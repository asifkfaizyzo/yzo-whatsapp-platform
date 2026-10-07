// src/components/settings/ShopifySettings.jsx
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Unlink,
  ShieldCheck,
  Zap,
  ExternalLink,
  ShoppingBag,
  Package,
  Store,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import ShopifyLogo from "./ShopifyLogo";
import { useToast } from "../../context/ToastContext";
import {
  getShopifyStatus,
  connectShopify,
  disconnectShopify,
} from "../../services/shopify.service";


export default function ShopifySettings({ onBack } = {}) {
  const toast = useToast();

  // ── Connection State ──
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  const [connection, setConnection] = useState({
    isConnected: false,
    shopName: null,
    connectedAt: null,
    connectedBy: null,
    status: null,
  });

  // ── Form State ──
  const [form, setForm] = useState({
    shopName: "",
    accessToken: "",
    webhookSecret: "",
  });

  // ── Fetch Connection Status ──
  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await getShopifyStatus();
      if (res.success && res.data) {
        const isConnected =
          res.data.isConnected || res.data.status === "active";
        setConnection({
          isConnected,
          shopName: res.data.shopName || null,
          connectedAt: res.data.connectedAt || null,
          connectedBy: res.data.connectedBy || null,
          status: res.data.status || null,
        });
      } else {
        setConnection({
          isConnected: false,
          shopName: null,
          connectedAt: null,
          connectedBy: null,
          status: null,
        });
      }
    } catch (err) {
      console.error("Fetch Shopify status error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // ── Connect / Disconnect ──
  const handleConnect = async (e) => {
    e.preventDefault();
    if (!form.shopName.trim() || !form.accessToken.trim()) {
      toast.error("Shop name and Admin API access token are required");
      return;
    }

    setConnecting(true);
    try {
      const payload = {
        shopName: form.shopName.trim().replace(/\.myshopify\.com$/i, ""),
        accessToken: form.accessToken.trim(),
        webhookSecret: form.webhookSecret.trim() || null,
      };
      const res = await connectShopify(payload);
      if (res.success) {
        toast.success("🎉 Shopify store connected successfully!");
        setForm({ shopName: "", accessToken: "", webhookSecret: "" });
        fetchStatus();
      } else {
        toast.error(res.message || "Failed to connect Shopify store");
      }
    } catch (err) {
      console.error("Shopify connect error:", err);
      toast.error(
        err?.response?.data?.message || "Failed to connect Shopify store"
      );
    }
    setConnecting(false);
  };

  const handleDisconnectConfirm = async () => {
    setDisconnecting(true);
    try {
      const res = await disconnectShopify();
      if (res.success) {
        toast.success("Shopify store disconnected successfully.");
        setShowDisconnectModal(false);
        fetchStatus();
      } else {
        toast.error(res.message || "Failed to disconnect Shopify");
      }
    } catch (err) {
      toast.error("Failed to disconnect Shopify");
    }
    setDisconnecting(false);
  };

  const copyWebhookUrl = () => {
    const url = `${"http://localhost:5000"}/api2/webhook/shopify`;
    navigator.clipboard.writeText(url);
    toast.success("Webhook URL copied!");
  };

  const isConnected = connection.isConnected;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <RefreshCw className="animate-spin text-[#95BF47]" size={24} />
        <p className="text-xs text-slate-500 font-medium">
          Loading Shopify integration...
        </p>
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
            <ShopifyLogo className="w-9 h-9" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-900">
                Shopify Store
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
              Sync your Shopify orders, customers, and products with WhatsApp
              conversations — automate order confirmations, tracking updates,
              and abandoned cart recovery.
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
        {/* LEFT COLUMN (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          {isConnected ? (
            /* STATE 1: CONNECTED */
            <>
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-white to-white p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Your Shopify Store is Linked
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Order events, customer updates, and product syncs are
                        streaming in real time.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Store Quick Actions */}
                <div className="pt-2 p-4 rounded-xl bg-slate-50/70 border border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Connected Store
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                      {connection.shopName}.myshopify.com
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <a
                      href={`https://admin.shopify.com/store/${connection.shopName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors flex-1 sm:flex-none"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#95BF47]" />
                      Open Admin
                    </a>
                    <a
                      href={`https://${connection.shopName}.myshopify.com`}
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
                  Every new order, fulfilment update, and customer creation
                  event is instantly delivered to Sudoreply —{" "}
                  <strong>ready to trigger WhatsApp automations</strong>.
                </p>
              </div>

              {/* Webhook Configuration Card */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Zap size={15} className="text-[#95BF47]" />
                      <span>Webhook Endpoint</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Register this endpoint in Shopify Admin → Settings →
                      Notifications to receive events.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">
                    Your Webhook URL
                  </label>
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50">
                    <code className="flex-1 text-xs font-mono text-slate-700 truncate">
                      {`${window.location.origin.replace("5173", "3000")}/api2/webhook/shopify`}
                    </code>
                    <button
                      type="button"
                      onClick={copyWebhookUrl}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition"
                      title="Copy webhook URL"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      Event
                    </p>
                    <p className="text-xs font-semibold text-slate-800 mt-1">
                      orders/create
                    </p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      Event
                    </p>
                    <p className="text-xs font-semibold text-slate-800 mt-1">
                      orders/fulfilled
                    </p>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      Event
                    </p>
                    <p className="text-xs font-semibold text-slate-800 mt-1">
                      customers/create
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                  <AlertCircle
                    size={14}
                    className="text-blue-600 shrink-0 mt-0.5"
                  />
                  <p className="leading-relaxed">
                    Webhook signatures are verified using HMAC-SHA256. Ensure
                    your API Secret Key matches the value set in your Shopify
                    Admin Custom App.
                  </p>
                </div>
              </div>
            </>
          ) : (
            /* STATE 2: NOT CONNECTED */
            <div className="space-y-6">
              {/* Hero Action Card with Form */}
              <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/60 to-white p-6 sm:p-8 space-y-6 shadow-2xs">
                <div className="max-w-md mx-auto text-center space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto">
                    <ShopifyLogo className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Connect Your Shopify Store
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Enter your Shopify Admin API credentials to enable
                    real-time order syncing, customer tracking, and WhatsApp
                    automation.
                  </p>
                </div>

                <form onSubmit={handleConnect} className="space-y-4 max-w-lg mx-auto">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Shop Name *
                    </label>
                    <div className="flex items-center border border-slate-200 rounded-xl bg-white focus-within:ring-1 focus-within:ring-[#95BF47] focus-within:border-[#95BF47] transition">
                      <input
                        type="text"
                        required
                        placeholder="your-store-name"
                        value={form.shopName}
                        onChange={(e) =>
                          setForm({ ...form, shopName: e.target.value })
                        }
                        className="flex-1 px-3 py-2.5 text-xs bg-transparent focus:outline-none rounded-l-xl"
                      />
                      <span className="px-3 py-2.5 text-xs text-slate-400 font-mono border-l border-slate-200">
                        .myshopify.com
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Admin API Access Token *
                    </label>
                    <div className="relative">
                      <input
                        type={showAccessToken ? "text" : "password"}
                        required
                        placeholder="shpat_••••••••••••••••••••••••••"
                        value={form.accessToken}
                        onChange={(e) =>
                          setForm({ ...form, accessToken: e.target.value })
                        }
                        className="w-full px-3 py-2.5 pr-10 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#95BF47] focus:border-[#95BF47]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAccessToken(!showAccessToken)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                      >
                        {showAccessToken ? (
                          <EyeOff size={13} />
                        ) : (
                          <Eye size={13} />
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Generate from Shopify Admin → Apps → Develop apps →
                      Configure Admin API scopes.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      API Secret Key (Webhook Verification)
                    </label>
                    <div className="relative">
                      <input
                        type={showWebhookSecret ? "text" : "password"}
                        placeholder="shpss_••••••••••••••••••••••••••"
                        value={form.webhookSecret}
                        onChange={(e) =>
                          setForm({ ...form, webhookSecret: e.target.value })
                        }
                        className="w-full px-3 py-2.5 pr-10 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#95BF47] focus:border-[#95BF47]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                      >
                        {showWebhookSecret ? (
                          <EyeOff size={13} />
                        ) : (
                          <Eye size={13} />
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Used to verify webhook payload signatures via HMAC-SHA256.
                    </p>
                  </div>

                  <div className="pt-2 text-center">
                    <button
                      type="submit"
                      disabled={connecting}
                      className="px-8 py-3.5 text-xs font-bold rounded-xl bg-gradient-to-r from-[#95BF47] to-[#7AB55C] text-white hover:opacity-95 transition inline-flex items-center gap-2.5 shadow-md hover:shadow-lg disabled:opacity-60"
                    >
                      {connecting ? (
                        <RefreshCw
                          size={16}
                          className="animate-spin text-white"
                        />
                      ) : (
                        <ShoppingBag size={16} />
                      )}
                      <span>
                        {connecting ? "Connecting..." : "Connect Shopify Store"}
                      </span>
                    </button>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Your credentials are encrypted at rest using AES-256.
                    </p>
                  </div>
                </form>

                {/* 3 Key Benefits */}
                <div className="grid sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-left">
                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5">
                      <Zap size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Real-Time Orders
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Get order events streamed to WhatsApp automations instantly.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0C83FD] flex items-center justify-center mb-2.5">
                      <Package size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">
                      Auto Tracking
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Send fulfilment and shipping updates via WhatsApp
                      automatically.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-2xs">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2.5">
                      <ShieldCheck size={18} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-800">
                      HMAC Verified
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Every webhook is cryptographically verified for security.
                    </p>
                  </div>
                </div>
              </div>

              {/* How It Works */}
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
                      <h5 className="text-xs font-bold text-slate-800">
                        Create Custom App
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        In Shopify Admin → Apps → Develop apps → Create app.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">
                        Grant API Scopes
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Enable read_orders, read_products, read_customers.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">
                        Paste Credentials
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Copy Admin API token and paste in the form above.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (4 Cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Live Order Preview */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <h4 className="text-xs font-bold text-slate-800">
                  Live Order Feed
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Shopify
              </span>
            </div>

            <div className="rounded-xl border border-slate-200/80 overflow-hidden shadow-inner">
              <div className="bg-[#95BF47] px-3 py-2 flex items-center gap-2">
                <ShoppingBag size={13} className="text-white" />
                <span className="text-[10px] font-bold text-white truncate">
                  Recent Orders Stream
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="px-3 py-2.5 flex items-center justify-between hover:bg-slate-50/50">
                  <div>
                    <p className="text-[10px] font-bold text-slate-800">
                      #1042
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      Rahul S. • ₹1,299
                    </p>
                  </div>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    PAID
                  </span>
                </div>
                <div className="px-3 py-2.5 flex items-center justify-between hover:bg-slate-50/50">
                  <div>
                    <p className="text-[10px] font-bold text-slate-800">
                      #1041
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      Priya M. • ₹849
                    </p>
                  </div>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                    FULFILLED
                  </span>
                </div>
                <div className="px-3 py-2.5 flex items-center justify-between hover:bg-slate-50/50">
                  <div>
                    <p className="text-[10px] font-bold text-slate-800">
                      #1040
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      Arjun K. • ₹2,199
                    </p>
                  </div>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                    PENDING
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 mt-2.5 text-center leading-relaxed">
              Orders trigger WhatsApp automations the moment they're placed.
            </p>
          </div>

          {/* Integration Highlights */}
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
                  Orders, Fulfilments
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">API Version</span>
                <span className="font-semibold text-slate-800">2024-10</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Signature</span>
                <span className="font-semibold text-slate-800">HMAC-SHA256</span>
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
                  Disconnect Shopify?
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Disconnecting will stop all order and customer syncing.
                  WhatsApp automations tied to Shopify events will pause. You
                  can reconnect anytime with your Admin API credentials.
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