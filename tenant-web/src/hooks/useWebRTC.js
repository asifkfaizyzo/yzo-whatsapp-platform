import { useRef, useEffect } from 'react';
import * as webrtcService from '../lib/webrtcService';

export const useWebRTC = () => {
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (remoteAudioRef.current) {
      webrtcService.bindAudioElement(remoteAudioRef.current);
    }
  }, []);

  return {
    remoteAudioRef,
    initiateOutboundCall: webrtcService.initiateOutboundCall,
    handleRemoteAnswer: webrtcService.handleRemoteAnswer,
    acceptIncomingCall: webrtcService.acceptIncomingCall,
    muteMic: webrtcService.muteMic,
    endCall: webrtcService.endCall
  };
};
