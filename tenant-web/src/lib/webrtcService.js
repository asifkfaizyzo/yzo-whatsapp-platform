// WebRTC Service: Direct Peer-to-Peer Full-ICE connection between Browser and Meta WhatsApp Voice Gateway

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let audioElement = null;
let pendingRemoteAnswer = null;

const getOrCreateAudioElement = () => {
  if (typeof document === 'undefined') return null;
  if (!audioElement) {
    audioElement = document.getElementById('webrtc-remote-audio');
    if (!audioElement) {
      audioElement = document.createElement('audio');
      audioElement.id = 'webrtc-remote-audio';
      audioElement.autoplay = true;
      audioElement.playsInline = true;
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);
    }
  }
  return audioElement;
};

// Helper to wait for ICE candidates (host, srflx) to be gathered into localDescription.sdp
const waitForIceGathering = (pc, timeoutMs = 2000) => {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      return resolve();
    }
    const onStateChange = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', onStateChange);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', onStateChange);
    setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', onStateChange);
      resolve();
    }, timeoutMs);
  });
};

export const bindAudioElement = (element) => {
  if (element) {
    audioElement = element;
    if (remoteStream) {
      audioElement.srcObject = remoteStream;
      audioElement.play().catch(e => console.warn('Audio play notice:', e));
    }
  }
};

export const initiateOutboundCall = async () => {
  endCall();

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  peerConnection = pc;

  // Prime audio output
  const audio = getOrCreateAudioElement();
  if (audio) {
    audio.play().catch(() => {});
  }

  // 1. Get user microphone
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  // 2. Setup remote audio track handler
  pc.ontrack = (event) => {
    console.log('🔊 [WebRTC] Remote track received from Meta:', event.track);
    remoteStream = event.streams[0] || new MediaStream([event.track]);
    const targetAudio = getOrCreateAudioElement();
    if (targetAudio) {
      targetAudio.srcObject = remoteStream;
      targetAudio.volume = 1.0;
      targetAudio.autoplay = true;
      targetAudio.play().catch(e => console.warn('Audio auto-play notice:', e));
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log('🌐 [WebRTC] ICE Connection State:', pc.iceConnectionState);
  };
  pc.onconnectionstatechange = () => {
    console.log('🔗 [WebRTC] PeerConnection State:', pc.connectionState);
  };

  // 3. Create Offer
  const offer = await pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: false
  });
  await pc.setLocalDescription(offer);

  // 4. Wait for ICE candidate gathering
  await waitForIceGathering(pc);

  console.log('✅ [WebRTC] Outbound SDP Offer ready for Meta');

  if (pendingRemoteAnswer) {
    const ans = pendingRemoteAnswer;
    pendingRemoteAnswer = null;
    await handleRemoteAnswer(ans);
  }

  return pc.localDescription.sdp;
};

export const handleRemoteAnswer = async (sdpAnswer) => {
  if (!sdpAnswer) return;
  if (!peerConnection) {
    console.log('⏳ [WebRTC] PeerConnection not initialized yet, caching remote answer');
    pendingRemoteAnswer = sdpAnswer;
    return;
  }
  try {
    if (peerConnection.signalingState === 'have-local-offer') {
      console.log('📥 [WebRTC] Applying Meta SDP Answer to PeerConnection');
      await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sdpAnswer }));
      console.log('✅ [WebRTC] Remote description applied successfully. ICE State:', peerConnection.iceConnectionState);
    }
  } catch (err) {
    console.error('❌ [WebRTC] Error setting remote description:', err);
  }
};

export const acceptIncomingCall = async (sdpOffer) => {
  endCall();

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  peerConnection = pc;

  // Prime audio output
  const audio = getOrCreateAudioElement();
  if (audio) {
    audio.play().catch(() => {});
  }

  // 1. Get microphone
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  // 2. Setup remote audio track handler
  pc.ontrack = (event) => {
    console.log('🔊 [WebRTC] Remote track received from Meta:', event.track);
    remoteStream = event.streams[0] || new MediaStream([event.track]);
    const targetAudio = getOrCreateAudioElement();
    if (targetAudio) {
      targetAudio.srcObject = remoteStream;
      targetAudio.volume = 1.0;
      targetAudio.autoplay = true;
      targetAudio.play().catch(e => console.warn('Audio auto-play notice:', e));
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log('🌐 [WebRTC] ICE Connection State:', pc.iceConnectionState);
  };
  pc.onconnectionstatechange = () => {
    console.log('🔗 [WebRTC] PeerConnection State:', pc.connectionState);
  };

  // 3. Set remote offer from Meta
  await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdpOffer }));

  // 4. Create answer
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  // 5. Wait for ICE gathering
  await waitForIceGathering(pc);

  console.log('✅ [WebRTC] Inbound SDP Answer ready for Meta');
  return pc.localDescription.sdp;
};

export const muteMic = (muted) => {
  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !muted;
    });
  }
};

export const endCall = () => {
  pendingRemoteAnswer = null;
  if (peerConnection) {
    try { peerConnection.close(); } catch (_) {}
    peerConnection = null;
  }
  if (localStream) {
    try { localStream.getTracks().forEach(t => t.stop()); } catch (_) {}
    localStream = null;
  }
  if (audioElement) {
    audioElement.srcObject = null;
  }
  remoteStream = null;
};
