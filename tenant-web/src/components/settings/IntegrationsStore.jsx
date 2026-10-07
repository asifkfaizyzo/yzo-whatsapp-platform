// src/components/settings/IntegrationsStore.jsx
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, RefreshCw } from "lucide-react";

import PaymentGatewaySettings from "./PaymentGatewaySettings";
import GoogleSheetsSettings from "./GoogleSheetsSettings";
import ZohoSettings from "./ZohoSettings";
import ShopifySettings from "./ShopifySettings";
import WooCommerceSettings from "./WooCommerceSettings";

import RazorpayLogo from "./RazorpayLogo";
import GoogleSheetsLogo from "./GoogleSheetsLogo";
import ZohoLogo from "./ZohoLogo";
import ShopifyLogo from "./ShopifyLogo";
import WooCommerceLogo from "./WooCommerceLogo";

import { getPaymentGatewayConfig } from "../../services/tenant.service";
import { getGoogleSheetsStatus } from "../../services/googleSheets.service";
import { getZohoStatus } from "../../services/zoho.service";
import { shopifyService } from "../../services/shopify.service";
import { woocommerceService } from "../../services/woocommerce.service";

export default function IntegrationsStore() {
  const [searchParams, setSearchParams] = useSearchParams();

  // App routing state supporting: "razorpay" | "google-sheets" | "zoho" | "shopify" | "woocommerce" | null
  const [selectedApp, setSelectedApp] = useState(() => {
    const app = searchParams.get("app");
    const connected = searchParams.get("connected");
    if (app === "google-sheets") return "google-sheets";
    if (app === "zoho") return "zoho";
    if (app === "shopify") return "shopify";
    if (app === "woocommerce") return "woocommerce";
    if (app === "razorpay" || connected === "true") return "razorpay";
    return null;
  });

  const [isRazorpayConnected, setIsRazorpayConnected] = useState(false);
  const [isSheetsConnected, setIsSheetsConnected] = useState(false);
  const [isZohoConnected, setIsZohoConnected] = useState(false);
  const [isShopifyConnected, setIsShopifyConnected] = useState(false);
  const [isWooCommerceConnected, setIsWooCommerceConnected] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Check connection statuses of all integrated systems
  const checkStatus = async () => {
    try {
      const [rzpRes, sheetsRes, zohoRes, shopifyRes, wooRes] = await Promise.allSettled([
        getPaymentGatewayConfig(),
        getGoogleSheetsStatus(),
        getZohoStatus(),
        shopifyService.getStatus(),
        woocommerceService.getStatus(),
      ]);

      if (rzpRes.status === "fulfilled" && rzpRes.value?.success && rzpRes.value?.data) {
        const data = rzpRes.value.data;
        const isConnected =
          data.razorpayAuthType === "OAUTH"
            ? Boolean(data.razorpayAccountId)
            : Boolean(data.razorpayKeyId);
        setIsRazorpayConnected(isConnected);
      }

      if (sheetsRes.status === "fulfilled" && sheetsRes.value?.success && sheetsRes.value?.data) {
        setIsSheetsConnected(
          Boolean(sheetsRes.value.data.isConnected || sheetsRes.value.data.status === "active")
        );
      }

      if (zohoRes.status === "fulfilled" && zohoRes.value?.success && zohoRes.value?.data) {
        setIsZohoConnected(Boolean(zohoRes.value.data.connected));
      }

      if (shopifyRes.status === "fulfilled" && shopifyRes.value?.data) {
        setIsShopifyConnected(Boolean(shopifyRes.value.data.connected));
      }

      if (wooRes.status === "fulfilled" && wooRes.value?.data) {
        setIsWooCommerceConnected(Boolean(wooRes.value.data.connected));
      }
    } catch (err) {
      console.warn("Failed to check integration statuses:", err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [selectedApp]);

  // Sync state on URL updates
  useEffect(() => {
    const app = searchParams.get("app");
    const connected = searchParams.get("connected");
    if (app === "google-sheets") {
      setSelectedApp("google-sheets");
    } else if (app === "zoho") {
      setSelectedApp("zoho");
    } else if (app === "shopify") {
      setSelectedApp("shopify");
    } else if (app === "woocommerce") {
      setSelectedApp("woocommerce");
    } else if (app === "razorpay" || connected === "true") {
      setSelectedApp("razorpay");
    }
  }, [searchParams]);

  const handleBackToStore = () => {
    setSelectedApp(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("app");
    newParams.delete("connected");
    newParams.delete("sheet");
    newParams.delete("error");
    setSearchParams(newParams, { replace: true });
    checkStatus();
  };

  const handleOpenApp = (appId) => {
    setSelectedApp(appId);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("app", appId);
    setSearchParams(newParams, { replace: true });
  };

  // Full-page subview routing
  if (selectedApp === "razorpay") {
    return <PaymentGatewaySettings onBack={handleBackToStore} />;
  }

  if (selectedApp === "google-sheets") {
    return <GoogleSheetsSettings onBack={handleBackToStore} />;
  }

  if (selectedApp === "zoho") {
    return <ZohoSettings onBack={handleBackToStore} />;
  }

  if (selectedApp === "shopify") {
    return <ShopifySettings onBack={handleBackToStore} />;
  }

  if (selectedApp === "woocommerce") {
    return <WooCommerceSettings onBack={handleBackToStore} />;
  }

  if (loadingStatus) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3">
        <RefreshCw className="animate-spin text-blue-600" size={24} />
        <p className="text-xs text-slate-500 font-medium">Loading integration store...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-150">
      {/* Integrations Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Razorpay Card */}
        <div
          onClick={() => handleOpenApp("razorpay")}
          className="group relative rounded-2xl border border-slate-200/90 bg-white p-6 hover:border-[#0C83FD]/80 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[240px]"
        >
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200">
                <RazorpayLogo className="w-10 h-10" />
              </div>

              {isRazorpayConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#0C83FD] border border-blue-100">
                  Ready to Connect
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0C83FD] transition flex items-center gap-1.5">
              <span>Razorpay Payments</span>
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Accept UPI, credit/debit cards, and net banking directly in WhatsApp chat with zero platform fees.
            </p>

            <div className="flex flex-wrap gap-1.5 mt-3.5">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                UPI & Cards
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                0% Platform Fee
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                Auto-Confirm
              </span>
            </div>
          </div>

          <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-[#0C83FD] transition">
            <span>{isRazorpayConnected ? "Manage Settings" : "Connect Gateway"}</span>
            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Google Sheets Card */}
        <div
          onClick={() => handleOpenApp("google-sheets")}
          className="group relative rounded-2xl border border-slate-200/90 bg-white p-6 hover:border-[#0F9D58]/80 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[240px]"
        >
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200">
                <GoogleSheetsLogo className="w-10 h-10" />
              </div>

              {isSheetsConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-[#0F9D58] border border-emerald-100">
                  Ready to Connect
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0F9D58] transition flex items-center gap-1.5">
              <span>Google Sheets</span>
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Auto-export confirmed leads, orders, and payment statuses to a live Google spreadsheet in real time.
            </p>

            <div className="flex flex-wrap gap-1.5 mt-3.5">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                Real-Time Sync
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                Custom Columns
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                CSV / Excel Export
              </span>
            </div>
          </div>

          <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-[#0F9D58] transition">
            <span>{isSheetsConnected ? "Manage Settings" : "Connect Sheets"}</span>
            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Zoho CRM Card */}
        <div
          onClick={() => handleOpenApp("zoho")}
          className="group relative rounded-2xl border border-slate-200/90 bg-white p-6 hover:border-[#009A44]/80 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[240px]"
        >
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200">
                <ZohoLogo className="w-10 h-10" />
              </div>

              {isZohoConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-50 text-[#009A44] border border-slate-100">
                  Ready to Connect
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900 group-hover:text-[#009A44] transition flex items-center gap-1.5">
              <span>Zoho CRM</span>
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Synchronize WhatsApp contacts dynamically into Zoho CRM Contact modules with automated background processing.
            </p>

            <div className="flex flex-wrap gap-1.5 mt-3.5">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                Contact Sync
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                Background Queues
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                Multi-DC Support
              </span>
            </div>
          </div>

          <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-[#009A44] transition">
            <span>{isZohoConnected ? "Manage Settings" : "Connect Zoho CRM"}</span>
            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Shopify Card */}
        <div
          onClick={() => handleOpenApp("shopify")}
          className="group relative rounded-2xl border border-slate-200/90 bg-white p-6 hover:border-[#5E8E3E]/80 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[240px]"
        >
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200">
                <ShopifyLogo className="w-10 h-10" />
              </div>

              {isShopifyConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-[#5E8E3E] border border-green-100">
                  Ready to Connect
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900 group-hover:text-[#5E8E3E] transition flex items-center gap-1.5">
              <span>Shopify Store</span>
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Connect your Shopify store to receive order webhooks, sync products, and trigger instant WhatsApp notifications.
            </p>

            <div className="flex flex-wrap gap-1.5 mt-3.5">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                Order Webhooks
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                Real-Time Sync
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                Admin API
              </span>
            </div>
          </div>

          <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-[#5E8E3E] transition">
            <span>{isShopifyConnected ? "Manage Settings" : "Connect Shopify"}</span>
            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* WooCommerce Card */}
        <div
          onClick={() => handleOpenApp("woocommerce")}
          className="group relative rounded-2xl border border-slate-200/90 bg-white p-6 hover:border-[#7F54B3]/80 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[240px]"
        >
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200">
                <WooCommerceLogo className="w-10 h-10" />
              </div>

              {isWooCommerceConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-[#7F54B3] border border-purple-100">
                  Ready to Connect
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900 group-hover:text-[#7F54B3] transition flex items-center gap-1.5">
              <span>WooCommerce Store</span>
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Connect your WordPress WooCommerce store via REST API keys for real-time WhatsApp order alerts.
            </p>

            <div className="flex flex-wrap gap-1.5 mt-3.5">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                REST API
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                Order Webhooks
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                WordPress Sync
              </span>
            </div>
          </div>

          <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-[#7F54B3] transition">
            <span>{isWooCommerceConnected ? "Manage Settings" : "Connect WooCommerce"}</span>
            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

      </div>
    </div>
  );
}