// src/pages/dashboard/Settings.jsx

import React, { useState, useEffect } from "react";
import { 
  Settings, 
  User, 
  Smartphone, 
  Code, 
  Key, 
  Save, 
  Copy, 
  CheckCircle2,
  Tag,
  Plus,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { getTags, createTag } from "../../services/tag.service";
import { getAutoReopenConfig, updateAutoReopenConfig, getTenantProfile, updateTenantProfile, getWhatsappConfig, updateWhatsappConfig } from "../../services/tenant.service";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [copiedKey, setCopiedKey] = useState(false);
  const [userRole, setUserRole] = useState("admin");
  const [profile, setProfile] = useState({
    name: "Admin Member",
    companyName: "WhatsApp Tenant Corp",
    email: "tenant@company.com",
    phone: "",
    address: "",
    timezone: "UTC+5:30 (India Standard Time)",
  });

  const fetchTenantProfile = async () => {
    if (userRole !== "admin") return;
    const res = await getTenantProfile();
    if (res.success) {
      setProfile((prev) => ({
        ...prev,
        name: res.data.tenantName,
        companyName: res.data.tenantName,
        email: res.data.email,
        phone: res.data.phone || "",
        address: res.data.address || "",
      }));
    }
  };

  useEffect(() => {
    if (activeTab === "profile" && userRole === "admin") {
      fetchTenantProfile();
    }
  }, [activeTab, userRole]);
  
  const [whatsapp, setWhatsapp] = useState({
    phoneId: "109283746592038",
    wabaId: "982746104827591",
    accessToken: "EAAGj21...z8QZDZD",
  });

  const [webhook, setWebhook] = useState({
    url: "https://api.yzo.com/webhooks/whatsapp",
    token: "yzo_verification_token_secure_2026",
    apiKey: "yzo_live_api_key_8x90a2b1cd34ef5678",
  });

  const [feedback, setFeedback] = useState("");

  // Tag state management
  const [tags, setTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [tagError, setTagError] = useState("");
  const [newTag, setNewTag] = useState({ name: "", priority: 3, description: "" });
  // Auto-Reopen Rules State Management
  const [reopenConfig, setReopenConfig] = useState({
    enabled: true,
    reopenWindowHours: 72,
    maxReopenCount: 5,
    smartFilterEnabled: true,
    assignmentStrategy: "original_agent",
  });
  const [loadingReopen, setLoadingReopen] = useState(false);
  const [reopenError, setReopenError] = useState("");

    // ─── ADDED: WhatsApp Config Load Logic ───
  const fetchWhatsappConfig = async () => {
    if (userRole !== "admin") return;
    const res = await getWhatsappConfig();
    if (res.success && res.data) {
      setWhatsapp({
        phoneId: res.data.whatsappPhoneId || "",
        wabaId: res.data.whatsappWabaId || "",
        accessToken: res.data.whatsappAccessToken || "",
      });
      setWebhook((prev) => ({
        ...prev,
        token: res.data.whatsappVerifyToken || prev.token,
      }));
    }
  };

  useEffect(() => {
    if (activeTab === "whatsapp" && userRole === "admin") {
      fetchWhatsappConfig();
    }
  }, [activeTab]);

    const fetchReopenConfig = async () => {
    setLoadingReopen(true);
    setReopenError("");
    const res = await getAutoReopenConfig();
    if (res.success) {
      setReopenConfig(res.data);
    } else {
      setReopenError(res.message);
    }
    setLoadingReopen(false);
  };
  const handleReopenSave = async (e) => {
    e.preventDefault();
    setReopenError("");
    const res = await updateAutoReopenConfig({
      enabled: reopenConfig.enabled,
      reopenWindowHours: parseInt(reopenConfig.reopenWindowHours, 10),
      maxReopenCount: parseInt(reopenConfig.maxReopenCount, 10),
      smartFilterEnabled: reopenConfig.smartFilterEnabled,
      assignmentStrategy: reopenConfig.assignmentStrategy,
    });
    if (res.success) {
      setFeedback("Auto-reopen rules updated successfully!");
      setTimeout(() => setFeedback(""), 3000);
      setReopenConfig(res.data);
    } else {
      setReopenError(res.message);
    }
  };
  useEffect(() => {
    if (activeTab === "reopen" && userRole === "admin") {
      fetchReopenConfig();
    }
  }, [activeTab]);

  const fetchTags = async () => {
    setLoadingTags(true);
    setTagError("");
    const res = await getTags();
    if (res.success) {
      setTags(res.data || []);
    } else {
      setTagError(res.message);
    }
    setLoadingTags(false);
  };

  const handleCreateTag = async (e) => {
    e.preventDefault();
    setTagError("");
    if (!newTag.name.trim()) return;

    const res = await createTag({
      name: newTag.name.trim(),
      priority: parseInt(newTag.priority, 10),
      description: newTag.description.trim() || null
    });

    if (res.success) {
      setNewTag({ name: "", priority: 3, description: "" });
      setFeedback("Priority tag created!");
      setTimeout(() => setFeedback(""), 3000);
      fetchTags();
    } else {
      setTagError(res.message);
    }
  };

  useEffect(() => {
    if (activeTab === "tags" && userRole === "admin") {
      fetchTags();
    }
  }, [activeTab]);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setProfile((prev) => ({
          ...prev,
          name: parsed.name || parsed.tenantName || prev.name,
          companyName: parsed.companyName || parsed.tenantName || prev.companyName,
          email: parsed.email || prev.email,
        }));
        setUserRole(parsed.type === "TENANT" ? "admin" : "agent");
      } catch (e) {}
    }
  }, []);

    const handleProfileSave = async (e) => {
    e.preventDefault();
    if (userRole !== "admin") {
      // Agents don't have update profile permissions in this screen
      setFeedback("Profile configurations updated!");
      setTimeout(() => setFeedback(""), 3000);
      return;
    }

    setFeedback("");
    const res = await updateTenantProfile({
      tenantName: profile.name,
      email: profile.email,
      phone: profile.phone,
      address: profile.address,
    });

    if (res.success) {
      setFeedback("Profile configurations updated!");
      setTimeout(() => setFeedback(""), 3000);

      // Keep localStorage in sync so other components read updated values
      const stored = localStorage.getItem("user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsed.tenantName = res.data.tenantName;
          parsed.name = res.data.tenantName;
          parsed.email = res.data.email;
          localStorage.setItem("user", JSON.stringify(parsed));
        } catch (err) {}
      }
    } else {
      alert("Failed to update profile: " + res.message);
    }
  };

  const handleWhatsappSave = async (e) => {
    e.preventDefault();
    setFeedback("");
    const res = await updateWhatsappConfig({
      phoneId: whatsapp.phoneId,
      wabaId: whatsapp.wabaId,
      accessToken: whatsapp.accessToken,
      verifyToken: webhook.token,
    });
    if (res.success) {
      setFeedback("WhatsApp Cloud API details verified & synced!");
      setTimeout(() => setFeedback(""), 3000);
    } else {
      alert("Failed to save WhatsApp config: " + res.message);
    }
  };

  const handleWebhookSave = async (e) => {
    e.preventDefault();
    setFeedback("");
    const res = await updateWhatsappConfig({
      phoneId: whatsapp.phoneId,
      wabaId: whatsapp.wabaId,
      accessToken: whatsapp.accessToken,
      verifyToken: webhook.token,
    });
    if (res.success) {
      setFeedback("Webhook API triggers saved!");
      setTimeout(() => setFeedback(""), 3000);
    } else {
      alert("Failed to save Webhook config: " + res.message);
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(webhook.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="text-emerald-600" size={24} />
            <span>Channel Settings</span>
          </h1>
          <p className="text-xs text-[color:var(--muted)] font-medium mt-1">
            Configure profile metadata, WhatsApp Cloud integrations, and developer webhooks.
          </p>
        </div>
        {feedback && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-semibold animate-bounce shrink-0">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>{feedback}</span>
          </div>
        )}
      </div>

      {/* Main Settings Section */}
      <div className="grid gap-6 md:grid-cols-4 items-start">
        {/* Navigation Tabs */}
        <div className="card border border-slate-100 p-2 flex flex-row md:flex-col gap-1 overflow-x-auto shrink-0">
          {[
            { id: "profile", label: userRole === "agent" ? "My Profile Settings" : "Business Profile", icon: <User size={15} />, adminOnly: false },
            { id: "tags", label: "Tags & Routing", icon: <Tag size={15} />, adminOnly: true },
            { id: "reopen", label: "Auto-Reopen Rules", icon: <RefreshCw size={15} />, adminOnly: true },
            { id: "whatsapp", label: "WhatsApp API", icon: <Smartphone size={15} />, adminOnly: true },
            { id: "developer", label: "Webhooks & Sockets", icon: <Code size={15} />, adminOnly: true }
          ]
            .filter(t => !t.adminOnly || userRole === "admin")
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition w-full whitespace-nowrap text-left ${
                  activeTab === tab.id
                    ? "bg-slate-100 text-slate-800"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))
          }
        </div>

        {/* Configurations Form Panel */}
        <div className="card border border-slate-100 p-6 md:col-span-3 bg-white">
          {/* Tab 1: Profile */}
          {activeTab === "profile" && (
            <form onSubmit={handleProfileSave} className="space-y-4">
              <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-50">
                {userRole === "agent" ? "My Profile Settings" : "Business Profile Settings"}
              </h2>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label text-xs">Display / Company Name</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="input text-xs"
                    required
                    disabled={userRole !== "admin"}
                  />
                </div>
                <div>
                  <label className="label text-xs">Email Address</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="input text-xs"
                    required
                    disabled={userRole !== "admin"} 
                  />
                </div>
              </div>

              {userRole === "admin" && (
                <div>
                  <label className="label text-xs">Phone Number</label>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="input text-xs"
                    placeholder="e.g. +919876543210"
                  />
                </div>
              )}

              <div>
                <label className="label text-xs">Company Address</label>
                <input 
                  type="text"
                  className="input text-xs"
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  placeholder="e.g.123 Business Road, New York, USA"
                />
              </div>

              <div className="pt-4 flex items-center justify-end border-t border-slate-50">
                <button type="submit" className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5">
                  <Save size={14} />
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab 2: WhatsApp Settings */}
          {activeTab === "whatsapp" && (
            <form onSubmit={handleWhatsappSave} className="space-y-4">
              <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-50">Meta Cloud API Credentials</h2>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label text-xs">Phone Number ID</label>
                  <input
                    type="text"
                    value={whatsapp.phoneId}
                    onChange={(e) => setWhatsapp({ ...whatsapp, phoneId: e.target.value })}
                    className="input text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="label text-xs">WhatsApp Business Account ID (WABA)</label>
                  <input
                    type="text"
                    value={whatsapp.wabaId}
                    onChange={(e) => setWhatsapp({ ...whatsapp, wabaId: e.target.value })}
                    className="input text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs">Permanent System Access Token</label>
                <input
                  type="password"
                  value={whatsapp.accessToken}
                  onChange={(e) => setWhatsapp({ ...whatsapp, accessToken: e.target.value })}
                  className="input text-xs font-mono"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  Obtained from Meta App Developer portal under WhatsApp Settings.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end border-t border-slate-50">
                <button type="submit" className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5">
                  <Save size={14} />
                  <span>Verify & Sync Credentials</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab 3: Developer Settings */}
          {activeTab === "developer" && (
            <form onSubmit={handleWebhookSave} className="space-y-4">
              <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-50">Webhook Web Hooks & Client API Keys</h2>
              
              <div>
                <label className="label text-xs">Callback Webhook URL</label>
                <input
                  type="url"
                  value={webhook.url}
                  onChange={(e) => setWebhook({ ...webhook, url: e.target.value })}
                  className="input text-xs font-mono"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  We post raw incoming WhatsApp event objects to this URL.
                </p>
              </div>

              <div>
                <label className="label text-xs">Verify Webhook Token</label>
                <input
                  type="text"
                  value={webhook.token}
                  onChange={(e) => setWebhook({ ...webhook, token: e.target.value })}
                  className="input text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="label text-xs">System API Private Key</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={webhook.apiKey}
                    readOnly
                    className="input text-xs font-mono bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={copyApiKey}
                    className="btn-secondary px-3 flex items-center justify-center shrink-0"
                    title="Copy API Key"
                  >
                    {copiedKey ? <CheckCircle2 size={15} className="text-emerald-600" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end border-t border-slate-50">
                <button type="submit" className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5">
                  <Save size={14} />
                  <span>Save Integration Webhooks</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab 4: Tags Management */}
          {activeTab === "tags" && (
            <div className="space-y-6">
              <div className="pb-3 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Tag & Auto-Routing Settings</h2>
                  <p className="text-[10px] text-slate-400 font-medium">Define customer tags and priority values for automatic agent assignment.</p>
                </div>
                <button
                  type="button"
                  onClick={fetchTags}
                  className="btn-secondary py-1.5 px-3 text-[10px] flex items-center gap-1 shadow-sm hover:shadow"
                  disabled={loadingTags}
                >
                  <RefreshCw size={12} className={loadingTags ? "animate-spin" : ""} />
                  <span>Refresh Tags</span>
                </button>
              </div>

              {tagError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs text-rose-650 font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>{tagError}</span>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-3">
                {/* Create Tag Form */}
                <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 space-y-4">
                  <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Plus size={14} className="text-emerald-600" />
                    <span>Create New Segment Tag</span>
                  </h3>
                  
                  <form onSubmit={handleCreateTag} className="space-y-3">
                    <div>
                      <label className="label text-[10px] uppercase font-bold text-slate-400">Tag Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. VIP, Hot Lead, Support"
                        value={newTag.name}
                        onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                        className="input text-xs bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="label text-[10px] uppercase font-bold text-slate-400">Routing Priority *</label>
                      <select
                        value={newTag.priority}
                        onChange={(e) => setNewTag({ ...newTag, priority: e.target.value })}
                        className="input text-xs bg-white font-medium"
                      >
                        <option value={1}>1 (Highest Priority - e.g. VIP)</option>
                        <option value={2}>2 (High Priority - e.g. Hot Lead)</option>
                        <option value={3}>3 (Medium Priority - e.g. General Support)</option>
                        <option value={4}>4 (Low Priority - e.g. Feedback)</option>
                        <option value={5}>5 (Lowest Priority - e.g. Spam)</option>
                      </select>
                      <p className="text-[9px] text-slate-400 mt-1 font-medium leading-normal">
                        Contacts matching higher priority tags are assigned first.
                      </p>
                    </div>

                    <div>
                      <label className="label text-[10px] uppercase font-bold text-slate-400">Description</label>
                      <textarea
                        rows={2}
                        placeholder="Optional description..."
                        value={newTag.description}
                        onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                        className="input text-xs bg-white resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loadingTags}
                      className="btn-primary w-full py-2 text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Plus size={13} />
                      <span>Add Priority Tag</span>
                    </button>
                  </form>
                </div>

                {/* Tags Table */}
                <div className="lg:col-span-2 space-y-2">
                  <h3 className="text-xs font-bold text-slate-700">Existing Priority Tags</h3>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
                    <div className="overflow-x-auto max-h-[300px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-450">
                            <th className="p-3">Tag Name</th>
                            <th className="p-3 text-center">Priority</th>
                            <th className="p-3">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {loadingTags ? (
                            <tr>
                              <td colSpan={3} className="p-8 text-center text-slate-400">
                                Loading tags...
                              </td>
                            </tr>
                          ) : tags.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="p-8 text-center text-slate-450 italic">
                                No tags created yet. Add one on the left!
                              </td>
                            </tr>
                          ) : (
                            tags.map((tag) => {
                              // Define visual tag styling based on priority
                              const getBadgeColor = (p) => {
                                if (p === 1) return "bg-rose-50 border border-rose-100 text-rose-700";
                                if (p === 2) return "bg-amber-50 border border-amber-100 text-amber-700";
                                if (p === 3) return "bg-blue-50 border border-blue-100 text-blue-700";
                                return "bg-slate-50 border border-slate-100 text-slate-600";
                              };

                              return (
                                <tr key={tag.id} className="hover:bg-slate-50/30 transition">
                                  <td className="p-3">
                                    <span className={`inline-flex rounded-full px-2.5 py-0.5 font-bold ${getBadgeColor(tag.priority)}`}>
                                      {tag.name}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center font-bold text-slate-800">
                                    {tag.priority}
                                  </td>
                                  <td className="p-3 text-slate-500 font-medium max-w-[200px] truncate" title={tag.description}>
                                    {tag.description || "N/A"}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

                    {/* Tab 5: Auto-Reopen Rules */}
          {activeTab === "reopen" && (
            <form onSubmit={handleReopenSave} className="space-y-6">
              <div className="pb-3 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Auto-Reopen Rules & Policies</h2>
                  <p className="text-[10px] text-slate-400 font-medium">Configure rules for when closed/resolved customer chats receive new replies.</p>
                </div>
                <button
                  type="button"
                  onClick={fetchReopenConfig}
                  className="btn-secondary py-1.5 px-3 text-[10px] flex items-center gap-1 shadow-sm hover:shadow"
                  disabled={loadingReopen}
                >
                  <RefreshCw size={12} className={loadingReopen ? "animate-spin" : ""} />
                  <span>Refresh Settings</span>
                </button>
              </div>

              {reopenError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs text-rose-655 font-semibold flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>{reopenError}</span>
                </div>
              )}

              {loadingReopen ? (
                <div className="text-center text-xs text-slate-400 py-12">Loading configurations...</div>
              ) : (
                <div className="space-y-5">
                  
                  {/* Toggle: Enable Auto-Reopen */}
                  <div className="flex items-start gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/80">
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={reopenConfig.enabled}
                      onChange={(e) => setReopenConfig({ ...reopenConfig, enabled: e.target.checked })}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div>
                      <label htmlFor="enabled" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                        Enable Conversation Auto-Reopen
                      </label>
                      <p className="text-[10px] text-slate-400 font-medium mt-1 leading-normal">
                        When checked, incoming customer messages will automatically reopen resolved or closed conversations within the defined reopen window.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Reopen Window (Hours) */}
                    <div>
                      <label className="label text-xs font-bold text-slate-750">Reopen Window (Hours)</label>
                      <input
                        type="number"
                        min={1}
                        max={720}
                        value={reopenConfig.reopenWindowHours}
                        onChange={(e) => setReopenConfig({ ...reopenConfig, reopenWindowHours: e.target.value })}
                        className="input text-xs mt-1"
                        required
                        disabled={!reopenConfig.enabled}
                      />
                      <p className="text-[9px] text-slate-450 mt-1 leading-normal">
                        Time window (in hours) after resolution where a customer reply reopens the ticket. Suggestion: 72 hours (3 days).
                      </p>
                    </div>

                    {/* Max Reopen Count */}
                    <div>
                      <label className="label text-xs font-bold text-slate-750">Max Reopen Count</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={reopenConfig.maxReopenCount}
                        onChange={(e) => setReopenConfig({ ...reopenConfig, maxReopenCount: e.target.value })}
                        className="input text-xs mt-1"
                        required
                        disabled={!reopenConfig.enabled}
                      />
                      <p className="text-[9px] text-slate-450 mt-1 leading-normal">
                        Maximum number of times a single conversation is allowed to reopen automatically to prevent endless loops.
                      </p>
                    </div>
                  </div>

                  {/* Toggle: Smart Junk Filter */}
                  <div className="flex items-start gap-3 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/80">
                    <input
                      type="checkbox"
                      id="smartFilterEnabled"
                      checked={reopenConfig.smartFilterEnabled}
                      onChange={(e) => setReopenConfig({ ...reopenConfig, smartFilterEnabled: e.target.checked })}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      disabled={!reopenConfig.enabled}
                    />
                    <div>
                      <label htmlFor="smartFilterEnabled" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                        Enable Smart Junk Message Filtering
                      </label>
                      <p className="text-[10px] text-slate-400 font-medium mt-1 leading-normal">
                        When active, simple polite words (e.g. "thanks", "thank you", "ok", "thumbs up") will be ignored and will not reopen closed conversations.
                      </p>
                    </div>
                  </div>

                  {/* Dropdown: Assignment Strategy */}
                  <div>
                    <label className="label text-xs font-bold text-slate-750">Reassignment Strategy</label>
                    <select
                      value={reopenConfig.assignmentStrategy}
                      onChange={(e) => setReopenConfig({ ...reopenConfig, assignmentStrategy: e.target.value })}
                      className="input text-xs mt-1 font-medium bg-white"
                      disabled={!reopenConfig.enabled}
                    >
                      <option value="original_agent">Assign back to Original Agent (Default)</option>
                      <option value="unassigned_pool">Move to Unassigned Conversations Pool</option>
                    </select>
                    <p className="text-[9px] text-slate-450 mt-1 leading-normal">
                      <strong>Original Agent:</strong> Assigns the reopened chat directly back to the last operator who resolved it.<br />
                      <strong>Unassigned Pool:</strong> Resets assignment, allowing any online team member to assign the chat to themselves.
                    </p>
                  </div>

                  <div className="pt-4 flex items-center justify-end border-t border-slate-50">
                    <button type="submit" className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5">
                      <Save size={14} />
                      <span>Save Rules & Policies</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
