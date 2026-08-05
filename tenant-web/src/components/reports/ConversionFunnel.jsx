// tenant-web/src/components/reports/ConversionFunnel.jsx

import React from "react";
import { TrendingUp } from "lucide-react";

export default function ConversionFunnel({ steps = [] }) {
  return (
    <div className="card border border-slate-200 bg-white rounded-xl p-6 shadow-xs flex flex-col justify-between">
      <div>
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <TrendingUp size={18} className="text-[#125EF2]" />
          <span>Message Conversion Funnel</span>
        </h2>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          Progressive drop-off breakdown from broadcast dispatch to client reply
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {steps.map((step) => (
          <div key={step.phase} className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span>{step.phase}</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-normal text-[11px]">{step.dropoff}</span>
                <span className="font-bold text-slate-800">{step.count} ({step.percent}%)</span>
              </div>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className={`${step.color || 'bg-[#125EF2]'} h-full rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(step.percent, 100)}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}