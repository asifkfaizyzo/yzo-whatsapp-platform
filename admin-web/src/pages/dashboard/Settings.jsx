// admin-web/src/pages/dashboard/Settings.jsx

import React, { useState } from "react";
import {
  Settings,
  Smartphone,
  Code,
  CheckCircle2,
  Save,
  Database,
  Mail
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("platform");
  const [feedback, setFeedback] = useState("");

  const [platform, setPlatform] = useState({
    siteName: "yzo Platform",
    masterDomain: "https://yzo.com",
    contactEmail: "ops@yzo.com",
    maxFreeTrialDays: 14,
  });

  const [gateway, setGateway] = useState({
    masterPhoneId: "901827364510293",
    masterWabaId: "123450987654321",
    masterAccessToken: "EAAGj21...MASTER_TOKEN_xyz",
  });

  const [pricing, setPricing] = useState({
    starterFee: 49,
    growthFee: 149,
    enterpriseFee: 499,
  });

  const handleSave = (e) => {
    e.preventDefault();
    setFeedback("Platform settings saved successfully!");
    setTimeout(() => setFeedback(""), 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="text-[#125EF2]" size={24} />
            <span>Platform Configurations</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage global SaaS parameters, master Meta API keys, webhook routing, and subscription fees.
          </p>
        </div>
        {feedback && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EAF2FE] border border-[#CFE0FD] rounded-xl text-[#0D47A1] text-xs font-semibold animate-bounce shrink-0">
            <CheckCircle2 size={13} className="text-[#125EF2]" />
            <span>{feedback}</span>
          </div>
        )}
      </div>

      {/* Main Configurations Section */}
      <div className="grid gap-6 md:grid-cols-4 items-start">
        {/* Navigation Tabs */}
        <div className="card border border-slate-100 p-2 flex flex-row md:flex-col gap-1 overflow-x-auto shrink-0 bg-white">
          {[
            { id: "platform", label: "General Settings", icon: <Database size={15} /> },
            { id: "gateway", label: "Master Meta Cloud API", icon: <Smartphone size={15} /> },
            { id: "pricing", label: "Subscription Pricing", icon: <Mail size={15} /> }
          ].map((tab) => (
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
          ))}
        </div>

        {/* Configurations Form Panel */}
        <div className="card border border-slate-100 p-6 md:col-span-3 bg-white">
          {/* Tab 1: General settings */}
          {activeTab === "platform" && (
            <form onSubmit={handleSave} className="space-y-4">
              <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-50">General SaaS Metadata</h2>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label text-xs">Site Brand Name</label>
                  <input
                    type="text"
                    value={platform.siteName}
                    onChange={(e) => setPlatform({ ...platform, siteName: e.target.value })}
                    className="input text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="label text-xs">Master Support Email</label>
                  <input
                    type="email"
                    value={platform.contactEmail}
                    onChange={(e) => setPlatform({ ...platform, contactEmail: e.target.value })}
                    className="input text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs">Platform Target Domain</label>
                <input
                  type="url"
                  value={platform.masterDomain}
                  onChange={(e) => setPlatform({ ...platform, masterDomain: e.target.value })}
                  className="input text-xs font-mono"
                  required
                />
              </div>

              <div className="pt-4 flex items-center justify-end border-t border-slate-50">
                <button type="submit" className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5">
                  <Save size={14} />
                  <span>Save General Settings</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab 2: Master Cloud API */}
          {activeTab === "gateway" && (
            <form onSubmit={handleSave} className="space-y-4">
              <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-50">Meta Cloud master credentials</h2>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label text-xs">Master Phone Number ID</label>
                  <input
                    type="text"
                    value={gateway.masterPhoneId}
                    onChange={(e) => setGateway({ ...gateway, masterPhoneId: e.target.value })}
                    className="input text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="label text-xs">Master WABA ID</label>
                  <input
                    type="text"
                    value={gateway.masterWabaId}
                    onChange={(e) => setGateway({ ...gateway, masterWabaId: e.target.value })}
                    className="input text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs">Master Permanent Meta Access Token</label>
                <input
                  type="password"
                  value={gateway.masterAccessToken}
                  onChange={(e) => setGateway({ ...gateway, masterAccessToken: e.target.value })}
                  className="input text-xs font-mono"
                  required
                />
              </div>

              <div className="pt-4 flex items-center justify-end border-t border-slate-50">
                <button type="submit" className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5">
                  <Save size={14} />
                  <span>Update Master Gateway</span>
                </button>
              </div>
            </form>
          )}

          {/* Tab 3: Subscription Pricing */}
          {activeTab === "pricing" && (
            <form onSubmit={handleSave} className="space-y-4">
              <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-50">SaaS Subscription Plans ($ / month)</h2>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label text-xs">Starter Plan Fee</label>
                  <input
                    type="number"
                    value={pricing.starterFee}
                    onChange={(e) => setPricing({ ...pricing, starterFee: Number(e.target.value) })}
                    className="input text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="label text-xs">Growth Plan Fee</label>
                  <input
                    type="number"
                    value={pricing.growthFee}
                    onChange={(e) => setPricing({ ...pricing, growthFee: Number(e.target.value) })}
                    className="input text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="label text-xs">Enterprise Plan Fee</label>
                  <input
                    type="number"
                    value={pricing.enterpriseFee}
                    onChange={(e) => setPricing({ ...pricing, enterpriseFee: Number(e.target.value) })}
                    className="input text-xs"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end border-t border-slate-50">
                <button type="submit" className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5">
                  <Save size={14} />
                  <span>Update Billing Rates</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
