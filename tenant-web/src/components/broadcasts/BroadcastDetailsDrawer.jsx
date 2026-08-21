import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Search,
  Download,
  RotateCcw,
  Pause,
  Play,
  CheckCircle2,
  CheckCheck,
  Check,
  AlertTriangle,
  Clock,
  HelpCircle,
  TrendingUp,
  Users,
  Send,
  Eye,
  Info,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Loader2
} from "lucide-react";
import {
  getBroadcastRecipients,
  exportBroadcastRecipients,
  retryFailedBroadcast,
  pauseBroadcast,
  resumeBroadcast
} from "../../services/broadcast.service";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { io } from "socket.io-client";
import { useAuthStore } from "../../store/useAuthStore";

export default function BroadcastDetailsDrawer({
  broadcastId,
  isOpen,
  onClose,
  onCampaignUpdated
}) {
  const toast = useToast();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedError, setSelectedError] = useState(null);

  // Fetch paginated recipient data
  const fetchRecipients = useCallback(async (targetPage = 1, status = activeTab, query = searchTerm) => {
    if (!broadcastId) return;
    setLoading(true);
    const res = await getBroadcastRecipients(broadcastId, {
      page: targetPage,
      limit: 25,
      status: status === "ALL" ? "" : status,
      search: query
    });

    if (res.success && res.data) {
      setData(res.data);
      setPage(res.data.pagination?.page || 1);
    } else {
      toast.error(res.message || "Failed to load broadcast delivery logs.");
    }
    setLoading(false);
  }, [broadcastId, activeTab, searchTerm, toast]);

  useEffect(() => {
    if (isOpen && broadcastId) {
      fetchRecipients(1, activeTab, searchTerm);
    }
  }, [isOpen, broadcastId, activeTab, fetchRecipients]);

  // Live Socket Sync for active campaign stats & status in Drawer
  useEffect(() => {
    if (!isOpen || !broadcastId) return;

    const userStr = localStorage.getItem("user");
    if (!userStr) return;
    let activeTenantId = "";
    try {
      const userObj = JSON.parse(userStr);
      activeTenantId = userObj.tenantId || "";
    } catch (e) {
      return;
    }
    if (!activeTenantId) return;

    const socketUrl = import.meta.env.VITE_BACKEND_URL;
    const token = useAuthStore.getState().accessToken;
    const socket = io(socketUrl, {
      auth: { token },
      transports: ["websocket"]
    });

    socket.emit("join_tenant", activeTenantId);

    socket.on("broadcast_update", (updateData) => {
      if (updateData.broadcastId === broadcastId) {
        setData(prev => {
          if (!prev) return prev;
          const updatedCampaign = {
            ...prev.campaign,
            status: updateData.status || prev.campaign.status
          };
          const updatedCounts = {
            ...prev.counts,
            sent: updateData.sent !== undefined ? updateData.sent : prev.counts.sent,
            delivered: updateData.delivered !== undefined ? updateData.delivered : prev.counts.delivered,
            read: updateData.read !== undefined ? updateData.read : prev.counts.read,
            failed: updateData.failed !== undefined ? updateData.failed : prev.counts.failed,
          };
          return {
            ...prev,
            campaign: updatedCampaign,
            counts: updatedCounts
          };
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [isOpen, broadcastId]);

  // Handle Tab Switch
  const handleTabChange = (status) => {
    setActiveTab(status);
    setPage(1);
  };

  // Handle Search Input with debounce
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchRecipients(1, activeTab, searchTerm);
  };

  // CSV Export
  const handleExportCSV = async () => {
    setActionLoading(true);
    const res = await exportBroadcastRecipients(broadcastId);
    if (res.success && res.data) {
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const campaignName = (data?.campaign?.name || "broadcast").replace(/[^a-zA-Z0-9_-]/g, "_");
      link.setAttribute("download", `broadcast_${campaignName}_delivery_report.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Broadcast delivery log exported successfully!");
    } else {
      toast.error(res.message || "Failed to export report.");
    }
    setActionLoading(false);
  };

  // Retry Failed Recipients
  const handleRetryFailed = async () => {
    const ok = await confirm({
      type: "warning",
      title: "Retry Failed Messages?",
      message: "This will re-queue all failed recipients with recoverable errors (e.g. rate limits or network issues). Permanently invalid phone numbers will be skipped automatically.",
      confirmLabel: "Retry Now"
    });
    if (!ok) return;

    setActionLoading(true);
    const res = await retryFailedBroadcast(broadcastId);
    if (res.success) {
      toast.success(res.data?.message || "Failed recipients re-queued for delivery!");
      fetchRecipients(1, activeTab, searchTerm);
      if (onCampaignUpdated) onCampaignUpdated();
    } else {
      toast.error(res.message || "Failed to retry broadcast.");
    }
    setActionLoading(false);
  };

  // Pause Campaign
  const handlePause = async () => {
    setActionLoading(true);
    const res = await pauseBroadcast(broadcastId);
    if (res.success) {
      toast.success("Broadcast campaign paused.");
      fetchRecipients(page, activeTab, searchTerm);
      if (onCampaignUpdated) onCampaignUpdated();
    } else {
      toast.error(res.message || "Failed to pause campaign.");
    }
    setActionLoading(false);
  };

  // Resume Campaign
  const handleResume = async () => {
    setActionLoading(true);
    const res = await resumeBroadcast(broadcastId);
    if (res.success) {
      toast.success("Broadcast campaign resumed!");
      fetchRecipients(page, activeTab, searchTerm);
      if (onCampaignUpdated) onCampaignUpdated();
    } else {
      toast.error(res.message || "Failed to resume campaign.");
    }
    setActionLoading(false);
  };

  if (!isOpen) return null;

  const campaign = data?.campaign || {};
  const counts = data?.counts || { all: 0, sent: 0, delivered: 0, read: 0, failed: 0, pending: 0 };
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };
  const recipients = data?.recipients || [];

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#125EF2] border border-blue-100 flex items-center justify-center shrink-0">
              <Send size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-800 truncate">
                  {campaign.name || "Broadcast Details & Delivery Logs"}
                </h2>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                  campaign.status === "COMPLETED"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : campaign.status === "PAUSED"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : campaign.status === "SCHEDULED"
                    ? "bg-purple-50 text-purple-700 border-purple-100"
                    : campaign.status === "CANCELLED"
                    ? "bg-rose-50 text-rose-700 border-rose-100"
                    : "bg-blue-50 text-blue-700 border-blue-100"
                }`}>
                  <span className="capitalize">{campaign.status ? campaign.status.toLowerCase() : "loading..."}</span>
                </span>
                {campaign.templateName && (
                  <span className="font-mono text-[10px] bg-slate-200/60 text-slate-700 font-semibold px-2 py-0.5 rounded border border-slate-300/60">
                    {campaign.templateName}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Launched {campaign.createdAt ? new Date(campaign.createdAt).toLocaleString() : "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Pause / Resume Controls */}
            {campaign.status === "PROCESSING" && (
              <button
                type="button"
                onClick={handlePause}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition shadow-2xs"
                title="Pause active broadcast sending"
              >
                <Pause size={13} />
                <span>Pause</span>
              </button>
            )}

            {campaign.status === "PAUSED" && (
              <button
                type="button"
                onClick={handleResume}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-2xs"
                title="Resume sending broadcast"
              >
                <Play size={13} />
                <span>Resume</span>
              </button>
            )}

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={actionLoading || recipients.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition shadow-2xs"
              title="Download Full Delivery Audit Report (CSV)"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Precision Funnel Overview Cards */}
        <div className="p-6 pb-4 border-b border-slate-100 bg-white grid grid-cols-2 sm:grid-cols-5 gap-3 shrink-0">
          {/* Total Targeted */}
          <div className="bg-slate-50/80 border border-slate-200/60 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[11px] font-bold">Targeted</span>
              <Users size={14} className="text-slate-400" />
            </div>
            <div className="mt-2">
              <span className="text-lg font-black text-slate-800">{counts.all.toLocaleString()}</span>
              <span className="text-[10px] text-slate-400 font-semibold block">100% audience</span>
            </div>
          </div>

          {/* Sent */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-600">
              <span className="text-[11px] font-bold">Sent to Meta</span>
              <Send size={14} className="text-blue-500" />
            </div>
            <div className="mt-2">
              <span className="text-lg font-black text-blue-900">{counts.sent.toLocaleString()}</span>
              <span className="text-[10px] text-blue-600 font-semibold block">API Accepted</span>
            </div>
          </div>

          {/* Delivered */}
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-600">
              <span className="text-[11px] font-bold">Delivered</span>
              <CheckCheck size={15} className="text-emerald-500" />
            </div>
            <div className="mt-2">
              <span className="text-lg font-black text-emerald-900">{counts.delivered.toLocaleString()}</span>
              <span className="text-[10px] text-emerald-700 font-semibold block">
                {campaign.rates?.deliveryRate || "0.0"}% delivery rate
              </span>
            </div>
          </div>

          {/* Read */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-indigo-600">
              <span className="text-[11px] font-bold">Read / Opened</span>
              <Eye size={14} className="text-indigo-500" />
            </div>
            <div className="mt-2">
              <span className="text-lg font-black text-indigo-900">{counts.read.toLocaleString()}</span>
              <span className="text-[10px] text-indigo-700 font-semibold block">
                {campaign.rates?.readRate || "0.0"}% read rate
              </span>
            </div>
          </div>

          {/* Failed */}
          <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-rose-600">
              <span className="text-[11px] font-bold">Failed</span>
              <AlertTriangle size={14} className="text-rose-500" />
            </div>
            <div className="mt-2">
              <span className="text-lg font-black text-rose-900">{counts.failed.toLocaleString()}</span>
              <span className="text-[10px] text-rose-600 font-semibold block">
                {campaign.rates?.failureRate || "0.0"}% failure rate
              </span>
            </div>
          </div>
        </div>

        {/* Failed Action Banner (If failed recipients exist) */}
        {counts.failed > 0 && (
          <div className="px-6 py-2.5 bg-rose-50/90 border-b border-rose-100 flex items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 text-rose-900 font-medium">
              <AlertTriangle size={15} className="text-rose-600 shrink-0" />
              <span>
                <strong>{counts.failed} messages failed.</strong> Filter by <strong>Failed</strong> tab below to inspect Meta error codes and reasons.
              </span>
            </div>
            <button
              type="button"
              onClick={handleRetryFailed}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-2xs shrink-0"
            >
              <RotateCcw size={12} />
              <span>Retry Recoverable</span>
            </button>
          </div>
        )}

        {/* Filter Tabs & Search Bar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: "ALL", label: "All", count: counts.all },
              { id: "READ", label: "Read", count: counts.read, color: "text-indigo-600" },
              { id: "DELIVERED", label: "Delivered", count: counts.delivered, color: "text-emerald-600" },
              { id: "SENT", label: "Sent", count: counts.sent, color: "text-blue-600" },
              { id: "FAILED", label: "Failed", count: counts.failed, color: "text-rose-600" },
              { id: "PENDING", label: "Pending", count: counts.pending, color: "text-slate-500" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-white text-slate-800 shadow-2xs border border-slate-200"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/70"
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  activeTab === tab.id ? "bg-slate-100 text-slate-800" : "bg-slate-200/50 text-slate-500"
                }`}>
                  {tab.count || 0}
                </span>
              </button>
            ))}
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name or phone..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] transition"
            />
          </form>
        </div>

        {/* Recipient Logs Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
              <Loader2 size={24} className="animate-spin text-[#125EF2]" />
              <span className="text-xs font-semibold">Loading recipient logs...</span>
            </div>
          ) : recipients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
              <Info size={28} className="text-slate-300" />
              <p className="text-xs font-medium text-slate-500">No recipients matched the selected filter.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-xs border-b border-slate-100 text-[11px] text-slate-500 font-bold">
                <tr>
                  <th className="py-3 px-6">Recipient</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Sent At</th>
                  <th className="py-3 px-4 text-right">Delivered At</th>
                  <th className="py-3 px-4 text-right">Read At</th>
                  <th className="py-3 px-6 text-left">Details / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {recipients.map((r) => {
                  const hasError = r.status === "FAILED";
                  const diag = r.errorDiagnostic;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition">
                      {/* Recipient Info */}
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0 border border-slate-200">
                            {r.contactName ? r.contactName.charAt(0).toUpperCase() : "?"}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{r.contactName}</p>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{r.contactPhone}</p>
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                          r.status === "READ"
                            ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                            : r.status === "DELIVERED"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : r.status === "SENT"
                            ? "bg-blue-50 text-blue-700 border-blue-100"
                            : r.status === "FAILED"
                            ? "bg-rose-50 text-rose-700 border-rose-100"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}>
                          {r.status === "READ" ? (
                            <Eye size={10} />
                          ) : r.status === "DELIVERED" ? (
                            <CheckCheck size={11} />
                          ) : r.status === "SENT" ? (
                            <Check size={10} />
                          ) : r.status === "FAILED" ? (
                            <AlertTriangle size={10} />
                          ) : (
                            <Clock size={10} />
                          )}
                          <span className="capitalize">{r.status.toLowerCase()}</span>
                        </span>
                      </td>

                      {/* Sent At */}
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-600">
                        {r.sentAt ? new Date(r.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "—"}
                      </td>

                      {/* Delivered At */}
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-emerald-700">
                        {r.deliveredAt ? new Date(r.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "—"}
                      </td>

                      {/* Read At */}
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-indigo-700">
                        {r.readAt ? new Date(r.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "—"}
                      </td>

                      {/* Error Diagnostic / WAMID */}
                      <td className="py-3 px-6">
                        {hasError ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold">
                              {diag?.errorCode || r.errorCode ? `Error ${diag?.errorCode || r.errorCode}` : "Failed"}
                            </span>
                            <span className="text-[11px] text-rose-600 truncate max-w-[200px]" title={diag?.description || r.errorMessage}>
                              {diag?.title || r.errorMessage}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedError({ recipient: r, diag })}
                              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition shrink-0"
                              title="View diagnostic details"
                            >
                              <Info size={13} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[140px] block" title={r.wamid || "Awaiting WAMID"}>
                            {r.wamid ? r.wamid.slice(0, 16) + "..." : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-white flex items-center justify-between shrink-0 text-xs text-slate-500 font-medium">
          <div>
            Showing <strong className="text-slate-800">{recipients.length}</strong> of <strong className="text-slate-800">{pagination.total}</strong> total logs
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchRecipients(page - 1, activeTab, searchTerm)}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold text-slate-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              onClick={() => fetchRecipients(page + 1, activeTab, searchTerm)}
              disabled={page >= pagination.totalPages || loading}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </div>

      {/* Meta Error Diagnostic Modal */}
      {selectedError && (
        <div 
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          style={{ zIndex: 99999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedError(null);
          }}
        >
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-150 relative">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 text-rose-600">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Meta Delivery Failure</h3>
                  <span className="text-[10px] font-mono text-rose-600 font-extrabold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Code {selectedError.diag?.errorCode || selectedError.recipient?.errorCode || "N/A"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedError(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recipient Contact</span>
                <p className="font-bold text-slate-800">{selectedError.recipient?.contactName}</p>
                <p className="text-[11px] font-mono text-slate-500">{selectedError.recipient?.contactPhone}</p>
              </div>

              <div className="space-y-1.5 p-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Diagnostic Reason</span>
                <p className="font-bold text-slate-800 text-sm">{selectedError.diag?.title || selectedError.recipient?.errorMessage}</p>
                <p className="text-slate-600 text-xs leading-relaxed">{selectedError.diag?.description || selectedError.recipient?.errorMessage}</p>
              </div>

              {selectedError.diag?.action && (
                <div className="p-3.5 bg-blue-50/80 border border-blue-100 rounded-2xl space-y-1">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1">
                    <Info size={13} />
                    Recommended Action
                  </span>
                  <p className="text-xs text-blue-950 leading-relaxed font-medium">
                    {selectedError.diag.action}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedError(null)}
                className="btn-primary py-2.5 px-5 text-xs font-bold rounded-xl"
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
