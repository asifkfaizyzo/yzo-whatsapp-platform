import React, { useState, useEffect } from "react";
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
  AlertCircle
} from "lucide-react";
import { getBroadcasts, launchBroadcast } from "../../services/broadcast.service";
import { getTemplates } from "../../services/template.service";
import { getTags } from "../../services/tag.service";
import { io } from "socket.io-client";

export default function Broadcasts() {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

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

  // 1. Fetch campaigns, templates, tags
  const loadData = async () => {
    setLoading(true);
    const [bRes, tRes, tagRes] = await Promise.all([
      getBroadcasts(),
      getTemplates(),
      getTags()
    ]);

    if (bRes.success) setCampaigns(bRes.data);
    if (tRes.success) {
      // Filter only approved templates
      setTemplates(tRes.data.filter(t => t.status === "APPROVED"));
    }
    if (tagRes.success) setTags(tagRes.data);
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
    const socket = io(socketUrl, { transports: ["websocket"] });

    socket.emit("join_tenant", activeTenantId);

    // Watch for backend status updates
    socket.on("broadcast_update", (data) => {
      setCampaigns(prev => prev.map(c => {
        if (c.id === data.broadcastId) {
          return {
            ...c,
            sent: data.sent,
            delivered: data.delivered,
            read: data.read,
            failed: data.failed,
            status: data.sent + data.failed >= c.totalRecipients ? "COMPLETED" : c.status
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
      }
    };

    const res = await launchBroadcast(payload);

    if (res.success) {
      setShowModal(false);
      setNewCampaign({
        name: "",
        templateId: "",
        targetType: "ALL",
        tagIds: [],
        schedule: "now",
        scheduledTime: "",
      });
      setParamsMapping({});
      setFeedback("Campaign launched and processing!");
      setTimeout(() => setFeedback(""), 3500);
      loadData();
    } else {
      alert("Failed to launch campaign: " + res.message);
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
            if (templates.length === 0) {
              alert("You must have at least one approved template before launching a broadcast campaign.");
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

      {feedback && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-xs text-emerald-800 font-semibold">
          {feedback}
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
                            : "bg-amber-50 text-amber-700 border-amber-100"
                        }`}>
                          {b.status === "COMPLETED" ? <CheckCircle size={10} /> : <Clock size={10} />}
                          <span className="capitalize">{b.status.toLowerCase()}</span>
                        </span>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Launch Campaign Modal */}
      {showModal && (
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
                  Send Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}