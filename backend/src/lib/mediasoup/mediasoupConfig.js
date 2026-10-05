import os from 'os';

export const mediasoupConfig = {
  worker: {
    rtcMinPort: process.env.MEDIASOUP_MIN_PORT ? parseInt(process.env.MEDIASOUP_MIN_PORT) : 40000,
    rtcMaxPort: process.env.MEDIASOUP_MAX_PORT ? parseInt(process.env.MEDIASOUP_MAX_PORT) : 40200,
    logLevel: 'warn',
    logTags: [
      'info',
      'ice',
      'dtls',
      'rtp',
      'srtp',
      'rtcp'
    ],
  },
  router: {
    // ═══════════════════════════════════════════════════════════
    // META WHATSAPP RTP CAPABILITIES (Strictly Enforced)
    // ═══════════════════════════════════════════════════════════
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          useinbandfec: 1,
          minptime: 10,
          ptime: 20
        }
      },
      {
        kind: 'audio',
        mimeType: 'audio/telephone-event',
        clockRate: 8000
      }
    ]
  },
  webRtcTransport: {
    // Meta requires our gateway to be controlling/ice-full, but Mediasoup's PlainTransport 
    // or WebRtcTransport will handle the negotiation. 
    // Listen IPs must be public if deployed, local for dev.
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || null
      }
    ],
    initialAvailableOutgoingBitrate: 800000,
    maxSctpMessageSize: 262144,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  }
};
