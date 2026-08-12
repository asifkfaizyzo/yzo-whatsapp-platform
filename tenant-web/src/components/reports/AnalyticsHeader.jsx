// tenant-web/src/components/reports/AnalyticsHeader.jsx

import React from "react";
import { 
  BarChart3, 
  RotateCw, 
  Download, 
  Printer, 
  Calendar, 
  Filter, 
  User 
} from "lucide-react";

export default function AnalyticsHeader({
  dateRangePreset, setDateRangePreset,
  customStartDate, setCustomStartDate,
  customEndDate, setCustomEndDate,
  campaignId, setCampaignId,
  agentId, setAgentId,
  filterOptions,
  onRefresh,
  onExportCSV,
  onExportPDF,
  loading,
  exporting
}) {
  return (
    <div className="space-y-4">
      {/* Top Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="text-[#125EF2]" size={26} />
            <span>Analytics & Reports</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Channel delivery statistics, campaign conversion funnels, and agent performance reports.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="btn btn-ghost border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition"
            title="Refresh Data"
          >
            <RotateCw size={14} className={loading ? "animate-spin text-[#125EF2]" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onExportCSV}
            disabled={exporting}
            className="btn border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm"
          >
            <Download size={14} className="text-[#125EF2]" />
            <span>{exporting ? "Exporting..." : "Export CSV"}</span>
          </button>

          <button
            onClick={onExportPDF}
            className="btn bg-[#125EF2] hover:bg-blue-700 text-white px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-sm"
          >
            <Printer size={14} />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="card p-4 border border-slate-200 bg-white rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Date Range Preset Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <Calendar size={14} className="text-slate-400" />
            <select
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value)}
              className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 Days</option>
              <option value="last30">Last 30 Days (Default)</option>
              <option value="last90">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Inputs (only when custom is selected) */}
          {dateRangePreset === "custom" && (
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="input input-sm border border-slate-200 text-xs rounded-lg px-2 py-1"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="input input-sm border border-slate-200 text-xs rounded-lg px-2 py-1"
              />
            </div>
          )}

          {/* Campaign Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <Filter size={14} className="text-slate-400" />
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer max-w-[180px]"
            >
              <option value="all">All Campaigns</option>
              {filterOptions.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Agent Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <User size={14} className="text-slate-400" />
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer max-w-[160px]"
            >
              <option value="all">All Agents</option>
              {filterOptions.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Period Badge */}
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Active Period: <span className="text-slate-700 font-bold">{dateRangePreset.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}