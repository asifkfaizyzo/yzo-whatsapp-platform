import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, 
  Clock, CheckCircle2, XCircle, Search, RefreshCw, 
  Play, Pause, Download, Volume2, FileText, ChevronLeft, ChevronRight,
  Filter, AlertCircle
} from 'lucide-react';
import api from '../../lib/axios';

export default function CallLogsTable() {
  const [calls, setCalls] = useState([]);
  const [kpis, setKpis] = useState({
    totalCalls: 0,
    answered: 0,
    missed: 0,
    totalDurationSeconds: 0
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('ALL');

  // Audio playback state
  const [currentlyPlayingWacid, setCurrentlyPlayingWacid] = useState(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef(new Audio());

  // Transcript Modal state
  const [selectedTranscript, setSelectedTranscript] = useState(null);

  const fetchCalls = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 15,
        ...(search && { search }),
        ...(direction && { direction }),
        ...(status && status !== 'ALL' && { status })
      };

      const res = await api.get('/whatsapp/calls/history', { params });
      if (res.data?.success && res.data?.data) {
        setCalls(res.data.data.calls || []);
        if (res.data.data.pagination) {
          setTotalPages(res.data.data.pagination.totalPages || 1);
          setTotalCount(res.data.data.pagination.total || 0);
        }
        if (res.data.data.kpis) {
          setKpis(res.data.data.kpis);
        }
      }
    } catch (err) {
      console.error('Failed to fetch call history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [page, direction, status]);

  // Audio setup
  useEffect(() => {
    const audio = audioRef.current;

    const onTimeUpdate = () => {
      setAudioProgress(audio.currentTime);
      setAudioDuration(audio.duration || 0);
    };

    const onEnded = () => {
      setCurrentlyPlayingWacid(null);
      setAudioProgress(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const handlePlayAudio = (wacid, mediaUrl) => {
    const audio = audioRef.current;
    if (currentlyPlayingWacid === wacid) {
      audio.pause();
      setCurrentlyPlayingWacid(null);
      return;
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    const fullAudioUrl = mediaUrl.startsWith('http') ? mediaUrl : `${backendUrl}${mediaUrl}`;
    
    audio.src = fullAudioUrl;
    audio.play()
      .then(() => setCurrentlyPlayingWacid(wacid))
      .catch((err) => console.warn('Audio playback error:', err));
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatTotalTime = (totalSeconds) => {
    if (!totalSeconds) return '0m';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Calls */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Calls</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{kpis.totalCalls}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#125EF2] flex items-center justify-center shadow-xs">
            <PhoneCall className="w-5 h-5" />
          </div>
        </div>

        {/* Answered */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Answered</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              {kpis.answered}
              <span className="text-xs font-semibold text-slate-400 ml-1.5 font-sans">
                ({kpis.totalCalls > 0 ? Math.round((kpis.answered / kpis.totalCalls) * 100) : 0}%)
              </span>
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Missed / Failed */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Missed / Failed</p>
            <h3 className="text-2xl font-black text-rose-500 mt-1">{kpis.missed}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shadow-xs">
            <PhoneMissed className="w-5 h-5" />
          </div>
        </div>

        {/* Total Talk Time */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Talk Time</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{formatTotalTime(kpis.totalDurationSeconds)}</h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Filters & Controls Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by phone number..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchCalls()}
              className="w-full text-xs font-semibold pl-9 pr-3 py-2 bg-slate-50/50 border border-slate-200/80 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] outline-none transition"
            />
          </div>

          {/* Direction Filter */}
          <select 
            value={direction}
            onChange={(e) => { setDirection(e.target.value); setPage(1); }}
            className="text-xs font-semibold text-slate-600 bg-white border border-slate-200/80 rounded-xl px-3 py-2 outline-none cursor-pointer focus:ring-2 focus:ring-[#125EF2]/20"
          >
            <option value="">All Directions</option>
            <option value="BUSINESS_INITIATED">Outbound</option>
            <option value="USER_INITIATED">Inbound</option>
          </select>

          {/* Status Filter */}
          <select 
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="text-xs font-semibold text-slate-600 bg-white border border-slate-200/80 rounded-xl px-3 py-2 outline-none cursor-pointer focus:ring-2 focus:ring-[#125EF2]/20"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Declined / Busy</option>
            <option value="FAILED">Missed / Failed</option>
          </select>
        </div>

        {/* Refresh Button */}
        <button 
          onClick={fetchCalls}
          disabled={loading}
          className="btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 self-end sm:self-auto shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#125EF2]' : 'text-slate-500'}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ── Call Logs Table ── */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/60 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400 select-none">
              <th className="py-3 px-4">Contact</th>
              <th className="py-3 px-3">Type</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Duration</th>
              <th className="py-3 px-4">Date & Time</th>
              <th className="py-3 px-4">Call Recording</th>
              <th className="py-3 px-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#125EF2] mb-2" />
                  <span>Loading call records...</span>
                </td>
              </tr>
            ) : calls.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-400">
                  <PhoneCall className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-slate-600">No call records found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Calls placed or received will appear here with recordings.</p>
                </td>
              </tr>
            ) : (
              calls.map((call) => {
                const isInbound = call.direction === 'USER_INITIATED';
                const phoneNumber = isInbound ? call.fromNumber : call.toNumber;
                const isSuccess = ['ACCEPTED', 'COMPLETED'].includes(call.status);
                const isMissed = ['FAILED', 'REJECTED'].includes(call.status);
                const recording = call.recordings?.[0];
                const hasRecording = Boolean(recording?.mediaUrl);
                const isPlaying = currentlyPlayingWacid === call.wacid;
                const transcript = call.transcripts?.[0]?.fullText;

                return (
                  <tr key={call.wacid || call.id} className="hover:bg-slate-50/60 transition group">
                    {/* Contact Number */}
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          isInbound ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-[#125EF2]'
                        }`}>
                          {isInbound ? <PhoneIncoming className="w-3.5 h-3.5" /> : <PhoneOutgoing className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <p className="font-mono text-slate-900 leading-tight">+{phoneNumber || 'Unknown'}</p>
                          <p className="text-[10px] text-slate-400 font-normal">WhatsApp Voice</p>
                        </div>
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        isInbound ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-[#125EF2]'
                      }`}>
                        {isInbound ? 'Inbound' : 'Outbound'}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                        isSuccess 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : isMissed 
                            ? 'bg-rose-50 text-rose-600' 
                            : 'bg-amber-50 text-amber-700'
                      }`}>
                        {call.status}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="py-3.5 px-3 font-mono font-medium text-slate-700">
                      {formatDuration(call.duration)}
                    </td>

                    {/* Date & Time */}
                    <td className="py-3.5 px-4 text-slate-500 font-medium">
                      {formatDate(call.createdAt)}
                    </td>

                    {/* Call Recording Audio Player */}
                    <td className="py-3.5 px-4">
                      {hasRecording ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePlayAudio(call.wacid, recording.mediaUrl)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition shadow-xs ${
                              isPlaying 
                                ? 'bg-emerald-600 text-white' 
                                : 'bg-[#125EF2] text-white hover:bg-blue-700'
                            }`}
                            title={isPlaying ? "Pause" : "Play Recording"}
                          >
                            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                          </button>

                          {/* Audio Progress / Info */}
                          <div className="flex flex-col">
                            <span className="text-[11px] font-mono font-bold text-slate-700">
                              {isPlaying ? formatDuration(audioProgress) : formatDuration(call.duration)}
                            </span>
                          </div>

                          {/* Download Button */}
                          <a 
                            href={recording.mediaUrl} 
                            download={`${call.wacid}_recording.ogg`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition hover:bg-slate-100"
                            title="Download Audio (.ogg)"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No recording</span>
                      )}
                    </td>

                    {/* Transcript / Action */}
                    <td className="py-3.5 px-3 text-right">
                      {transcript ? (
                        <button
                          onClick={() => setSelectedTranscript(transcript)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#125EF2] bg-blue-50/70 hover:bg-blue-100 rounded-lg transition inline-flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Transcript</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 px-1">
          <p>Showing page {page} of {totalPages} ({totalCount} total calls)</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Transcript Modal ── */}
      {selectedTranscript && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#125EF2]" />
                Call Transcription
              </h3>
              <button 
                onClick={() => setSelectedTranscript(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 max-h-[60vh] overflow-y-auto text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-4 rounded-xl border border-slate-100">
              {selectedTranscript}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedTranscript(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
