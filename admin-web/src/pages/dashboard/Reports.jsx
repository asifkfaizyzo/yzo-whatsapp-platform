// admin-web/src/pages/dashboard/Reports.jsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  CheckCircle2,
  Users,
  Clock,
  AlertTriangle,
  Server,
  Activity,
  Download,
  RefreshCw,
  Search,
  Filter,
  Layers,
  ShieldCheck,
  BarChart3,
  XCircle,
  ArrowUpRight,
  CheckCircle,
  Building2,
  Calendar,
  Info
} from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  fetchReportKPIs,
  fetchReportMessages,
  fetchReportDelivery,
  fetchReportTenants,
  fetchReportSystemHealth
} from '../../services/reports.service';

export default function Reports() {
  const [dateRange, setDateRange] = useState('30days');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter state for Tenant Activity Table
  const [tenantSearch, setTenantSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');

  // Data states for 5 sections
  const [kpis, setKpis] = useState(null);
  const [messagesData, setMessagesData] = useState(null);
  const [deliveryData, setDeliveryData] = useState(null);
  const [tenantsData, setTenantsData] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);

  // Helper to convert dateRange preset to ISO start/end
  const getDateRangeParams = useCallback(() => {
    const end = new Date();
    let start = new Date();
    if (dateRange === '7days') {
      start.setDate(end.getDate() - 7);
    } else if (dateRange === '30days') {
      start.setDate(end.getDate() - 30);
    } else if (dateRange === 'thisMonth') {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
    } else if (dateRange === '90days') {
      start.setDate(end.getDate() - 90);
    }
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    };
  }, [dateRange]);

  const loadAllReports = useCallback(async () => {
    try {
      setLoading(true);
      const params = getDateRangeParams();

      const [kpiRes, msgRes, delRes, tenRes, healthRes] = await Promise.all([
        fetchReportKPIs(params),
        fetchReportMessages(params),
        fetchReportDelivery(params),
        fetchReportTenants({ ...params, search: tenantSearch, planFilter }),
        fetchReportSystemHealth()
      ]);

      if (kpiRes?.success) setKpis(kpiRes.data);
      if (msgRes?.success) setMessagesData(msgRes.data);
      if (delRes?.success) setDeliveryData(delRes.data);
      if (tenRes?.success) setTenantsData(tenRes.data);
      if (healthRes?.success) setSystemHealth(healthRes.data);
    } catch (err) {
      console.error('Failed to load platform reports:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getDateRangeParams, tenantSearch, planFilter]);

  useEffect(() => {
    loadAllReports();
  }, [loadAllReports]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllReports();
  };

  const handleExportCSV = () => {
    if (!tenantsData?.tenantActivityTable) return;
    const headers = ['Tenant Name', 'Plan', 'Messages Dispatched', 'Delivery Rate (%)', 'Status'];
    const csvRows = [
      headers.join(','),
      ...tenantsData.tenantActivityTable.map((t) =>
        `"${t.name}","${t.plan}",${t.messagesDispatched},${t.deliveryRate !== null ? t.deliveryRate : 'N/A'},"${t.status}"`
      )
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `platform_reports_${dateRange}.csv`);
    a.click();
  };

  // Render heatmap color intensity
  const getHeatmapColor = (count, max) => {
    if (!count || count === 0) return 'bg-slate-50 text-slate-400';
    const ratio = count / (max || 1);
    if (ratio > 0.75) return 'bg-[#125EF2] text-white font-bold';
    if (ratio > 0.4) return 'bg-[#5B92F7] text-white font-medium';
    if (ratio > 0.15) return 'bg-[#A3C4FA] text-slate-900';
    return 'bg-[#E5EFFE] text-slate-700';
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hoursOfDay = Array.from({ length: 24 }, (_, i) => i);

  const maxHeatmapCount = messagesData?.peakHoursHeatmap
    ? Math.max(...messagesData.peakHoursHeatmap.flatMap((row) => row), 1)
    : 1;

  return (
    <div className="space-y-8 animate-in fade-in duration-200 pb-12">
      {/* Top Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Activity className="text-[#125EF2]" size={26} />
            <span>Platform Operational Reports</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            System performance, message delivery intelligence, tenant usage trends, and gateway health.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <Calendar size={14} className="text-slate-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="90days">Last 90 Days</option>
            </select>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-[#125EF2] text-white hover:bg-[#0F4FCC] transition-colors shadow-sm"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 1 — PERFORMANCE KPI CARDS
      ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 size={18} className="text-[#125EF2]" />
            <span>Section 1 — Operational KPI Snapshot</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium">Updated live from backend</span>
        </div>

        {loading && !kpis ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Total Messages */}
            <div className="card p-5 border border-slate-100 bg-white rounded-2xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Dispatched</span>
                <div className="p-2 rounded-xl bg-blue-50 text-[#125EF2]">
                  <MessageSquare size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900">
                  {kpis?.totalMessages?.value?.toLocaleString() || 0}
                </span>
                <p className="mt-1 text-xs font-semibold flex items-center gap-1 text-[#125EF2]">
                  <TrendingUp size={12} />
                  <span>+{kpis?.totalMessages?.changePct || 0}% MoM</span>
                </p>
              </div>
            </div>

            {/* Card 2: Delivery Rate */}
            <div className="card p-5 border border-slate-100 bg-white rounded-2xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivery Rate</span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900">{kpis?.deliveryRate?.value || 0}%</span>
                <p
                  className={`mt-1 text-xs font-semibold flex items-center gap-1 ${
                    (kpis?.deliveryRate?.changePct || 0) >= 0 ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {(kpis?.deliveryRate?.changePct || 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  <span>
                    {(kpis?.deliveryRate?.changePct || 0) >= 0 ? '+' : ''}
                    {kpis?.deliveryRate?.changePct || 0}% MoM
                  </span>
                </p>
              </div>
            </div>

            {/* Card 3: Active Tenants */}
            <div className="card p-5 border border-slate-100 bg-white rounded-2xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Tenants</span>
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                  <Building2 size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900">{kpis?.activeTenants?.value || '0 / 0'}</span>
                <p className="mt-1 text-xs font-semibold text-purple-600 flex items-center gap-1">
                  <ArrowUpRight size={12} />
                  <span>+{kpis?.activeTenants?.netChange || 0} net this month</span>
                </p>
              </div>
            </div>

            {/* Card 4: Avg Response Time */}
            <div className="card p-5 border border-slate-100 bg-white rounded-2xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Response Time</span>
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Clock size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900">{kpis?.avgResponseTime?.value || 'N/A'}</span>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {kpis?.avgResponseTime?.hasData ? 'Calculated from response timestamps' : 'No response conversations'}
                </p>
              </div>
            </div>

            {/* Card 5: Failed Messages */}
            <div className="card p-5 border border-slate-100 bg-white rounded-2xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Failed Messages</span>
                <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                  <XCircle size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900">
                  {kpis?.failedMessages?.value?.toLocaleString() || 0}
                </span>
                <p className="mt-1 text-xs font-semibold text-rose-600">
                  {kpis?.failedMessages?.ratePct || 0}% failure rate
                </p>
              </div>
            </div>

            {/* Card 6: Messages / Tenant */}
            <div className="card p-5 border border-slate-100 bg-white rounded-2xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Msgs / Tenant Avg</span>
                <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                  <Layers size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900">
                  {kpis?.msgsPerTenant?.value?.toLocaleString() || 0}
                </span>
                <p className="mt-1 text-xs font-semibold text-slate-500">Platform average per active tenant</p>
              </div>
            </div>

            {/* Card 7: New vs Churned Tenants */}
            <div className="card p-5 border border-slate-100 bg-white rounded-2xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">New / Churned</span>
                <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                  <Users size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900">
                  +{kpis?.tenantGrowth?.newTenants || 0} / -{kpis?.tenantGrowth?.churnedTenants || 0}
                </span>
                <p className="mt-1 text-xs font-semibold text-sky-600">
                  Net: {kpis?.tenantGrowth?.netGrowth >= 0 ? '+' : ''}
                  {kpis?.tenantGrowth?.netGrowth || 0} this period
                </p>
              </div>
            </div>

            {/* Card 8: Gateway Nodes */}
            <div className="card p-5 border border-slate-100 bg-white rounded-2xl flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Gateway Nodes</span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Server size={18} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold text-slate-900">
                  {kpis?.gatewayNodes?.online || 0} / {kpis?.gatewayNodes?.total || 25}
                </span>
                <p className="mt-1 text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <ShieldCheck size={12} />
                  <span>Nodes {kpis?.gatewayNodes?.status || 'Online'}</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 2 — MESSAGE VOLUME & TRENDS
      ───────────────────────────────────────────────────────────── */}
      <div className="card border border-slate-100 p-6 bg-white rounded-2xl shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={20} className="text-[#125EF2]" />
            <span>Section 2 — Message Volume & Operational Trends</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Track overall platform dispatch growth, message format distribution, and peak traffic hours.
          </p>
        </div>

        {/* Volume over time Area Chart */}
        <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Platform-wide Message Volume Over Time</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={messagesData?.volumeOverTime || []}>
                <defs>
                  <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#125EF2" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#125EF2" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="Sent" stroke="#125EF2" fillOpacity={1} fill="url(#colorSent)" />
                <Area type="monotone" dataKey="Delivered" stroke="#10B981" fillOpacity={1} fill="url(#colorDelivered)" />
                <Area type="monotone" dataKey="Failed" stroke="#EF4444" fill="#FEE2E2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Message Types Breakdown */}
          <div className="p-5 border border-slate-100 rounded-2xl bg-white space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Message Formats & Types Breakdown</h3>
            <div className="space-y-3">
              {(messagesData?.messageTypesBreakdown || []).map((item) => (
                <div key={item.type} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{item.type}</span>
                    <span>{item.pct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#125EF2] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Volume Growth MoM */}
          <div className="p-5 border border-slate-100 rounded-2xl bg-white space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Month-over-Month Volume Growth</h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={messagesData?.volumeGrowthMoM || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis dataKey="period" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={80} />
                  <Tooltip />
                  <Bar dataKey="volume" fill="#125EF2" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Peak Hours Heatmap (Vanilla CSS Grid implementation) */}
        <div className="p-5 border border-slate-100 rounded-2xl bg-white space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Peak Traffic Hours Heatmap (Local Time, Day vs Hour)</h3>
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
              <span>Low</span>
              <div className="w-3 h-3 bg-slate-100 rounded-xs" />
              <div className="w-3 h-3 bg-[#A3C4FA] rounded-xs" />
              <div className="w-3 h-3 bg-[#125EF2] rounded-xs" />
              <span>High</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[650px] space-y-1">
              <div className="grid grid-cols-[50px_repeat(24,1fr)] gap-1 text-[10px] text-slate-400 font-semibold text-center">
                <div>Day</div>
                {hoursOfDay.map((h) => (
                  <div key={h}>{h}h</div>
                ))}
              </div>

              {daysOfWeek.map((day, dayIdx) => (
                <div key={day} className="grid grid-cols-[50px_repeat(24,1fr)] gap-1 items-center">
                  <span className="text-xs font-semibold text-slate-600">{day}</span>
                  {hoursOfDay.map((hourIdx) => {
                    const count = messagesData?.peakHoursHeatmap?.[dayIdx]?.[hourIdx] || 0;
                    return (
                      <div
                        key={hourIdx}
                        title={`${day} at ${hourIdx}:00 — ${count} messages`}
                        className={`h-6 rounded-xs flex items-center justify-center text-[9px] transition-colors cursor-pointer ${getHeatmapColor(
                          count,
                          maxHeatmapCount
                        )}`}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 3 — DELIVERY PERFORMANCE
      ───────────────────────────────────────────────────────────── */}
      <div className="card border border-slate-100 p-6 bg-white rounded-2xl shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-emerald-600" />
            <span>Section 3 — Platform Delivery Performance & Funnel</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Identify dispatch bottleneck drops, delivery error reasons, and low-performing tenant accounts.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Delivery Funnel Steps */}
          <div className="p-5 border border-slate-100 rounded-2xl bg-white space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Delivery Funnel (Sent → Delivered → Read → Failed)</h3>

            <div className="space-y-3 text-xs">
              {/* SENT */}
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between font-semibold text-blue-900">
                <span>1. SENT</span>
                <span>
                  {deliveryData?.funnel?.sent?.count?.toLocaleString() || 0} ({deliveryData?.funnel?.sent?.pct || 0}%)
                </span>
              </div>

              {/* DELIVERED */}
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between font-semibold text-emerald-900">
                <span>2. DELIVERED</span>
                <span>
                  {deliveryData?.funnel?.delivered?.count?.toLocaleString() || 0} ({deliveryData?.funnel?.delivered?.pct || 0}%)
                </span>
              </div>

              {/* READ */}
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between font-semibold text-indigo-900">
                <span>3. READ</span>
                <span>
                  {deliveryData?.funnel?.read?.count?.toLocaleString() || 0} ({deliveryData?.funnel?.read?.pct || 0}%)
                </span>
              </div>

              {/* FAILED */}
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-between font-semibold text-rose-900">
                <span>4. FAILED</span>
                <span>
                  {deliveryData?.funnel?.failed?.count?.toLocaleString() || 0} ({deliveryData?.funnel?.failed?.pct || 0}%)
                </span>
              </div>
            </div>
          </div>

          {/* Failure Reasons Breakdown */}
          <div className="p-5 border border-slate-100 rounded-2xl bg-white space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Primary Delivery Failure Reasons</h3>

            {(!deliveryData?.failureReasons || deliveryData.failureReasons.length === 0) ? (
              <div className="p-6 bg-slate-50 rounded-xl text-center space-y-1">
                <CheckCircle2 size={24} className="text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-slate-700">Zero Message Failures</p>
                <p className="text-[11px] text-slate-400">No failed message dispatches recorded in this date range.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deliveryData.failureReasons.map((item) => (
                  <div key={item.reason} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>{item.reason} ({item.count} msgs)</span>
                      <span>{item.pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delivery Rate Trend Line Chart */}
        <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100">
          <h3 className="text-sm font-bold text-slate-700 mb-4">Delivery Rate Trend Over Time (%)</h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={deliveryData?.deliveryRateTrend || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tenants with Low Delivery Rate Alert Box */}
        <div className="p-5 bg-amber-50/60 border border-amber-200/70 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <span>Tenants Below 85% Delivery Threshold (Attention Required)</span>
          </h3>

          {(!deliveryData?.lowDeliveryTenants || deliveryData.lowDeliveryTenants.length === 0) ? (
            <p className="text-xs text-amber-700 font-medium">
              ✅ All active tenants with dispatches are currently performing above the 85% delivery threshold.
            </p>
          ) : (
            <div className="space-y-2">
              {deliveryData.lowDeliveryTenants.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-200 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-slate-800 font-bold">{t.name}</span>
                    <span className="text-slate-400 text-[11px]">({t.dispatchedCount} dispatched)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-amber-700 font-bold">{t.deliveryRate}% Delivery Rate</span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 4 — TENANT ACTIVITY & USAGE
      ───────────────────────────────────────────────────────────── */}
      <div className="card border border-slate-100 p-6 bg-white rounded-2xl shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Users size={20} className="text-purple-600" />
              <span>Section 4 — Tenant Activity & Usage Distribution</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Analyze tenant message distribution, plan adoption, and identify inactive accounts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search tenant..."
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#125EF2]"
              />
            </div>

            {/* Plan Filter dropdown */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <Filter size={13} className="text-slate-400" />
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="bg-transparent text-slate-700 font-semibold focus:outline-none cursor-pointer"
              >
                <option value="all">All Plans</option>
                {(tenantsData?.planDistribution || []).map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Top 10 Tenants Horizontal Bar Chart */}
        <div className="p-5 border border-slate-100 rounded-2xl bg-white space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Top Tenants by Dispatch Volume</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tenantsData?.topTenantsByVolume || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={120} />
                <Tooltip />
                <Bar dataKey="messagesDispatched" fill="#8B5CF6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tenant Activity Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                <th className="p-3.5">Tenant Name</th>
                <th className="p-3.5">Plan Tier</th>
                <th className="p-3.5 text-right">Messages Dispatched</th>
                <th className="p-3.5 text-right">Delivery Rate</th>
                <th className="p-3.5">Last Active</th>
                <th className="p-3.5 text-center">Operational Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(tenantsData?.tenantActivityTable || []).map((tenant) => (
                <tr key={tenant.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-3.5 font-bold text-slate-800">{tenant.name}</td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#125EF2] border border-blue-100">
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-bold text-slate-900">
                    {tenant.messagesDispatched.toLocaleString()}
                  </td>
                  <td className="p-3.5 text-right font-semibold text-emerald-600">
                    {tenant.deliveryRate !== null ? `${tenant.deliveryRate}%` : 'N/A'}
                  </td>
                  <td className="p-3.5 text-slate-500">
                    {new Date(tenant.lastActive).toLocaleDateString()}
                  </td>
                  <td className="p-3.5 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tenant.status === 'OPERATIONAL'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : tenant.status === 'ATTENTION'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          tenant.status === 'OPERATIONAL'
                            ? 'bg-emerald-500'
                            : tenant.status === 'ATTENTION'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      />
                      {tenant.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SECTION 5 — SYSTEM HEALTH
      ───────────────────────────────────────────────────────────── */}
      <div className="card border border-slate-100 p-6 bg-white rounded-2xl shadow-xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Server size={20} className="text-emerald-600" />
            <span>Section 5 — Gateway Nodes & Infrastructure Health</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor active WhatsApp gateway instances, message queue backlogs, API latencies, and platform uptime.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* WhatsApp Gateway Nodes List */}
          <div className="p-5 border border-slate-100 rounded-2xl bg-white space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center justify-between">
              <span>Active WhatsApp Gateway Nodes</span>
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle size={12} /> Configured Nodes
              </span>
            </h3>

            {(!systemHealth?.gatewayNodes || systemHealth.gatewayNodes.length === 0) ? (
              <div className="p-6 bg-slate-50 rounded-xl text-center space-y-1">
                <Server size={24} className="text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No Gateway Nodes Configured</p>
                <p className="text-[11px] text-slate-400">Configure WABA WhatsApp credentials on tenant accounts to add nodes.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {systemHealth.gatewayNodes.map((node) => (
                  <div key={node.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs font-semibold border border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${node.status === 'Online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className="text-slate-800 font-bold">{node.id}</span>
                      <span className="text-slate-500 text-[11px]">({node.tenantName})</span>
                    </div>
                    <span className="text-slate-600 font-medium">{node.dispatches.toLocaleString()} msgs dispatched</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message Queue Status */}
          <div className="p-5 border border-slate-100 rounded-2xl bg-white space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Message Dispatch Queues</h3>
              {systemHealth?.messageQueue?.isSimulated && (
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                  <Info size={11} /> DB-Estimated
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-semibold block">Waiting Jobs</span>
                <span className="text-lg font-bold text-slate-800">
                  {systemHealth?.messageQueue?.waitingJobs?.toLocaleString() || 0}
                </span>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                <span className="text-blue-600 font-semibold block">Active Processing</span>
                <span className="text-lg font-bold text-blue-900">
                  {systemHealth?.messageQueue?.activeJobs || 0}
                </span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <span className="text-amber-600 font-semibold block">Retry Queue</span>
                <span className="text-lg font-bold text-amber-900">
                  {systemHealth?.messageQueue?.retryQueue || 0}
                </span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                <span className="text-rose-600 font-semibold block">Failed Queue</span>
                <span className="text-lg font-bold text-rose-900">
                  {systemHealth?.messageQueue?.failedQueue || 0}
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between text-xs font-bold text-emerald-900">
              <span>System Throughput</span>
              <span>{systemHealth?.messageQueue?.throughputMsgMin || 0} msg / min</span>
            </div>
          </div>
        </div>

        {/* API Response Times & Uptime */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-5 border border-slate-100 rounded-2xl bg-white space-y-3">
            <h3 className="text-sm font-bold text-slate-800">API Response Time & Latency (Avg ms)</h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg font-semibold">
                <span className="text-slate-600">WhatsApp Meta API</span>
                <span className="text-slate-900 font-bold">{systemHealth?.apiPerformance?.whatsappApiAvgMs || 240} ms</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg font-semibold">
                <span className="text-slate-600">Internal SuperAdmin API</span>
                <span className="text-slate-900 font-bold">{systemHealth?.apiPerformance?.internalApiAvgMs || 48} ms</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg font-semibold">
                <span className="text-slate-600">Database Query Avg</span>
                <span className="text-slate-900 font-bold">{systemHealth?.apiPerformance?.databaseAvgMs || 12} ms</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-slate-50 rounded-lg font-semibold">
                <span className="text-slate-600">Webhook Ingestion</span>
                <span className="text-slate-900 font-bold">{systemHealth?.apiPerformance?.webhookIngestAvgMs || 28} ms</span>
              </div>
            </div>
          </div>

          <div className="p-5 border border-slate-100 rounded-2xl bg-white space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">30-Day Platform Uptime & SLA</h3>
              <p className="text-xs text-slate-400 mt-1">Target SLA: 99.9% Uptime guarantee</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-slate-700">Overall System Reliability</span>
                <span className="text-emerald-600">{systemHealth?.uptime?.last30DaysPct || 99.8}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div className="bg-emerald-500 h-3 rounded-full" style={{ width: `${systemHealth?.uptime?.last30DaysPct || 99.8}%` }} />
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {systemHealth?.uptime?.incidentsThisMonth || 0} incidents recorded this month.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
