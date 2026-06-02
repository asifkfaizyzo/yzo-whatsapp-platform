// admin-web/src/pages/dashboard/Reports.jsx

import React from "react";
import {
  TrendingUp,
  DollarSign,
  MessageSquare,
  Building2,
  CheckCircle,
  ArrowUpRight,
  TrendingDown
} from "lucide-react";

export default function Reports() {
  const usageStats = [
    { tenant: "Acme Corporation", plan: "Enterprise", messagesSent: 48290, successRate: "99.4%", bills: "$2,450" },
    { tenant: "Starlight Retail Ltd", plan: "Growth", messagesSent: 28940, successRate: "98.9%", bills: "$950" },
    { tenant: "Delta Logistics", plan: "Starter", messagesSent: 5400, successRate: "99.1%", bills: "$150" },
    { tenant: "Apex Consulting", plan: "Growth", messagesSent: 12800, successRate: "97.5%", bills: "$450" },
  ];

  const systemMetrics = [
    { label: "Monthly Recurring Revenue", value: "$4,000", change: "+15% this month", icon: <DollarSign size={20} />, trend: "up" },
    { label: "System Messages Sent", value: "95,430", change: "+8% this week", icon: <MessageSquare size={20} />, trend: "up" },
    { label: "Active Connections", value: "24 / 25 Nodes", change: "99.98% Gateway Uptime", icon: <Building2 size={20} />, trend: "up" },
    { label: "Delivery Success Rate", value: "98.97%", change: "-0.05% latency spike", icon: <CheckCircle size={20} />, trend: "down" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="text-emerald-600" size={24} />
          <span>SaaS Analytics & Reports</span>
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Monitor system messaging volume, billing distribution, and active nodes across the network.
        </p>
      </div>

      {/* Grid Stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {systemMetrics.map((item) => (
          <div key={item.label} className="card p-5 border border-slate-100 flex flex-col justify-between bg-white">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500">{item.label}</span>
              <div className="p-2.5 rounded-xl border bg-slate-50 border-slate-100 text-slate-600">
                {item.icon}
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold text-slate-800">{item.value}</span>
              <p className={`mt-1 text-xs font-semibold flex items-center gap-1 ${
                item.trend === "up" ? "text-emerald-600" : "text-amber-600"
              }`}>
                {item.trend === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                <span>{item.change}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Usage breakdown */}
      <div className="card border border-slate-100 p-6 bg-white">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Tenant Usage & Billing Breakdown</h2>
            <p className="text-xs text-gray-400 font-medium">Resource consumption and subscription billing per tenant</p>
          </div>
        </div>
        
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-gray-400 font-bold border-b border-slate-100">
                <th className="pb-3 font-semibold">Tenant Name</th>
                <th className="pb-3 font-semibold">Tier Plan</th>
                <th className="pb-3 font-semibold text-right">Messages Dispatched</th>
                <th className="pb-3 font-semibold text-right">Average Success</th>
                <th className="pb-3 font-semibold text-right">Current Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-sm">
              {usageStats.map((item) => (
                <tr key={item.tenant} className="hover:bg-slate-50/50">
                  <td className="py-3.5 font-semibold text-slate-700">{item.tenant}</td>
                  <td className="py-3.5">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {item.plan}
                    </span>
                  </td>
                  <td className="py-3.5 text-right font-semibold text-slate-800">{item.messagesSent.toLocaleString()}</td>
                  <td className="py-3.5 text-right text-emerald-600 font-semibold">{item.successRate}</td>
                  <td className="py-3.5 text-right font-bold text-slate-800">{item.bills}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
