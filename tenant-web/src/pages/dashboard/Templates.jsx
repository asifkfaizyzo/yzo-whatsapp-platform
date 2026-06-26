// src/pages/dashboard/Templates.jsx

import React, { useState } from "react";
import { 
  FileCode, 
  Plus, 
  Search, 
  CheckCircle, 
  Clock, 
  X,
  Smartphone,
  Eye
} from "lucide-react";

export default function Templates() {
  const [templates, setTemplates] = useState([
    {
      id: 1,
      name: "summer_sale_2026",
      category: "Marketing",
      language: "en (English)",
      status: "approved",
      body: "Hello {{1}}, our Summer Clearance Sale is officially LIVE! Use code {{2}} to get {{3}}% off on all items. Shop here: {{4}}",
    },
    {
      id: 2,
      name: "monthly_newsletter",
      category: "Marketing",
      language: "en (English)",
      status: "approved",
      body: "Hey {{1}}, check out this month's updates and tips for WhatsApp Automation in our newsletter: {{2}}",
    },
    {
      id: 3,
      name: "customer_feedback",
      category: "Utility",
      language: "en (English)",
      status: "approved",
      body: "Hi {{1}}, thank you for chatting with us today. We would love to hear your feedback. Please rate us here: {{2}}",
    },
    {
      id: 4,
      name: "cart_recovery",
      category: "Marketing",
      language: "en (English)",
      status: "pending",
      body: "Hi {{1}}, we noticed you left some items in your cart. Complete your purchase now and get free shipping: {{2}}",
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    category: "Marketing",
    body: "",
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newTemplate.name.trim() || !newTemplate.body.trim()) return;

    const formattedName = newTemplate.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    
    const created = {
      id: templates.length + 1,
      name: formattedName,
      category: newTemplate.category,
      language: "en (English)",
      status: "pending",
      body: newTemplate.body,
    };

    setTemplates([created, ...templates]);
    setShowModal(false);
    setNewTemplate({ name: "", category: "Marketing", body: "" });
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
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center justify-center gap-2 text-sm shadow-sm"
        >
          <Plus size={16} />
          <span>Create Template</span>
        </button>
      </div>

      {/* Templates Catalog */}
      <div className="grid gap-6 md:grid-cols-2">
        {templates.map((temp) => (
          <div key={temp.id} className="card border border-slate-100 p-5 flex flex-col justify-between hover:shadow-md transition duration-150">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-800 text-sm truncate max-w-[200px]">
                  {temp.name}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                  temp.status === "approved"
                    ? "bg-[#EAF2FE] text-[#125EF2] border-[#CFE0FD]"
                    : "bg-amber-50 text-amber-700 border-amber-100"
                }`}>
                  {temp.status === "approved" ? <CheckCircle size={10} /> : <Clock size={10} />}
                  <span className="capitalize">{temp.status}</span>
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
                  {temp.body}
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-50 flex items-center justify-end gap-2">
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

      {/* ── Meta Template Creator Modal ── */}
      {showModal && (
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
              {/* Template Name */}
              <div>
                <label className="label">Template Name</label>
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

              {/* Category */}
              <div>
                <label className="label">Category</label>
                <select 
                  className="input"
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                >
                  <option value="Marketing">Marketing (Promos, Offers)</option>
                  <option value="Utility">Utility (Transaction receipts, updates)</option>
                  <option value="Authentication">Authentication (OTPs, Security codes)</option>
                </select>
              </div>

              {/* Body Text */}
              <div>
                <label className="label">Template Body Text</label>
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

              {/* Actions */}
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
        </div>
      )}

      {/* ── Smartphone Preview Modal ── */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white rounded-[40px] p-4 w-72 border-8 border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-150 shrink-0">
            {/* Phone Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-800 rounded-full"></div>
            
            {/* Phone Header */}
            <div className="mt-5 flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-[10px] font-semibold text-slate-400">WhatsApp Preview</span>
              <button 
                onClick={() => setPreviewTemplate(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X size={14} />
              </button>
            </div>

            {/* Phone Screen Mock */}
            <div className="bg-[#efeae2] h-96 rounded-2xl p-3 flex flex-col justify-end mt-4 overflow-hidden relative">
              {/* Wallpaper Doodles Pattern Mock */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#125EF2_1px,transparent_1px)] [background-size:16px_16px]"></div>
              
              {/* Message Bubble */}
              <div className="bg-white text-slate-800 rounded-2xl rounded-tl-none p-3 shadow-sm border border-slate-200/50 max-w-[90%] text-[11px] leading-relaxed relative z-10 font-sans">
                <p className="whitespace-pre-wrap">{previewTemplate.body.replace(/\{\{\d\}\}/g, "...")}</p>
                <span className="text-[9px] text-slate-400 float-right mt-1.5">12:00 PM</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
