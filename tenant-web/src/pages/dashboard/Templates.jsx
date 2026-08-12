import React, { useState, useEffect } from "react";
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
  AlertCircle
} from "lucide-react";
import { getTemplates, createTemplate, syncTemplates, deleteTemplate } from "../../services/template.service";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";

export default function Templates() {
  const confirm = useConfirm();
  const toast = useToast();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "MARKETING",
    body: "",
  });

  const loadTemplates = async () => {
    setLoading(true);
    setError("");
    const res = await getTemplates();
    if (res.success) {
      setTemplates(res.data);
    } else {
      setError(res.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setError("");
    const res = await syncTemplates();
    if (res.success) {
      toast.success(`Synced ${res.count} templates from Meta successfully!`);
      loadTemplates();
    } else {
      toast.error(res.message || "Failed to sync templates");
    }
    setSyncing(false);
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      type: "danger",
      title: "Delete Template?",
      message: "This will delete the template locally and on Meta.",
      detail: "This action cannot be undone and may affect active broadcasts using this template.",
      confirmLabel: "Delete Template",
    });
    if (!ok) return;
    const res = await deleteTemplate(id);
    if (res.success) {
      toast.success("Template deleted successfully.");
      loadTemplates();
    } else {
      toast.error(res.message);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTemplate.name.trim() || !newTemplate.body.trim()) return;

    const formattedName = newTemplate.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    
    // Construct Meta components structure
    const components = [
      {
        type: "BODY",
        text: newTemplate.body
      }
    ];

    const res = await createTemplate({
      name: formattedName,
      category: newTemplate.category,
      language: "en_US",
      components
    });

    if (res.success) {
      setShowModal(false);
      setNewTemplate({ name: "", category: "MARKETING", body: "" });
      toast.success("Template created successfully!");
      loadTemplates();
    } else {
      toast.error("Failed to create template: " + res.message);
    }
  };

  const getBodyText = (components) => {
    const bodyComp = (components || []).find(c => c.type === 'BODY');
    return bodyComp ? bodyComp.text : '';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileCode className="text-[#125EF2]" size={24} />
            <span>WhatsApp Message Templates</span>
          </h1>
          <p className="text-xs text-[color:var(--muted)] font-medium mt-1">
            Create, manage, and inspect WhatsApp pre-approved templates synced with Meta.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="btn-secondary flex items-center gap-2 text-sm bg-white"
          >
            <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
            <span>Sync from Meta</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            <Plus size={16} />
            <span>Create Template</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs text-rose-800 font-semibold flex items-center gap-2">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Templates Catalog */}
      {loading ? (
        <div className="text-center py-12 text-sm text-slate-400">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-slate-450 italic border border-dashed rounded-3xl">
          No templates found. Create one or sync from Meta!
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {templates.map((temp) => (
            <div key={temp.id} className="card border border-slate-100 p-5 flex flex-col justify-between hover:shadow-md transition duration-150 bg-white">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-800 text-sm truncate max-w-[200px]" title={temp.name}>
                    {temp.name}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                    temp.status === "APPROVED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : temp.status === "PENDING"
                      ? "bg-amber-50 text-amber-700 border-amber-100"
                      : "bg-rose-50 text-rose-700 border-rose-100"
                  }`}>
                    {temp.status === "APPROVED" ? <CheckCircle size={10} /> : <Clock size={10} />}
                    <span className="capitalize">{temp.status.toLowerCase()}</span>
                  </span>
                </div>

                <div className="mt-2.5 flex items-center gap-3">
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded border border-slate-200/40">
                    {temp.category}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Language: {temp.language}
                  </span>
                </div>

                <div className="mt-4 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                  <p className="text-xs text-slate-600 font-mono leading-relaxed line-clamp-3">
                    {getBodyText(temp.components)}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-55 flex items-center justify-between">
                <button
                  onClick={() => handleDelete(temp.id)}
                  className="text-slate-405 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition"
                  title="Delete Template"
                >
                  <Trash2 size={15} />
                </button>
                <button 
                  onClick={() => setPreviewTemplate(temp)}
                  className="btn-secondary py-1.5 px-3 text-[11px] font-semibold flex items-center gap-1 bg-white"
                >
                  <Eye size={12} />
                  <span>Preview Mock</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit Template Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Submit New Template</h2>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="label text-xs font-semibold text-slate-700">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. order_shipment_notification"
                  required
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  className="input"
                />
                <p className="text-[9px] text-[color:var(--muted)] mt-1 font-medium">
                  Use lowercase letters, numbers, and underscores only.
                </p>
              </div>

              <div>
                <label className="label text-xs font-semibold text-slate-700">Category</label>
                <select 
                  className="input"
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                >
                  <option value="MARKETING">Marketing (Promos, Offers)</option>
                  <option value="UTILITY">Utility (Transaction receipts, updates)</option>
                  <option value="AUTHENTICATION">Authentication (OTPs, Security codes)</option>
                </select>
              </div>

              <div>
                <label className="label text-xs font-semibold text-slate-700">Template Body Text</label>
                <textarea
                  placeholder="Hello {{1}}, your order {{2}} has been confirmed! Track it here: {{3}}"
                  required
                  rows={4}
                  value={newTemplate.body}
                  onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                  className="input py-2.5 px-3 font-mono text-xs resize-none"
                />
                <p className="text-[10px] text-[color:var(--muted)] font-medium mt-1">
                  Use curly brackets with numbers like <code className="font-semibold text-slate-800">{"{{1}}"}</code>, <code className="font-semibold text-slate-800">{"{{2}}"}</code> for placeholders.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary py-2.5 px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2.5 px-5 text-xs font-bold"
                >
                  Submit to Meta
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Smartphone Preview Modal */}
      {previewTemplate && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-[40px] p-4 w-72 border-8 border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-150 shrink-0">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-800 rounded-full"></div>
            
            <div className="mt-5 flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400">WhatsApp Preview</span>
              <button 
                onClick={() => setPreviewTemplate(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X size={14} />
              </button>
            </div>

            <div className="bg-[#efeae2] h-96 rounded-2xl p-3 flex flex-col justify-end mt-4 overflow-hidden relative">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#059669_1px,transparent_1px)] [background-size:16px_16px]"></div>
              
              <div className="bg-white text-slate-800 rounded-2xl rounded-tl-none p-3 shadow-sm border border-slate-200/50 max-w-[90%] text-[11px] leading-relaxed relative z-10 font-sans">
                <p className="whitespace-pre-wrap">{getBodyText(previewTemplate.components).replace(/\{\{\d\}\}/g, "...")}</p>
                <span className="text-[9px] text-slate-400 float-right mt-1.5">12:00 PM</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}