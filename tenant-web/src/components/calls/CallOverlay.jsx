import React, { useEffect, useState } from 'react';
import { useCallStore } from '../../store/useCallStore';
import { useWebRTC } from '../../hooks/useWebRTC';
import api from '../../lib/axios';
import { Phone, PhoneOff, Mic, MicOff, User, Lock } from 'lucide-react';
import { useWhatsAppStore } from '../../store/useWhatsAppStore';

export default function CallOverlay() {
  const { activeCall, updateCallStatus, clearCall } = useCallStore();
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const { acceptIncomingCall, handleRemoteAnswer, muteMic, endCall, remoteAudioRef } = useWebRTC();
  const phoneId = useWhatsAppStore(s => s.wabaData?.phone_numbers?.data?.[0]?.id);

  // Apply Meta SDP answer whenever received
  useEffect(() => {
    if (activeCall?.sdpAnswer) {
      handleRemoteAnswer(activeCall.sdpAnswer);
    }
  }, [activeCall?.sdpAnswer]);

  // Duration timer when call is active
  useEffect(() => {
    let interval;
    if (activeCall?.status === 'ACCEPTED') {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [activeCall?.status]);

  const handleAccept = async () => {
    try {
      updateCallStatus('ACCEPTING...');
      let sdpAnswer = null;
      if (activeCall.sdpOffer) {
        sdpAnswer = await acceptIncomingCall(activeCall.sdpOffer);
      }
      await api.post('/whatsapp/calls/accept', {
        wacid: activeCall.wacid,
        phoneId: phoneId,
        ...(sdpAnswer && { sdpAnswer })
      });
      updateCallStatus('ACCEPTED');
    } catch (err) {
      console.error('Accept error:', err);
      updateCallStatus('FAILED');
      setTimeout(clearCall, 2000);
    }
  };

  const handleReject = async () => {
    try {
      await api.post('/whatsapp/calls/reject', {
        wacid: activeCall.wacid,
        phoneId: phoneId
      });
    } catch (err) {
      console.warn('Reject error:', err);
    } finally {
      clearCall();
    }
  };

  const handleTerminate = async () => {
    try {
      await api.post('/whatsapp/calls/terminate', {
        wacid: activeCall.wacid,
        phoneId: phoneId
      });
    } catch (err) {
      console.warn('Terminate error:', err);
    } finally {
      endCall();
      clearCall();
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    muteMic(next);
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!activeCall) return null;

  const isInboundRinging = activeCall.status === 'RINGING' && activeCall.direction === 'USER_INITIATED';
  const isOutboundDialing = ['DIALING', 'RINGING', 'CONNECTING'].includes(activeCall.status) && activeCall.direction === 'BUSINESS_INITIATED';
  const isDeclined = activeCall.status === 'REJECTED';
  const isEnded = ['COMPLETED', 'TERMINATED', 'ENDED'].includes(activeCall.status);
  const isFailed = activeCall.status === 'FAILED';
  const isAccepted = activeCall.status === 'ACCEPTED';

  const displayName = activeCall.name || activeCall.fromNumber || activeCall.contactId || 'WhatsApp User';
  const displaySubtitle = activeCall.name && activeCall.fromNumber ? activeCall.fromNumber : null;

  return (
    <div className="fixed bottom-6 right-6 w-[340px] bg-[#111b21] rounded-2xl shadow-2xl overflow-hidden z-[9999] border border-[#222e35] text-[#e9edef] animate-in slide-in-from-bottom-6 duration-300 font-sans select-none">
      
      {/* Hidden WebRTC Audio Output Element */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Top Header - WhatsApp Encryption Tag */}
      <div className="pt-3 px-4 flex items-center justify-center gap-1.5 text-[11px] text-[#8696a0] tracking-wide">
        <Lock className="w-3 h-3 text-[#00a884]" />
        <span>End-to-end encrypted</span>
      </div>

      {/* Main Avatar & Contact Info */}
      <div className="pt-6 pb-6 px-6 flex flex-col items-center justify-center text-center">
        {/* Avatar with pulse ring during ringing */}
        <div className="relative mb-4">
          {isInboundRinging && (
            <div className="absolute inset-0 rounded-full bg-[#00a884]/30 animate-ping" />
          )}
          {isOutboundDialing && (
            <div className="absolute inset-0 rounded-full bg-[#53bdeb]/20 animate-pulse" />
          )}
          <div className="w-20 h-20 rounded-full bg-[#202c33] border-2 border-[#2a3942] flex items-center justify-center shadow-lg relative z-10 overflow-hidden">
            {activeCall.avatar ? (
              <img src={activeCall.avatar} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-[#8696a0]" />
            )}
          </div>
        </div>

        {/* Contact Name */}
        <h3 className="font-semibold text-lg text-[#e9edef] leading-tight mb-1 truncate max-w-[280px]">
          {displayName}
        </h3>

        {/* Secondary phone number (if name is shown) */}
        {displaySubtitle && (
          <p className="text-xs text-[#8696a0] mb-1 font-mono">
            {displaySubtitle}
          </p>
        )}

        {/* Dynamic Status Display */}
        <div className="mt-1 flex items-center justify-center gap-2">
          {isInboundRinging && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00a884]">
              <span className="w-2 h-2 rounded-full bg-[#00a884] animate-ping" />
              Incoming WhatsApp Call
            </span>
          )}

          {isOutboundDialing && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#8696a0]">
              <span className="w-2 h-2 rounded-full bg-[#53bdeb] animate-pulse" />
              Calling...
            </span>
          )}

          {isAccepted && (
            <span className="inline-flex items-center gap-1.5 text-sm font-mono text-[#00a884] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#00a884]" />
              {formatDuration(callDuration)}
            </span>
          )}

          {isDeclined && (
            <span className="text-xs font-medium text-[#ea4335]">
              Call Declined
            </span>
          )}

          {isEnded && (
            <span className="text-xs text-[#8696a0]">
              Call Ended
            </span>
          )}

          {isFailed && (
            <span className="text-xs font-medium text-[#ea4335]">
              Call Failed
            </span>
          )}
        </div>
      </div>

      {/* Action Controls Bar */}
      <div className="px-6 pb-6 pt-2 flex items-center justify-center gap-6 bg-[#111b21]">
        {isInboundRinging ? (
          <>
            {/* Decline Call Button */}
            <button
              onClick={handleReject}
              className="w-14 h-14 rounded-full bg-[#ea4335] hover:bg-[#d93025] active:scale-95 transition-all flex items-center justify-center text-white shadow-lg cursor-pointer"
              title="Decline"
            >
              <PhoneOff className="w-6 h-6" />
            </button>

            {/* Accept Call Button */}
            <button
              onClick={handleAccept}
              className="w-14 h-14 rounded-full bg-[#00a884] hover:bg-[#02906f] active:scale-95 transition-all flex items-center justify-center text-white shadow-lg cursor-pointer animate-pulse"
              title="Accept"
            >
              <Phone className="w-6 h-6 fill-current" />
            </button>
          </>
        ) : (
          <>
            {/* Mute Button */}
            <button
              onClick={toggleMute}
              disabled={!isAccepted}
              className={`w-12 h-12 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                isMuted
                  ? 'bg-[#ea4335] text-white shadow-md'
                  : 'bg-[#202c33] hover:bg-[#2a3942] text-[#e9edef]'
              } ${!isAccepted ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* End Call Button */}
            <button
              onClick={handleTerminate}
              className="w-14 h-14 rounded-full bg-[#ea4335] hover:bg-[#d93025] active:scale-95 transition-all flex items-center justify-center text-white shadow-lg cursor-pointer"
              title="End Call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

    </div>
  );
}
