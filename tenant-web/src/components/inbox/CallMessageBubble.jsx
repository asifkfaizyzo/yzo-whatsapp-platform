import React, { useState, useRef, useEffect } from "react";
import {
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Play,
  Pause,
  Download,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Phone,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

export default function CallMessageBubble({ call, onCallContact }) {
  if (!call) return null;

  const isOutbound = call.direction === "BUSINESS_INITIATED";
  const isCompleted = call.status === "COMPLETED" || call.status === "ACCEPTED";
  const isMissed =
    call.status === "FAILED" ||
    call.status === "REJECTED" ||
    (!isCompleted && (call.status === "MISSED" || call.status === "NO_ANSWER"));
  const isInProgress = ["INITIATED", "RINGING", "DIALING", "CONNECTING"].includes(
    call.status
  );

  // Time formatting
  const callDate = call.createdAt ? new Date(call.createdAt) : new Date();
  const timeStr = !isNaN(callDate.getTime())
    ? callDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  // Recording
  const recording = (call.recordings || []).find(
    (r) => r.downloadStatus === "DOWNLOADED" && r.mediaUrl
  ) || (call.recordings || [])[0];

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
  const audioUrl = recording?.mediaUrl
    ? recording.mediaUrl.startsWith("http")
      ? recording.mediaUrl
      : `${backendUrl}${recording.mediaUrl}`
    : null;

  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(call.duration || 0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.warn("Playback error:", err));
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current) return;
    const seekTime = parseFloat(e.target.value);
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  // Transcript
  const transcript = (call.transcripts || [])[0];
  const [showTranscript, setShowTranscript] = useState(false);

  // Status Styling
  const getStatusBadge = () => {
    if (isCompleted) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Completed • {formatDuration(call.duration || audioDuration)}
        </span>
      );
    }
    if (isInProgress) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
          In Progress
        </span>
      );
    }
    if (call.status === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Declined
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        Missed Call
      </span>
    );
  };

  return (
    <div
      className={`flex w-full my-2 animate-in fade-in slide-in-from-bottom-1 duration-200 ${
        isOutbound ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`w-full max-w-[420px] rounded-2xl shadow-sm border p-3.5 transition-all ${
          isOutbound
            ? "bg-[#E7F8F0] border-emerald-200/90 rounded-tr-none text-[#111B21]"
            : "bg-white border-slate-200/90 rounded-tl-none text-[#111B21]"
        }`}
      >
        {/* Header: Call Type & Direction */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/5">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                isCompleted
                  ? "bg-[#075E54]/10 text-[#075E54]"
                  : isMissed
                  ? "bg-rose-100 text-rose-600"
                  : "bg-blue-100 text-blue-600"
              }`}
            >
              {isMissed ? (
                <PhoneMissed size={14} />
              ) : isOutbound ? (
                <PhoneOutgoing size={14} />
              ) : (
                <PhoneIncoming size={14} />
              )}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-[#111B21] flex items-center gap-1.5">
                <span>
                  {isMissed
                    ? "Missed WhatsApp Call"
                    : isOutbound
                    ? "Outgoing WhatsApp Call"
                    : "Incoming WhatsApp Call"}
                </span>
              </p>
              <div className="mt-0.5">{getStatusBadge()}</div>
            </div>
          </div>

          <div className="flex flex-col items-end shrink-0">
            <span className="text-[10px] text-[#667781] flex items-center gap-1">
              <FaWhatsapp className="text-[#25D366] text-[10px]" />
              {timeStr}
            </span>
          </div>
        </div>

        {/* Audio Recording Player (If recording exists) */}
        {audioUrl ? (
          <div className="mt-2.5 pt-1">
            <audio ref={audioRef} src={audioUrl} preload="metadata" />
            <div className="bg-white/80 rounded-xl p-2.5 border border-emerald-200/60 flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="w-8 h-8 rounded-full bg-[#075E54] hover:bg-[#064E47] text-white flex items-center justify-center shrink-0 shadow-xs transition hover:scale-105 active:scale-95"
                title={isPlaying ? "Pause Recording" : "Play Recording"}
              >
                {isPlaying ? (
                  <Pause size={14} className="fill-white" />
                ) : (
                  <Play size={14} className="fill-white ml-0.5" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <input
                  type="range"
                  min="0"
                  max={audioDuration || 1}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#075E54]"
                />
                <div className="flex justify-between items-center text-[10px] text-[#667781] mt-1 font-mono">
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(audioDuration)}</span>
                </div>
              </div>

              <a
                href={audioUrl}
                download={`${call.wacid || "whatsapp_call"}.ogg`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-[#667781] hover:text-[#075E54] hover:bg-black/5 transition shrink-0"
                title="Download Audio (.ogg)"
              >
                <Download size={14} />
              </a>
            </div>
          </div>
        ) : isCompleted ? (
          <div className="mt-2 text-[11px] text-[#667781] italic flex items-center gap-1.5">
            <Clock size={11} />
            <span>Call ended • Duration {formatDuration(call.duration)}</span>
          </div>
        ) : null}

        {/* AI Transcript Section */}
        {transcript && transcript.fullText && (
          <div className="mt-2 pt-1 border-t border-black/5">
            <button
              type="button"
              onClick={() => setShowTranscript((prev) => !prev)}
              className="w-full flex items-center justify-between text-[11px] font-semibold text-[#075E54] hover:text-[#064E47] py-1 transition"
            >
              <span className="flex items-center gap-1">
                <FileText size={12} />
                <span>AI Call Transcript</span>
                {transcript.detectedLanguage && (
                  <span className="uppercase text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded">
                    {transcript.detectedLanguage}
                  </span>
                )}
              </span>
              {showTranscript ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showTranscript && (
              <div className="mt-1.5 p-2.5 rounded-xl bg-white/90 border border-emerald-100 text-xs text-slate-700 leading-relaxed max-h-40 overflow-y-auto animate-in fade-in duration-150">
                <p className="whitespace-pre-wrap">{transcript.fullText}</p>
              </div>
            )}
          </div>
        )}

        {/* Call Back Button */}
        {onCallContact && (
          <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between">
            <button
              type="button"
              onClick={onCallContact}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#075E54] hover:text-[#064E47] hover:underline transition"
            >
              <Phone size={11} />
              <span>Call back</span>
            </button>

            {recording?.mediaUrl && (
              <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Recording ready
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
