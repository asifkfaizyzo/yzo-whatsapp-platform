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
  CheckCircle2 
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [copiedKey, setCopiedKey] = useState(false);
  const [userRole, setUserRole] = useState("admin");
  const [profile, setProfile] = useState({
    name: "Admin Member",
    companyName: "WhatsApp Tenant Corp",
    email: "tenant@company.com",
    timezone: "UTC+5:30 (India Standard Time)",
  });
  
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

  const handleProfileSave = (e) => {
    e.preventDefault();
    setFeedback("Profile configurations updated!");
    setTimeout(() => setFeedback(""), 3000);
  };

  const handleWhatsappSave = (e) => {
    e.preventDefault();
    setFeedback("WhatsApp Cloud API details verified & synced!");
    setTimeout(() => setFeedback(""), 3000);
  };

  const handleWebhookSave = (e) => {
    e.preventDefault();
    setFeedback("Webhook API triggers saved!");
    setTimeout(() => setFeedback(""), 3000);
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
                  <label className="label text-xs">Display Name</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="input text-xs"
                    required
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
                  />
                </div>
              </div>

              {userRole === "admin" && (
                <div>
                  <label className="label text-xs">Company Name</label>
                  <input
                    type="text"
                    value={profile.companyName}
                    onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                    className="input text-xs"
                    required
                  />
                </div>
              )}

              <div>
                <label className="label text-xs">System Timezone</label>
                <select 
                  className="input text-xs"
                  value={profile.timezone}
                  onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                >
                  <option>UTC+5:30 (India Standard Time)</option>
                  <option>UTC+0:00 (GMT / London)</option>
                  <option>UTC-5:00 (EST / New York)</option>
                </select>
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
        </div>
      </div>
    </div>
  );
}
