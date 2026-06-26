// src/pages/dashboard/Reports.jsx

import React from "react";
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  MessageSquare,
  ArrowUpRight,
  Sparkles
} from "lucide-react";

export default function Reports() {
  const cards = [
    { label: "Messages Sent", value: "48,290", change: "+14.2%", type: "positive" },
    { label: "Delivered", value: "48,010", change: "99.4%", type: "neutral" },
    { label: "Read (Open)", value: "39,705", change: "82.7%", type: "neutral" },
    { label: "Replied (Incoming)", value: "12,940", change: "26.8%", type: "positive" },
  ];

  // Visual CSS charts - Funnel bars
  const funnelSteps = [
    { phase: "1. Sent", count: "48,290", percent: 100, color: "bg-[#125EF2]" },
    { phase: "2. Delivered", count: "48,010", percent: 99.4, color: "bg-[#125EF2]" },
    { phase: "3. Read", count: "39,705", percent: 82.7, color: "bg-[#125EF2]" },
    { phase: "4. Replied", count: "12,940", percent: 26.8, color: "bg-[#A0C2FA]" },
  ];

  const weeklyTraffic = [
    { day: "Mon", count: 8400 },
    { day: "Tue", count: 9600 },
    { day: "Wed", count: 11200 },
    { day: "Thu", count: 10500 },
    { day: "Fri", count: 12400 },
    { day: "Sat", count: 4200 },
    { day: "Sun", count: 3800 },
  ];

  const maxTraffic = Math.max(...weeklyTraffic.map(t => t.count));

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 className="text-[#125EF2]" size={24} />
          <span>Analytics & Reports</span>
        </h1>
        <p className="text-xs text-[color:var(--muted)] font-medium mt-1">
          Detailed metrics, open rates, and response metrics for your WhatsApp channel.
        </p>
      </div>

      {/* Grid Indicators */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="card p-5 border border-slate-100 flex flex-col justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{card.label}</span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-slate-800">{card.value}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                card.type === "positive" 
                  ? "bg-[#EAF2FE] text-[#125EF2] border border-[#CFE0FD]" 
                  : "bg-slate-50 text-slate-600 border border-slate-150"
              }`}>
                {card.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Analytics Visualizers */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Conversion Funnel */}
        <div className="card border border-slate-100 p-6">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={18} className="text-[#125EF2]" />
            <span>Message Conversion Funnel</span>
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Efficiency breakdown from dispatch to client replies</p>
          
          <div className="mt-6 space-y-4">
            {funnelSteps.map((step) => (
              <div key={step.phase} className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>{step.phase}</span>
                  <span>{step.count} ({step.percent}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`${step.color} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${step.percent}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Traffic volume */}
        <div className="card border border-slate-100 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Clock size={18} className="text-[#125EF2]" />
              <span>Weekly Message Volume</span>
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Total processed events (outgoing + incoming)</p>
          </div>

          {/* Simple CSS bar chart */}
          <div className="mt-6 flex items-end justify-between h-40 pt-4 px-2">
            {weeklyTraffic.map((day) => {
              const height = (day.count / maxTraffic) * 100;
              return (
                <div key={day.day} className="flex flex-col items-center gap-2 flex-1 group">
                  {/* Tooltip info */}
                  <span className="opacity-0 group-hover:opacity-100 transition duration-150 bg-slate-800 text-white text-[9px] font-bold py-1 px-1.5 rounded absolute -translate-y-8 pointer-events-none">
                    {day.count.toLocaleString()}
                  </span>
                  
                  {/* Bar */}
                  <div 
                    className="w-8 bg-[#CFE0FD] border-t border-[#125EF2] rounded-t group-hover:bg-[#125EF2] transition-all duration-300"
                    style={{ height: `${height}%` }}
                  ></div>
                  
                  <span className="text-[10px] text-slate-500 font-bold">{day.day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI Campaign Insights summary */}
      <div className="card border border-slate-100 p-6 bg-slate-50 border-l-4 border-l-emerald-600">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <Sparkles size={16} className="text-[#125EF2]" />
          <span>Smart Campaign Insight</span>
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed mt-2">
          Your <strong className="text-slate-800">Summer Promo Campaign</strong> generated a read rate of <span className="text-[#125EF2] font-bold">84.2%</span>. This is 3.5% higher than your average. Campaigns dispatched between <strong className="text-slate-800">10:00 AM and 11:30 AM</strong> show the highest engagement response rates from your contacts.
        </p>
      </div>
    </div>
  );
}
