import { useState, useRef, useCallback } from 'react';
import { Device } from 'mediasoup-client';
import { getSocket } from '../lib/socket';

export const useWebRTC = () => {
  const [device, setDevice] = useState(null);
  const [sendTransport, setSendTransport] = useState(null);
  const [recvTransport, setRecvTransport] = useState(null);
  const [producer, setProducer] = useState(null);
  const [consumer, setConsumer] = useState(null);

  const localMediaStream = useRef(null);
  const remoteAudioRef = useRef(new Audio());

  const initDevice = useCallback(async () => {
    const socket = getSocket();
    if (!socket) throw new Error('Socket not connected');

    return new Promise((resolve, reject) => {
      socket.emit('getRouterRtpCapabilities', async (response) => {
        if (response.error) return reject(new Error(response.error));
        
        try {
          const newDevice = new Device();
          await newDevice.load({ routerRtpCapabilities: response.rtpCapabilities });
          setDevice(newDevice);
          resolve(newDevice);
        } catch (error) {
          reject(error);
        }
      });
    });
  }, []);

  const createTransports = useCallback(async (currentDevice, callId) => {
    const socket = getSocket();
    if (!socket || !currentDevice) return;

    // 1. Send Transport (Mic to Server)
    const sendParams = await new Promise((resolve, reject) => {
      socket.emit('createWebRtcTransport', { callId, direction: 'send' }, (res) => {
        if (res.error) reject(new Error(res.error));
        resolve(res);
      });
    });

    const sendTx = currentDevice.createSendTransport(sendParams);

    sendTx.on('connect', ({ dtlsParameters }, callback, errback) => {
      socket.emit('connectTransport', { callId, dtlsParameters, direction: 'send' }, (res) => {
        if (res.error) errback(res.error);
        else callback();
      });
    });

    sendTx.on('produce', ({ kind, rtpParameters }, callback, errback) => {
      socket.emit('produce', { callId, kind, rtpParameters }, (res) => {
        if (res.error) errback(res.error);
        else callback({ id: res.id });
      });
    });

    setSendTransport(sendTx);

    // 2. Recv Transport (Server to Speaker)
    const recvParams = await new Promise((resolve, reject) => {
      socket.emit('createWebRtcTransport', { callId, direction: 'recv' }, (res) => {
        if (res.error) reject(new Error(res.error));
        resolve(res);
      });
    });

    const recvTx = currentDevice.createRecvTransport(recvParams);

    recvTx.on('connect', ({ dtlsParameters }, callback, errback) => {
      socket.emit('connectTransport', { callId, dtlsParameters, direction: 'recv' }, (res) => {
        if (res.error) errback(res.error);
        else callback();
      });
    });

    setRecvTransport(recvTx);

    return { sendTx, recvTx };
  }, []);

  const startProducing = useCallback(async (sendTx) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localMediaStream.current = stream;
      const track = stream.getAudioTracks()[0];
      
      const newProducer = await sendTx.produce({ track });
      setProducer(newProducer);
    } catch (err) {
      console.error('Microphone error:', err);
    }
  }, []);

  const startConsuming = useCallback(async (currentDevice, recvTx, callId) => {
    const socket = getSocket();
    if (!socket || !currentDevice || !recvTx) return;

    socket.emit('consume', { callId, rtpCapabilities: currentDevice.rtpCapabilities }, async (res) => {
      if (res.error) {
        console.error('Consume error:', res.error);
        return;
      }

      const newConsumer = await recvTx.consume({
        id: res.id,
        producerId: res.producerId,
        kind: res.kind,
        rtpParameters: res.rtpParameters
      });

      setConsumer(newConsumer);

      // Play audio
      const { track } = newConsumer;
      const remoteStream = new MediaStream([track]);
      remoteAudioRef.current.srcObject = remoteStream;
      await remoteAudioRef.current.play();

      // Tell backend to resume the stream
      socket.emit('resumeConsumer', { callId });
    });
  }, []);

  const endCall = useCallback(() => {
    if (producer) producer.close();
    if (consumer) consumer.close();
    if (sendTransport) sendTransport.close();
    if (recvTransport) recvTransport.close();
    
    if (localMediaStream.current) {
      localMediaStream.current.getTracks().forEach(track => track.stop());
    }
    
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setDevice(null);
    setSendTransport(null);
    setRecvTransport(null);
    setProducer(null);
    setConsumer(null);
  }, [producer, consumer, sendTransport, recvTransport]);

  return {
    device,
    initDevice,
    createTransports,
    startProducing,
    startConsuming,
    endCall
  };
};
