import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Megaphone, 
  Plus, 
  Search, 
  Send, 
  Calendar, 
  X, 
  CheckCircle, 
  Info,
  Clock,
  AlertCircle,
  Activity,
  Zap,
  BarChart3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getBroadcasts, launchBroadcast, cancelBroadcast } from "../../services/broadcast.service";
import { getTemplates } from "../../services/template.service";
import { getTags } from "../../services/tag.service";
import { getWhatsappStatus } from "../../services/tenant.service";
import { io } from "socket.io-client";
import { useAuthStore } from "../../store/useAuthStore";
import { useConfirm } from "../../context/ConfirmContext";
import { useToast } from "../../context/ToastContext";
import WhatsAppRequiredModal from "../../components/whatsapp/WhatsAppRequiredModal";
import WhatsAppConnect from "../../components/whatsapp/WhatsAppConnect";
import BroadcastDetailsDrawer from "../../components/broadcasts/BroadcastDetailsDrawer";

export default function Broadcasts() {
  const confirm = useConfirm();
  const toast = useToast();

  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(true);
  const [whatsappHealth, setWhatsappHealth] = useState(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showWhatsAppSetup, setShowWhatsAppSetup] = useState(false);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    templateId: "",
    targetType: "ALL",
    tagIds: [],
    schedule: "now",
    scheduledTime: "",
  });

  // Dynamic variable parameters mappings state
  const [paramsMapping, setParamsMapping] = useState({});

  // 1. Fetch campaigns, templates, tags, whatsapp status
  const loadData = async () => {
    setLoading(true);
    const [bRes, tRes, tagRes, statusRes] = await Promise.all([
      getBroadcasts(),
      getTemplates(),
      getTags(),
      getWhatsappStatus()
    ]);

    if (bRes.success) setCampaigns(bRes.data);
    if (tRes.success) {
      // Filter only approved templates
      setTemplates(tRes.data.filter(t => t.status === "APPROVED"));
    }
    if (tagRes.success) setTags(tagRes.data);
    if (statusRes.success && statusRes.data) {
      setIsWhatsAppConnected(!!statusRes.data.isConnected);
      setWhatsappHealth(statusRes.data.health || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // 2. Setup Socket Connection for Live Status Updates
  useEffect(() => {
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

    // Watch for backend status updates in real-time
    socket.on("broadcast_update", (data) => {
      setCampaigns(prev => prev.map(c => {
        if (c.id === data.broadcastId) {
          const newStatus = data.status || (
            (data.sent !== undefined && data.failed !== undefined && (data.sent + data.failed >= c.totalRecipients))
              ? "COMPLETED"
              : c.status
          );
          return {
            ...c,
            sent: data.sent !== undefined ? data.sent : c.sent,
            delivered: data.delivered !== undefined ? data.delivered : c.delivered,
            read: data.read !== undefined ? data.read : c.read,
            failed: data.failed !== undefined ? data.failed : c.failed,
            status: newStatus
          };
        }
        return c;
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // 3. Handle Template Selection Change
  const handleTemplateChange = (e) => {
    const tempId = e.target.value;
    setNewCampaign(prev => ({ ...prev, templateId: tempId }));
    
    const selected = templates.find(t => t.id === tempId);
    if (!selected) {
      setParamsMapping({});
      return;
    }

    // Parse parameters
    const bodyComp = (selected.components || []).find(c => c.type === "BODY");
    const bodyText = bodyComp ? bodyComp.text : "";
    const placeholders = bodyText.match(/\{\{(\d+)\}\}/g);
    const count = placeholders ? new Set(placeholders).size : 0;

    const initMapping = {};
    for (let i = 1; i <= count; i++) {
      initMapping[i] = { type: "contact_field", value: "{{contact_name}}" };
    }
    setParamsMapping(initMapping);
  };

  // 4. Update Parameter Field Mapping
  const handleParamMappingChange = (paramIndex, key, value) => {
    setParamsMapping(prev => ({
      ...prev,
      [paramIndex]: {
        ...prev[paramIndex],
        [key]: value
      }
    }));
  };

  // 5. Submit Launch request to backend
  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!newCampaign.name.trim() || !newCampaign.templateId) return;

    // Build standard defaultParams object
    const bodyParams = Object.keys(paramsMapping)
      .sort((a, b) => Number(a) - Number(b))
      .map(key => paramsMapping[key].value);

    const payload = {
      name: newCampaign.name,
      templateId: newCampaign.templateId,
      targetType: newCampaign.targetType,
      tagIds: newCampaign.targetType === "TAGS" ? newCampaign.tagIds : [],
      defaultParams: {
        body: bodyParams
      },
      scheduledAt: newCampaign.schedule === "later" && newCampaign.scheduledTime
        ? new Date(newCampaign.scheduledTime).toISOString()
        : null
    };

    const res = await launchBroadcast(payload);

    if (res.success) {
      setShowModal(false);
      const isScheduled = newCampaign.schedule === "later";
      setNewCampaign({
        name: "",
        templateId: "",
        targetType: "ALL",
        tagIds: [],
        schedule: "now",
        scheduledTime: "",
      });
      setParamsMapping({});
      toast.success(isScheduled ? "Campaign scheduled successfully!" : "Campaign launched and processing!");
      loadData();
    } else {
      toast.error("Failed to launch campaign: " + res.message);
    }
  };

  // 6. Handle Cancel Scheduled / Active Campaign
  const handleCancelCampaign = async (campaignId) => {
    const ok = await confirm({
      type: "warning",
      title: "Cancel Campaign?",
      message: "Pending messages will not be sent. This action cannot be undone.",
      confirmLabel: "Cancel Campaign",
    });
    if (!ok) return;

    const res = await cancelBroadcast(campaignId);
    if (res.success) {
      toast.success("Campaign cancelled successfully.");
      loadData();
    } else {
      toast.error("Failed to cancel campaign: " + res.message);
    }
  };

  const getBodyText = (tempId) => {
    const template = templates.find(t => t.id === tempId);
    if (!template) return "";
    const bodyComp = (template.components || []).find(c => c.type === "BODY");
    return bodyComp ? bodyComp.text : "";
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Megaphone className="text-[#125EF2]" size={24} />
            <span>Broadcast Campaigns</span>
          </h1>
          <p className="text-xs text-[color:var(--muted)] font-medium mt-1">
            Send WhatsApp templates to large audiences and track open rates in real-time.
          </p>
        </div>
        <button
          onClick={() => {
            if (!isWhatsAppConnected) {
              setShowConnectModal(true);
              return;
            }
            if (templates.length === 0) {
              toast.error("You must have at least one approved template before launching a broadcast campaign.");
              return;
            }
            setShowModal(true);
          }}
          className="btn-primary flex items-center justify-center gap-2 text-sm shadow-sm"
        >
          <Plus size={16} />
          <span>New Campaign</span>
        </button>
      </div>

      {/* Live Meta Account Health & Messaging Limit Status Bar */}
      {isWhatsAppConnected && whatsappHealth && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
              <Zap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800">
                  {whatsappHealth.tierName || "Tier 1K (1,000 / 24 hrs)"}
                </span>
                {whatsappHealth.qualityRating === "GREEN" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    High Quality (GREEN)
                  </span>
                ) : whatsappHealth.qualityRating === "YELLOW" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Medium Quality (YELLOW)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Low Quality (RED)
                  </span>
                )}
                {whatsappHealth.isMock && (
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded border border-slate-200">
                    MOCK
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {whatsappHealth.displayPhoneNumber || "WhatsApp Business Number"} · Meta Cloud API
              </p>
            </div>
          </div>

          {/* Daily Limit Usage Bar */}
          <div className="flex flex-col sm:items-end gap-1 min-w-[240px]">
            <div className="flex items-center justify-between w-full text-xs font-bold text-slate-700">
              <span className="text-[11px] text-slate-500 font-semibold">24h Broadcast Usage:</span>
              <span>
                {whatsappHealth.sentLast24h || 0} / {whatsappHealth.messagingLimitNumber || 1000}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
              <div
                className="bg-[#125EF2] h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((whatsappHealth.sentLast24h || 0) /
                        (whatsappHealth.messagingLimitNumber || 1000)) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {whatsappHealth.remaining24h ?? 1000} messages remaining today
            </span>
          </div>
        </div>
      )}

      {/* WhatsApp Disconnected Warning Banner */}
      {!isWhatsAppConnected && !loading && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0">
              <AlertCircle size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">WhatsApp Account Not Connected</h4>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                Connect your WhatsApp Business Number in Settings to launch broadcast campaigns and send messages via Meta Cloud API.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowWhatsAppSetup(true)}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white text-xs font-bold rounded-xl transition shadow-sm whitespace-nowrap self-start sm:self-auto shrink-0"
          >
            Connect WhatsApp
          </button>
        </div>
      )}

      {/* Campaigns Listing */}
      <div className="card border border-slate-100 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-12 text-sm text-slate-400">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-12 text-slate-450 italic">No campaigns launched yet. Click "New Campaign" to start!</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-[color:var(--muted)] font-bold border-b border-slate-100 bg-slate-50/20">
                  <th className="p-4 font-semibold">Campaign Detail</th>
                  <th className="p-4 font-semibold">Template Used</th>
                  <th className="p-4 font-semibold text-center">Status</th>
                  <th className="p-4 font-semibold text-right">Recipients</th>
                  <th className="p-4 font-semibold text-right">Read Rate</th>
                  <th className="p-4 font-semibold text-right">Delivery Success</th>
                  <th className="p-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {campaigns.map((b) => {
                  const readPercent = b.totalRecipients > 0 ? ((b.read / b.totalRecipients) * 100).toFixed(1) : "0.0";
                  const deliveryPercent = b.totalRecipients > 0 ? ((b.delivered / b.totalRecipients) * 100).toFixed(1) : "0.0";

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/40">
                      <td className="p-4">
                        <p className="font-bold text-slate-800 text-sm">{b.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {new Date(b.createdAt).toLocaleString()}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/50">
                          {b.template?.name || "Unknown Template"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                          b.status === "COMPLETED" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                            : b.status === "SCHEDULED"
                            ? "bg-purple-50 text-purple-700 border-purple-100"
                            : b.status === "CANCELLED"
                            ? "bg-rose-50 text-rose-700 border-rose-100"
                            : "bg-amber-50 text-amber-700 border-amber-100"
                        }`}>
                          {b.status === "COMPLETED" ? <CheckCircle size={10} /> : b.status === "SCHEDULED" ? <Calendar size={10} /> : b.status === "CANCELLED" ? <AlertCircle size={10} /> : <Clock size={10} />}
                          <span className="capitalize">{b.status.toLowerCase()}</span>
                        </span>
                        {b.scheduledAt && b.status === "SCHEDULED" && (
                          <p className="text-[9px] text-purple-600 font-medium mt-1">
                            {new Date(b.scheduledAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-right font-semibold text-slate-800 text-sm">
                        {b.totalRecipients.toLocaleString()}
                      </td>
                      <td className="p-4 text-right font-semibold text-blue-600 text-sm">
                        {readPercent}% ({b.read})
                      </td>
                      <td className="p-4 text-right font-semibold text-emerald-600 text-sm">
                        {deliveryPercent}% ({b.delivered})
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBroadcastId(b.id);
                              setShowDrawer(true);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-[#125EF2] hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition shadow-2xs flex items-center gap-1"
                            title="View granular recipient logs and diagnostics"
                          >
                            <BarChart3 size={12} />
                            <span>Logs</span>
                          </button>
                          {(b.status === "SCHEDULED" || b.status === "PROCESSING") && (
                            <button
                              type="button"
                              onClick={() => handleCancelCampaign(b.id)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg transition shadow-2xs"
                              title="Cancel Campaign"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Launch Campaign Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-150">
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
              <div>
                <label className="label text-xs font-semibold text-slate-700">Campaign Name</label>
                <input
                  type="text"
                  placeholder="e.g. Summer Clearance Launch"
                  required
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label text-xs font-semibold text-slate-700">WhatsApp Template</label>
                <select 
                  className="input"
                  required
                  value={newCampaign.templateId}
                  onChange={handleTemplateChange}
                >
                  <option value="">Select an approved template</option>
                  {templates.map(temp => (
                    <option key={temp.id} value={temp.id}>{temp.name} ({temp.category.toLowerCase()})</option>
                  ))}
                </select>
                <p className="text-[10px] text-[color:var(--muted)] font-medium mt-1.5 flex items-center gap-1">
                  <Info size={11} />
                  <span>Only approved WhatsApp templates can be used.</span>
                </p>
              </div>

              {/* Dynamic Parameter Settings */}
              {newCampaign.templateId && Object.keys(paramsMapping).length > 0 && (
                <div className="bg-slate-55/30 border border-slate-100 rounded-2xl p-4 space-y-3.5">
                  <h4 className="text-xs font-bold text-slate-700">Template Dynamic Parameters Mapping</h4>
                  
                  {/* Show Template preview snippet for context */}
                  <div className="p-2.5 bg-white border rounded-xl font-mono text-[10px] text-slate-500 max-h-20 overflow-y-auto">
                    {getBodyText(newCampaign.templateId)}
                  </div>

                  {Object.keys(paramsMapping).map((paramIndex) => (
                    <div key={paramIndex} className="grid grid-cols-3 gap-2 items-center">
                      <span className="text-xs font-medium text-slate-500">Variable {"{{"}{paramIndex}{"}}"}</span>
                      
                      <select
                        className="input py-1.5 text-xs bg-white"
                        value={paramsMapping[paramIndex].type}
                        onChange={(e) => handleParamMappingChange(paramIndex, "type", e.target.value)}
                      >
                        <option value="contact_field">Dynamic Contact Field</option>
                        <option value="static">Custom Static Value</option>
                      </select>

                      {paramsMapping[paramIndex].type === "contact_field" ? (
                        <select
                          className="input py-1.5 text-xs bg-white"
                          value={paramsMapping[paramIndex].value}
                          onChange={(e) => handleParamMappingChange(paramIndex, "value", e.target.value)}
                        >
                          <option value="{{contact_name}}">Contact Name</option>
                          <option value="{{contact_phone}}">Contact Phone</option>
                          <option value="{{contact_company}}">Contact Company</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          required
                          placeholder="e.g. SUMMER20"
                          className="input py-1.5 text-xs bg-white"
                          value={paramsMapping[paramIndex].value === "{{contact_name}}" ? "" : paramsMapping[paramIndex].value}
                          onChange={(e) => handleParamMappingChange(paramIndex, "value", e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Audience Targeting */}
              <div>
                <label className="label text-xs font-semibold text-slate-700">Target Audience</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewCampaign({ ...newCampaign, targetType: "ALL" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition ${
                      newCampaign.targetType === "ALL"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>All Active Contacts</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCampaign({ ...newCampaign, targetType: "TAGS" })}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition ${
                      newCampaign.targetType === "TAGS"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span>Filter by Priority Tags</span>
                  </button>
                </div>
              </div>

              {newCampaign.targetType === "TAGS" && (
                <div>
                  <label className="label text-xs font-semibold text-slate-700">Select Targeting Tags</label>
                  <div className="grid grid-cols-2 gap-2 max-h-28 overflow-y-auto p-2 border rounded-xl bg-slate-50/30">
                    {tags.map(tag => {
                      const isChecked = newCampaign.tagIds.includes(tag.id);
                      return (
                        <label key={tag.id} className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setNewCampaign(prev => {
                                const newTagIds = isChecked
                                  ? prev.tagIds.filter(id => id !== tag.id)
                                  : [...prev.tagIds, tag.id];
                                return { ...prev, tagIds: newTagIds };
                              });
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>{tag.name} (Priority {tag.priority})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sending Schedule Selection */}
              <div>
                <label className="label text-xs font-semibold text-slate-700">Sending Schedule</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewCampaign({ ...newCampaign, schedule: "now", scheduledTime: "" })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      newCampaign.schedule === "now"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Send size={13} />
                    <span>Send Immediately</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCampaign({ ...newCampaign, schedule: "later" })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      newCampaign.schedule === "later"
                        ? "bg-purple-50 border-purple-500 text-purple-700 shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Calendar size={13} />
                    <span>Schedule for Later</span>
                  </button>
                </div>
              </div>

              {newCampaign.schedule === "later" && (
                <div className="p-3.5 bg-purple-50/40 border border-purple-100 rounded-2xl space-y-1.5">
                  <label className="label text-xs font-semibold text-purple-900">Select Date & Time</label>
                  <input
                    type="datetime-local"
                    required={newCampaign.schedule === "later"}
                    value={newCampaign.scheduledTime}
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    onChange={(e) => setNewCampaign({ ...newCampaign, scheduledTime: e.target.value })}
                    className="input text-xs bg-white border-purple-200 focus:ring-purple-500"
                  />
                </div>
              )}

              {/* Messaging Limit Quota Info */}
              {whatsappHealth && (
                <div className="p-3 bg-blue-50/80 border border-blue-100 rounded-2xl flex items-center justify-between text-xs text-blue-950">
                  <div className="flex items-center gap-2">
                    <Zap size={15} className="text-[#125EF2]" />
                    <span className="font-semibold text-blue-900">
                      Daily Tier: <strong>{whatsappHealth.tierName}</strong>
                    </span>
                  </div>
                  <span className="font-bold text-[#125EF2] bg-white px-2 py-0.5 rounded-lg border border-blue-100 shadow-2xs">
                    {whatsappHealth.remaining24h ?? 1000} remaining today
                  </span>
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
                  className={`py-2.5 px-5 text-xs font-bold rounded-xl text-white shadow-sm transition ${
                    newCampaign.schedule === "later"
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "bg-[#125EF2] hover:bg-blue-700"
                  }`}
                >
                  {newCampaign.schedule === "later" ? "Schedule Campaign" : "Send Now"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* WhatsApp Connection Required Modal */}
      <WhatsAppRequiredModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnect={() => setShowWhatsAppSetup(true)}
        title="WhatsApp Number Required"
        description="To launch broadcast campaigns, you need to connect your official WhatsApp Business Number first."
        feature="Broadcasts"
      />

      {/* WhatsApp Setup / Connect Modal ("Choose Your Setup Type") */}
      {showWhatsAppSetup && (
        <WhatsAppConnect
          onSuccess={() => {
            setShowWhatsAppSetup(false);
            setIsWhatsAppConnected(true);
            loadData();
            toast.success("WhatsApp connected successfully!");
          }}
          onClose={() => setShowWhatsAppSetup(false)}
        />
      )}

      {/* Granular Recipient Delivery Logs & Diagnostics Drawer */}
      <BroadcastDetailsDrawer
        broadcastId={selectedBroadcastId}
        isOpen={showDrawer}
        onClose={() => {
          setShowDrawer(false);
          setSelectedBroadcastId(null);
        }}
        onCampaignUpdated={loadData}
      />
    </div>
  );
}