// src/components/settings/WooCommerceSettings.jsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Unlink,
  ShieldCheck,
  Zap,
  ExternalLink,
  ShoppingCart,
  Package,
  Store,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import WooCommerceLogo from "./WooCommerceLogo";
import { useToast } from "../../context/ToastContext";
import {
  getWooCommerceStatus,
  connectWooCommerce,
  disconnectWooCommerce,
  getWooCommerceOAuthUrl,
  saveWooCommerceTrackingUrlTemplates,
} from "../../services/woocommerce.service";

export default function WooCommerceSettings({ onBack } = {}) {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [savingTrackingTemplates, setSavingTrackingTemplates] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showConsumerKey, setShowConsumerKey] = useState(false);
  const [showConsumerSecret, setShowConsumerSecret] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const [connection, setConnection] = useState({
    isConnected: false,
    storeUrl: null,
    connectedAt: null,
    connectedBy: null,
    status: null,
  });
  const [trackingUrlTemplates, setTrackingUrlTemplates] = useState([]);

  // 1-Click form (only store URL)
  const [storeUrl, setStoreUrl] = useState("");

  // Manual / Advanced form
  const [form, setForm] = useState({
    storeUrl: "",
    consumerKey: "",
    consumerSecret: "",
    webhookSecret: "",
  });

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await getWooCommerceStatus();
      if (res.success && res.data) {
        const isConnected =
          res.data.isConnected || res.data.status === "active";
        setConnection({
          isConnected,
          storeUrl: res.data.storeUrl || null,
          connectedAt: res.data.connectedAt || null,
          connectedBy: res.data.connectedBy || null,
          status: res.data.status || null,
        });
        setTrackingUrlTemplates(
          Object.entries(res.data.trackingUrlTemplates || {}).map(([provider, urlTemplate]) => ({
            provider,
            urlTemplate,
          })),
        );
      } else {
        setConnection({
          isConnected: false,
          storeUrl: null,
          connectedAt: null,
          connectedBy: null,
          status: null,
        });
        setTrackingUrlTemplates([]);
      }
    } catch (err) {
      console.error("Fetch WooCommerce status error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Handle return from WooCommerce OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      toast.success("🎉 WooCommerce store connected successfully!");
      // Clean URL without reload
      window.history.replaceState({}, "", window.location.pathname);
      fetchStatus();
    }
    if (params.get("error")) {
      toast.error(decodeURIComponent(params.get("error")));
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // ─────────────────────────────────────────────
  // 1-CLICK CONNECT
  // ─────────────────────────────────────────────
  const handleOneClickConnect = async (e) => {
    e.preventDefault();
    if (!storeUrl.trim()) {
      toast.error("Please enter your WooCommerce store URL");
      return;
    }

    setConnecting(true);
    try {
      const cleanUrl = storeUrl.trim().replace(/\/$/, "");
      const finalUrl = cleanUrl.startsWith("http")
        ? cleanUrl
        : `https://${cleanUrl}`;

      const res = await getWooCommerceOAuthUrl(finalUrl);

      if (res.success && res.authUrl) {
        // Redirect tenant to their WordPress "Approve" screen
        window.location.href = res.authUrl;
      } else {
        toast.error(res.message || "Failed to start 1-Click connection");
        setConnecting(false);
      }
    } catch (err) {
      console.error("1-Click connect error:", err);
      toast.error(
        err?.response?.data?.message ||
          "Failed to start 1-Click connection. Try manual keys below."
      );
      setConnecting(false);
    }
  };

  // ─────────────────────────────────────────────
  // MANUAL CONNECT (Advanced fallback)
  // ─────────────────────────────────────────────
  const handleManualConnect = async (e) => {
    e.preventDefault();
    if (
      !form.storeUrl.trim() ||
      !form.consumerKey.trim() ||
      !form.consumerSecret.trim()
    ) {
      toast.error("Store URL, Consumer Key, and Consumer Secret are required");
      return;
    }

    setConnecting(true);
    try {
      const cleanUrl = form.storeUrl.trim().replace(/\/$/, "");
      const payload = {
        storeUrl: cleanUrl.startsWith("http")
          ? cleanUrl
          : `https://${cleanUrl}`,
        consumerKey: form.consumerKey.trim(),
        consumerSecret: form.consumerSecret.trim(),
        webhookSecret: form.webhookSecret.trim() || null,
      };
      const res = await connectWooCommerce(payload);
      if (res.success) {
        toast.success("🎉 WooCommerce store connected successfully!");
        setForm({
          storeUrl: "",
          consumerKey: "",
          consumerSecret: "",
          webhookSecret: "",
        });
        fetchStatus();
      } else {
        toast.error(res.message || "Failed to connect WooCommerce store");
      }
    } catch (err) {
      console.error("WooCommerce connect error:", err);
      toast.error(
        err?.response?.data?.message || "Failed to connect WooCommerce store"
      );
    }
    setConnecting(false);
  };

  const handleDisconnectConfirm = async () => {
    setDisconnecting(true);
    try {
      const res = await disconnectWooCommerce();
      if (res.success) {
        toast.success("WooCommerce store disconnected successfully.");
        setShowDisconnectModal(false);
        fetchStatus();
      } else {
        toast.error(res.message || "Failed to disconnect WooCommerce");
      }
    } catch (err) {
      toast.error("Failed to disconnect WooCommerce");
    }
    setDisconnecting(false);
  };

  const handleSaveTrackingTemplates = async (event) => {
    event.preventDefault();
    setSavingTrackingTemplates(true);
    try {
      const result = await saveWooCommerceTrackingUrlTemplates(trackingUrlTemplates);
      if (result.success) {
        setTrackingUrlTemplates(
          Object.entries(result.data || {}).map(([provider, urlTemplate]) => ({
            provider,
            urlTemplate,
          })),
        );
        toast.success("Courier tracking links saved.");
      } else {
        toast.error(result.message || "Failed to save courier tracking links.");
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to save courier tracking links.",
      );
    } finally {
      setSavingTrackingTemplates(false);
    }
  };

  const isConnected = connection.isConnected;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <RefreshCw className="animate-spin text-[#96588A]" size={24} />
        <p className="text-xs text-slate-500 font-medium">
          Loading WooCommerce integration...
        </p>
      </div>
    );
  }

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

      {/* Header Card */}
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-center shadow-xs shrink-0">
            <WooCommerceLogo className="w-9 h-9" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900">
                WooCommerce Store
              </h2>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active & Syncing
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  Not Connected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Connect your WordPress WooCommerce store to sync orders,
              customers, and inventory with WhatsApp — trigger automated
              messages on every order event.
            </p>
          </div>
        </div>

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

      {/* 2-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          {isConnected ? (
            /* ────────── CONNECTED STATE ────────── */
            <>
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-white p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Your WooCommerce Store is Linked
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        REST API connected — orders and customer events flow
                        into WhatsApp automations in real time.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 p-4 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Connected Store
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-mono truncate max-w-xs">
                      {connection.storeUrl}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <a
                      href={`${connection.storeUrl}/wp-admin`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors flex-1 sm:flex-none"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#96588A]" />
                      wp-admin
                    </a>
                    <a
                      href={connection.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors flex-1 sm:flex-none"
                    >
                      <Store className="w-3.5 h-3.5 text-blue-600" />
                      View Store
                    </a>
                  </div>
                </div>

                <p className="text-xs text-slate-500 pt-1 leading-relaxed">
                  Every order creation, status change, and customer signup is
                  captured —{" "}
                  <strong>ready for WhatsApp automation flows</strong>.
                </p>
              </div>

              {/* <form
                onSubmit={handleSaveTrackingTemplates}
                className="p-5 rounded-xl border border-slate-200 bg-white space-y-4"
              >
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    Courier tracking URL templates
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    AST-provided links are used first. Add a courier URL pattern as a fallback when AST only sends the courier and tracking number. The courier name must match AST (case-insensitive); use {"{{tracking_number}}"} where the number belongs.
                  </p>
                </div>

                <div className="space-y-3">
                  {trackingUrlTemplates.map((entry, index) => (
                    <div key={index} className="grid sm:grid-cols-[1fr_2fr_auto] gap-2">
                      <input
                        type="text"
                        required
                        maxLength={80}
                        aria-label="Courier name"
                        placeholder="Courier name (e.g. Blue Dart)"
                        value={entry.provider}
                        onChange={(event) => setTrackingUrlTemplates((current) =>
                          current.map((item, itemIndex) => itemIndex === index
                            ? { ...item, provider: event.target.value }
                            : item),
                        )}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#96588A]"
                      />
                      <input
                        type="text"
                        inputMode="url"
                        required
                        aria-label="Courier tracking URL template"
                        placeholder="https://carrier.example/track?number={{tracking_number}}"
                        value={entry.urlTemplate}
                        onChange={(event) => setTrackingUrlTemplates((current) =>
                          current.map((item, itemIndex) => itemIndex === index
                            ? { ...item, urlTemplate: event.target.value }
                            : item),
                        )}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#96588A]"
                      />
                      <button
                        type="button"
                        onClick={() => setTrackingUrlTemplates((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )}
                        className="px-3 py-2 text-xs font-medium text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTrackingUrlTemplates((current) => [
                      ...current,
                      { provider: "", urlTemplate: "" },
                    ])}
                    className="px-3 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Add courier
                  </button>
                  <button
                    type="submit"
                    disabled={savingTrackingTemplates}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#96588A] rounded-lg hover:opacity-90 disabled:opacity-60"
                  >
                    {savingTrackingTemplates ? "Saving..." : "Save courier links"}
                  </button>
                </div>
              </form> */}

              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">
                      Active Automations & Sync Triggers
                    </h4>
                    <p className="text-xs text-slate-500">
                      Your WooCommerce store is automatically sending these
                      events to WhatsApp:
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                    ● Auto-Managed
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                    <p className="text-xs font-semibold text-slate-700">
                      📦 New Orders
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      order.created
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                    <p className="text-xs font-semibold text-slate-700">
                      🚚 Status Updates
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      order.updated
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                    <p className="text-xs font-semibold text-slate-700">
                      👤 New Signups
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      customer.created
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ────────── NOT CONNECTED STATE ────────── */
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/60 to-white p-6 sm:p-8 space-y-6 shadow-2xs">
                <div className="max-w-md mx-auto text-center space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto">
                    <WooCommerceLogo className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Connect Your WooCommerce Store
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Enter your store URL and approve once in WordPress.
                    No API keys to copy — takes under 30 seconds.
                  </p>
                </div>

                {/* ═══════ 1-CLICK FORM ═══════ */}
                <form
                  onSubmit={handleOneClickConnect}
                  className="space-y-4 max-w-lg mx-auto"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Store URL *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="https://your-store.com"
                      value={storeUrl}
                      onChange={(e) => setStoreUrl(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#96588A] focus:border-[#96588A]"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Your full WordPress site URL (must have SSL / HTTPS).
                    </p>
                  </div>

                  <div className="pt-1 text-center">
                    <button
                      type="submit"
                      disabled={connecting}
                      className="px-8 py-3.5 text-xs font-bold rounded-xl bg-gradient-to-r from-[#96588A] to-[#7F4A75] text-white hover:opacity-95 transition inline-flex items-center gap-2.5 shadow-md hover:shadow-lg disabled:opacity-60"
                    >
                      {connecting ? (
                        <RefreshCw
                          size={16}
                          className="animate-spin text-white"
                        />
                      ) : (
                        <ShoppingCart size={16} />
                      )}
                      <span>
                        {connecting
                          ? "Redirecting to WordPress..."
                          : "Connect with 1-Click"}
                      </span>
                    </button>
                    <p className="text-[11px] text-slate-400 mt-2">
                      You'll approve the connection on your WordPress dashboard.
                    </p>
                  </div>
                </form>

                {/* ═══════ ADVANCED / MANUAL FALLBACK ═══════ */}
                <div className="max-w-lg mx-auto pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition py-2"
                  >
                    {showAdvanced ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                    <span>
                      {showAdvanced
                        ? "Hide manual API key setup"
                        : "Or connect manually with API keys (Advanced)"}
                    </span>
                  </button>

                  {showAdvanced && (
                    <form
                      onSubmit={handleManualConnect}
                      className="mt-3 space-y-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50 animate-in fade-in duration-150"
                    >
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Generate keys at{" "}
                        <strong>
                          WooCommerce → Settings → Advanced → REST API
                        </strong>{" "}
                        with <strong>Read/Write</strong> permissions.
                      </p>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Store URL *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="https://your-store.com"
                          value={form.storeUrl}
                          onChange={(e) =>
                            setForm({ ...form, storeUrl: e.target.value })
                          }
                          className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#96588A] bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Consumer Key *
                        </label>
                        <div className="relative">
                          <input
                            type={showConsumerKey ? "text" : "password"}
                            required
                            placeholder="ck_••••••••••••••••••••••••••"
                            value={form.consumerKey}
                            onChange={(e) =>
                              setForm({ ...form, consumerKey: e.target.value })
                            }
                            className="w-full px-3 py-2.5 pr-10 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#96588A] bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConsumerKey(!showConsumerKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                          >
                            {showConsumerKey ? (
                              <EyeOff size={13} />
                            ) : (
                              <Eye size={13} />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Consumer Secret *
                        </label>
                        <div className="relative">
                          <input
                            type={showConsumerSecret ? "text" : "password"}
                            required
                            placeholder="cs_••••••••••••••••••••••••••"
                            value={form.consumerSecret}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                consumerSecret: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2.5 pr-10 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#96588A] bg-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowConsumerSecret(!showConsumerSecret)
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                          >
                            {showConsumerSecret ? (
                              <EyeOff size={13} />
                            ) : (
                              <Eye size={13} />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Webhook Secret (Optional)
                        </label>
                        <div className="relative">
                          <input
                            type={showWebhookSecret ? "text" : "password"}
                            placeholder="Optional webhook secret"
                            value={form.webhookSecret}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                webhookSecret: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2.5 pr-10 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#96588A] bg-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowWebhookSecret(!showWebhookSecret)
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                          >
                            {showWebhookSecret ? (
                              <EyeOff size={13} />
                            ) : (
                              <Eye size={13} />
                            )}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={connecting}
                        className="w-full px-4 py-2.5 text-xs font-bold rounded-xl border border-[#96588A] text-[#96588A] hover:bg-[#96588A]/5 transition disabled:opacity-60"
                      >
                        {connecting
                          ? "Connecting..."
                          : "Connect with API Keys"}
                      </button>
                    </form>
                  )}
                </div>

                {/* Benefits */}
                <div className="grid sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-left">
                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5">
                      <Zap size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Instant Orders
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      WooCommerce events trigger WhatsApp messages in real time.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0C83FD] flex items-center justify-center mb-2.5">
                      <Package size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Status Updates
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Notify customers on processing, shipped, and completed
                      orders.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2.5">
                      <ShieldCheck size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Secure 1-Click
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Official WooCommerce auth — keys never leave WordPress.
                    </p>
                  </div>
                </div>
              </div>

              {/* How it works */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4">
                  How 1-Click works
                </h4>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">
                        Enter Store URL
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Type your WordPress site address above.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">
                        Approve in WordPress
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Click Approve on the official WooCommerce screen.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">
                        Done — Auto-synced
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Keys & webhooks are set automatically. Start automating.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — same as before */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <h4 className="text-xs font-bold text-slate-800">
                  Live Order Feed
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                WooCommerce
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/80 overflow-hidden shadow-inner">
              <div className="bg-[#96588A] px-3 py-2 flex items-center gap-2">
                <ShoppingCart size={13} className="text-white" />
                <span className="text-[10px] font-bold text-white truncate">
                  Recent Orders Stream
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="px-3 py-2.5 flex items-center justify-between hover:bg-slate-50/50">
                  <div>
                    <p className="text-[10px] font-bold text-slate-800">
                      #WC-2091
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      Ananya D. • ₹1,850
                    </p>
                  </div>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    COMPLETED
                  </span>
                </div>
                <div className="px-3 py-2.5 flex items-center justify-between hover:bg-slate-50/50">
                  <div>
                    <p className="text-[10px] font-bold text-slate-800">
                      #WC-2090
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      Vikram J. • ₹649
                    </p>
                  </div>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                    PROCESSING
                  </span>
                </div>
                <div className="px-3 py-2.5 flex items-center justify-between hover:bg-slate-50/50">
                  <div>
                    <p className="text-[10px] font-bold text-slate-800">
                      #WC-2089
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      Neha R. • ₹3,299
                    </p>
                  </div>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                    ON-HOLD
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 mt-2.5 text-center leading-relaxed">
              Orders push directly to WhatsApp automation triggers.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-3.5 text-left">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Integration Highlights
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Sync Type</span>
                <span className="font-bold text-emerald-600">
                  Real-Time Webhooks
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Events Captured</span>
                <span className="font-semibold text-slate-800">
                  Orders, Customers
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">API Version</span>
                <span className="font-semibold text-slate-800">wc/v3</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Signature</span>
                <span className="font-semibold text-slate-800">
                  HMAC-SHA256
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500">Encryption</span>
                <span className="font-semibold text-slate-800">AES-256</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disconnect Modal */}
      {showDisconnectModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 relative z-10 animate-in zoom-in-95 duration-150">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <AlertTriangle size={20} />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Disconnect WooCommerce?
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Disconnecting will stop all order and customer syncing.
                  WhatsApp automations tied to WooCommerce events will pause.
                  You can reconnect anytime.
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
                  {disconnecting && (
                    <RefreshCw size={13} className="animate-spin" />
                  )}
                  <span>
                    {disconnecting ? "Disconnecting..." : "Yes, Disconnect"}
                  </span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}