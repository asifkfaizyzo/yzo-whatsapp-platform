// src/components/settings/PaymentGatewaySettings.jsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Unlink,
  ShieldCheck,
  Zap,
  ChevronDown,
  ChevronUp,
  Key,
  Eye,
  EyeOff,
  Save,
  CreditCard,
  Building2,
  Sparkles,
  Smartphone,
  CheckCheck,
} from "lucide-react";
import RazorpayLogo from "./RazorpayLogo";
import { useToast } from "../../context/ToastContext";
import {
  getPaymentGatewayConfig,
  updatePaymentGatewayConfig,
  testPaymentGatewayConnection,
  getRazorpayOAuthUrl,
  disconnectRazorpayOAuth,
} from "../../services/tenant.service";

export default function PaymentGatewaySettings({ onBack } = {}) {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // Manual Keys accordion (for advanced developers, collapsed by default)
  const [showManualKeys, setShowManualKeys] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [testingManual, setTestingManual] = useState(false);
  const [showKeySecret, setShowKeySecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedAccountId, setCopiedAccountId] = useState(false);
  const [copiedEvents, setCopiedEvents] = useState(false);

  const [form, setForm] = useState({
    authType: "OAUTH",
    accountId: null,
    accountStatus: "DISCONNECTED",
    kycStatus: "PENDING",
    razorpayKeyId: "",
    razorpayKeySecret: "",
    razorpayWebhookSecret: "",
    enableOnlinePayment: true,
    enableCod: true,
    paymentLinkExpiryMins: 30,
    defaultCurrency: "INR",
    hasKeySecret: false,
    hasWebhookSecret: false,
    webhookUrl: "",
  });

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await getPaymentGatewayConfig();
      if (res.success && res.data) {
        const data = res.data;

        setForm((prev) => ({
          ...prev,
          authType: data.razorpayAuthType || "OAUTH",
          accountId: data.razorpayAccountId || null,
          accountStatus: data.razorpayAccountStatus || "DISCONNECTED",
          kycStatus: data.razorpayKycStatus || "PENDING",
          razorpayKeyId: data.razorpayKeyId || "",
          razorpayKeySecret: "",
          razorpayWebhookSecret: "",
          hasKeySecret: Boolean(data.hasKeySecret),
          hasWebhookSecret: Boolean(data.hasWebhookSecret),
          enableOnlinePayment: data.enableOnlinePayment ?? true,
          enableCod: data.enableCod ?? true,
          paymentLinkExpiryMins: data.paymentLinkExpiryMins || 30,
          defaultCurrency: data.defaultCurrency || "INR",
          webhookUrl: data.webhookUrl || "",
        }));
      } else {
        toast.error(res.message || "Failed to load payment settings");
      }
    } catch (err) {
      toast.error(err.message || "Error fetching payment configuration");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchConfig();

    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      toast.success("🎉 Razorpay account connected successfully!");
      cleanUrlParams();
    } else if (params.get("error")) {
      toast.error(`Connection failed: ${decodeURIComponent(params.get("error"))}`);
      cleanUrlParams();
    }
  }, []);

  const cleanUrlParams = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("connected");
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await getRazorpayOAuthUrl();
      if (res.success && res.url) {
        window.location.href = res.url;
      } else {
        toast.error(res.message || "Unable to initiate Razorpay connection. Please try again.");
        setConnecting(false);
      }
    } catch (err) {
      toast.error(err.message || "Failed to start Razorpay connection");
      setConnecting(false);
    }
  };

  const handleDisconnectConfirm = async () => {
    setDisconnecting(true);
    try {
      const res = await disconnectRazorpayOAuth();
      if (res.success) {
        toast.success("Razorpay account disconnected.");
        setShowDisconnectModal(false);
        fetchConfig();
      } else {
        toast.error(res.message || "Failed to disconnect account");
      }
    } catch (err) {
      toast.error(err.message || "Error disconnecting account");
    }
    setDisconnecting(false);
  };

  const handleCopyAccountId = () => {
    if (!form.accountId) return;
    navigator.clipboard.writeText(form.accountId);
    setCopiedAccountId(true);
    toast.success("Merchant Account ID copied!");
    setTimeout(() => setCopiedAccountId(false), 2000);
  };

  const handleCopyWebhook = () => {
    if (!form.webhookUrl) return;
    navigator.clipboard.writeText(form.webhookUrl);
    setCopiedWebhook(true);
    toast.success("Webhook URL copied!");
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleSaveGeneralSettings = async () => {
    setSavingGeneral(true);
    try {
      const payload = {
        enableCod: form.enableCod,
        paymentLinkExpiryMins: Number(form.paymentLinkExpiryMins) || 30,
        enableOnlinePayment: form.enableOnlinePayment,
      };

      const res = await updatePaymentGatewayConfig(payload);
      if (res.success) {
        toast.success("Checkout settings saved successfully!");
        fetchConfig();
      } else {
        toast.error(res.message || "Failed to save settings");
      }
    } catch (err) {
      toast.error(err.message || "Error saving settings");
    }
    setSavingGeneral(false);
  };

  const handleTestManualConnection = async () => {
    setTestingManual(true);
    try {
      const payload = {};
      if (form.razorpayKeyId) payload.razorpayKeyId = form.razorpayKeyId;
      if (form.razorpayKeySecret) payload.razorpayKeySecret = form.razorpayKeySecret;

      const res = await testPaymentGatewayConnection(payload);
      if (res.success) {
        toast.success(res.message || "Connected to Razorpay successfully!");
      } else {
        toast.error(res.message || "Connection test failed");
      }
    } catch (err) {
      toast.error(err.message || "Failed to test connection");
    }
    setTestingManual(false);
  };

  const handleSaveManualKeys = async (e) => {
    if (e) e.preventDefault();
    setSavingManual(true);
    try {
      const payload = {
        razorpayAuthType: "DIRECT_KEYS",
        razorpayKeyId: form.razorpayKeyId,
        enableOnlinePayment: form.enableOnlinePayment,
        enableCod: form.enableCod,
        paymentLinkExpiryMins: Number(form.paymentLinkExpiryMins),
        defaultCurrency: form.defaultCurrency,
      };
      if (form.razorpayKeySecret) payload.razorpayKeySecret = form.razorpayKeySecret;
      if (form.razorpayWebhookSecret) payload.razorpayWebhookSecret = form.razorpayWebhookSecret;

      const res = await updatePaymentGatewayConfig(payload);
      if (res.success) {
        toast.success("Manual API keys saved successfully!");
        fetchConfig();
      } else {
        toast.error(res.message || "Failed to save API keys");
      }
    } catch (err) {
      toast.error(err.message || "Error saving API keys");
    }
    setSavingManual(false);
  };

  const isConnected =
    form.authType === "OAUTH"
      ? Boolean(form.accountId)
      : Boolean(form.razorpayKeyId && (form.hasKeySecret || form.razorpayKeySecret));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <RefreshCw className="animate-spin text-[#0C83FD]" size={24} />
        <p className="text-xs text-slate-500 font-medium">Loading Razorpay integration...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Back to Integrations Breadcrumb */}
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

      {/* Integration Header Card (Full Width) */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-center shadow-xs shrink-0">
            <RazorpayLogo className="w-9 h-9" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900">Razorpay Payments</h2>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active & Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  Not Connected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Accept UPI, Credit/Debit cards, and NetBanking payments from your customers directly inside WhatsApp chat.
            </p>
          </div>
        </div>

                {/* Top Header Action - Show Disconnect ONLY when connected */}
        {isConnected && (
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setShowDisconnectModal(true)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition flex items-center gap-1.5"
            >
              <Unlink size={13} />
              <span>Disconnect</span>
            </button>
          </div>
        )}
        </div>

      {/* ────────────────────────────────────────────── */}
      {/* 2-COLUMN BALANCED DESKTOP GRID */}
      {/* ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Main Connection Flow & How It Works (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {isConnected ? (
            /* STATE 1: ALREADY CONNECTED */
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-white p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Your Razorpay Account is Linked</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">Merchant Account ID:</span>
                      <button
                        type="button"
                        onClick={handleCopyAccountId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-mono text-xs font-semibold transition"
                        title="Click to copy"
                      >
                        <span>{form.accountId || form.razorpayKeyId}</span>
                        {copiedAccountId ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* KYC Status Banner */}
              <div className="pt-2">
                {form.kycStatus === "VERIFIED" ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800 font-semibold">
                    <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                    <span>Payments are Live — Customers can pay via WhatsApp checkout buttons.</span>
                  </div>
                ) : form.accountStatus === "SUSPENDED" ? (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-800 font-semibold">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                    <span>Account Suspended — Please check your Razorpay merchant dashboard.</span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-xs text-amber-900 font-semibold">
                    <Clock size={16} className="text-amber-600 shrink-0" />
                    <span>Verification in Progress — Online payments will automatically activate once Razorpay verifies your business documents.</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                When customers order products in WhatsApp, an automated payment link will be sent directly to their chat. Transactions settle straight into your registered bank account with <strong>0% platform fees</strong>.
              </p>
            </div>
          ) : (
            /* STATE 2: NOT CONNECTED */
            <div className="space-y-6">
              {/* Hero Action Card */}
              <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/60 to-white p-6 sm:p-8 text-center space-y-6 shadow-2xs">
                <div className="max-w-md mx-auto space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto">
                    <RazorpayLogo className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Collect Payments on WhatsApp
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Connect your Razorpay account to send instant payment links and accept UPI, cards, and net banking with zero setup hassle.
                  </p>
                </div>

                {/* Connect CTA */}
                <div>
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="px-8 py-3.5 text-xs font-bold rounded-xl bg-gradient-to-r from-[#0C2340] to-[#0C83FD] text-white hover:opacity-95 transition inline-flex items-center gap-2.5 shadow-md hover:shadow-lg disabled:opacity-60"
                  >
                    {connecting ? (
                      <RefreshCw size={16} className="animate-spin text-white" />
                    ) : (
                      <RazorpayLogo className="w-4 h-4" />
                    )}
                    <span>{connecting ? "Redirecting to Razorpay..." : "Connect Razorpay Account"}</span>
                  </button>
                  <p className="text-[11px] text-slate-400 mt-2">
                    You will be redirected to Razorpay to log in and approve your store.
                  </p>
                </div>

                {/* 3 Key Client Benefits */}
                <div className="grid sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-left">
                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5">
                      <ShieldCheck size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">0% Platform Cut</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      100% of customer payments go straight into your bank account.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0C83FD] flex items-center justify-center mb-2.5">
                      <Zap size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Instant UPI Checkout</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Customers pay via GPay, PhonePe, Paytm, or cards with a single tap.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2.5">
                      <CheckCircle2 size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">Auto Order Confirmation</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      WhatsApp orders are confirmed immediately upon successful payment.
                    </p>
                  </div>
                </div>
              </div>

              {/* How It Works (Simple 3 Steps) */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
                  How it works
                </h4>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">Connect Account</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Click Connect and authorize your Razorpay merchant profile.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">Share Payment Link</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Customers receive interactive "Pay Now" links during chat checkout.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">Get Paid Automatically</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Funds settle directly into your bank and the order marks as Paid.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CHECKOUT SETTINGS & CONTROLS */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Checkout & Payment Controls
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure payment methods, link expiration, and Cash on Delivery rules.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-1">
              {/* Enable COD Toggle */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-3">
                <div>
                  <h5 className="text-xs font-bold text-slate-800">Cash on Delivery (COD) / Pay on Pickup</h5>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Allow customers to pay in cash or at counter if they prefer not to pay online.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={form.enableCod}
                    onChange={(e) => setForm({ ...form, enableCod: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* Payment Link Expiry Input */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-3">
                <div>
                  <h5 className="text-xs font-bold text-slate-800">Payment Link Expiry Time</h5>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Auto-expire unpaid payment links (minimum 15 mins required by Razorpay).
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="15"
                    max="1440"
                    value={form.paymentLinkExpiryMins}
                    onChange={(e) => setForm({ ...form, paymentLinkExpiryMins: Math.max(15, Math.min(1440, Number(e.target.value) || 15)) })}
                    className="w-16 text-xs text-center font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-500">mins</span>
                </div>
              </div>
            </div>

            {/* Save Settings Button */}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSaveGeneralSettings}
                disabled={savingGeneral}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-[#0C83FD] text-white hover:bg-[#125EF2] transition flex items-center gap-2 shadow-xs disabled:opacity-50"
              >
                {savingGeneral ? <RefreshCw size={14} className="animate-spin text-white" /> : <Save size={14} />}
                <span>{savingGeneral ? "Saving..." : "Save Checkout Settings"}</span>
              </button>
            </div>
          </div>

          {/* DEVELOPER OPTIONS ACCORDION */}
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowManualKeys(!showManualKeys)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-100/60 transition"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <Key size={14} className="text-slate-400" />
                <span>Developer Options (Manual API Keys Setup)</span>
              </div>
              {showManualKeys ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
            </button>

            {showManualKeys && (
              <div className="p-4 pt-2 border-t border-slate-200/70 bg-white space-y-4">
                <p className="text-[11px] text-slate-500">
                  If you prefer not to use automatic connection, you can enter your Razorpay Key ID, Secret, and Webhook secret manually.
                </p>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Razorpay Key ID
                    </label>
                    <input
                      type="text"
                      value={form.razorpayKeyId}
                      onChange={(e) => setForm({ ...form, razorpayKeyId: e.target.value })}
                      placeholder="rzp_live_xxxxxxxxxxxxxxxx"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Razorpay Key Secret
                    </label>
                    <div className="relative">
                      <input
                        type={showKeySecret ? "text" : "password"}
                        value={form.razorpayKeySecret}
                        onChange={(e) => setForm({ ...form, razorpayKeySecret: e.target.value })}
                        placeholder={form.hasKeySecret ? "••••••••••••••••" : "Enter Key Secret"}
                        className="w-full text-xs pl-3 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeySecret(!showKeySecret)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showKeySecret ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Razorpay Webhook Secret
                    </label>
                    <div className="relative">
                      <input
                        type={showWebhookSecret ? "text" : "password"}
                        value={form.razorpayWebhookSecret}
                        onChange={(e) => setForm({ ...form, razorpayWebhookSecret: e.target.value })}
                        placeholder={form.hasWebhookSecret ? "••••••••••••••••" : "Enter Webhook Secret"}
                        className="w-full text-xs pl-3 pr-8 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showWebhookSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Webhook Callback URL
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        readOnly
                        value={form.webhookUrl}
                        className="w-full text-xs font-mono pl-3 pr-16 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 select-all"
                      />
                      <button
                        type="button"
                        onClick={handleCopyWebhook}
                        className="absolute right-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        {copiedWebhook ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleTestManualConnection}
                    disabled={testingManual || !form.razorpayKeyId}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {testingManual ? "Testing..." : "Test Connection"}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveManualKeys}
                    disabled={savingManual}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {savingManual ? "Saving..." : "Save Manual Keys"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Live Customer Checkout Preview & Key Highlights (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* WhatsApp Customer Experience Live Mockup */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <h4 className="text-xs font-bold text-slate-800">Customer Checkout Preview</h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                WhatsApp
              </span>
            </div>

            {/* Simulated WhatsApp Bubble Box */}
            <div className="rounded-xl bg-[#EFEAE2] p-3 border border-slate-200/80 shadow-inner space-y-2 font-sans">
              <div className="bg-white rounded-xl rounded-tl-xs p-3 shadow-xs text-left space-y-2 border border-slate-100/90">
                <p className="text-[11px] text-slate-800 font-medium leading-snug">
                  Hi Rahul! 👋 Your order <strong>#ORD-2084</strong> has been placed.
                </p>

                <div className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-100 text-[10px] text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span>1x Wireless Earbuds Pro</span>
                    <span className="font-semibold text-slate-800">₹1,499</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200/60">
                    <span>Total Amount:</span>
                    <span className="text-emerald-600">₹1,499</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 leading-tight">
                  Tap below to complete payment securely via UPI, Card, or NetBanking:
                </p>

                {/* WhatsApp Interactive CTA Button */}
                <div className="pt-1">
                  <div className="w-full py-2.5 px-3 rounded-xl bg-[#0C2340] text-white text-center text-xs font-bold shadow-xs flex items-center justify-center gap-2 select-none">
                    <RazorpayLogo className="w-3.5 h-3.5" />
                    <span>Pay ₹1,499 via Razorpay</span>
                  </div>
                </div>

                <div className="text-[9px] text-slate-400 text-right flex items-center justify-end gap-1 pt-0.5">
                  <span>10:45 AM</span>
                  <CheckCheck size={12} className="text-[#53BDEB]" />
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 mt-2.5 text-center leading-relaxed">
              This is the exact payment card your customers will receive inside WhatsApp chat.
            </p>
          </div>

          {/* Integration Specs & Assurances Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3.5 text-left">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Integration Highlights
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Platform Commission</span>
                <span className="font-bold text-emerald-600">0% (Zero Platform Fee)</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Payment Modes</span>
                <span className="font-semibold text-slate-800">UPI, Cards, NetBanking</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Payout Target</span>
                <span className="font-semibold text-slate-800">Direct to Your Bank</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Order Updates</span>
                <span className="font-semibold text-emerald-600">Real-Time Instant Sync</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500">Security</span>
                <span className="font-semibold text-slate-800">256-bit Bank Grade</span>
              </div>
            </div>
          </div>
        </div>
      </div>

               {/* Disconnect Modal */}
      {showDisconnectModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 relative z-10 animate-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <AlertTriangle size={20} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800">Disconnect Razorpay?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Disconnecting will disable online payment links in WhatsApp. You can reconnect anytime.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
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
        </div>,
        document.body
      )} 
       </div>
  );
}
