import { createWebRtcTransport, getRouter } from '../../lib/mediasoup/mediasoupService.js';
import prisma from '../../config/prisma.js';
import { mediasoupConfig } from '../../lib/mediasoup/mediasoupConfig.js';

// Maps call IDs to their Mediasoup transports and producers/consumers
export const activeCalls = new Map();
export const activeOutboundTransports = new Map();

// Helper to route Agent's mic to Meta's WebRTC stream
export const bridgeAgentToMeta = async (callData) => {
  if (callData?.metaTransport && callData?.producer && !callData?.metaConsumer) {
    try {
      const metaRtpCapabilities = {
        codecs: [{ mimeType: 'audio/opus', kind: 'audio', preferredPayloadType: 111, clockRate: 48000, channels: 2 }]
      };
      const metaConsumer = await callData.metaTransport.consume({
        producerId: callData.producer.id,
        rtpCapabilities: metaRtpCapabilities,
        paused: false
      });
      callData.metaConsumer = metaConsumer;
      metaConsumer.on('transportclose', () => { callData.metaConsumer = null; });
      metaConsumer.on('producerclose', () => { callData.metaConsumer = null; });
      console.log('✅ [MediaBridge] Agent audio successfully routed to Meta');
    } catch (e) {
      console.error('❌ [MediaBridge] Failed to route Agent audio to Meta:', e.message);
    }
  }
};

export const registerCallSocketHandlers = (socket, io) => {
  
  // 1. Get Router RTP Capabilities (Browser needs this to configure its local device)
  socket.on('getRouterRtpCapabilities', (callback) => {
    try {
      const router = getRouter();
      if (!router) throw new Error('Router not ready');
      callback({ rtpCapabilities: router.rtpCapabilities });
    } catch (err) {
      console.error(err);
      callback({ error: err.message });
    }
  });

  // 2. Create WebRTC Transport for Browser (Connection A)
  socket.on('createWebRtcTransport', async ({ callId, direction }, callback) => {
    try {
      const { transport, params } = await createWebRtcTransport();
      
      if (!activeCalls.has(callId)) {
        activeCalls.set(callId, {
          sendTransport: null,
          recvTransport: null,
          metaTransport: null,
          metaProducer: null,
          metaConsumer: null,
          producer: null,
          consumer: null
        });
      }
      
      const callData = activeCalls.get(callId);
      if (direction === 'send') {
        callData.sendTransport = transport;
      } else {
        callData.recvTransport = transport;
      }

      transport.on('dtlsstatechange', dtlsState => {
        if (dtlsState === 'closed') {
          // Cleanup
          activeCalls.delete(callId);
        }
      });

      callback(params);
    } catch (err) {
      console.error(err);
      callback({ error: err.message });
    }
  });

  // 3. Connect Transport (DTLS parameters from Browser)
  socket.on('connectTransport', async ({ callId, dtlsParameters, direction }, callback) => {
    try {
      const callData = activeCalls.get(callId);
      const transport = direction === 'send' ? callData?.sendTransport : callData?.recvTransport;
      
      if (!transport) throw new Error(`Transport not found for direction: ${direction}`);

      await transport.connect({ dtlsParameters });
      callback({ success: true });
    } catch (err) {
      console.error(err);
      callback({ error: err.message });
    }
  });

  // 4. Produce Media (Browser sending mic audio)
  socket.on('produce', async ({ callId, kind, rtpParameters }, callback) => {
    try {
      const callData = activeCalls.get(callId);
      if (!callData || !callData.sendTransport) throw new Error('Send transport not found');

      const producer = await callData.sendTransport.produce({ kind, rtpParameters });
      callData.producer = producer;

      producer.on('transportclose', () => {
        producer.close();
      });
      
      // Route audio to Meta if metaTransport is already established
      await bridgeAgentToMeta(callData);

      callback({ id: producer.id });
    } catch (err) {
      console.error(err);
      callback({ error: err.message });
    }
  });

  // 5. Consume Media (Browser receiving audio from Meta)
  socket.on('consume', async ({ callId, rtpCapabilities }, callback) => {
    try {
      const router = getRouter();
      let callData = activeCalls.get(callId);
      
      // Wait for metaProducer if not ready yet (up to 4 seconds)
      if (!callData || !callData.metaProducer) {
        console.log(`[Socket] Waiting for metaProducer on call ${callId}...`);
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 200));
          callData = activeCalls.get(callId);
          if (callData?.metaProducer) break;
        }
      }

      if (!callData || !callData.metaProducer) {
        throw new Error('Meta audio stream not ready yet');
      }

      if (!router.canConsume({ producerId: callData.metaProducer.id, rtpCapabilities })) {
        throw new Error('Cannot consume Meta audio');
      }

      if (!callData.recvTransport) throw new Error('Recv transport not found');

      const consumer = await callData.recvTransport.consume({
        producerId: callData.metaProducer.id,
        rtpCapabilities,
        paused: false // start immediately
      });
      
      callData.consumer = consumer;

      consumer.on('transportclose', () => {
        consumer.close();
      });

      consumer.on('producerclose', () => {
        consumer.close();
      });

      console.log(`✅ [MediaBridge] Customer audio routed to browser (call: ${callId})`);

      callback({
        id: consumer.id,
        producerId: callData.metaProducer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters
      });
    } catch (err) {
      console.error('Consume error:', err.message);
      callback({ error: err.message });
    }
  });
  
  socket.on('resumeConsumer', async ({ callId }, callback) => {
    try {
       const callData = activeCalls.get(callId);
       if (callData?.consumer) {
          await callData.consumer.resume();
       }
       if (callback) callback({ success: true });
    } catch (err) {
       console.error(err);
       if (callback) callback({ error: err.message });
    }
  });

};
