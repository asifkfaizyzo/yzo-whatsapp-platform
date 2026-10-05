import { createWebRtcTransport, getRouter } from '../../lib/mediasoup/mediasoupService.js';
import prisma from '../../config/prisma.js';
import { mediasoupConfig } from '../../lib/mediasoup/mediasoupConfig.js';

// Maps call IDs to their Mediasoup transports and producers/consumers
export const activeCalls = new Map();
export const activeOutboundTransports = new Map();

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
      
      // Route audio to Meta
      if (callData.metaTransport) {
        const metaRtpCapabilities = {
          codecs: [{ mimeType: 'audio/opus', kind: 'audio', preferredPayloadType: 111, clockRate: 48000, channels: 2 }]
        };
        const metaConsumer = await callData.metaTransport.consume({
          producerId: producer.id,
          rtpCapabilities: metaRtpCapabilities,
          paused: false
        });
        callData.metaConsumer = metaConsumer;
        metaConsumer.on('transportclose', () => metaConsumer.close());
        metaConsumer.on('producerclose', () => metaConsumer.close());
      }

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
      const callData = activeCalls.get(callId);
      
      // The consumer receives what Meta's producer sends. 
      // This implies Meta's Connection B must already be producing audio.
      if (!callData || !callData.metaProducer) {
         // Wait or throw. For now we assume meta is producing.
         throw new Error('Meta producer not ready');
      }

      if (!router.canConsume({ producerId: callData.metaProducer.id, rtpCapabilities })) {
        throw new Error('Cannot consume');
      }

      if (!callData.recvTransport) throw new Error('Recv transport not found');

      const consumer = await callData.recvTransport.consume({
        producerId: callData.metaProducer.id,
        rtpCapabilities,
        paused: true
      });
      
      callData.consumer = consumer;

      consumer.on('transportclose', () => {
        consumer.close();
      });

      consumer.on('producerclose', () => {
        consumer.close();
      });

      callback({
        id: consumer.id,
        producerId: callData.metaProducer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters
      });
    } catch (err) {
      console.error(err);
      callback({ error: err.message });
    }
  });
  
  socket.on('resumeConsumer', async ({ callId }, callback) => {
    try {
       const callData = activeCalls.get(callId);
       if(callData?.consumer) {
          await callData.consumer.resume();
       }
       if(callback) callback({ success: true });
    } catch (err) {
       console.error(err);
       if(callback) callback({ error: err.message });
    }
  });

};
