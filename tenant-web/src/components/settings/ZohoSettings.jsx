// src/components/settings/ZohoSettings.jsx

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Unlink,
  ShieldCheck,
  Zap,
  Play,
  Check,
  Info,
  Server,
  Users2,
  Database,
  Calendar,
  Loader2,
  Sparkles,
  Lock,
  Layers,
  BarChart3,
} from "lucide-react";
import ZohoLogo from "./ZohoLogo";
import { useToast } from "../../context/ToastContext";
import {
  getZohoStatus,
  getZohoAuthUrl,
  testZohoConnection,
  disconnectZoho,
  triggerZohoSync,
  triggerZohoIncrementalSync,
  getZohoSyncStatus,
  getZohoPlanInfo,
  getZohoPreferences,
  updateZohoPreferences,
} from "../../services/zoho.service";

export default function ZohoSettings({ onBack } = {}) {
  const toast = useToast();

  // ── Connection Status ──
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const [connection, setConnection] = useState({
    connected: false,
    status: "DISCONNECTED",
    accountEmail: null,
    dataCenter: null,
    dataCenterLabel: null,
    connectedAt: null,
    scopes: [],
    rateLimit: null, // Holds limit, remaining, reset, and updatedAt
  });

  // ── Plan Information ──
  const [planLoading, setPlanLoading] = useState(false);
  const [planInfo, setPlanInfo] = useState({
    edition: "Free",
    companyName: null,
    currencySymbol: "₹",
    countryCode: "IN",
    features: {
      contacts: true,
      leads: true,
      tasks: true,
      deals: false,
      notes: true,
      webhooks: false,
      customModules: false,
      blueprints: false,
    },
  });

  // ── Sync Status ──
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncTriggering, setSyncTriggering] = useState(false);
  const [syncStats, setSyncStats] = useState({
    totalContacts: 0,
    mappedContacts: 0,
    unmappedContacts: 0,
    lastSyncedAt: null,
  });

  // ── Automation Preferences ──
  const [preferences, setPreferences] = useState({
    syncDestination: "CONTACTS",
    logConversationNotes: true,
    createDealsOnOrders: true,
    createFollowUpTasks: true,
    autoSyncNewContacts: true,
  });
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);

  // ── Fetch Connection, Plan, Sync Stats & Preferences ──
  const fetchStatusAndStats = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setLoading(true);
    try {
      const res = await getZohoStatus();
      if (res.success && res.data) {
        setConnection(res.data);
        if (res.data.connected) {
          await Promise.allSettled([
            fetchSyncStats(),
            fetchPlanDetails(),
            fetchPreferences(),
          ]);
        }
      }
    } catch (err) {
      console.error("Failed to load Zoho status:", err);
    } finally {
      if (showLoadingIndicator) setLoading(false);
    }
  };

  const fetchPlanDetails = async () => {
    setPlanLoading(true);
    try {
      const res = await getZohoPlanInfo();
      if (res.success && res.data) {
        setPlanInfo(res.data);
      }
    } catch (err) {
      console.error("Failed to load Zoho plan details:", err);
    } finally {
      setPlanLoading(false);
    }
  };

  const fetchSyncStats = async () => {
    setSyncLoading(true);
    try {
      const res = await getZohoSyncStatus();
      if (res.success && res.data) {
        setSyncStats(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch Zoho sync statistics:", err);
    } finally {
      setSyncLoading(false);
    }
  };

  const fetchPreferences = async () => {
    setPrefsLoading(true);
    try {
      const res = await getZohoPreferences();
      if (res.success && res.data) {
        setPreferences((prev) => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      console.error("Failed to load Zoho preferences:", err);
    } finally {
      setPrefsLoading(false);
    }
  };

  // ── Update Individual Preference Toggle ──
  const handleUpdatePreference = async (key, value) => {
    // Optimistic UI update
    const previous = preferences;
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    setPrefsSaving(true);

    try {
      const res = await updateZohoPreferences({ [key]: value });
      if (res.success) {
        if (res.data) setPreferences((prev) => ({ ...prev, ...res.data }));
        toast.success("Preference updated");
      } else {
        setPreferences(previous); // Revert on failure
        toast.error(res.message || "Failed to update preference");
      }
    } catch (err) {
      setPreferences(previous);
      toast.error("Could not save preference");
    } finally {
      setPrefsSaving(false);
    }
  };

  useEffect(() => {
    fetchStatusAndStats();

    // Catch OAuth redirection callbacks
    const params = new URLSearchParams(window.location.search);
    const connectedParam = params.get("connected");
    const errorParam = params.get("error");

    if (connectedParam === "true") {
      toast.success("🎉 Zoho CRM connected successfully!");
      cleanUrlParams();
    } else if (errorParam) {
      toast.error(`OAuth Integration failed: ${decodeURIComponent(errorParam)}`);
      cleanUrlParams();
    }
  }, []);

  const cleanUrlParams = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("app");
    url.searchParams.delete("connected");
    url.searchParams.delete("error");
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
  };

  // ── Connect Flow ──
  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await getZohoAuthUrl();
      if (res.success && res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error(res.message || "Failed to generate authorization URL");
        setConnecting(false);
      }
    } catch (err) {
      toast.error("Failed to establish Zoho session");
      setConnecting(false);
    }
  };

  // ── Test Active Session ──
  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await testZohoConnection();
      if (res.success) {
        toast.success(
          `Connection healthy! Verified account: ${res.data?.user?.email || "Zoho User"}`
        );
        // Immediately set rateLimit in component state
        if (res.data?.rateLimit) {
          setConnection((prev) => ({ ...prev, rateLimit: res.data.rateLimit }));
        }
        fetchStatusAndStats(false);
      } else {
        toast.error(res.message || "Connection check failed. Reconnect required.");
      }
    } catch (err) {
      toast.error("Could not reach Zoho API");
    } finally {
      setTesting(false);
    }
  };

  // ── Trigger Manual Full Contacts Synchronization ──
  const handleTriggerSync = async () => {
    setSyncTriggering(true);
    try {
      const res = await triggerZohoSync("FULL");
      if (res.success) {
        toast.success("Background full synchronization queued. Updating progress...");
        setTimeout(() => {
          fetchSyncStats();
          fetchStatusAndStats(false); // Refresh API credits remaining
        }, 1500);
      } else {
        toast.error(res.message || "Sync request rejected");
      }
    } catch (err) {
      toast.error("Failed to queue synchronization");
    } finally {
      setSyncTriggering(false);
    }
  };

  // ── Trigger Incremental Synchronization ──
  const handleTriggerIncrementalSync = async () => {
    setSyncTriggering(true);
    try {
      const res = await triggerZohoIncrementalSync();
      if (res.success) {
        toast.success("Incremental sync queued — only modified contacts will update.");
        setTimeout(() => {
          fetchSyncStats();
          fetchStatusAndStats(false); // Refresh API credits remaining
        }, 2000);
      } else {
        toast.error(res.message || "Incremental sync request rejected");
      }
    } catch (err) {
      toast.error("Failed to queue incremental synchronization");
    } finally {
      setSyncTriggering(false);
    }
  };

  // ── Disconnect Connection Flow ──
  const handleDisconnectConfirm = async () => {
    setDisconnecting(true);
    try {
      const res = await disconnectZoho();
      if (res.success) {
        toast.success("Zoho CRM disconnected completely.");
        setShowDisconnectModal(false);
        setConnection({
          connected: false,
          status: "DISCONNECTED",
          accountEmail: null,
          dataCenter: null,
          dataCenterLabel: null,
          connectedAt: null,
          scopes: [],
          rateLimit: null,
        });
        setSyncStats({
          totalContacts: 0,
          mappedContacts: 0,
          unmappedContacts: 0,
          lastSyncedAt: null,
        });
      } else {
        toast.error(res.message || "Failed to disconnect Zoho");
      }
    } catch (err) {
      toast.error("Disconnect action failed");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <RefreshCw className="animate-spin text-[#009A44]" size={24} />
        <p className="text-xs text-slate-500 font-medium">Querying Zoho integration status...</p>
      </div>
    );
  }

  const isConnected = connection.connected;
  const features = planInfo.features || {};

  // Rate limit computations
  const rateLimit = connection.rateLimit;
  const usedCredits = rateLimit ? rateLimit.limit - rateLimit.remaining : 0;
  const usagePercentage = rateLimit ? Math.round((usedCredits / rateLimit.limit) * 100) : 0;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Back Breadcrumb */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition mb-1"
        >
          <ArrowLeft size={14} />
          <span>Back to Integrations</span>
        </button>
      )}

      {/* Integration Header Panel */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-center shadow-xs shrink-0">
            <ZohoLogo className="w-10 h-10" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900">Zoho CRM</h2>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Connected
                </span>
              ) : connection.status === "REFRESH_FAILED" ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertCircle size={12} className="text-rose-500 animate-bounce" />
                  Action Required
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  Ready to Connect
                </span>
              )}

              {/* Connected Plan Badge */}
              {isConnected && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold capitalize border ${
                  planInfo.edition === "Enterprise" || planInfo.edition === "Ultimate" || planInfo.edition === "Trial"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : planInfo.edition === "Professional"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : planInfo.edition === "Standard"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                }`}>
                  {planInfo.edition === "Enterprise" || planInfo.edition === "Ultimate" || planInfo.edition === "Trial" ? (
                    <Sparkles size={11} className="text-purple-500" />
                  ) : (
                    <Layers size={11} />
                  )}
                  {planInfo.edition} Edition
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Synchronize your WhatsApp contacts with Zoho CRM Contacts database seamlessly to build comprehensive customer relationships.
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="shrink-0">
          {isConnected ? (
            <button
              type="button"
              onClick={() => setShowDisconnectModal(true)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition flex items-center gap-1.5"
            >
              <Unlink size={13} />
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[#009A44] text-white hover:bg-[#007C36] transition flex items-center gap-2 shadow-sm disabled:opacity-60"
            >
              {connecting ? (
                <RefreshCw size={14} className="animate-spin text-white" />
              ) : (
                <Zap size={14} />
              )}
              <span>{connecting ? "Connecting..." : "Connect Zoho CRM"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-6">
          {isConnected ? (
            <>
              {/* Linked Card */}
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/20 via-white to-white p-6 shadow-2xs space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0 mt-0.5">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900">Your Zoho CRM account is linked</h3>
                    <p className="text-xs text-slate-500">
                      Sudo Reply has been authorized to securely sync contacts into your CRM workspace module.
                    </p>
                  </div>
                </div>

                {/* Zoho account details strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Connected Account</span>
                    <span className="text-xs font-bold text-slate-700 truncate block mt-0.5">{connection.accountEmail}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Data Center (DC)</span>
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                      <Server size={12} className="text-[#009A44]" />
                      {connection.dataCenterLabel}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide">Connected On</span>
                    <span className="text-xs font-bold text-slate-700 block mt-0.5">
                      {connection.connectedAt ? new Date(connection.connectedAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) : "Recently"}
                    </span>
                  </div>
                </div>

                {/* Integration Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
                  >
                    {testing ? (
                      <RefreshCw size={13} className="animate-spin text-[#009A44]" />
                    ) : (
                      <ShieldCheck size={13} className="text-blue-500" />
                    )}
                    <span>{testing ? "Testing..." : "Test Connection"}</span>
                  </button>
                </div>
              </div>

              {/* Contacts Sync Panel */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Database size={15} className="text-[#009A44]" />
                        <span>Contacts Synchronization</span>
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Auto-Sync Active
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Export active WhatsApp contacts directly to Zoho CRM Contacts database.
                    </p>
                  </div>

                  {/* Sync Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleTriggerIncrementalSync}
                      disabled={syncTriggering || syncLoading}
                      className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={syncTriggering ? "animate-spin text-[#009A44]" : "text-slate-500"} />
                      <span>Incremental Sync</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleTriggerSync}
                      disabled={syncTriggering || syncLoading}
                      className="px-4 py-2 bg-[#009A44] hover:bg-[#007C36] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
                    >
                      {syncTriggering ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <Play size={13} fill="white" />
                      )}
                      <span>{syncTriggering ? "Queueing Sync..." : "Sync Contacts Now"}</span>
                    </button>
                  </div>
                </div>

                {/* Sync Statistics Dashboard */}
                {syncLoading ? (
                  <div className="py-8 flex flex-col items-center gap-2 text-slate-400">
                    <Loader2 size={24} className="animate-spin text-[#009A44]" />
                    <span className="text-xs font-semibold">Updating sync statistics...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                        <Users2 size={16} />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sudo Contacts</span>
                        <span className="text-lg font-extrabold text-slate-800">{syncStats.totalContacts}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                        <Check size={16} />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Synced to Zoho</span>
                        <span className="text-lg font-extrabold text-slate-800">{syncStats.mappedContacts}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                        <RefreshCw size={14} className="text-amber-500" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Sync</span>
                        <span className="text-lg font-extrabold text-slate-800">{syncStats.unmappedContacts}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Last Synced Row */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400" />
                    Last Synced At:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {syncStats.lastSyncedAt
                      ? new Date(syncStats.lastSyncedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                      : "Never Synced"}
                  </span>
                </div>
              </div>

              {/* ── AUTOMATION & SYNC PREFERENCES CARD ── */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles size={14} className="text-[#009A44]" />
                      <span>Automation & Workflow Preferences</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure how Sudo Reply synchronizes data into your Zoho CRM modules.
                    </p>
                  </div>
                  {prefsSaving && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                      <RefreshCw size={11} className="animate-spin text-[#009A44]" />
                      Saving...
                    </span>
                  )}
                </div>

                {prefsLoading ? (
                  <div className="py-8 flex flex-col items-center gap-2 text-slate-400">
                    <Loader2 size={22} className="animate-spin text-[#009A44]" />
                    <span className="text-xs font-semibold">Loading preferences...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Switch 1: Auto-Sync on Creation */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Auto-Sync New Contacts</h4>
                        <p className="text-[11px] text-slate-500">Instantly push new WhatsApp leads to Zoho CRM.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.autoSyncNewContacts}
                          onChange={(e) => handleUpdatePreference('autoSyncNewContacts', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#009A44]" />
                      </label>
                    </div>

                    {/* Switch 2: Conversation Notes */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Log Chat History as Notes</h4>
                        <p className="text-[11px] text-slate-500">Attach WhatsApp conversation logs to Zoho Contact records.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.logConversationNotes}
                          onChange={(e) => handleUpdatePreference('logConversationNotes', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#009A44]" />
                      </label>
                    </div>

                    {/* Switch 3: Deal Creation */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Create Deals on WhatsApp Orders</h4>
                        <p className="text-[11px] text-slate-500">Automatically generate a Zoho CRM Deal when an order is placed.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.createDealsOnOrders}
                          onChange={(e) => handleUpdatePreference('createDealsOnOrders', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#009A44]" />
                      </label>
                    </div>

                    {/* Switch 4: Follow-up Tasks */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Auto-Create Follow-up Tasks</h4>
                        <p className="text-[11px] text-slate-500">Create reminder tasks in Zoho for conversations unresolved after 24h.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.createFollowUpTasks}
                          onChange={(e) => handleUpdatePreference('createFollowUpTasks', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#009A44]" />
                      </label>
                    </div>

                    {/* Sync Destination Selector */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 border border-slate-100">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Sync Destination Module</h4>
                        <p className="text-[11px] text-slate-500">Choose which Zoho module receives new contacts.</p>
                      </div>
                      <select
                        value={preferences.syncDestination}
                        onChange={(e) => handleUpdatePreference('syncDestination', e.target.value)}
                        className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#009A44]/20 focus:border-[#009A44] cursor-pointer"
                      >
                        <option value="CONTACTS">Contacts</option>
                        <option value="LEADS">Leads</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* NOT CONNECTED STATE */
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/50 to-white p-6 sm:p-8 text-center space-y-6 shadow-2xs">
                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto">
                    <ZohoLogo className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Connect Sudo Reply to Zoho CRM</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Map Sudo Reply WhatsApp contacts into Zoho CRM Contact modules. Keep your customer databases in sync automatically.
                  </p>
                </div>

                {connection.status === "REFRESH_FAILED" && (
                  <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/50 text-left text-rose-900 text-xs flex gap-3 max-w-lg mx-auto">
                    <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold">Authorization Expired</p>
                      <p className="leading-relaxed">
                        Sudo Reply's authorization token was revoked on Zoho CRM or has expired. Please click "Connect Zoho CRM" below to re-authorize.
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="px-8 py-3.5 text-xs font-bold rounded-xl bg-gradient-to-r from-[#009A44] to-[#007C36] text-white hover:opacity-95 transition inline-flex items-center gap-2.5 shadow-md hover:shadow-lg disabled:opacity-60"
                  >
                    {connecting ? (
                      <RefreshCw size={16} className="animate-spin text-white" />
                    ) : (
                      <Zap size={16} />
                    )}
                    <span>{connecting ? "Connecting..." : "Connect Zoho CRM"}</span>
                  </button>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Secured with standard Zoho Server-Based OAuth 2.0 protocol.
                  </p>
                </div>

                {/* Features Highlights */}
                <div className="grid sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-left">
                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5">
                      <Users2 size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Contact Sync</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Push WhatsApp leads directly into Zoho Contacts.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
                      <Zap size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">One-Click Install</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Instant connection. Sudo automatically resolves your DC.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2.5">
                      <ShieldCheck size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Security Built-in</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Credential keys are fully GCM-encrypted at rest.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Multi DC, Plan Details, & Info Cards */}
        <div className="lg:col-span-4 space-y-5">
          {/* Zoho API limits & metrics (Only displays when Zoho sends active rate headers) */}
          {isConnected && rateLimit && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <BarChart3 size={14} className="text-[#009A44]" />
                  <h4 className="text-xs font-bold text-slate-800">Zoho API Usage Limits</h4>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Live Quota</span>
              </div>

              {/* Progress metrics */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-bold text-slate-700">
                  <span>API Credits Used</span>
                  <span>{usagePercentage}%</span>
                </div>

                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                  <div
                    style={{ width: `${usagePercentage}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      usagePercentage > 85
                        ? "bg-rose-500"
                        : usagePercentage > 60
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 font-semibold pt-1">
                  <span>{usedCredits.toLocaleString()} Credits Used</span>
                  <span>{rateLimit.remaining.toLocaleString()} Left</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 bg-slate-50/50 rounded-lg">
                  <span className="block text-slate-400 font-bold uppercase tracking-wider">Quota Limit</span>
                  <span className="text-xs font-extrabold text-slate-700 mt-0.5">{rateLimit.limit.toLocaleString()}</span>
                </div>
                <div className="p-2 bg-slate-50/50 rounded-lg">
                  <span className="block text-slate-400 font-bold uppercase tracking-wider">Recorded At</span>
                  <span className="text-xs font-extrabold text-slate-700 mt-0.5">
                    {new Date(rateLimit.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Plan Capability matrix details */}
          {isConnected && (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3.5">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <ShieldCheck size={14} className="text-[#009A44]" />
                <h4 className="text-xs font-bold text-slate-800">Plan Capabilities</h4>
              </div>

              {planLoading ? (
                <div className="flex items-center gap-2 py-3 justify-center text-xs text-slate-400">
                  <RefreshCw className="animate-spin text-[#009A44]" size={12} />
                  <span>Loading capabilities...</span>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-50">
                    <span className="text-slate-500">Contact Sync</span>
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <Check size={12} strokeWidth={3} /> Active
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-50">
                    <span className="text-slate-500">Conversation Notes</span>
                    {features.notes ? (
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <Check size={12} strokeWidth={3} /> Active
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-400 flex items-center gap-1" title="Requires Standard Plan+">
                        <Lock size={11} /> Locked
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-50">
                    <span className="text-slate-500">Auto Deal Creation</span>
                    {features.deals ? (
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <Check size={12} strokeWidth={3} /> Active
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-400 flex items-center gap-1" title="Requires Standard Plan+">
                        <Lock size={11} /> Locked
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-50">
                    <span className="text-slate-500">Bidirectional Sync</span>
                    {features.webhooks ? (
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <Check size={12} strokeWidth={3} /> Active
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-400 flex items-center gap-1" title="Requires Professional Plan+">
                        <Lock size={11} /> Locked
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-50">
                    <span className="text-slate-500">Custom CRM Modules</span>
                    {features.customModules ? (
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <Check size={12} strokeWidth={3} /> Active
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-400 flex items-center gap-1" title="Requires Enterprise Plan+">
                        <Lock size={11} /> Locked
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Multi DC Support Notice */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Server size={14} className="text-[#009A44]" />
              <h4 className="text-xs font-bold text-slate-800">Multi-DC Support</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Zoho isolates accounts strictly across regional Data Centers. Sudo Reply fully supports automatic detection across all supported global Zoho domains, including:
            </p>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
              <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-600">IN (India)</span>
              <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-600">US (United States)</span>
              <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-600">EU (Europe)</span>
              <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-600">AU (Australia)</span>
              <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-100 text-slate-600">JP (Japan)</span>
            </div>
            <p className="text-[9px] text-slate-400 italic">
              Authorization keys are matched dynamically with your regional login DC.
            </p>
          </div>

          {/* Guidelines Notice Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Info size={14} className="text-blue-500" />
              <h4 className="text-xs font-bold text-slate-800">Guidelines & Mapping</h4>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Before syncing, note Sudo's name-splitting strategy:
            </p>
            <ul className="list-disc pl-4 text-[10px] text-slate-500 space-y-1.5">
              <li>Names are split on the <strong>last space</strong> for Zoho First Name & Last Name formatting.</li>
              <li>Single-word names (e.g., Madonna) map entirely to the mandatory <strong>Last Name</strong> field.</li>
              <li>Only active WhatsApp contacts with valid names will be processed during the background sync.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Disconnect Warning Modal */}
      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <AlertTriangle size={20} />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">Disconnect Zoho CRM?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Disconnecting will clear all tokens. Synchronization will stop. Your mapped contact relationships will remain intact in the database for future reconnections.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={disconnecting}
                onClick={() => setShowDisconnectModal(false)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={disconnecting}
                onClick={handleDisconnectConfirm}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {disconnecting && <RefreshCw size={13} className="animate-spin" />}
                <span>{disconnecting ? "Disconnecting..." : "Yes, Disconnect"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}