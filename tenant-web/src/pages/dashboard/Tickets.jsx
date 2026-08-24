// tenant-web/src/pages/dashboard/Tickets.jsx

import React, { useState, useEffect } from "react";
import {
  TicketCheck,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Plus,
  ChevronRight,
  Users,
  User,
} from "lucide-react";
import { useOutletContext,useSearchParams } from "react-router-dom";
import api from "../../lib/axios";

// ── Helpers ──
const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ── Get userType from localStorage ──
const getUserType = () => {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    return u.type === "TENANT" ? "TENANT" : "USER";
  } catch {
    return "TENANT";
  }
};

// ── Status Badge ──
const StatusBadge = ({ status }) => {
  const map = {
    OPEN: {
      label: "Open",
      className: "bg-blue-50 text-blue-700 border border-blue-100",
      icon: <Clock size={11} />,
    },
    IN_PROGRESS: {
      label: "In Progress",
      className: "bg-amber-50 text-amber-700 border border-amber-100",
      icon: <RefreshCw size={11} />,
    },
    RESOLVED: {
      label: "Resolved",
      className: "bg-emerald-50 text-emerald-700 border border-emerald-100",
      icon: <CheckCircle2 size={11} />,
    },
    CLOSED: {
      label: "Closed",
      className: "bg-slate-100 text-slate-500 border border-slate-200",
      icon: <XCircle size={11} />,
    },
  };
  const config = map[status] || map.OPEN;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5
                  rounded-full text-[11px] font-semibold ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
};

// ── Priority Badge ──
const PriorityBadge = ({ priority }) => {
  const map = {
    LOW:    "bg-slate-50 text-slate-500 border border-slate-200",
    MEDIUM: "bg-yellow-50 text-yellow-700 border border-yellow-100",
    HIGH:   "bg-orange-50 text-orange-700 border border-orange-100",
    URGENT: "bg-red-50 text-red-700 border border-red-100",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full
                  text-[11px] font-semibold ${map[priority] || map.LOW}`}
    >
      {priority}
    </span>
  );
};

// ══════════════════════════════════════════
// NEW TICKET FORM
// ══════════════════════════════════════════
const NewTicketForm = ({ onClose, onSuccess, type = "TENANT" }) => {
  const [form, setForm] = useState({
    title:       "",
    description: "",
    category:    "GENERAL",
    priority:    "LOW",
  });
  const [attachment,    setAttachment]    = useState(null);
  const [attachPreview, setAttachPreview] = useState(null);
  const [fileMetaInfo,  setFileMetaInfo]  = useState(null);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState("");

  const fileInputRef = React.useRef(null);

  const getFileKind = (mime) => {
    if (mime.startsWith("image/"))  return "image";
    if (mime === "application/pdf") return "pdf";
    if (mime.startsWith("video/"))  return "video";
    if (mime.startsWith("audio/"))  return "audio";
    if (mime === "text/plain")      return "text";
    return "other";
  };

  const FileKindIcon = ({ kind, className = "" }) => {
    switch (kind) {
      case "pdf":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
               className={className}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12 a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="15" y2="17"/>
            <line x1="9" y1="9"  x2="11" y2="9"/>
          </svg>
        );
      case "video":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
               className={className}>
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        );
      case "audio":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
               className={className}>
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6"  cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
        );
      case "text":
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
               className={className}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12 a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
            <line x1="8" y1="17" x2="16" y2="17"/>
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
               className={className}>
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        );
    }
  };

  const kindStyle = {
    image: { bg: "bg-blue-50",   border: "border-blue-200",   icon: "text-blue-500",   badge: "bg-blue-100 text-blue-700"   },
    pdf:   { bg: "bg-red-50",    border: "border-red-200",    icon: "text-red-500",    badge: "bg-red-100 text-red-700"     },
    video: { bg: "bg-purple-50", border: "border-purple-200", icon: "text-purple-500", badge: "bg-purple-100 text-purple-700"},
    audio: { bg: "bg-amber-50",  border: "border-amber-200",  icon: "text-amber-500",  badge: "bg-amber-100 text-amber-700" },
    text:  { bg: "bg-slate-50",  border: "border-slate-200",  icon: "text-slate-500",  badge: "bg-slate-100 text-slate-600" },
    other: { bg: "bg-slate-50",  border: "border-slate-200",  icon: "text-slate-500",  badge: "bg-slate-100 text-slate-600" },
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedMimes = [
      "image/jpeg","image/jpg","image/png","image/webp",
      "application/pdf","video/mp4","audio/mpeg","audio/mp3","text/plain",
    ];

    if (!allowedMimes.includes(file.type)) {
      setError("Unsupported file. Allowed: JPG, PNG, WEBP, PDF, MP4, MP3, TXT");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File must be smaller than 20MB.");
      return;
    }

    setError("");
    setAttachment(file);

    const kind = getFileKind(file.type);
    setFileMetaInfo({ name: file.name, size: file.size, kind });

    if (kind === "image") {
      const reader = new FileReader();
      reader.onloadend = () => setAttachPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setAttachPreview(null);
    }
  };

  const handleRemoveFile = () => {
    setAttachment(null);
    setAttachPreview(null);
    setFileMetaInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatSize = (bytes) => {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const endpoint = type === "TENANT" ? "/tickets" : "/user-tickets";
      const formData = new FormData();
      formData.append("title",       form.title.trim());
      formData.append("description", form.description.trim());
      formData.append("category",    form.category);
      formData.append("priority",    form.priority);
      if (attachment) formData.append("attachment", attachment);

      await api.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSuccess();
    } catch (e) {
      setError("Failed to create ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
                    bg-black/30 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg
                      border border-slate-100 animate-in fade-in duration-200
                      max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center
                        justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Raise New Ticket
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {type === "TENANT"
                ? "Your ticket will be sent to SuperAdmin support"
                : "Your ticket will be sent to your Tenant admin"}
            </p>
          </div>
          <button onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-400">
            <XCircle size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="px-6 py-5 space-y-4">

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border
                            border-red-100 rounded-xl text-xs text-red-600 font-semibold">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Title *</label>
            <input
              type="text"
              placeholder="Brief summary of your issue..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 text-sm border border-slate-200
                         rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Description *</label>
            <textarea
              placeholder="Describe your issue in detail..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2.5 text-sm border border-slate-200
                         rounded-xl focus:outline-none focus:ring-2
                         focus:ring-[#125EF2]/20 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2.5 text-sm border border-slate-200
                           rounded-xl focus:outline-none focus:ring-2
                           focus:ring-[#125EF2]/20 bg-white"
              >
                <option value="GENERAL">General</option>
                <option value="BILLING">Billing</option>
                <option value="TECHNICAL">Technical</option>
                <option value="FEATURE">Feature Request</option>
                <option value="ACCOUNT">Account</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2.5 text-sm border border-slate-200
                           rounded-xl focus:outline-none focus:ring-2
                           focus:ring-[#125EF2]/20 bg-white"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          {/* Attachment */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">
              Attachment{" "}
              <span className="text-slate-400 font-normal">(Optional)</span>
            </label>

            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                { label: "JPG",  color: "bg-blue-50   text-blue-600   border-blue-100"   },
                { label: "PNG",  color: "bg-blue-50   text-blue-600   border-blue-100"   },
                { label: "WEBP", color: "bg-blue-50   text-blue-600   border-blue-100"   },
                { label: "PDF",  color: "bg-red-50    text-red-600    border-red-100"    },
                { label: "MP4",  color: "bg-purple-50 text-purple-600 border-purple-100" },
                { label: "MP3",  color: "bg-amber-50  text-amber-600  border-amber-100"  },
                { label: "TXT",  color: "bg-slate-50  text-slate-600  border-slate-200"  },
              ].map(({ label, color }) => (
                <span key={label}
                      className={`inline-flex items-center px-2 py-0.5 rounded-md
                                  text-[10px] font-bold border ${color}`}>
                  {label}
                </span>
              ))}
              <span className="text-[10px] text-slate-400 self-center ml-1">· Max 20MB</span>
            </div>

            {fileMetaInfo ? (
              <div className={`rounded-xl overflow-hidden border
                              ${kindStyle[fileMetaInfo.kind]?.border || "border-slate-200"}
                              ${kindStyle[fileMetaInfo.kind]?.bg    || "bg-slate-50"}`}>
                {attachPreview && fileMetaInfo.kind === "image" && (
                  <img src={attachPreview} alt="Preview"
                       className="w-full max-h-44 object-contain bg-slate-100"/>
                )}
                {fileMetaInfo.kind !== "image" && (
                  <div className="flex items-center justify-center py-8">
                    <div className={`p-4 rounded-2xl bg-white border
                                    ${kindStyle[fileMetaInfo.kind]?.border} shadow-sm`}>
                      <FileKindIcon kind={fileMetaInfo.kind}
                                    className={`w-10 h-10 ${kindStyle[fileMetaInfo.kind]?.icon}`}/>
                    </div>
                  </div>
                )}
                <div className="px-3 py-2 bg-white border-t border-slate-100
                                flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0"/>
                  <p className="text-xs text-slate-700 font-semibold truncate flex-1">
                    {fileMetaInfo.name}
                  </p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0
                                   ${kindStyle[fileMetaInfo.kind]?.badge}`}>
                    {fileMetaInfo.kind.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {formatSize(fileMetaInfo.size)}
                  </span>
                  <button onClick={handleRemoveFile} type="button"
                          className="p-1 hover:bg-red-50 rounded-lg transition shrink-0">
                    <XCircle size={14} className="text-red-400"/>
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-slate-200
                                 rounded-xl p-5 text-center hover:border-[#125EF2]
                                 hover:bg-blue-50/40 transition group cursor-pointer
                                 bg-slate-50/50">
                <div className="flex flex-col items-center gap-2">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200
                                  shadow-sm group-hover:border-[#125EF2]
                                  group-hover:bg-blue-50 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                         viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                         className="text-slate-400 group-hover:text-[#125EF2] transition">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600
                                  group-hover:text-[#125EF2] transition">
                      Click to attach a file
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Image · PDF · Video · Audio · Text · Max 20MB
                    </p>
                  </div>
                </div>
              </button>
            )}

            <input ref={fileInputRef} type="file"
                   accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf,video/mp4,audio/mpeg,audio/mp3,text/plain"
                   onChange={handleFileChange} className="hidden"/>
          </div>

          {/* 48hr indicator */}
          <div className="flex items-start gap-3 p-3.5 bg-blue-50
                          border border-blue-100 rounded-xl">
            <div className="shrink-0 mt-0.5 p-1.5 bg-white rounded-lg
                            border border-blue-100 shadow-sm">
              <Clock size={14} className="text-[#125EF2]"/>
            </div>
            <div>
              <p className="text-xs font-bold text-[#125EF2]">
                Response within 48 hours
              </p>
              <p className="text-[11px] text-blue-500 mt-0.5 leading-relaxed">
                {type === "TENANT"
                  ? "Our support team will review your ticket and respond within 48 business hours."
                  : "Your Tenant admin will review and respond to your request within 48 business hours."}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center
                        justify-end gap-3 sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold text-slate-500
                             hover:bg-slate-100 rounded-xl transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
                  className={`flex items-center gap-2 px-5 py-2 text-sm font-bold
                              rounded-xl transition ${
                    submitting
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-[#125EF2] text-white hover:bg-[#0d4fd6] shadow-sm"
                  }`}>
            {submitting ? (
              <><RefreshCw size={14} className="animate-spin"/>Submitting...</>
            ) : (
              <><Send size={14}/>Submit Ticket</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════
// TICKET DETAIL
// ══════════════════════════════════════════
const TicketDetail = ({ ticket, onBack, onRefresh, userType }) => {
  const [reply,      setReply]      = useState("");
  const [sending,    setSending]    = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [resolving,  setResolving]  = useState(false);

  const isUserTicket = ticket.raisedBy === "USER";
  const isLocked     = ticket.status === "CLOSED" || ticket.status === "RESOLVED";

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      let endpoint;
      if (userType === "TENANT") {
        endpoint = isUserTicket
          ? `/tickets/${ticket.id}/reply-user`
          : `/tickets/${ticket.id}/reply`;
      } else {
        endpoint = `/user-tickets/${ticket.id}/reply`;
      }
      await api.post(endpoint, { message: reply });
      setReply("");
      await onRefresh(ticket.id);
    } catch (e) {
      console.error("Reply error:", e);
    } finally {
      setSending(false);
    }
  };

  const handleEscalate = async () => {
    setEscalating(true);
    try {
      await api.patch(`/tickets/${ticket.id}/escalate`);
      await onRefresh(ticket.id);
    } catch (e) { console.error(e); }
    finally { setEscalating(false); }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      await api.patch(`/tickets/${ticket.id}/resolve`);
      onBack();
    } catch (e) { console.error(e); }
    finally { setResolving(false); }
  };

  const handleClose = async () => {
    try {
      await api.patch(`/tickets/${ticket.id}/close`);
      onBack();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      <button onClick={onBack}
              className="flex items-center gap-2 text-sm font-semibold
                         text-[#125EF2] hover:text-[#0d4fd6] transition">
        <ArrowLeft size={16}/>
        Back to Tickets
      </button>

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {ticket.ticketNumber}
              </span>
              <StatusBadge status={ticket.status}/>
              <PriorityBadge priority={ticket.priority}/>
              {ticket.isEscalated && (
                <span className="text-[11px] font-semibold px-2 py-0.5
                                 bg-red-50 text-red-600 border border-red-100 rounded-full">
                  ⚠️ Escalated to SuperAdmin
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-800">{ticket.title}</h2>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              {ticket.description}
            </p>

            {/* Attachment viewer */}
            {ticket.attachmentUrl && (() => {
              const url      = `${import.meta.env.VITE_BACKEND_URL}${ticket.attachmentUrl}`;
              const ext      = ticket.attachmentUrl.split(".").pop().toLowerCase();
              const isImage  = ["jpg","jpeg","png","webp"].includes(ext);
              const isPdf    = ext === "pdf";
              const isVideo  = ext === "mp4";
              const isAudio  = ["mp3","mpeg"].includes(ext);
              const isText   = ext === "txt";

              return (
                <div className="mt-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Attachment
                  </p>

                  {isImage && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                       className="inline-block rounded-xl overflow-hidden border
                                  border-slate-200 hover:border-[#125EF2] transition
                                  shadow-sm max-w-sm group">
                      <img src={url} alt="Ticket attachment"
                           className="w-full max-h-48 object-contain bg-slate-50"/>
                      <div className="px-3 py-1.5 bg-white border-t border-slate-100
                                      flex items-center gap-1.5">
                        <CheckCircle2 size={11} className="text-emerald-500 shrink-0"/>
                        <span className="text-[11px] text-slate-500 font-medium
                                         group-hover:text-[#125EF2] transition">
                          Click to open full image
                        </span>
                      </div>
                    </a>
                  )}

                  {isPdf && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-3 px-4 py-3 rounded-xl
                                  bg-red-50 border border-red-100 hover:border-red-300
                                  transition group max-w-sm">
                      <div className="p-2 bg-white rounded-lg border border-red-100 shadow-sm shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                             className="w-5 h-5 text-red-500">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12 a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="9" y1="13" x2="15" y2="13"/>
                          <line x1="9" y1="17" x2="15" y2="17"/>
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-red-700 truncate">
                          {ticket.attachmentUrl.split("/").pop()}
                        </p>
                        <p className="text-[11px] text-red-400 mt-0.5">Click to open PDF</p>
                      </div>
                    </a>
                  )}

                  {isVideo && (
                    <div className="rounded-xl overflow-hidden border border-slate-200
                                    shadow-sm max-w-sm bg-black">
                      <video controls className="w-full max-h-48" src={url}>
                        Your browser does not support video playback.
                      </video>
                      <div className="px-3 py-1.5 bg-white border-t border-slate-100
                                      flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                             className="w-3 h-3 text-purple-500 shrink-0">
                          <polygon points="23 7 16 12 23 17 23 7"/>
                          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                        </svg>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Video attachment
                        </span>
                      </div>
                    </div>
                  )}

                  {isAudio && (
                    <div className="rounded-xl overflow-hidden border border-amber-100
                                    bg-amber-50 shadow-sm max-w-sm">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="p-2 bg-white rounded-lg border border-amber-100 shadow-sm shrink-0">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                               className="w-5 h-5 text-amber-500">
                            <path d="M9 18V5l12-2v13"/>
                            <circle cx="6"  cy="18" r="3"/>
                            <circle cx="18" cy="16" r="3"/>
                          </svg>
                        </div>
                        <p className="text-xs font-bold text-amber-700 truncate flex-1">
                          {ticket.attachmentUrl.split("/").pop()}
                        </p>
                      </div>
                      <audio controls className="w-full px-3 pb-3">
                        <source src={url} type="audio/mpeg"/>
                        Your browser does not support audio playback.
                      </audio>
                    </div>
                  )}

                  {isText && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-3 px-4 py-3 rounded-xl
                                  bg-slate-50 border border-slate-200 hover:border-slate-300
                                  transition group max-w-sm">
                      <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-sm shrink-0">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                             className="w-5 h-5 text-slate-500">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12 a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="8" y1="13" x2="16" y2="13"/>
                          <line x1="8" y1="17" x2="16" y2="17"/>
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">
                          {ticket.attachmentUrl.split("/").pop()}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Click to open text file
                        </p>
                      </div>
                    </a>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Action Buttons */}
          {!isLocked && userType === "TENANT" && (
            <div className="flex flex-wrap gap-2 shrink-0">
              {isUserTicket && !ticket.isEscalated && (
                <button onClick={handleEscalate} disabled={escalating}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold
                                   text-orange-700 bg-orange-50 border border-orange-100
                                   rounded-xl hover:bg-orange-100 transition disabled:opacity-50">
                  {escalating
                    ? <RefreshCw size={12} className="animate-spin"/>
                    : <AlertCircle size={12}/>}
                  Escalate to Admin
                </button>
              )}
              {isUserTicket && (
                <button onClick={handleResolve} disabled={resolving}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold
                                   text-emerald-700 bg-emerald-50 border border-emerald-100
                                   rounded-xl hover:bg-emerald-100 transition disabled:opacity-50">
                  {resolving
                    ? <RefreshCw size={12} className="animate-spin"/>
                    : <CheckCircle2 size={12}/>}
                  Mark Resolved
                </button>
              )}
              {!isUserTicket && (
                <button onClick={handleClose}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold
                                   text-slate-500 bg-slate-100 border border-slate-200
                                   rounded-xl hover:bg-slate-200 transition">
                  <XCircle size={12}/>
                  Close Ticket
                </button>
              )}
            </div>
          )}
        </div>

        {/* Meta Grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-semibold">Category</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5 capitalize">
              {ticket.category}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-semibold">Raised By</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              {ticket.raisedBy === "USER"
                ? ticket.user?.name || "User"
                : userType === "TENANT" ? "You (Tenant)" : "You"}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-semibold">Created</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              {formatDate(ticket.createdAt)}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs text-slate-400 font-semibold">Updated</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">
              {formatDate(ticket.updatedAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Conversation</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {ticket.messages?.filter((m) => !m.isInternal).length || 0} messages
          </p>
        </div>

        <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
          {ticket.messages?.filter((m) => !m.isInternal).length === 0 ? (
            <div className="text-center py-8">
              <TicketCheck className="w-10 h-10 text-slate-200 mx-auto mb-2"/>
              <p className="text-sm text-slate-400">No messages yet</p>
              <p className="text-xs text-slate-300 mt-1">Start the conversation below</p>
            </div>
          ) : (
            ticket.messages?.filter((msg) => !msg.isInternal).map((msg) => {
              const isMine = userType === "TENANT"
                ? msg.sentBy === "TENANT"
                : msg.sentBy === "USER";

              const senderLabel = isMine
                ? "You"
                : msg.sentBy === "SUPER_ADMIN"
                  ? "Support Team"
                  : msg.sentBy === "TENANT"
                    ? ticket.tenant?.tenantName || "Tenant"
                    : ticket.user?.name || "User";

              return (
                <div key={msg.id}
                     className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] flex flex-col gap-1
                                   ${isMine ? "items-end" : "items-start"}`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm ${
                      isMine
                        ? "bg-[#125EF2] text-white"
                        : msg.sentBy === "SUPER_ADMIN"
                          ? "bg-[#EAF2FE] text-[#125EF2] border border-[#CFE0FD]"
                          : "bg-slate-100 text-slate-800"
                    }`}>
                      <p className={`text-[10px] font-bold mb-1 ${
                        isMine
                          ? "text-blue-100"
                          : msg.sentBy === "SUPER_ADMIN"
                            ? "text-[#125EF2]"
                            : "text-slate-400"
                      }`}>
                        {senderLabel}
                      </p>
                      <p className="leading-relaxed">{msg.message}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 px-1">
                      {formatDate(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!isLocked ? (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <div className="flex gap-3">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={
                  userType === "TENANT"
                    ? isUserTicket ? "Reply to user..." : "Reply to Support Team..."
                    : "Reply to Tenant admin..."
                }
                rows={3}
                className="flex-1 px-4 py-3 text-sm border border-slate-200
                           rounded-xl focus:outline-none focus:ring-2
                           focus:ring-[#125EF2]/20 resize-none bg-white"
              />
              <button onClick={handleReply} disabled={sending || !reply.trim()}
                      className={`self-end flex items-center gap-2 px-4 py-3
                                  rounded-xl text-sm font-bold transition ${
                        sending || !reply.trim()
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-[#125EF2] text-white hover:bg-[#0d4fd6] shadow-sm"
                      }`}>
                {sending ? <RefreshCw size={15} className="animate-spin"/> : <Send size={15}/>}
                {sending ? "..." : "Send"}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 text-center">
            <p className="text-xs font-semibold text-slate-400">
              This ticket is {ticket.status.toLowerCase()}. No further replies allowed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════
// MAIN TICKETS PAGE
// ══════════════════════════════════════════
export default function Tickets() {
  const { tenantStatus } = useOutletContext();
  const userType = getUserType();
  const [searchParams, setSearchParams] = useSearchParams(); // ✅ Added
  const ticketIdParam = searchParams.get("ticketId"); // ✅ Get ticketId from URL

  const [activeTab,      setActiveTab]      = useState("my");

  const [myTickets,      setMyTickets]      = useState([]);
  const [userTickets,    setUserTickets]    = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showNewForm,    setShowNewForm]    = useState(false);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [filterStatus,   setFilterStatus]  = useState("ALL");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (userType === "TENANT") {
        const [myRes, userRes] = await Promise.all([
          api.get("/tickets/my"),
          api.get("/tickets/user-tickets/all"),
        ]);
        if (myRes.data.success)   setMyTickets(myRes.data.data);
        if (userRes.data.success) setUserTickets(userRes.data.data);
      } else {
        const res = await api.get("/user-tickets/my");
        if (res.data.success) setMyTickets(res.data.data);
      }
    } catch (e) {
      setError("Failed to fetch tickets");
    } finally {
      setLoading(false);
    }
  };

   const fetchTicketDetail = async (ticketId) => {
    try {
      const endpoint = userType === "USER"
        ? `/user-tickets/${ticketId}`
        : `/tickets/${ticketId}`;
      const res = await api.get(endpoint);
      if (res.data.success) setSelectedTicket(res.data.data);
    } catch (e) {
      console.error("fetchTicketDetail error:", e);
    }
  };

  // ✅ Auto-fetch and select ticket if ticketId parameter exists in the URL
  useEffect(() => {
    if (ticketIdParam) {
      fetchTicketDetail(ticketIdParam);
    }
  }, [ticketIdParam]);

  useEffect(() => { fetchData(); }, []);

  const currentList = activeTab === "my" ? myTickets : userTickets;

  const filteredList = currentList.filter((t) => {
    const matchStatus = filterStatus === "ALL" || t.status === filterStatus;
    const matchSearch = !searchQuery ||
      t.ticketNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  // ── Stats ──
  const openCount        = myTickets.filter((t) => t.status === "OPEN").length;
  const inProgressCount  = myTickets.filter((t) => t.status === "IN_PROGRESS").length;
  const resolvedCount    = myTickets.filter((t) => t.status === "RESOLVED").length;
  const userTicketsCount = userTickets.length;
  const userOpenCount    = userTickets.filter((t) => t.status === "OPEN").length;

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="h-8 w-48 bg-slate-100 rounded-xl animate-pulse"/>
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse"/>
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse"/>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
          <AlertCircle className="text-red-500" size={32}/>
        </div>
        <p className="text-sm font-semibold text-slate-600">{error}</p>
        <button onClick={fetchData}
                className="flex items-center gap-2 px-4 py-2 bg-[#125EF2] text-white
                           text-sm font-semibold rounded-xl hover:bg-[#0d4fd6] transition">
          <RefreshCw size={14}/>Retry
        </button>
      </div>
    );
  }

   if (selectedTicket) {
    return (
      <TicketDetail
        ticket={selectedTicket}
        userType={userType}
        onBack={() => { 
          setSelectedTicket(null); 
          setSearchParams({}); // ✅ Clears the '?ticketId=xxx' from URL
          fetchData(); 
        }}
        onRefresh={fetchTicketDetail}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">

      {showNewForm && (
        <NewTicketForm
          type={userType}
          onClose={() => setShowNewForm(false)}
          onSuccess={() => { setShowNewForm(false); fetchData(); }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center
                      md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">
            Support Tickets
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 font-medium">
            {userType === "TENANT"
              ? "Manage your support tickets and user issues"
              : "View and track your support requests"}
          </p>
        </div>
        <button onClick={() => setShowNewForm(true)}
                className="btn-primary flex items-center gap-2 text-sm shadow-sm
                           self-start md:self-auto">
          <Plus size={16}/>New Ticket
        </button>
      </div>

      {/* ── Stats Cards ── */}
      <div className={`grid gap-4 ${
        userType === "TENANT"
          ? "sm:grid-cols-2 lg:grid-cols-4"
          : "sm:grid-cols-3"
      }`}>

        {/* Open */}
        <div onClick={() => { setActiveTab("my"); setFilterStatus("OPEN"); }}
             className="card p-5 border border-slate-100 bg-white flex flex-col
                        justify-between cursor-pointer hover:border-blue-200
                        hover:shadow-md transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              My Open Tickets
            </span>
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-100
                            group-hover:bg-blue-100 transition">
              <Clock size={16} className="text-blue-600"/>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-extrabold text-slate-800">{openCount}</span>
            <p className="text-xs text-slate-400 font-semibold mt-1">Awaiting response</p>
          </div>
        </div>

        {/* In Progress */}
        <div onClick={() => { setActiveTab("my"); setFilterStatus("IN_PROGRESS"); }}
             className="card p-5 border border-slate-100 bg-white flex flex-col
                        justify-between cursor-pointer hover:border-amber-200
                        hover:shadow-md transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              In Progress
            </span>
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-100
                            group-hover:bg-amber-100 transition">
              <RefreshCw size={16} className="text-amber-600"/>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-extrabold text-slate-800">{inProgressCount}</span>
            <p className="text-xs text-slate-400 font-semibold mt-1">Being handled</p>
          </div>
        </div>

        {/* Resolved */}
        <div onClick={() => { setActiveTab("my"); setFilterStatus("RESOLVED"); }}
             className="card p-5 border border-slate-100 bg-white flex flex-col
                        justify-between cursor-pointer hover:border-emerald-200
                        hover:shadow-md transition group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Resolved
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100
                            group-hover:bg-emerald-100 transition">
              <CheckCircle2 size={16} className="text-emerald-600"/>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-extrabold text-slate-800">{resolvedCount}</span>
            <p className="text-xs text-slate-400 font-semibold mt-1">Issues fixed</p>
          </div>
        </div>

        {/* User Tickets — TENANT ONLY */}
        {userType === "TENANT" && (
          <div onClick={() => { setActiveTab("user"); setFilterStatus("ALL"); }}
               className="card p-5 border border-slate-100 bg-white flex flex-col
                          justify-between cursor-pointer hover:border-purple-200
                          hover:shadow-md transition group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                User Tickets
              </span>
              <div className="p-2 rounded-xl bg-purple-50 border border-purple-100
                              group-hover:bg-purple-100 transition">
                <Users size={16} className="text-purple-600"/>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-extrabold text-slate-800">{userTicketsCount}</span>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                {userOpenCount} open · {userTicketsCount - userOpenCount} handled
              </p>
            </div>
          </div>
        )}

      </div>
      {/* ── End Stats Cards ── */}

      {/* Tabs — TENANT ONLY */}
      {userType === "TENANT" && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button onClick={() => setActiveTab("my")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                              font-semibold transition ${
                    activeTab === "my"
                      ? "bg-white text-[#125EF2] shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}>
            <User size={15}/>
            My Tickets
            {openCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px]
                               h-[18px] px-1 rounded-full bg-[#125EF2] text-white
                               text-[10px] font-bold">
                {openCount}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab("user")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm
                              font-semibold transition ${
                    activeTab === "user"
                      ? "bg-white text-[#125EF2] shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}>
            <Users size={15}/>
            User Tickets
            {userOpenCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px]
                               h-[18px] px-1 rounded-full bg-purple-500 text-white
                               text-[10px] font-bold">
                {userOpenCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Ticket List */}
      <div className="card border border-slate-100 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center
                          justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                {activeTab === "my" ? "My Tickets" : "User Tickets"}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filteredList.length} ticket{filteredList.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <div className="relative">
                <Search size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input type="text" placeholder="Search tickets..."
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                       className="pl-8 pr-3 py-1.5 text-xs border border-slate-200
                                  rounded-xl focus:outline-none focus:ring-2
                                  focus:ring-[#125EF2]/20 w-36"/>
              </div>
              <select value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-slate-200
                                 rounded-xl focus:outline-none focus:ring-2
                                 focus:ring-[#125EF2]/20">
                <option value="ALL">All Status</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
              <button onClick={fetchData}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                                 font-semibold text-slate-500 hover:text-slate-700
                                 hover:bg-slate-100 rounded-xl transition border border-slate-200">
                <RefreshCw size={12}/>Refresh
              </button>
            </div>
          </div>
        </div>

        {filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <TicketCheck size={32} className="text-slate-200"/>
            <p className="text-sm font-semibold text-slate-500">No tickets found</p>
            <p className="text-xs text-slate-400">
              {activeTab === "my"
                ? "Click 'New Ticket' to raise your first support request"
                : "No user tickets yet"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredList.map((ticket) => {
              const lastMsg = ticket.messages?.[0];
              return (
                <div key={ticket.id}
                     onClick={() => { setSelectedTicket(ticket); fetchTicketDetail(ticket.id); }}
                     className="flex items-center justify-between px-6 py-4
                                hover:bg-slate-50 cursor-pointer transition gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#125EF2]">
                        {ticket.ticketNumber}
                      </span>
                      <StatusBadge status={ticket.status}/>
                      <PriorityBadge priority={ticket.priority}/>
                      {ticket.isEscalated && (
                        <span className="text-[10px] font-bold text-red-500">
                          ⚠️ Escalated
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 mt-1 truncate">
                      {ticket.title}
                    </p>
                    {lastMsg && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        Last: {lastMsg.message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-slate-400 font-medium">
                        {formatDate(ticket.updatedAt || ticket.createdAt)}
                      </p>
                      <p className="text-xs text-slate-400 capitalize mt-0.5">
                        {ticket.category}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300"/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}