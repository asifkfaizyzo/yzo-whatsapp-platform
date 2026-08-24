import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FileCode,
  Plus,
  CheckCircle,
  Clock,
  X,
  Eye,
  RefreshCw,
  Trash2,
  AlertCircle,
  Image,
  Video,
  FileText,
  MapPin,
  Type,
  Upload,
  ChevronDown,
  ChevronUp,
  Phone,
  Link,
  MessageSquare,
  Play,
} from "lucide-react";
import { getTemplates, createTemplate, syncTemplates, deleteTemplate } from "../../services/template.service";
import { getWhatsappStatus } from "../../services/tenant.service";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import WhatsAppRequiredModal from "../../components/whatsapp/WhatsAppRequiredModal";
import WhatsAppConnect from "../../components/whatsapp/WhatsAppConnect";
import { getSocket } from "../../lib/socket";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const HEADER_TYPES = [
  { value: "NONE",     label: "None",     icon: null },
  { value: "TEXT",     label: "Text",     icon: Type },
  { value: "IMAGE",    label: "Image",    icon: Image },
  { value: "VIDEO",    label: "Video",    icon: Video },
  { value: "DOCUMENT", label: "Document", icon: FileText },
  { value: "LOCATION", label: "Location", icon: MapPin },
];

const HEADER_ICON_MAP = { NONE: null, TEXT: Type, IMAGE: Image, VIDEO: Video, DOCUMENT: FileText, LOCATION: MapPin };

const HEADER_ACCEPT = {
  IMAGE: "image/jpeg,image/jpg,image/png,image/webp",
  VIDEO: "video/mp4,video/3gpp",
  DOCUMENT: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain",
};

const HEADER_SIZE_MB = { IMAGE: 5, VIDEO: 16, DOCUMENT: 16 };

const getBodyText   = (comps) => (comps || []).find(c => c.type === "BODY")?.text || "";
const getFooterText = (comps) => (comps || []).find(c => c.type === "FOOTER")?.text || "";
const getButtons    = (comps) => (comps || []).find(c => c.type === "BUTTONS")?.buttons || [];
const countVars     = (text) => { if (!text) return 0; const m = text.match(/\{\{(\d+)\}\}/g); return m ? new Set(m).size : 0; };
const fmtSize       = (b) => { if (!b) return ""; if (b < 1024) return b + " B"; if (b < 1048576) return (b/1024).toFixed(1) + " KB"; return (b/1048576).toFixed(2) + " MB"; };

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now - d) / 1000));
  if (diffSec < 45) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

function TemplatePreview({ headerType, headerText, mediaPreviewUrl, locationName, locationAddress, locationLat, locationLng, body, footer, buttons }) {
  const pb = (body || "").replace(/\{\{(\d+)\}\}/g, (_, n) => `[var${n}]`);
  return (
    <div className="bg-[#efeae2] rounded-2xl p-3 flex flex-col gap-2 min-h-[160px] relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#059669_1px,transparent_1px)] [background-size:16px_16px]" />
      <div className="bg-white text-slate-800 rounded-2xl rounded-tl-none shadow-sm border border-slate-200/50 max-w-[95%] text-[11px] leading-relaxed relative z-10 overflow-hidden">
        {headerType === "TEXT" && headerText && (
          <div className="px-3 pt-2.5 pb-1 font-bold text-[12px] border-b border-slate-100">{headerText.replace(/\{\{1\}\}/g, "[header]")}</div>
        )}
        {headerType === "IMAGE" && (
          <div className="w-full h-28 bg-slate-100 flex items-center justify-center overflow-hidden">
            {mediaPreviewUrl ? <img src={mediaPreviewUrl} alt="Header" className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-1 text-slate-400"><Image size={28} /><span className="text-[9px]">Image</span></div>}
          </div>
        )}
        {headerType === "VIDEO" && (
          <div className="w-full h-28 bg-slate-800 flex items-center justify-center overflow-hidden">
            {mediaPreviewUrl ? <video src={mediaPreviewUrl} className="w-full h-full object-cover" /> : <div className="flex flex-col items-center gap-1 text-slate-400"><Play size={28} /><span className="text-[9px]">Video</span></div>}
          </div>
        )}
        {headerType === "DOCUMENT" && (
          <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
            <FileText size={18} className="text-blue-500 shrink-0" />
            <span className="text-[10px] text-blue-700 font-semibold truncate">{mediaPreviewUrl ? mediaPreviewUrl.split("/").pop().split("\\").pop() : "Document"}</span>
          </div>
        )}
        {headerType === "LOCATION" && (
          <div className="bg-emerald-50 border-b border-emerald-100 p-2 flex items-start gap-2">
            <MapPin size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-emerald-800">{locationName || "Location Name"}</p>
              <p className="text-[9px] text-emerald-600">{locationAddress || "Address"}</p>
              {(locationLat || locationLng) && <p className="text-[8px] text-emerald-500 mt-0.5">{locationLat}, {locationLng}</p>}
            </div>
          </div>
        )}
        <div className="px-3 py-2.5">
          <p className="whitespace-pre-wrap text-[11px] text-slate-700">{pb || "Your message body will appear here..."}</p>
          {footer && <p className="text-[9px] text-slate-400 mt-1.5">{footer}</p>}
          <span className="text-[9px] text-slate-400 float-right mt-1.5">12:00 PM ✓✓</span>
        </div>
        {buttons && buttons.length > 0 && (
          <div className="border-t border-slate-100">
            {buttons.map((btn, i) => (
              <div key={i} className="px-3 py-1.5 text-center text-[10px] font-semibold text-[#125fe2] border-b border-slate-50 last:border-b-0">{btn.text || "Button"}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Templates() {
  const confirm = useConfirm();
  const toast   = useToast();
  const fileInputRef = useRef(null);

  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [syncing,   setSyncing]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState("");
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showWhatsAppSetup, setShowWhatsAppSetup] = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [showFooter,  setShowFooter]  = useState(false);
  const [showButtons, setShowButtons] = useState(false);

  // Sync state: Cooldown & Last Synced Timestamp
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [, setTick] = useState(0); // Force periodic re-render for relative timestamps

  const defaultForm = {
    name: "", category: "MARKETING", language: "en_US",
    headerType: "NONE", headerText: "",
    headerLocationName: "", headerLocationAddress: "", headerLocationLat: "", headerLocationLng: "",
    bodyText: "", bodyExampleValues: [], footerText: "", buttons: [],
  };
  const [form, setForm] = useState(defaultForm);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [mediaError, setMediaError] = useState("");

  const resetForm = () => {
    setForm(defaultForm);
    setMediaFile(null);
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaPreviewUrl(null);
    setMediaError("");
    setShowFooter(false);
    setShowButtons(false);
  };

  const loadTemplates = async () => {
    setLoading(true); setError("");
    const [res, sr] = await Promise.all([getTemplates(), getWhatsappStatus()]);
    if (res.success) {
      setTemplates(res.data);
      if (res.lastSyncedAt) setLastSyncedAt(res.lastSyncedAt);
    } else {
      setError(res.message);
    }
    if (sr.success) setIsWhatsAppConnected(!!sr.data?.isConnected);
    setLoading(false);
  };

  // Cooldown countdown ticker & relative time auto-refresher
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldownSec((prev) => (prev > 0 ? prev - 1 : 0));
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadTemplates();

    const socket = getSocket();
    if (!socket) return;

    const handleTemplateStatusUpdate = (data) => {
      console.log("⚡ Real-time template status update received:", data);
      setTemplates((prev) => {
        const idx = prev.findIndex((t) => t.id === data.templateId || (t.name === data.name && t.language === data.language));
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], status: data.status };
          return updated;
        }
        return prev;
      });

      if (data.status === "APPROVED") {
        toast.success(`🎉 Template "${data.name}" was approved by Meta!`);
      } else if (data.status === "REJECTED") {
        toast.error(`⚠️ Template "${data.name}" was rejected by Meta${data.reason ? `: ${data.reason}` : ""}`);
      } else {
        toast.info(`ℹ️ Template "${data.name}" status: ${data.status}`);
      }
    };

    const handleTemplatesSynced = (data) => {
      console.log("⚡ Templates auto-synced via socket:", data);
      if (data.lastSyncedAt) setLastSyncedAt(data.lastSyncedAt);
      loadTemplates();
      toast.success(`⚡ Automatically synced ${data.count} templates from WhatsApp!`);
    };

    socket.on("template_status_update", handleTemplateStatusUpdate);
    socket.on("templates_synced", handleTemplatesSynced);

    return () => {
      socket.off("template_status_update", handleTemplateStatusUpdate);
      socket.off("templates_synced", handleTemplatesSynced);
    };
  }, []);

  const handleSync = async () => {
    if (!isWhatsAppConnected) { setShowConnectModal(true); return; }
    if (cooldownSec > 0 || syncing) return;

    setSyncing(true); setError("");
    setCooldownSec(60); // 60s cooldown to protect Meta API rate limits

    const res = await syncTemplates();
    if (res.success) {
      toast.success(`Synced ${res.count} templates from Meta!`);
      if (res.lastSyncedAt) setLastSyncedAt(res.lastSyncedAt);
      loadTemplates();
    } else {
      toast.error(res.message || "Sync failed");
    }
    setSyncing(false);
  };

  const handleDelete = async (id) => {
    const ok = await confirm({ type: "danger", title: "Delete Template?", message: "This will delete the template locally and on Meta.", confirmLabel: "Delete Template" });
    if (!ok) return;
    const res = await deleteTemplate(id);
    if (res.success) { toast.success("Template deleted."); loadTemplates(); }
    else toast.error(res.message);
  };

  useEffect(() => {
    const count = countVars(form.bodyText);
    setForm(prev => {
      const cur = prev.bodyExampleValues || [];
      if (cur.length === count) return prev;
      return { ...prev, bodyExampleValues: Array.from({ length: count }, (_, i) => cur[i] ?? "") };
    });
  }, [form.bodyText]);

  const handleHeaderTypeChange = (val) => {
    setForm(prev => ({ ...prev, headerType: val, headerText: "", headerLocationName: "", headerLocationAddress: "", headerLocationLat: "", headerLocationLng: "" }));
    setMediaFile(null);
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaPreviewUrl(null); setMediaError("");
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    const ALLOWED = {
      IMAGE: ["image/jpeg","image/jpg","image/png","image/webp"],
      VIDEO: ["video/mp4","video/3gpp"],
      DOCUMENT: ["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation","text/plain"],
    };
    if (!ALLOWED[form.headerType]?.includes(file.type)) {
      const labels = { IMAGE: "JPEG, PNG, WebP", VIDEO: "MP4, 3GP", DOCUMENT: "PDF, Word, Excel, PowerPoint, TXT" };
      setMediaError(`Invalid file type. Allowed for ${form.headerType}: ${labels[form.headerType]}`); return;
    }
    const limitMB = HEADER_SIZE_MB[form.headerType] || 16;
    if (file.size > limitMB * 1048576) { setMediaError(`File too large. Max for ${form.headerType} is ${limitMB} MB. Your file is ${fmtSize(file.size)}.`); return; }
    setMediaError(""); setMediaFile(file);
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaPreviewUrl(URL.createObjectURL(file));
  };

  const addButton = (type) => {
    if (form.buttons.length >= 10) { toast.error("Maximum 10 buttons allowed."); return; }
    if (type === "URL" && form.buttons.filter(b => b.type === "URL").length >= 2) { toast.error("Max 2 URL buttons."); return; }
    if (type === "PHONE_NUMBER" && form.buttons.filter(b => b.type === "PHONE_NUMBER").length >= 1) { toast.error("Max 1 phone button."); return; }
    setForm(prev => ({ ...prev, buttons: [...prev.buttons, { type, text: "", url: "", phoneNumber: "" }] }));
  };

  const updateButton = (i, field, val) => setForm(prev => { const btns = [...prev.buttons]; btns[i] = { ...btns[i], [field]: val }; return { ...prev, buttons: btns }; });
  const removeButton = (i) => setForm(prev => ({ ...prev, buttons: prev.buttons.filter((_, idx) => idx !== i) }));

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.bodyText.trim()) { toast.error("Template name and body are required."); return; }
    if (form.headerType === "TEXT" && !form.headerText.trim()) { toast.error("Header text is required."); return; }
    if (["IMAGE","VIDEO","DOCUMENT"].includes(form.headerType) && !mediaFile) { toast.error(`Please select a ${form.headerType.toLowerCase()} file.`); return; }
    if (form.headerType === "LOCATION" && (!form.headerLocationLat || !form.headerLocationLng)) { toast.error("Latitude and longitude are required."); return; }
    if (countVars(form.bodyText) > 0 && form.bodyExampleValues.some(v => !v.trim())) { toast.error("Please fill all body variable examples."); return; }

    setSubmitting(true);
    const fd = new FormData();
    fd.append("name",     form.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));
    fd.append("category", form.category);
    fd.append("language", form.language);
    fd.append("headerType", form.headerType);
    fd.append("bodyText",   form.bodyText);
    if (form.footerText) fd.append("footerText", form.footerText);
    if (form.headerType === "TEXT") fd.append("headerText", form.headerText);
    if (form.headerType === "LOCATION") {
      fd.append("headerLocationName",    form.headerLocationName);
      fd.append("headerLocationAddress", form.headerLocationAddress);
      fd.append("headerLocationLat",     form.headerLocationLat);
      fd.append("headerLocationLng",     form.headerLocationLng);
    }
    if (mediaFile) fd.append("headerMedia", mediaFile);
    if (form.bodyExampleValues.length > 0) fd.append("bodyExampleValues", JSON.stringify(form.bodyExampleValues));
    if (form.buttons.length > 0) fd.append("buttons", JSON.stringify(form.buttons));

    const res = await createTemplate(fd);
    setSubmitting(false);
    if (res.success) { setShowModal(false); resetForm(); toast.success("Template submitted to Meta for review!"); loadTemplates(); }
    else toast.error(res.message || "Failed to create template.");
  };

  const StatusBadge = ({ status }) => {
    const cfg = { APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-100", PENDING: "bg-amber-50 text-amber-700 border-amber-100", REJECTED: "bg-rose-50 text-rose-700 border-rose-100", PAUSED: "bg-orange-50 text-orange-700 border-orange-100", DISABLED: "bg-slate-100 text-slate-500 border-slate-200" };
    return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${cfg[status] || cfg.PENDING}`}>{status === "APPROVED" ? <CheckCircle size={10} /> : <Clock size={10} />}<span className="capitalize">{status?.toLowerCase()}</span></span>;
  };

  const HeaderBadge = ({ headerType }) => {
    if (!headerType || headerType === "NONE") return null;
    const Icon = HEADER_ICON_MAP[headerType];
    return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">{Icon && <Icon size={9} />}{headerType}</span>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileCode className="text-[#125EF2]" size={24} /><span>WhatsApp Templates</span></h1>
          <p className="text-xs text-[color:var(--muted)] font-medium mt-1">Create, manage, and inspect WhatsApp pre-approved message templates.</p>
        </div>
        <div className="flex flex-col sm:items-end gap-1">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing || cooldownSec > 0}
              className="btn-secondary flex items-center gap-2 text-sm bg-white disabled:opacity-60 disabled:cursor-not-allowed transition"
              title={cooldownSec > 0 ? `Please wait ${cooldownSec}s before syncing again` : "Sync all templates from Meta"}
            >
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              <span>{syncing ? "Syncing..." : cooldownSec > 0 ? `Sync (${cooldownSec}s)` : "Sync from Meta"}</span>
            </button>
            <button onClick={() => { if (!isWhatsAppConnected) setShowConnectModal(true); else setShowModal(true); }} className="btn-primary flex items-center gap-2 text-sm shadow-sm">
              <Plus size={16} /><span>Create Template</span>
            </button>
          </div>
          {lastSyncedAt && (
            <span className="text-[11px] text-slate-400 font-medium tracking-tight pr-1">
              Last synced: {formatRelativeTime(lastSyncedAt)}
            </span>
          )}
        </div>
      </div>

      {!isWhatsAppConnected && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0"><AlertCircle size={20} /></div>
            <div><h4 className="text-sm font-bold text-amber-900">WhatsApp Not Connected</h4><p className="text-xs text-amber-700 mt-0.5">Connect your WABA in Settings to create and sync templates with Meta.</p></div>
          </div>
          <button onClick={() => setShowWhatsAppSetup(true)} className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white text-xs font-bold rounded-xl transition shadow-sm whitespace-nowrap shrink-0">Connect WhatsApp</button>
        </div>
      )}

      {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-800 font-semibold flex items-center gap-2"><AlertCircle size={15} />{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-sm text-slate-400">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-slate-400 italic border border-dashed rounded-3xl">No templates found. Create one or sync from Meta!</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {templates.map((temp) => (
            <div key={temp.id} className="card border border-slate-100 p-5 flex flex-col justify-between hover:shadow-md transition bg-white">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-800 text-sm truncate max-w-[180px]" title={temp.name}>{temp.name}</span>
                  <StatusBadge status={temp.status} />
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded border border-slate-200/40">{temp.category}</span>
                  <span className="text-[10px] text-slate-400 font-medium">Lang: {temp.language}</span>
                  <HeaderBadge headerType={temp.headerType} />
                </div>
                <div className="mt-4 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                  <p className="text-xs text-slate-600 font-mono leading-relaxed line-clamp-3">{getBodyText(temp.components) || <span className="italic text-slate-400">No body text</span>}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button onClick={() => handleDelete(temp.id)} className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition" title="Delete"><Trash2 size={15} /></button>
                <button onClick={() => setPreviewTemplate(temp)} className="btn-secondary py-1.5 px-3 text-[11px] font-semibold flex items-center gap-1 bg-white"><Eye size={12} /><span>Preview</span></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-4xl my-6 flex flex-col animate-in zoom-in-95 duration-150 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div><h2 className="text-lg font-bold text-slate-800">Create WhatsApp Template</h2><p className="text-xs text-slate-500 mt-0.5">Fill sections below and preview in real-time</p></div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition"><X size={18} /></button>
            </div>
            <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
              {/* Form */}
              <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-6 space-y-5 border-r border-slate-100">
                {/* §1 Template Info */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">1. Template Info</h3>
                  <div>
                    <label className="label text-xs font-semibold text-slate-700">Template Name</label>
                    <input type="text" required placeholder="e.g. order_shipped" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))} className="input" />
                    <p className="text-[9px] text-slate-400 mt-1">Lowercase letters, numbers, underscores only.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs font-semibold text-slate-700">Category</label>
                      <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                        <option value="MARKETING">Marketing</option>
                        <option value="UTILITY">Utility</option>
                        <option value="AUTHENTICATION">Authentication</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs font-semibold text-slate-700">Language</label>
                      <select className="input" value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                        <option value="en_US">English (US)</option>
                        <option value="en_GB">English (UK)</option>
                        <option value="hi">Hindi</option>
                        <option value="ar">Arabic</option>
                        <option value="es">Spanish</option>
                        <option value="pt_BR">Portuguese (BR)</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="id">Indonesian</option>
                        <option value="ta">Tamil</option>
                        <option value="te">Telugu</option>
                        <option value="ml">Malayalam</option>
                        <option value="kn">Kannada</option>
                        <option value="mr">Marathi</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-100" />

                {/* §2 Header */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">2. Header</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {HEADER_TYPES.map(ht => {
                      const Icon = ht.icon;
                      const active = form.headerType === ht.value;
                      return (
                        <button key={ht.value} type="button" onClick={() => handleHeaderTypeChange(ht.value)}
                          className={`flex flex-col items-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold transition ${active ? "border-[#125fe2] bg-blue-50 text-[#125fe2]" : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                          {Icon ? <Icon size={16} /> : <div className="w-4 h-4 rounded bg-slate-200" />}
                          {ht.label}
                        </button>
                      );
                    })}
                  </div>

                  {form.headerType === "TEXT" && (
                    <div>
                      <label className="label text-xs font-semibold text-slate-700">Header Text <span className="text-[10px] text-slate-400 font-normal">({form.headerText.length}/60)</span></label>
                      <input type="text" placeholder="e.g. Special Offer" maxLength={60} value={form.headerText} onChange={e => setForm(f => ({ ...f, headerText: e.target.value }))} className="input" />
                    </div>
                  )}

                  {["IMAGE","VIDEO","DOCUMENT"].includes(form.headerType) && (
                    <div>
                      <input ref={fileInputRef} type="file" accept={HEADER_ACCEPT[form.headerType]} className="hidden" onChange={e => handleFileSelect(e.target.files[0])} />
                      {!mediaFile ? (
                        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-200 hover:border-[#125fe2] rounded-2xl p-6 flex flex-col items-center gap-2 cursor-pointer transition group">
                          <Upload size={22} className="text-slate-400 group-hover:text-[#125fe2] transition" />
                          <p className="text-xs font-semibold text-slate-600 group-hover:text-[#125fe2]">Drop file here or click to browse</p>
                          <p className="text-[10px] text-slate-400">
                            {form.headerType === "IMAGE" && "JPEG, PNG, WebP · Max 5 MB"}
                            {form.headerType === "VIDEO" && "MP4, 3GP · Max 16 MB"}
                            {form.headerType === "DOCUMENT" && "PDF, Word, Excel, PowerPoint, TXT · Max 16 MB"}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 overflow-hidden">
                          {form.headerType === "IMAGE" && mediaPreviewUrl && <img src={mediaPreviewUrl} alt="Preview" className="w-full max-h-40 object-cover" />}
                          {form.headerType === "VIDEO" && mediaPreviewUrl && <video src={mediaPreviewUrl} controls className="w-full max-h-40" />}
                          <div className="px-3 py-2.5 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-2 min-w-0"><FileText size={14} className="text-slate-500 shrink-0" /><span className="text-xs text-slate-700 font-medium truncate">{mediaFile.name}</span><span className="text-[10px] text-slate-400 shrink-0">{fmtSize(mediaFile.size)}</span></div>
                            <button type="button" onClick={() => { setMediaFile(null); if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl); setMediaPreviewUrl(null); setMediaError(""); }} className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition ml-2"><X size={14} /></button>
                          </div>
                        </div>
                      )}
                      {mediaError && <div className="mt-2 text-[11px] text-rose-600 font-semibold flex items-center gap-1.5"><AlertCircle size={12} />{mediaError}</div>}
                    </div>
                  )}

                  {form.headerType === "LOCATION" && (
                    <div className="space-y-3">
                      {form.category === "AUTHENTICATION" && (
                        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-[11px] text-amber-800 font-semibold flex items-center gap-2"><AlertCircle size={13} /> LOCATION header is not compatible with AUTHENTICATION.</div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="label text-xs font-semibold text-slate-700">Location Name</label><input type="text" placeholder="e.g. Kochi Office" value={form.headerLocationName} onChange={e => setForm(f => ({ ...f, headerLocationName: e.target.value }))} className="input" /></div>
                        <div><label className="label text-xs font-semibold text-slate-700">Address</label><input type="text" placeholder="e.g. Kochi, Kerala" value={form.headerLocationAddress} onChange={e => setForm(f => ({ ...f, headerLocationAddress: e.target.value }))} className="input" /></div>
                        <div><label className="label text-xs font-semibold text-slate-700">Latitude</label><input type="number" step="0.000001" min="-90" max="90" placeholder="9.9312" value={form.headerLocationLat} onChange={e => setForm(f => ({ ...f, headerLocationLat: e.target.value }))} className="input" /></div>
                        <div><label className="label text-xs font-semibold text-slate-700">Longitude</label><input type="number" step="0.000001" min="-180" max="180" placeholder="76.2673" value={form.headerLocationLng} onChange={e => setForm(f => ({ ...f, headerLocationLng: e.target.value }))} className="input" /></div>
                      </div>
                      <p className="text-[10px] text-slate-400">These are default coordinates. You can override them per broadcast.</p>
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-100" />

                {/* §3 Body */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">3. Body</h3>
                  <div>
                    <label className="label text-xs font-semibold text-slate-700">Message Body <span className="text-[10px] text-slate-400 font-normal">({form.bodyText.length}/1024)</span></label>
                    <textarea required rows={4} maxLength={1024} placeholder="Hello {{1}}, your order {{2}} is confirmed!" value={form.bodyText} onChange={e => setForm(f => ({ ...f, bodyText: e.target.value }))} className="input py-2.5 px-3 font-mono text-xs resize-none" />
                    <p className="text-[10px] text-[color:var(--muted)] mt-1">Use <code className="font-semibold text-slate-800">{"{{1}}"}</code>, <code className="font-semibold text-slate-800">{"{{2}}"}</code> etc. for variables.</p>
                  </div>
                  {form.bodyExampleValues.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-slate-600">Sample values for variables (required by Meta):</p>
                      {form.bodyExampleValues.map((val, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 shrink-0 w-16">{"{{"}{i + 1}{"}}"}</span>
                          <input type="text" required placeholder={`Sample for {{${i + 1}}}`} value={val} onChange={e => { const arr = [...form.bodyExampleValues]; arr[i] = e.target.value; setForm(f => ({ ...f, bodyExampleValues: arr })); }} className="input py-1.5 text-xs" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-100" />

                {/* §4 Footer */}
                <div>
                  <button type="button" onClick={() => setShowFooter(v => !v)} className="flex items-center justify-between w-full text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-700 transition">
                    <span>4. Footer (optional)</span>{showFooter ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showFooter && (
                    <div className="mt-3">
                      <label className="label text-xs font-semibold text-slate-700">Footer Text <span className="text-[10px] text-slate-400 font-normal">({(form.footerText || "").length}/60)</span></label>
                      <input type="text" maxLength={60} placeholder="e.g. Reply STOP to unsubscribe" value={form.footerText} onChange={e => setForm(f => ({ ...f, footerText: e.target.value }))} className="input" />
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-100" />

                {/* §5 Buttons */}
                <div>
                  <button type="button" onClick={() => setShowButtons(v => !v)} className="flex items-center justify-between w-full text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-700 transition">
                    <span>5. Buttons (optional){form.buttons.length > 0 && ` — ${form.buttons.length}/10`}</span>{showButtons ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showButtons && (
                    <div className="mt-3 space-y-3">
                      {form.buttons.map((btn, i) => (
                        <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                              {btn.type === "QUICK_REPLY" && <MessageSquare size={11} />}{btn.type === "URL" && <Link size={11} />}{btn.type === "PHONE_NUMBER" && <Phone size={11} />}
                              {btn.type.replace("_", " ")}
                            </span>
                            <button type="button" onClick={() => removeButton(i)} className="text-rose-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition"><X size={12} /></button>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-600 font-semibold block mb-1">Button Text ({btn.text.length}/25)</label>
                            <input type="text" maxLength={25} placeholder="e.g. Shop Now" value={btn.text} onChange={e => updateButton(i, "text", e.target.value)} className="input py-1.5 text-xs" />
                          </div>
                          {btn.type === "URL" && <div><label className="text-[10px] text-slate-600 font-semibold block mb-1">URL</label><input type="url" placeholder="https://example.com/{{1}}" value={btn.url} onChange={e => updateButton(i, "url", e.target.value)} className="input py-1.5 text-xs font-mono" /></div>}
                          {btn.type === "PHONE_NUMBER" && <div><label className="text-[10px] text-slate-600 font-semibold block mb-1">Phone Number</label><input type="tel" placeholder="+919876543210" value={btn.phoneNumber} onChange={e => updateButton(i, "phoneNumber", e.target.value)} className="input py-1.5 text-xs" /></div>}
                        </div>
                      ))}
                      <div className="flex gap-2 flex-wrap">
                        <button type="button" onClick={() => addButton("QUICK_REPLY")} className="btn-secondary py-1.5 px-3 text-[11px] flex items-center gap-1"><MessageSquare size={12} /> Quick Reply</button>
                        <button type="button" onClick={() => addButton("URL")} className="btn-secondary py-1.5 px-3 text-[11px] flex items-center gap-1"><Link size={12} /> URL</button>
                        <button type="button" onClick={() => addButton("PHONE_NUMBER")} className="btn-secondary py-1.5 px-3 text-[11px] flex items-center gap-1"><Phone size={12} /> Phone Number</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="btn-secondary py-2.5 px-4 text-xs font-semibold">Cancel</button>
                  <button type="submit" disabled={submitting} className="btn-primary py-2.5 px-5 text-xs font-bold disabled:opacity-60">{submitting ? "Submitting…" : "Submit to Meta"}</button>
                </div>
              </form>

              {/* Live Preview */}
              <div className="w-full lg:w-72 shrink-0 p-6 bg-slate-50 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Live Preview</h3>
                <div className="sticky top-0">
                  <TemplatePreview
                    headerType={form.headerType} headerText={form.headerText} mediaPreviewUrl={mediaPreviewUrl}
                    locationName={form.headerLocationName} locationAddress={form.headerLocationAddress}
                    locationLat={form.headerLocationLat} locationLng={form.headerLocationLng}
                    body={form.bodyText} footer={form.footerText} buttons={form.buttons}
                  />
                  <p className="text-[9px] text-slate-400 mt-3 text-center">Preview updates in real time</p>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PREVIEW MODAL */}
      {previewTemplate && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewTemplate(null)}>
          <div className="bg-slate-900 text-white rounded-[40px] p-4 w-72 border-8 border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-800 rounded-full" />
            <div className="mt-5 flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400">WhatsApp Preview</span>
              <button onClick={() => setPreviewTemplate(null)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"><X size={14} /></button>
            </div>
            <div className="mt-4">
              <TemplatePreview
                headerType={previewTemplate.headerType || "NONE"}
                headerText={previewTemplate.headerText}
                mediaPreviewUrl={previewTemplate.headerMediaUrl ? `${BACKEND_URL}/${previewTemplate.headerMediaUrl.replace(/\\/g, "/")}` : null}
                locationName={previewTemplate.headerLocationName} locationAddress={previewTemplate.headerLocationAddress}
                locationLat={previewTemplate.headerLocationLat} locationLng={previewTemplate.headerLocationLng}
                body={getBodyText(previewTemplate.components)}
                footer={previewTemplate.footerText || getFooterText(previewTemplate.components)}
                buttons={previewTemplate.buttons || getButtons(previewTemplate.components)}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      <WhatsAppRequiredModal isOpen={showConnectModal} onClose={() => setShowConnectModal(false)} onConnect={() => setShowWhatsAppSetup(true)} title="WhatsApp Account Required" description="Connect your WABA to create and sync templates with Meta." feature="Templates" />
      {showWhatsAppSetup && <WhatsAppConnect onSuccess={() => { setShowWhatsAppSetup(false); setIsWhatsAppConnected(true); loadTemplates(); toast.success("WhatsApp connected!"); }} onClose={() => setShowWhatsAppSetup(false)} />}
    </div>
  );
}
