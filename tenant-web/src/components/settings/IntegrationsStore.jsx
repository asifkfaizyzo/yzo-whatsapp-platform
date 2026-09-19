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
import RazorpayLogo from "./RazorpayLogo";
import { getPaymentGatewayConfig } from "../../services/tenant.service";

export default function IntegrationsStore() {
  const [searchParams, setSearchParams] = useSearchParams();

  // "razorpay" | null
  const [selectedApp, setSelectedApp] = useState(() => {
    const app = searchParams.get("app");
    const connected = searchParams.get("connected");
    if (app === "razorpay" || connected === "true") return "razorpay";
    return null;
  });

  const [isRazorpayConnected, setIsRazorpayConnected] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Check Razorpay connection status on mount and when returning from detail view
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await getPaymentGatewayConfig();
        if (res.success && res.data) {
          const isConnected =
            res.data.razorpayAuthType === "OAUTH"
              ? Boolean(res.data.razorpayAccountId)
              : Boolean(res.data.razorpayKeyId);
          setIsRazorpayConnected(isConnected);
        }
      } catch (err) {
        console.warn("Failed to check gateway status:", err);
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
    if (app === "razorpay" || connected === "true") {
      setSelectedApp("razorpay");
    }
  }, [searchParams]);

  const handleBackToStore = () => {
    setSelectedApp(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("app");
    newParams.delete("connected");
    setSearchParams(newParams, { replace: true });
  };

  // If Razorpay is selected, show the full gateway connecting/management screen
  if (selectedApp === "razorpay") {
    return <PaymentGatewaySettings onBack={handleBackToStore} />;
  }

  return (
    <div className="animate-in fade-in duration-150">
      {/* Integrations Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Razorpay Card */}
        <div
          onClick={() => setSelectedApp("razorpay")}
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
      </div>
    </div>
  );
}
