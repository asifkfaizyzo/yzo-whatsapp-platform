// src/pages/dashboard/Broadcasts.jsx

import React, { useState } from "react";
import { 
  Megaphone, 
  Plus, 
  Search, 
  Send, 
  Calendar, 
  X, 
  CheckCircle, 
  Info,
  Clock
} from "lucide-react";

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState([
    { id: 1, name: "Summer Promo Campaign", template: "summer_sale_2026", status: "sent", sentTime: "May 29, 2026, 10:00 AM", total: 12500, delivered: 12390, read: 10525, failed: 110 },
    { id: 2, name: "Monthly Newsletter Update", template: "monthly_newsletter", status: "sent", sentTime: "May 15, 2026, 04:30 PM", total: 10800, delivered: 10780, read: 8845, failed: 20 },
    { id: 3, name: "Feedback Survey Alert", template: "customer_feedback", status: "sent", sentTime: "May 08, 2026, 11:15 AM", total: 5400, delivered: 5340, read: 4293, failed: 60 },
    { id: 4, name: "Abandoned Cart Reminder", template: "cart_recovery", status: "scheduled", sentTime: "June 02, 2026, 09:00 AM", total: 1850, delivered: 0, read: 0, failed: 0 },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    template: "summer_sale_2026",
    schedule: "now",
    scheduledTime: "",
  });

  const handleCreateCampaign = (e) => {
    e.preventDefault();
    if (!newCampaign.name.trim()) return;

    const created = {
      id: broadcasts.length + 1,
      name: newCampaign.name,
      template: newCampaign.template,
      status: newCampaign.schedule === "now" ? "sent" : "scheduled",
      sentTime: newCampaign.schedule === "now" 
        ? new Date().toLocaleString() 
        : new Date(newCampaign.scheduledTime).toLocaleString() || "Scheduled Date",
      total: Math.floor(Math.random() * 5000) + 500,
      delivered: 0,
      read: 0,
      failed: 0,
    };

    setBroadcasts([created, ...broadcasts]);
    setShowModal(false);
    setNewCampaign({ name: "", template: "summer_sale_2026", schedule: "now", scheduledTime: "" });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Megaphone className="text-emerald-600" size={24} />
            <span>Broadcast Campaigns</span>
          </h1>
          <p className="text-xs text-[color:var(--muted)] font-medium mt-1">
            Send WhatsApp templates to large audiences and track open rates in real-time.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center justify-center gap-2 text-sm shadow-sm"
        >
          <Plus size={16} />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Campaigns Listing */}
      <div className="card border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search campaigns..."
              className="input pl-9 py-1.5 text-xs bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Filter:</span>
            <select className="input py-1 px-3 text-xs bg-white w-28">
              <option>All Campaigns</option>
              <option>Sent</option>
              <option>Scheduled</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-[color:var(--muted)] font-bold border-b border-slate-100 bg-slate-50/20">
                <th className="p-4 font-semibold">Campaign Detail</th>
                <th className="p-4 font-semibold">Template Used</th>
                <th className="p-4 font-semibold text-center">Status</th>
                <th className="p-4 font-semibold text-right">Recipients</th>
                <th className="p-4 font-semibold text-right">Read Rate</th>
                <th className="p-4 font-semibold text-right">Delivery Success</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs">
              {broadcasts.map((b) => {
                const readPercent = b.total > 0 ? ((b.read / b.total) * 100).toFixed(1) : "0";
                const deliveryPercent = b.total > 0 ? ((b.delivered / b.total) * 100).toFixed(1) : "0";

                return (
                  <tr key={b.id} className="hover:bg-slate-50/40">
                    <td className="p-4">
                      <p className="font-bold text-slate-800 text-sm">{b.name}</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">{b.sentTime}</p>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/50">
                        {b.template}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                        b.status === "sent" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                          : "bg-amber-50 text-amber-700 border-amber-100"
                      }`}>
                        {b.status === "sent" ? <CheckCircle size={10} /> : <Clock size={10} />}
                        <span className="capitalize">{b.status}</span>
                      </span>
                    </td>
                    <td className="p-4 text-right font-semibold text-slate-800 text-sm">
                      {b.total.toLocaleString()}
                    </td>
                    <td className="p-4 text-right font-semibold text-blue-600 text-sm">
                      {b.status === "sent" ? `${readPercent}%` : "-"}
                    </td>
                    <td className="p-4 text-right font-semibold text-emerald-600 text-sm">
                      {b.status === "sent" ? `${deliveryPercent}%` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── New Broadcast Campaign Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Launch New Broadcast</h2>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-50 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateCampaign} className="p-6 space-y-4">
              {/* Campaign Name */}
              <div>
                <label className="label">Campaign Name</label>
                <input
                  type="text"
                  placeholder="e.g. Summer Clearance Launch"
                  required
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  className="input"
                />
              </div>

              {/* Message Template */}
              <div>
                <label className="label">WhatsApp Template</label>
                <select 
                  className="input"
                  value={newCampaign.template}
                  onChange={(e) => setNewCampaign({ ...newCampaign, template: e.target.value })}
                >
                  <option value="summer_sale_2026">summer_sale_2026 (Promo)</option>
                  <option value="monthly_newsletter">monthly_newsletter (Newsletter)</option>
                  <option value="customer_feedback">customer_feedback (Survey)</option>
                  <option value="cart_recovery">cart_recovery (Reminder)</option>
                </select>
                <p className="text-[10px] text-[color:var(--muted)] font-medium mt-1.5 flex items-center gap-1">
                  <Info size={11} />
                  <span>Only approved WhatsApp templates can be used.</span>
                </p>
              </div>

              {/* Scheduling Options */}
              <div>
                <label className="label">Send Schedule</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewCampaign({ ...newCampaign, schedule: "now" })}
                    className={`py-3.5 px-4 rounded-xl border text-sm font-semibold flex flex-col items-center gap-1 transition ${
                      newCampaign.schedule === "now"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Send size={16} />
                    <span>Send Immediately</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCampaign({ ...newCampaign, schedule: "later" })}
                    className={`py-3.5 px-4 rounded-xl border text-sm font-semibold flex flex-col items-center gap-1 transition ${
                      newCampaign.schedule === "later"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Calendar size={16} />
                    <span>Schedule for later</span>
                  </button>
                </div>
              </div>

              {newCampaign.schedule === "later" && (
                <div>
                  <label className="label">Scheduled Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={newCampaign.scheduledTime}
                    onChange={(e) => setNewCampaign({ ...newCampaign, scheduledTime: e.target.value })}
                    className="input text-xs"
                  />
                </div>
              )}

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
                  {newCampaign.schedule === "now" ? "Send Now" : "Schedule Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
