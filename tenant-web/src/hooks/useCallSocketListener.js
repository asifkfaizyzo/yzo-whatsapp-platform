import { useEffect } from 'react';
import { getSocket } from '../lib/socket';
import { useCallStore } from '../store/useCallStore';
import { useToast } from '../context/ToastContext';
import { useAuthStore } from '../store/useAuthStore';
import * as webrtcService from '../lib/webrtcService';
import { stopRingtone } from '../lib/ringtoneService';

export const useCallSocketListener = () => {
  const { setCall, updateCallStatus, clearCall } = useCallStore();
  const { showToast } = useToast();
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const tenantId = user?.type === 'TENANT' ? user?.id : user?.tenantId;
    if (tenantId) {
      socket.emit('join_tenant', tenantId);
    }

    const onIncomingCall = (data) => {
      console.log('Incoming WhatsApp Call:', data);
      setCall({
        wacid: data.wacid,
        fromNumber: data.fromNumber,
        direction: 'USER_INITIATED',
        status: 'RINGING',
        ctaPayload: data.ctaPayload,
        sdpOffer: data.sdpOffer || null
      });
      // Play a ringing sound in a real app
    };

    const onCallStatusUpdate = (data) => {
      console.log('Call Status Update:', data);
      if (!data) return;
      const raw = data.status ? String(data.status).toUpperCase() : '';
      let normalized = raw;
      if (['REJECTED', 'USER_REJECTED', 'DECLINED', 'BUSY'].includes(raw)) {
        normalized = 'REJECTED';
      } else if (['COMPLETED', 'TERMINATE', 'TERMINATED', 'ENDED'].includes(raw)) {
        normalized = 'COMPLETED';
      } else if (['FAILED', 'TIMEOUT', 'CANCELED', 'MISSED'].includes(raw)) {
        normalized = 'FAILED';
      }

      updateCallStatus(normalized, data.wacid, {
        ...(data.sdpAnswer && { sdpAnswer: data.sdpAnswer })
      });

      if (data.sdpAnswer) {
        webrtcService.handleRemoteAnswer(data.sdpAnswer);
      }
      
      if (['COMPLETED', 'FAILED', 'REJECTED'].includes(normalized)) {
        webrtcService.endCall();
        stopRingtone();
        setTimeout(() => {
          clearCall();
        }, 3000); // clear after 3s so user sees 'Call Ended' or 'Call Declined'
      }
    };

    socket.on('incoming_whatsapp_call', onIncomingCall);
    socket.on('call_status_update', onCallStatusUpdate);

    return () => {
      socket.off('incoming_whatsapp_call', onIncomingCall);
      socket.off('call_status_update', onCallStatusUpdate);
    };
  }, [setCall, updateCallStatus, clearCall, showToast]);
};
