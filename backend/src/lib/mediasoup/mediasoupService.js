import * as mediasoup from 'mediasoup';
import { mediasoupConfig } from './mediasoupConfig.js';
import * as sdpTransform from 'sdp-transform';

let worker;
let router;

// Initializes the global Mediasoup Worker and Router
export const initializeMediasoup = async () => {
  if (worker) return;
  
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

  const sdpObj = {
    version: 0,
    origin: {
      username: '-',
      sessionId: Date.now().toString(),
      sessionVersion: 2,
      netType: 'IN',
      ipVer: 4,
      address: process.env.MEDIASOUP_ANNOUNCED_IP || '8.8.8.8'
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
        port: 9,
        protocol: 'UDP/TLS/RTP/SAVPF',
        payloads: '111',
        connection: { version: 4, ip: process.env.MEDIASOUP_ANNOUNCED_IP || '8.8.8.8' },
        rtcp: { port: 9, netType: 'IN', ipVer: 4, address: process.env.MEDIASOUP_ANNOUNCED_IP || '8.8.8.8' },
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
        candidates: iceCandidates.map(c => ({
          foundation: c.foundation,
          component: c.component,
          transport: c.protocol.toLowerCase(),
          priority: c.priority,
          ip: c.ip === '127.0.0.1' ? '8.8.8.8' : c.ip,
          port: c.port,
          type: c.type,
          tcpType: c.tcpType
        }))
      }
    ]
  };

  return sdpTransform.write(sdpObj);
};

export const getRouter = () => router;

export const processMetaSdpAnswer = async (transport, sdpAnswerText) => {
  const parsed = sdpTransform.parse(sdpAnswerText);
  const media = parsed.media[0];
  const fingerprint = media.fingerprint || parsed.fingerprint;
  
  const dtlsParameters = {
    role: 'auto',
    fingerprints: [
      {
        algorithm: fingerprint.type,
        value: fingerprint.hash
      }
    ]
  };
  
  await transport.connect({ dtlsParameters });
  
  const rtpParameters = {
    codecs: [
      {
        mimeType: 'audio/' + media.rtp[0].codec,
        payloadType: media.rtp[0].payload,
        clockRate: media.rtp[0].rate,
        channels: media.rtp[0].encoding || 1
      }
    ],
    encodings: [ { ssrc: 111111 } ],
    rtcp: { cname: 'meta-cname' }
  };
  
  const producer = await transport.produce({ kind: 'audio', rtpParameters });
  return producer;
};
