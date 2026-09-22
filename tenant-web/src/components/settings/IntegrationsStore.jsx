// src/components/settings/IntegrationsStore.jsx
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import PaymentGatewaySettings from "./PaymentGatewaySettings";
import GoogleSheetsSettings from "./GoogleSheetsSettings";
import RazorpayLogo from "./RazorpayLogo";
import GoogleSheetsLogo from "./GoogleSheetsLogo";
import { getPaymentGatewayConfig } from "../../services/tenant.service";
import { getGoogleSheetsStatus } from "../../services/googleSheets.service";

export default function IntegrationsStore() {
  const [searchParams, setSearchParams] = useSearchParams();

   // "razorpay" | "google-sheets" | null
  const [selectedApp, setSelectedApp] = useState(() => {
    const app = searchParams.get("app");
    const connected = searchParams.get("connected");
    if (app === "google-sheets") return "google-sheets";
    if (app === "razorpay" || connected === "true") return "razorpay";
    return null;
  });

  const [isRazorpayConnected, setIsRazorpayConnected] = useState(false);
  const [isSheetsConnected, setIsSheetsConnected] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

    // Check connection statuses on mount and when returning from detail view
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [rzpRes, sheetsRes] = await Promise.allSettled([
          getPaymentGatewayConfig(),
          getGoogleSheetsStatus(),
        ]);

        if (rzpRes.status === "fulfilled" && rzpRes.value.success && rzpRes.value.data) {
          const data = rzpRes.value.data;
          const isConnected =
            data.razorpayAuthType === "OAUTH"
              ? Boolean(data.razorpayAccountId)
              : Boolean(data.razorpayKeyId);
          setIsRazorpayConnected(isConnected);
        }

        if (sheetsRes.status === "fulfilled" && sheetsRes.value.success && sheetsRes.value.data) {
          setIsSheetsConnected(
            Boolean(sheetsRes.value.data.isConnected || sheetsRes.value.data.status === "active")
          );
        }
      } catch (err) {
        console.warn("Failed to check integration statuses:", err);
      } finally {
        setLoadingStatus(false);
      }
    };
    checkStatus();
  }, [selectedApp]);

   // Sync with URL params
  useEffect(() => {
    const app = searchParams.get("app");
    const connected = searchParams.get("connected");
    if (app === "google-sheets") {
      setSelectedApp("google-sheets");
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
    setSearchParams(newParams, { replace: true });
  };

  const handleOpenApp = (appId) => {
    setSelectedApp(appId);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("app", appId);
    setSearchParams(newParams, { replace: true });
  };

  // If Razorpay is selected, show the full gateway connecting/management screen
  if (selectedApp === "razorpay") {
    return <PaymentGatewaySettings onBack={handleBackToStore} />;
  }

  // If Google Sheets is selected, show the full sheets management screen
  if (selectedApp === "google-sheets") {
    return <GoogleSheetsSettings onBack={handleBackToStore} />;
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
            {/* Icon & Status Badge */}
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

            {/* Title & Description */}
            <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0C83FD] transition flex items-center gap-1.5">
              <span>Razorpay Payments</span>
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Accept UPI, credit/debit cards, and net banking directly in WhatsApp chat with zero platform fees.
            </p>

            {/* Feature Pills */}
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

                    {/* Card Footer CTA */}
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
            {/* Icon & Status Badge */}
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

            {/* Title & Description */}
            <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0F9D58] transition flex items-center gap-1.5">
              <span>Google Sheets</span>
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Auto-export confirmed leads, orders, and payment statuses to a live Google spreadsheet in real time.
            </p>

            {/* Feature Pills */}
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

          {/* Card Footer CTA */}
          <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-[#0F9D58] transition">
            <span>{isSheetsConnected ? "Manage Settings" : "Connect Sheets"}</span>
            <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}
