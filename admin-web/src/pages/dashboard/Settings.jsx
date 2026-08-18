// admin-web/src/pages/dashboard/Settings.jsx
import React, { useState, useEffect } from "react";
import {
  Settings,
  Smartphone,
  CheckCircle2,
  Save,
  Database,
  Receipt,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { getTaxSettings, updateTaxSettings } from "../../lib/planService";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("platform");
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // ── Platform State ──
  const [platform, setPlatform] = useState({
    siteName: "SudoReply",
    masterDomain: "https://sudoreply.com",
    contactEmail: "support@sudoreply.com",
  });

  // ── Gateway State ──
  const [gateway, setGateway] = useState({
    masterPhoneId: "",
    masterWabaId: "",
    masterAccessToken: "",
  });

  // ── Tax State ──
  const [taxSettings, setTaxSettings] = useState({
    gstEnabled: true,
    gstPercent: 18,
    gstType: "CGST_SGST",
    companyGstNumber: "",
    pricingType: "EXCLUSIVE",
    companyName: "SudoReply Technologies Pvt Ltd",
    companyEmail: "info@sudoreply.com",
    companyAddress: "Mumbai, Maharashtra, India",
    sacCode: "998314",
  });
  const [taxLoading, setTaxLoading] = useState(false);
  const [taxSaving, setTaxSaving] = useState(false);
  const [taxError, setTaxError] = useState("");

  // ── Load tax settings when tab opens ──
  useEffect(() => {
    if (activeTab === "tax") {
      loadTaxSettings();
    }
  }, [activeTab]);

  const loadTaxSettings = async () => {
    setTaxLoading(true);
    setTaxError("");
    try {
      const res = await getTaxSettings();
      if (res.success) {
        setTaxSettings(res.data);
      } else {
        setTaxError(res.message || "Failed to load tax settings.");
      }
    } catch (err) {
      setTaxError("Failed to load tax settings.");
    }
    setTaxLoading(false);
  };

  // ── Feedback helper ──
  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback({ type: "", message: "" }), 3500);
  };

  // ── Save Platform ──
  const handleSavePlatform = (e) => {
    e.preventDefault();
    showFeedback("success", "General settings saved!");
  };

  // ── Save Gateway ──
  const handleSaveGateway = (e) => {
    e.preventDefault();
    showFeedback("success", "Master gateway updated!");
  };

  // ── Save Tax ──
  const handleSaveTax = async (e) => {
    e.preventDefault();
    setTaxSaving(true);
    setTaxError("");

    try {
      const res = await updateTaxSettings({
        gstEnabled: taxSettings.gstEnabled,
        gstPercent: parseFloat(taxSettings.gstPercent),
        gstType: taxSettings.gstType,
        companyGstNumber: taxSettings.companyGstNumber,
        pricingType: taxSettings.pricingType,
        companyName: taxSettings.companyName,
        companyEmail: taxSettings.companyEmail,
        companyAddress: taxSettings.companyAddress,
        sacCode: taxSettings.sacCode,
      });

      if (res.success) {
        setTaxSettings(res.data);
        showFeedback("success", res.message || "Tax settings updated!");
      } else {
        setTaxError(res.message || "Failed to update tax settings.");
        showFeedback("error", res.message || "Failed to update.");
      }
    } catch (err) {
      setTaxError("Something went wrong.");
      showFeedback("error", "Something went wrong.");
    }

    setTaxSaving(false);
  };

  // ── Tabs ──
  const tabs = [
    {
      id: "platform",
      label: "General Settings",
      icon: <Database size={15} />,
    },
    {
      id: "gateway",
      label: "Master Meta Cloud API",
      icon: <Smartphone size={15} />,
    },
    {
      id: "tax",
      label: "Tax & GST Settings",
      icon: <Receipt size={15} />,
    },
  ];

  // ── Live Preview ──
  const previewBase = 1000;
  const previewGST = taxSettings.gstEnabled
    ? parseFloat(((previewBase * taxSettings.gstPercent) / 100).toFixed(2))
    : 0;
  const previewTotal = previewBase + previewGST;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="text-[#125EF2]" size={24} />
            Platform Configurations
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage global SaaS parameters, Meta API keys, and tax settings.
          </p>
        </div>

        {/* Feedback */}
        {feedback.message && (
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 ${
              feedback.type === "success"
                ? "bg-[#EAF2FE] border border-[#CFE0FD] text-[#0D47A1]"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 size={13} className="text-[#125EF2]" />
            ) : (
              <AlertCircle size={13} className="text-red-500" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </div>

      {/* Layout */}
      <div className="grid gap-6 md:grid-cols-4 items-start">

        {/* Tab Sidebar */}
        <div className="card border border-slate-100 p-2 flex flex-row md:flex-col gap-1 overflow-x-auto shrink-0 bg-white">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-xl
                text-xs font-bold transition w-full whitespace-nowrap text-left
                ${
                  activeTab === tab.id
                    ? "bg-slate-100 text-slate-800"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Panel */}
        <div className="card border border-slate-100 p-6 md:col-span-3 bg-white">

          {/* ════ Tab 1: General ════ */}
          {activeTab === "platform" && (
            <form onSubmit={handleSavePlatform} className="space-y-4">
              <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-100">
                General SaaS Metadata
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label text-xs">Site Brand Name</label>
                  <input
                    type="text"
                    value={platform.siteName}
                    onChange={(e) =>
                      setPlatform({ ...platform, siteName: e.target.value })
                    }
                    className="input text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="label text-xs">Master Support Email</label>
                  <input
                    type="email"
                    value={platform.contactEmail}
                    onChange={(e) =>
                      setPlatform({ ...platform, contactEmail: e.target.value })
                    }
                    className="input text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs">Platform Domain</label>
                <input
                  type="url"
                  value={platform.masterDomain}
                  onChange={(e) =>
                    setPlatform({ ...platform, masterDomain: e.target.value })
                  }
                  className="input text-xs font-mono"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end border-t border-slate-100">
                <button
                  type="submit"
                  className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5"
                >
                  <Save size={14} />
                  Save General Settings
                </button>
              </div>
            </form>
          )}

          {/* ════ Tab 2: Gateway ════ */}
          {activeTab === "gateway" && (
            <form onSubmit={handleSaveGateway} className="space-y-4">
              <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-100">
                Meta Cloud Master Credentials
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label text-xs">Master Phone Number ID</label>
                  <input
                    type="text"
                    value={gateway.masterPhoneId}
                    onChange={(e) =>
                      setGateway({ ...gateway, masterPhoneId: e.target.value })
                    }
                    className="input text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="label text-xs">Master WABA ID</label>
                  <input
                    type="text"
                    value={gateway.masterWabaId}
                    onChange={(e) =>
                      setGateway({ ...gateway, masterWabaId: e.target.value })
                    }
                    className="input text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs">
                  Master Permanent Access Token
                </label>
                <input
                  type="password"
                  value={gateway.masterAccessToken}
                  onChange={(e) =>
                    setGateway({
                      ...gateway,
                      masterAccessToken: e.target.value,
                    })
                  }
                  className="input text-xs font-mono"
                />
              </div>

              <div className="pt-4 flex justify-end border-t border-slate-100">
                <button
                  type="submit"
                  className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5"
                >
                  <Save size={14} />
                  Update Master Gateway
                </button>
              </div>
            </form>
          )}

          {/* ════ Tab 3: Tax & GST ════ */}
          {activeTab === "tax" && (
            <>
              {taxLoading ? (
                <div className="flex items-center justify-center py-16 gap-3">
                  <Loader2 size={22} className="animate-spin text-[#125EF2]" />
                  <span className="text-sm text-slate-400">
                    Loading tax settings...
                  </span>
                </div>
              ) : (
                <form onSubmit={handleSaveTax} className="space-y-6">

                  <h2 className="text-base font-bold text-slate-800 pb-3 border-b border-slate-100">
                    Tax & GST Configuration
                  </h2>

                  {/* Error */}
                  {taxError && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs px-4 py-3 rounded-xl">
                      <AlertCircle size={14} />
                      {taxError}
                    </div>
                  )}

                  {/* ── Master Toggle ── */}
                  <div
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition ${
                      taxSettings.gstEnabled
                        ? "border-[#125EF2] bg-[#EAF2FE]/40"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        Enable GST / Tax Globally
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {taxSettings.gstEnabled
                          ? `✅ GST is ON — all invoices include ${taxSettings.gstPercent}% tax`
                          : "❌ GST is OFF — all invoices show base price only"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setTaxSettings((prev) => ({
                          ...prev,
                          gstEnabled: !prev.gstEnabled,
                        }))
                      }
                      className="flex items-center gap-2 ml-4 shrink-0"
                    >
                      {taxSettings.gstEnabled ? (
                        <>
                          <span className="text-xs font-bold text-[#125EF2]">
                            ON
                          </span>
                          <ToggleRight size={40} className="text-[#125EF2]" />
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-bold text-slate-400">
                            OFF
                          </span>
                          <ToggleLeft size={40} className="text-slate-300" />
                        </>
                      )}
                    </button>
                  </div>

                  {/* ── GST Config (only when enabled) ── */}
                  {taxSettings.gstEnabled && (
                    <>
                      {/* GST Rate + Type */}
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="label text-xs">GST Rate (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={taxSettings.gstPercent}
                            onChange={(e) =>
                              setTaxSettings((p) => ({
                                ...p,
                                gstPercent: e.target.value,
                              }))
                            }
                            className="input text-xs"
                            required
                          />
                          <p className="text-xs text-slate-400 mt-1">
                            Current: {taxSettings.gstPercent}% on all payments
                          </p>
                        </div>

                        <div>
                          <label className="label text-xs">GST Type</label>
                          <select
                            value={taxSettings.gstType}
                            onChange={(e) =>
                              setTaxSettings((p) => ({
                                ...p,
                                gstType: e.target.value,
                              }))
                            }
                            className="input text-xs"
                          >
                            <option value="CGST_SGST">
                              CGST + SGST (Intra-State)
                            </option>
                            <option value="IGST">IGST (Inter-State)</option>
                          </select>
                          <p className="text-xs text-slate-400 mt-1">
                            {taxSettings.gstType === "CGST_SGST"
                              ? `CGST ${taxSettings.gstPercent / 2}% + SGST ${
                                  taxSettings.gstPercent / 2
                                }%`
                              : `IGST ${taxSettings.gstPercent}%`}
                          </p>
                        </div>
                      </div>

                      {/* Pricing Type */}
                      <div>
                        <label className="label text-xs">Pricing Type</label>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                          {[
                            {
                              value: "EXCLUSIVE",
                              title: "Tax Exclusive",
                              desc: "GST added on top of plan price.",
                              eg: "₹1000 + ₹180 GST = ₹1180",
                            },
                            {
                              value: "INCLUSIVE",
                              title: "Tax Inclusive",
                              desc: "Plan price already includes GST.",
                              eg: "₹1180 shown = ₹1000 + ₹180 GST",
                            },
                          ].map((opt) => (
                            <label
                              key={opt.value}
                              className={`flex flex-col gap-1 p-3 rounded-xl border cursor-pointer transition ${
                                taxSettings.pricingType === opt.value
                                  ? "border-[#125EF2] bg-[#EAF2FE]"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="pricingType"
                                  value={opt.value}
                                  checked={
                                    taxSettings.pricingType === opt.value
                                  }
                                  onChange={() =>
                                    setTaxSettings((p) => ({
                                      ...p,
                                      pricingType: opt.value,
                                    }))
                                  }
                                  className="accent-[#125EF2]"
                                />
                                <span className="text-xs font-bold text-slate-700">
                                  {opt.title}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 ml-4">
                                {opt.desc}
                              </p>
                              <p className="text-[11px] text-[#125EF2] font-medium ml-4">
                                {opt.eg}
                              </p>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Company GST Details */}
                      <div>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100">
                          Company GST Details — Shown on Every Invoice
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="label text-xs">
                              Company GSTIN
                            </label>
                            <input
                              type="text"
                              value={taxSettings.companyGstNumber}
                              onChange={(e) =>
                                setTaxSettings((p) => ({
                                  ...p,
                                  companyGstNumber:
                                    e.target.value.toUpperCase(),
                                }))
                              }
                              placeholder="e.g. 27AABCU9603R1ZM"
                              className="input text-xs font-mono uppercase"
                            />
                          </div>
                          <div>
                            <label className="label text-xs">SAC Code</label>
                            <input
                              type="text"
                              value={taxSettings.sacCode}
                              onChange={(e) =>
                                setTaxSettings((p) => ({
                                  ...p,
                                  sacCode: e.target.value,
                                }))
                              }
                              placeholder="e.g. 998314"
                              className="input text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="label text-xs">
                              Company Name
                            </label>
                            <input
                              type="text"
                              value={taxSettings.companyName}
                              onChange={(e) =>
                                setTaxSettings((p) => ({
                                  ...p,
                                  companyName: e.target.value,
                                }))
                              }
                              className="input text-xs"
                            />
                          </div>
                          <div>
                            <label className="label text-xs">
                              Company Email
                            </label>
                            <input
                              type="email"
                              value={taxSettings.companyEmail}
                              onChange={(e) =>
                                setTaxSettings((p) => ({
                                  ...p,
                                  companyEmail: e.target.value,
                                }))
                              }
                              className="input text-xs"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="label text-xs">
                              Company Address
                            </label>
                            <input
                              type="text"
                              value={taxSettings.companyAddress}
                              onChange={(e) =>
                                setTaxSettings((p) => ({
                                  ...p,
                                  companyAddress: e.target.value,
                                }))
                              }
                              className="input text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Live Preview ── */}
                  <div
                    className={`rounded-2xl border p-4 transition ${
                      taxSettings.gstEnabled
                        ? "border-[#CFE0FD] bg-[#EAF2FE]/30"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      📋 Live Preview — Sample ₹1,000 Plan
                    </p>
                    <div className="space-y-1.5 text-xs">

                      {/* Base */}
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal (Base Price)</span>
                        <span className="font-semibold">₹1,000.00</span>
                      </div>

                      {/* Tax rows */}
                      {taxSettings.gstEnabled ? (
                        taxSettings.gstType === "CGST_SGST" ? (
                          <>
                            <div className="flex justify-between text-slate-500">
                              <span>CGST ({taxSettings.gstPercent / 2}%)</span>
                              <span>₹{(previewGST / 2).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>SGST ({taxSettings.gstPercent / 2}%)</span>
                              <span>₹{(previewGST / 2).toFixed(2)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between text-slate-500">
                            <span>IGST ({taxSettings.gstPercent}%)</span>
                            <span>₹{previewGST.toFixed(2)}</span>
                          </div>
                        )
                      ) : (
                        <div className="flex justify-between text-slate-400 italic">
                          <span>Tax</span>
                          <span>Not Applied</span>
                        </div>
                      )}

                      {/* Total */}
                      <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-800">
                        <span>Total Charged</span>
                        <span className="text-[#125EF2] text-sm">
                          ₹
                          {previewTotal.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-4 flex justify-end border-t border-slate-100">
                    <button
                      type="submit"
                      disabled={taxSaving}
                      className="btn-primary py-2 px-5 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {taxSaving ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save size={14} />
                          Save Tax Settings
                        </>
                      )}
                    </button>
                  </div>

                </form>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}