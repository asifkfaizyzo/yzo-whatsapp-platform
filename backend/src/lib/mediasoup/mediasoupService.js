import * as mediasoup from 'mediasoup';
import { mediasoupConfig, getAnnouncedIp, setAnnouncedIp } from './mediasoupConfig.js';
import * as sdpTransform from 'sdp-transform';

let worker;
let router;

// Initializes the global Mediasoup Worker and Router
export const initializeMediasoup = async () => {
  if (worker) return;

  // Auto-detect public IP if not explicitly configured in environment
  if (!process.env.MEDIASOUP_ANNOUNCED_IP) {
    try {
      const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      if (data?.ip) {
        setAnnouncedIp(data.ip);
        console.log(`🌐 [Mediasoup] Auto-detected public IP: ${data.ip}`);
      }
    } catch (e) {
      console.log(`ℹ️ [Mediasoup] Using default announced IP: ${getAnnouncedIp()}`);
    }
  } else {
    console.log(`🌐 [Mediasoup] Using configured announced IP: ${process.env.MEDIASOUP_ANNOUNCED_IP}`);
  }
  
  worker = await mediasoup.createWorker({
    logLevel: mediasoupConfig.worker.logLevel,
    logTags: mediasoupConfig.worker.logTags,
    rtcMinPort: mediasoupConfig.worker.rtcMinPort,
    rtcMaxPort: mediasoupConfig.worker.rtcMaxPort,
  });

  worker.on('died', () => {
    console.error('Mediasoup worker died, exiting in 2 seconds...');
    setTimeout(() => process.exit(1), 2000);
  });

  router = await worker.createRouter({
    mediaCodecs: mediasoupConfig.router.mediaCodecs
  });

  console.log('✅ Mediasoup Worker & Router initialized for WhatsApp Calling');
  return { worker, router };
};

// Generates a WebRtcTransport for either the Browser or Meta
export const createWebRtcTransport = async () => {
  if (!router) throw new Error('Mediasoup router not initialized');

  const transport = await router.createWebRtcTransport({
    listenIps: mediasoupConfig.webRtcTransport.listenIps,
    enableUdp: mediasoupConfig.webRtcTransport.enableUdp,
    enableTcp: mediasoupConfig.webRtcTransport.enableTcp,
    preferUdp: mediasoupConfig.webRtcTransport.preferUdp,
    initialAvailableOutgoingBitrate: mediasoupConfig.webRtcTransport.initialAvailableOutgoingBitrate,
  });

  transport.on('dtlsstatechange', dtlsState => {
    if (dtlsState === 'closed' || dtlsState === 'failed') {
      transport.close();
    }
  });

  transport.on('icestatechange', iceState => {
    if (iceState === 'disconnected' || iceState === 'closed') {
      transport.close();
    }
  });

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters
    }
  };
};

// Generates a standard SDP string for Meta to consume from Mediasoup Transport parameters
export const generateMetaSdp = (transportParams, type = 'answer') => {
  const { iceParameters, iceCandidates, dtlsParameters } = transportParams;
  const sha256Fingerprint = dtlsParameters.fingerprints.find(f => f.algorithm === 'sha-256') || dtlsParameters.fingerprints[0];
  const publicIp = getAnnouncedIp();
  const mediaPort = iceCandidates[0]?.port || 40000;

  // Ensure candidates have component: 1 (RTP) to avoid NaN in SDP output
  const candidates = (iceCandidates || [])
    .filter(c => c.protocol && c.port)
    .sort((a, b) => (a.protocol.toLowerCase() === 'udp' ? -1 : 1))
    .map((c, idx) => {
      const candIp = (!c.ip || c.ip === '127.0.0.1' || c.ip === '0.0.0.0' || c.ip.startsWith('172.') || c.ip.startsWith('10.')) ? publicIp : c.ip;
      return {
        foundation: c.foundation || String(idx + 1),
        component: 1, // Standard RFC 5245 component 1 for RTP
        transport: c.protocol.toLowerCase(),
        priority: c.priority || (2130706431 - idx),
        ip: candIp,
        port: c.port,
        type: c.type || 'host',
        ...(c.tcpType ? { tcpType: c.tcpType } : {})
      };
    });

  const sdpObj = {
    version: 0,
    origin: {
      username: '-',
      sessionId: Date.now().toString(),
      sessionVersion: 2,
      netType: 'IN',
      ipVer: 4,
      address: publicIp
    },
    name: '-',
    msidSemantic: { semantic: 'WMS', token: '*' },
    timing: { start: 0, stop: 0 },
    groups: [{ type: 'BUNDLE', mids: '0' }],
    media: [
      {
        rtp: [
          { payload: 111, codec: 'opus', rate: 48000, encoding: 2 }
        ],
        fmtp: [
          { payload: 111, config: 'minptime=10;useinbandfec=1' }
        ],
        type: 'audio',
        port: mediaPort,
        protocol: 'UDP/TLS/RTP/SAVPF',
        payloads: '111',
        connection: { version: 4, ip: publicIp },
        rtcp: { port: mediaPort, netType: 'IN', ipVer: 4, address: publicIp },
        mid: '0',
        msid: [{ id: '-', appdata: '-' }],
        ext: [{ value: 1, uri: 'urn:ietf:params:rtp-hdrext:ssrc-audio-level' }],
        setup: type === 'answer' ? 'active' : 'actpass',
        direction: 'sendrecv',
        rtcpMux: 'rtcp-mux',
        iceOptions: 'lite',
        iceUfrag: iceParameters.usernameFragment,
        icePwd: iceParameters.password,
        fingerprint: {
          type: sha256Fingerprint.algorithm,
          hash: sha256Fingerprint.value.toUpperCase()
        },
        candidates
      }
    ]
  };

  return sdpTransform.write(sdpObj);
};

export const getRouter = () => router;

export const processMetaSdpAnswer = async (transport, sdpAnswerText) => {
  const parsed = sdpTransform.parse(sdpAnswerText);
  const media = parsed.media?.[0] || parsed.media;
  if (!media) throw new Error('No media section in Meta SDP');

  const fingerprint = media.fingerprint || parsed.fingerprint;
  if (!fingerprint) throw new Error('No fingerprint in Meta SDP');
  
  let role = 'auto';
  if (media.setup === 'active') role = 'server';
  else if (media.setup === 'passive') role = 'client';
  else if (media.setup === 'actpass') role = 'client';

  const dtlsParameters = {
    role,
    fingerprints: [
      {
        algorithm: fingerprint.type,
        value: fingerprint.hash
      }
    ]
  };
  
  try {
    await transport.connect({ dtlsParameters });
  } catch (err) {
    if (!err.message?.includes('already called')) {
      throw err;
    }
  }
  
  const metaMid = media.mid || '0';
  const opusRtp = media.rtp?.find(r => r.codec.toLowerCase() === 'opus') || media.rtp?.[0] || { payload: 111, rate: 48000, encoding: 2 };
  const metaSsrc = media.ssrcs?.[0]?.id || (media.ssrc ? parseInt(media.ssrc) : undefined);
  const encodings = metaSsrc ? [{ ssrc: metaSsrc }] : [{}];

  const rtpParameters = {
    mid: metaMid,
    codecs: [
      {
        mimeType: 'audio/opus',
        payloadType: opusRtp.payload,
        clockRate: opusRtp.rate || 48000,
        channels: opusRtp.encoding || 2,
        parameters: {
          useinbandfec: 1,
          minptime: 10,
          ptime: 20
        }
      }
    ],
    encodings,
    rtcp: { cname: media.ssrcs?.[0]?.value || 'meta-call' }
  };
  
  const producer = await transport.produce({ kind: 'audio', rtpParameters });
  return producer;
};
