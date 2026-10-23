// src/pages/dashboard/Integrations.jsx
import React from "react";
import { LayoutGrid } from "lucide-react";
import IntegrationsStore from "../../components/settings/IntegrationsStore";

export default function Integrations() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#125EF2] flex items-center justify-center">
              <LayoutGrid size={18} />
            </div>
            <span>Integrations</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Connect external payment gateways, e-commerce stores, and business tools to supercharge WhatsApp.
          </p>
        </div>
      </div>

      {/* Main Integrations Content */}
      <IntegrationsStore />
    </div>
  );
}
