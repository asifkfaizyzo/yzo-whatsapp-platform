// tenant-web/src/components/reports/MessageVolumeChart.jsx

import React from "react";
import { Clock } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

export default function MessageVolumeChart({
  data = [],
  granularity,
  setGranularity
}) {
  return (
    <div className="card border border-slate-200 bg-white rounded-xl p-6 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Clock size={18} className="text-[#125EF2]" />
            <span>Message Traffic Volume</span>
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Outgoing vs incoming message distribution over time
          </p>
        </div>

        {/* Granularity Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setGranularity("hourly")}
            className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
              granularity === "hourly"
                ? "bg-white text-[#125EF2] shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Hourly
          </button>
          <button
            onClick={() => setGranularity("daily")}
            className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
              granularity === "daily"
                ? "bg-white text-[#125EF2] shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Daily
          </button>
        </div>
      </div>

      {/* Recharts Bar Chart */}
      <div className="mt-6 h-64 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs font-medium text-slate-400">
            No volume traffic data for selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="period" tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="outgoing" name="Outgoing" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="incoming" name="Incoming" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}