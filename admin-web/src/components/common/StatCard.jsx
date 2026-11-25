// admin-web/src/components/common/StatCard.jsx (do not remove this comment)
import React from "react";
import { TrendingUp } from "lucide-react";

export default function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  iconColor,
  iconBg,
  growth,
}) {
  return (
    <div
      className="relative bg-white rounded-2xl border border-slate-100 p-4 flex flex-col justify-between transition-all duration-200 overflow-hidden hover:shadow-md hover:-translate-y-0.5 hover:border-slate-200 cursor-default group"
      style={{
        boxShadow:
          "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(18,95,226,0.04)",
      }}
    >
      <div className="flex items-center justify-between relative mb-2">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${iconBg}`}
        >
          <Icon size={18} className={iconColor} />
        </div>
        {growth !== undefined && (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              growth >= 0
                ? "bg-emerald-50 text-emerald-600"
                : "bg-rose-50 text-rose-600"
            }`}
          >
            <TrendingUp size={10} />
            {growth >= 0 ? "+" : ""}
            {growth}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-900 leading-none">
          {value}
        </p>
        <p className="text-xs font-semibold text-slate-600 mt-1">{title}</p>
        {subtitle && (
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}