// tenant-web/src/components/reports/MetricCard.jsx

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function MetricCard({ label, value, change, type, isNegativeGood = false }) {
  const isPositive = type === "positive";
  
  // Color coding logic: For Failure Rate, a decrease is good (green)
  let badgeColorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
  if ((isPositive && isNegativeGood) || (!isPositive && !isNegativeGood)) {
    badgeColorClass = "bg-rose-50 text-rose-700 border-rose-200";
  }

  return (
    <div className="card p-5 border border-slate-200 bg-white rounded-xl shadow-xs flex flex-col justify-between hover:shadow-md transition">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {label}
      </span>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl font-bold text-slate-800 tracking-tight">
          {value || "0"}
        </span>

        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${badgeColorClass}`}
        >
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>{change}</span>
        </span>
      </div>

      <div className="mt-2 text-[10px] font-medium text-slate-400">
        vs previous period
      </div>
    </div>
  );
}
