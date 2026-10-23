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
  Bell,
  Phone,
  Clock,
  Copy,
} from "lucide-react";
import WooCommerceLogo from "./WooCommerceLogo";
import { useToast } from "../../context/ToastContext";
import {
  getWooCommerceStatus,
  connectWooCommerce,
  disconnectWooCommerce,
  getWooCommerceOAuthUrl,
  saveWooCommerceTrackingUrlTemplates,
  updateWooCommerceAlertSettings,
  getWooCommerceCartRecoveryWebhookConfig,
  updateWooCommerceCartRecoverySettings,
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
  const [savingCartRecovery, setSavingCartRecovery] = useState(false);
  const [loadingCartWebhookConfig, setLoadingCartWebhookConfig] = useState(false);
  const [showCartWebhookSecret, setShowCartWebhookSecret] = useState(false);
  const [cartWebhookConfig, setCartWebhookConfig] = useState(null);

    const [connection, setConnection] = useState({
    isConnected: false,
    storeUrl: null,
    connectedAt: null,
    connectedBy: null,
    status: null,
  });
  const [trackingUrlTemplates, setTrackingUrlTemplates] = useState([]);
  const [cartRecoveryForm, setCartRecoveryForm] = useState({
    cartRecoveryEnabled: true,
    cartReminder1Enabled: true,
    cartReminder24Enabled: true,
    cartReminder48Enabled: true,
    cartReminder1Text: "",
    cartReminder24Text: "",
    cartReminder48Text: "",
    cartDiscountCode: "",
    cartDiscountLabel: "",
    cartIncludeImage: true,
  });

  // Alert Settings state
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [alertForm, setAlertForm] = useState({
    alertPhone: "",
    newOrderAlert: true,
    lowStockAlert: false,
    lowStockThreshold: 5,
    dailySummaryAlert: false,
    dailySummaryHour: 20,
  });

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
          res.data.isConnected || ["active", "connected"].includes(String(res.data.status || "").toLowerCase());
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
        setAlertForm({
          alertPhone: res.data.alertPhone || "",
          newOrderAlert: res.data.newOrderAlert ?? true,
          lowStockAlert: res.data.lowStockAlert ?? false,
          lowStockThreshold: res.data.lowStockThreshold ?? 5,
          dailySummaryAlert: res.data.dailySummaryAlert ?? false,
          dailySummaryHour: res.data.dailySummaryHour ?? 20,
        });
        setCartRecoveryForm({
          cartRecoveryEnabled: res.data.cartRecoveryEnabled ?? true,
          cartReminder1Enabled: res.data.cartReminder1Enabled ?? true,
          cartReminder24Enabled: res.data.cartReminder24Enabled ?? true,
          cartReminder48Enabled: res.data.cartReminder48Enabled ?? true,
          cartReminder1Text: res.data.cartReminder1Text || "",
          cartReminder24Text: res.data.cartReminder24Text || "",
          cartReminder48Text: res.data.cartReminder48Text || "",
          cartDiscountCode: res.data.cartDiscountCode || "",
          cartDiscountLabel: res.data.cartDiscountLabel || "",
          cartIncludeImage: res.data.cartIncludeImage ?? true,
        });
      } else {
        setConnection({
          isConnected: false,
          storeUrl: null,
          connectedAt: null,
          connectedBy: null,
          status: null,
        });
        setTrackingUrlTemplates([]);
        setCartWebhookConfig(null);
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

    const handleSaveAlertSettings = async (e) => {
    e.preventDefault();
    setSavingAlerts(true);
    try {
      const res = await updateWooCommerceAlertSettings(alertForm);
      if (res.success) {
        toast.success("🔔 Admin alert settings saved successfully!");
      } else {
        toast.error(res.error || "Failed to save alert settings.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to save alert settings.");
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleSaveCartRecovery = async (event) => {
    event.preventDefault();
    setSavingCartRecovery(true);
    try {
      const result = await updateWooCommerceCartRecoverySettings(cartRecoveryForm);
      if (!result.success) {
        throw new Error(result.message || "Failed to save cart recovery settings.");
      }
      setCartRecoveryForm((current) => ({ ...current, ...result.data }));
      toast.success("Cart recovery settings saved.");
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || "Failed to save cart recovery settings.");
    } finally {
      setSavingCartRecovery(false);
    }
  };

  const handleLoadCartWebhookConfig = async () => {
    setLoadingCartWebhookConfig(true);
    try {
      const result = await getWooCommerceCartRecoveryWebhookConfig();
      if (!result.success || !result.data) {
        throw new Error(result.message || "Unable to load cart recovery plugin configuration.");
      }
      setCartWebhookConfig(result.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || "Unable to load cart recovery plugin configuration.");
    } finally {
      setLoadingCartWebhookConfig(false);
    }
  };

  const copyCartWebhookValue = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied to clipboard.");
    } catch (error) {
      console.error("Copy WooCommerce cart recovery configuration error:", error);
      toast.error("Could not copy this value.");
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
              Connect WooCommerce to sync orders and customers with WhatsApp.
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
        <div className="lg:col-span-12 space-y-6">
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
                        Connected to {connection.storeUrl}.
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

              </div>

              <form
                onSubmit={handleSaveCartRecovery}
                className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Abandoned cart recovery</h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Send WhatsApp reminders at selected times. Live sending requires approved cart-reminder templates.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2.5 cursor-pointer shrink-0">
                    <span className="text-xs font-semibold text-slate-600">
                      {cartRecoveryForm.cartRecoveryEnabled ? "ON" : "OFF"}
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      aria-label="Enable WooCommerce abandoned cart recovery"
                      checked={cartRecoveryForm.cartRecoveryEnabled}
                      onChange={(event) => setCartRecoveryForm((current) => ({
                        ...current,
                        cartRecoveryEnabled: event.target.checked,
                      }))}
                      className="sr-only peer"
                    />
                    <span className="relative h-5 w-9 rounded-full bg-slate-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-[#96588A] peer-checked:after:translate-x-4 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#96588A]" />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    ["1 hour", "cartReminder1Enabled"],
                    ["24 hours", "cartReminder24Enabled"],
                    ["48 hours", "cartReminder48Enabled"],
                  ].map(([label, field]) => (
                    <label key={field} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={cartRecoveryForm[field]}
                        disabled={!cartRecoveryForm.cartRecoveryEnabled}
                        onChange={(event) => setCartRecoveryForm((current) => ({
                          ...current,
                          [field]: event.target.checked,
                        }))}
                        className="h-4 w-4 rounded border-slate-300 accent-[#96588A]"
                      />
                      {label} reminder
                    </label>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={cartRecoveryForm.cartIncludeImage}
                    onChange={(event) => setCartRecoveryForm((current) => ({
                      ...current,
                      cartIncludeImage: event.target.checked,
                    }))}
                    className="h-4 w-4 rounded border-slate-300 accent-[#96588A]"
                  />
                  Include the first product image when an approved image-header template is available
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="48-hour discount code (optional)"
                    value={cartRecoveryForm.cartDiscountCode}
                    onChange={(event) => setCartRecoveryForm((current) => ({ ...current, cartDiscountCode: event.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#96588A]"
                  />
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Discount label (e.g. 10%)"
                    value={cartRecoveryForm.cartDiscountLabel}
                    onChange={(event) => setCartRecoveryForm((current) => ({ ...current, cartDiscountLabel: event.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#96588A]"
                  />
                </div>

                {[
                  ["1-hour message", "cartReminder1Text"],
                  ["24-hour message", "cartReminder24Text"],
                  ["48-hour message", "cartReminder48Text"],
                ].map(([label, field]) => (
                  <label key={field} className="block space-y-1.5">
                    <span className="text-xs font-semibold text-slate-700">{label} (optional)</span>
                    <textarea
                      rows={3}
                      maxLength={4000}
                      placeholder="Leave blank to use the default recovery message. Available: {{customer_name}}, {{store_name}}, {{product_summary}}, {{currency}}, {{total_amount}}, {{checkout_url}}, {{discount_code}}, {{discount_label}}"
                      value={cartRecoveryForm[field]}
                      onChange={(event) => setCartRecoveryForm((current) => ({ ...current, [field]: event.target.value }))}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#96588A]"
                    />
                  </label>
                ))}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingCartRecovery}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#96588A] rounded-lg hover:opacity-90 disabled:opacity-60"
                  >
                    {savingCartRecovery ? "Saving..." : "Save cart recovery"}
                  </button>
                </div>
              </form>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Connect the WooCommerce recovery plugin</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Install the plugin, then add these values in WordPress → Settings → SudoReply Auth Events.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadCartWebhookConfig}
                  disabled={loadingCartWebhookConfig}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-60"
                >
                  {loadingCartWebhookConfig ? "Loading setup values..." : "Show plugin setup values"}
                </button>
                {cartWebhookConfig && (
                  <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                    {[
                      ["Cart recovery endpoint", cartWebhookConfig.endpoint],
                      ["Tenant ID", cartWebhookConfig.tenantId],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                        <div className="mt-1 flex gap-2">
                          <input readOnly value={value} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-mono text-slate-700" />
                          <button type="button" onClick={() => copyCartWebhookValue(value)} aria-label={`Copy ${label}`} className="rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 hover:bg-slate-100">
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Signing secret</span>
                      <div className="mt-1 flex gap-2">
                        <input
                          readOnly
                          type={showCartWebhookSecret ? "text" : "password"}
                          value={cartWebhookConfig.signingSecret}
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-mono text-slate-700"
                        />
                        <button type="button" onClick={() => setShowCartWebhookSecret((current) => !current)} aria-label={showCartWebhookSecret ? "Hide signing secret" : "Show signing secret"} className="rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 hover:bg-slate-100">
                          {showCartWebhookSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button type="button" onClick={() => copyCartWebhookValue(cartWebhookConfig.signingSecret)} aria-label="Copy signing secret" className="rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 hover:bg-slate-100">
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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


                            {/* ── ADMIN & OPERATIONAL ALERTS CARD ── */}
              <form
                onSubmit={handleSaveAlertSettings}
                className="p-5 rounded-2xl border border-slate-200 bg-white space-y-5 shadow-2xs"
              >
                <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 text-[#96588A] flex items-center justify-center shrink-0 border border-purple-100">
                      <Bell size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Admin & Operational Alerts (WhatsApp)
                      </h4>
                      <p className="text-xs text-slate-500">Choose which alerts to receive.</p>
                    </div>
                  </div>
                </div>

                {/* Alert Recipient Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    WhatsApp Alert Number
                  </label>
                  <div className="relative max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone size={14} />
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. 919876543210 (leave empty for account phone)"
                      value={alertForm.alertPhone}
                      onChange={(e) => setAlertForm({ ...alertForm, alertPhone: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#96588A]"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Include country code without + or spaces. Defaults to tenant account phone if empty.
                  </p>
                </div>

                <div className="space-y-4 pt-1">
                  {/* 1. Instant New Order Alert */}
                  <div className="flex items-start justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
                    <div className="space-y-0.5 pr-4">
                      <p className="text-xs font-bold text-slate-800">Instant New Order Alert</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={alertForm.newOrderAlert}
                        onChange={(e) => setAlertForm({ ...alertForm, newOrderAlert: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#96588A]"></div>
                    </label>
                  </div>

                  {/* 2. Low Inventory Warning */}
                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5 pr-4">
                        <p className="text-xs font-bold text-slate-800">Low Inventory Warning</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                        <input
                          type="checkbox"
                          checked={alertForm.lowStockAlert}
                          onChange={(e) => setAlertForm({ ...alertForm, lowStockAlert: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#96588A]"></div>
                      </label>
                    </div>

                    {alertForm.lowStockAlert && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 animate-in fade-in duration-150">
                        <span className="text-xs text-slate-600 font-medium">Alert when product stock is &le;</span>
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={alertForm.lowStockThreshold}
                          onChange={(e) => setAlertForm({ ...alertForm, lowStockThreshold: parseInt(e.target.value, 10) || 5 })}
                          className="w-20 px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#96588A] bg-white text-center font-bold"
                        />
                        <span className="text-xs text-slate-600 font-medium">items</span>
                      </div>
                    )}
                  </div>

                  {/* 3. Daily Business Summary */}
                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5 pr-4">
                        <p className="text-xs font-bold text-slate-800">Daily Business Summary</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                        <input
                          type="checkbox"
                          checked={alertForm.dailySummaryAlert}
                          onChange={(e) => setAlertForm({ ...alertForm, dailySummaryAlert: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#96588A]"></div>
                      </label>
                    </div>

                    {alertForm.dailySummaryAlert && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 animate-in fade-in duration-150">
                        <Clock size={14} className="text-slate-500" />
                        <span className="text-xs text-slate-600 font-medium">Send summary daily at</span>
                        <select
                          value={alertForm.dailySummaryHour}
                          onChange={(e) => setAlertForm({ ...alertForm, dailySummaryHour: parseInt(e.target.value, 10) })}
                          className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#96588A] bg-white font-medium"
                        >
                          {Array.from({ length: 24 }).map((_, h) => (
                            <option key={h} value={h}>
                              {h === 0 ? '12:00 AM Midnight' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM Noon' : `${h - 12}:00 PM`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingAlerts}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#96588A] rounded-xl hover:opacity-90 transition disabled:opacity-60 flex items-center gap-1.5 shadow-xs"
                  >
                    {savingAlerts && <RefreshCw size={13} className="animate-spin" />}
                    <span>{savingAlerts ? "Saving Settings..." : "Save Alert Settings"}</span>
                  </button>
                </div>
              </form>
              

              <div className="hidden p-4 rounded-xl border border-slate-200 bg-white space-y-3">
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
                    Enter your store URL, then approve the connection in WordPress.
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
                <div className="hidden pt-4 border-t border-slate-100 text-left">
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
              <div className="hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
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
        <div className="hidden lg:col-span-4 space-y-5">
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