import React, { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  Phone,
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
  RefreshCw,
  Search,
} from "lucide-react";

export default function ContactCallsDrawer({
  contact,
  calls = [],
  loading = false,
  onBack,
  onInitiateCall,
  onRefresh,
}) {
  const [filter, setFilter] = useState("all"); // 'all' | 'recordings' | 'missed'
  const [activePlayingId, setActivePlayingId] = useState(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [expandedTranscriptId, setExpandedTranscriptId] = useState(null);

  const audioRef = useRef(new Audio());

  useEffect(() => {
    const audio = audioRef.current;

    const onTimeUpdate = () => {
      setAudioProgress(audio.currentTime);
      setAudioDuration(audio.duration || 0);
    };

    const onEnded = () => {
      setActivePlayingId(null);
      setAudioProgress(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const handleTogglePlay = (wacid, mediaUrl) => {
    const audio = audioRef.current;
    if (activePlayingId === wacid) {
      audio.pause();
      setActivePlayingId(null);
      return;
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || "";
    const fullAudioUrl = mediaUrl.startsWith("http")
      ? mediaUrl
      : `${backendUrl}${mediaUrl}`;

    audio.src = fullAudioUrl;
    audio
      .play()
      .then(() => setActivePlayingId(wacid))
      .catch((err) => console.warn("Audio playback error:", err));
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    const isToday = new Date().toDateString() === d.toDateString();
    if (isToday) {
      return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  // Filter calls
  const filteredCalls = calls.filter((c) => {
    const hasRecording = (c.recordings || []).some(
      (r) => r.mediaUrl && r.downloadStatus === "DOWNLOADED"
    );
    const isMissed =
      c.status === "FAILED" ||
      c.status === "REJECTED" ||
      c.status === "MISSED" ||
      c.status === "NO_ANSWER";

    if (filter === "recordings") return hasRecording;
    if (filter === "missed") return isMissed;
    return true;
  });

  // Calculate quick stats
  const totalCalls = calls.length;
  const answeredCalls = calls.filter(
    (c) => c.status === "COMPLETED" || c.status === "ACCEPTED"
  ).length;
  const recordingsCount = calls.filter((c) =>
    (c.recordings || []).some((r) => r.mediaUrl)
  ).length;
  const totalSeconds = calls.reduce((acc, c) => acc + (c.duration || 0), 0);

  return (
    <div className="flex flex-col h-full bg-[#F0F2F5] animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="p-4 bg-[#075E54] text-white flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 rounded-full hover:bg-white/10 transition"
            title="Back to Contact Info"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h4 className="font-bold text-sm leading-tight flex items-center gap-1.5">
              <PhoneCall size={14} /> Calls & Recordings
            </h4>
            <p className="text-[10px] text-emerald-200">
              {contact?.name || "Contact"} • {contact?.phone}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition disabled:opacity-40"
              title="Refresh Calls"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          )}

          {onInitiateCall && (
            <button
              onClick={onInitiateCall}
              className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-[#075E54] text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1"
              title="Start WhatsApp Voice Call"
            >
              <Phone size={11} />
              <span>Call</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Mini-bar */}
      <div className="bg-white border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between text-center shrink-0">
        <div>
          <span className="text-[10px] text-[#667781] block">Total</span>
          <span className="text-xs font-bold text-[#111B21]">{totalCalls}</span>
        </div>
        <div className="h-5 w-px bg-slate-200" />
        <div>
          <span className="text-[10px] text-[#667781] block">Answered</span>
          <span className="text-xs font-bold text-emerald-700">
            {answeredCalls}
          </span>
        </div>
        <div className="h-5 w-px bg-slate-200" />
        <div>
          <span className="text-[10px] text-[#667781] block">Recordings</span>
          <span className="text-xs font-bold text-[#075E54]">
            {recordingsCount}
          </span>
        </div>
        <div className="h-5 w-px bg-slate-200" />
        <div>
          <span className="text-[10px] text-[#667781] block">Total Time</span>
          <span className="text-xs font-bold text-[#111B21]">
            {formatDuration(totalSeconds)}
          </span>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="px-3 py-2 flex items-center gap-1.5 bg-[#F0F2F5] shrink-0 border-b border-slate-200/60">
        <button
          onClick={() => setFilter("all")}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
            filter === "all"
              ? "bg-[#075E54] text-white shadow-xs"
              : "bg-white text-[#667781] hover:bg-slate-200/80"
          }`}
        >
          All ({totalCalls})
        </button>
        <button
          onClick={() => setFilter("recordings")}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
            filter === "recordings"
              ? "bg-[#075E54] text-white shadow-xs"
              : "bg-white text-[#667781] hover:bg-slate-200/80"
          }`}
        >
          Recordings ({recordingsCount})
        </button>
        <button
          onClick={() => setFilter("missed")}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
            filter === "missed"
              ? "bg-[#075E54] text-white shadow-xs"
              : "bg-white text-[#667781] hover:bg-slate-200/80"
          }`}
        >
          Missed ({totalCalls - answeredCalls})
        </button>
      </div>

      {/* Calls List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-full text-xs text-[#075E54] shadow-xs">
              <RefreshCw size={12} className="animate-spin text-[#25D366]" />
              <span>Loading call history...</span>
            </div>
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs mt-2">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#075E54] flex items-center justify-center mx-auto mb-3">
              <PhoneCall size={20} />
            </div>
            <h5 className="text-xs font-bold text-[#111B21]">
              No {filter !== "all" ? filter : ""} calls found
            </h5>
            <p className="text-[11px] text-[#667781] mt-1 max-w-[200px] mx-auto leading-relaxed">
              {filter === "recordings"
                ? "No recorded audio available for this contact yet."
                : filter === "missed"
                ? "No missed calls with this contact."
                : "You haven't made or received any calls with this contact yet."}
            </p>
            {onInitiateCall && (
              <button
                onClick={onInitiateCall}
                className="mt-4 px-3 py-1.5 bg-[#075E54] hover:bg-[#064E47] text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-sm"
              >
                <Phone size={12} />
                <span>Start Voice Call</span>
              </button>
            )}
          </div>
        ) : (
          filteredCalls.map((call) => {
            const isOutbound = call.direction === "BUSINESS_INITIATED";
            const isCompleted =
              call.status === "COMPLETED" || call.status === "ACCEPTED";
            const isMissed =
              call.status === "FAILED" ||
              call.status === "REJECTED" ||
              call.status === "MISSED" ||
              call.status === "NO_ANSWER";

            const recording = (call.recordings || []).find(
              (r) => r.mediaUrl && r.downloadStatus === "DOWNLOADED"
            ) || (call.recordings || [])[0];

            const transcript = (call.transcripts || [])[0];
            const isPlayingThis = activePlayingId === call.wacid;

            return (
              <div
                key={call.id || call.wacid}
                className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs hover:shadow-sm transition-all space-y-2.5"
              >
                {/* Call Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? "bg-emerald-100 text-[#075E54]"
                          : isMissed
                          ? "bg-rose-100 text-rose-600"
                          : "bg-blue-100 text-blue-600"
                      }`}
                    >
                      {isMissed ? (
                        <PhoneMissed size={13} />
                      ) : isOutbound ? (
                        <PhoneOutgoing size={13} />
                      ) : (
                        <PhoneIncoming size={13} />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111B21] leading-tight">
                        {isMissed
                          ? "Missed Call"
                          : isOutbound
                          ? "Outgoing Call"
                          : "Incoming Call"}
                      </p>
                      <p className="text-[10px] text-[#667781] mt-0.5">
                        {formatDate(call.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isCompleted
                          ? "bg-emerald-100 text-emerald-800"
                          : isMissed
                          ? "bg-rose-100 text-rose-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {isCompleted
                        ? formatDuration(call.duration)
                        : call.status === "REJECTED"
                        ? "Declined"
                        : "Missed"}
                    </span>
                  </div>
                </div>

                {/* Audio Player (If recording exists) */}
                {recording?.mediaUrl && (
                  <div className="bg-[#F0F2F5] rounded-xl p-2.5 flex items-center gap-2.5 border border-slate-200/60">
                    <button
                      type="button"
                      onClick={() =>
                        handleTogglePlay(call.wacid, recording.mediaUrl)
                      }
                      className="w-7 h-7 rounded-full bg-[#075E54] hover:bg-[#064E47] text-white flex items-center justify-center shrink-0 shadow-2xs transition"
                      title={isPlayingThis ? "Pause" : "Play Recording"}
                    >
                      {isPlayingThis ? (
                        <Pause size={12} className="fill-white" />
                      ) : (
                        <Play size={12} className="fill-white ml-0.5" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[10px] text-[#667781] font-mono">
                        <span>
                          {isPlayingThis
                            ? formatDuration(audioProgress)
                            : "0:00"}
                        </span>
                        <span>
                          {formatDuration(call.duration || audioDuration)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-300 h-1 rounded-full mt-1 overflow-hidden">
                        <div
                          className="bg-[#075E54] h-full transition-all"
                          style={{
                            width:
                              isPlayingThis && audioDuration > 0
                                ? `${(audioProgress / audioDuration) * 100}%`
                                : "0%",
                          }}
                        />
                      </div>
                    </div>

                    <a
                      href={
                        recording.mediaUrl.startsWith("http")
                          ? recording.mediaUrl
                          : `${import.meta.env.VITE_BACKEND_URL || ""}${
                              recording.mediaUrl
                            }`
                      }
                      download={`${call.wacid}.ogg`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-[#667781] hover:text-[#075E54] transition shrink-0"
                      title="Download Audio (.ogg)"
                    >
                      <Download size={13} />
                    </a>
                  </div>
                )}

                {/* AI Transcript */}
                {transcript?.fullText && (
                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTranscriptId(
                          expandedTranscriptId === call.wacid
                            ? null
                            : call.wacid
                        )
                      }
                      className="w-full flex items-center justify-between text-[10px] font-semibold text-[#075E54] hover:text-[#064E47]"
                    >
                      <span className="flex items-center gap-1">
                        <FileText size={11} />
                        <span>AI Transcript</span>
                      </span>
                      {expandedTranscriptId === call.wacid ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                    </button>
                    {expandedTranscriptId === call.wacid && (
                      <div className="mt-1.5 p-2 rounded-lg bg-slate-50 text-[11px] text-slate-700 leading-relaxed border border-slate-200">
                        <p className="whitespace-pre-wrap">
                          {transcript.fullText}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Call Action */}
                {onInitiateCall && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={onInitiateCall}
                      className="text-[10px] font-semibold text-[#075E54] hover:underline flex items-center gap-1"
                    >
                      <Phone size={10} />
                      <span>Call back</span>
                    </button>
                    <span className="text-[9px] text-[#667781] font-mono">
                      {call.wacid ? call.wacid.slice(0, 14) + "..." : ""}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
