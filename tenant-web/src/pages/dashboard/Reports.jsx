// tenant-web/src/pages/dashboard/Reports.jsx

import React from "react";
import { useAnalyticsData } from "../../hooks/useAnalyticsData";
import AnalyticsHeader from "../../components/reports/AnalyticsHeader";
import MetricCard from "../../components/reports/MetricCard";
import ConversionFunnel from "../../components/reports/ConversionFunnel";
import MessageVolumeChart from "../../components/reports/MessageVolumeChart";
import CampaignReportTable from "../../components/reports/CampaignReportTable";
import TeamPerformance from "../../components/reports/TeamPerformance";
import { AlertCircle } from "lucide-react";

export default function Reports() {
  const {
    dateRangePreset, setDateRangePreset,
    customStartDate, setCustomStartDate,
    customEndDate, setCustomEndDate,
    campaignId, setCampaignId,
    agentId, setAgentId,
    granularity, setGranularity,
    campaignPage, setCampaignPage,
    filterOptions,
    overview,
    funnel,
    traffic,
    campaignsData,
    agentData,
    loading,
    exporting,
    error,
    refetch,
    handleExportCSV,
    handleExportPDF
  } = useAnalyticsData();

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-10">
      {/* Global Header & Filters Bar */}
      <AnalyticsHeader
        dateRangePreset={dateRangePreset}
        setDateRangePreset={setDateRangePreset}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        campaignId={campaignId}
        setCampaignId={setCampaignId}
        agentId={agentId}
        setAgentId={setAgentId}
        filterOptions={filterOptions}
        onRefresh={refetch}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
        loading={loading}
        exporting={exporting}
      />

      {/* Error Alert Banner */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800 font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={refetch}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition"
          >
            Try Again
          </button>
        </div>
      )}

      {/* 5 KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-5 border border-slate-200 bg-white rounded-xl h-28 animate-pulse space-y-3">
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
              <div className="h-6 bg-slate-200 rounded w-3/4"></div>
              <div className="h-2 bg-slate-100 rounded w-1/3"></div>
            </div>
          ))
        ) : (
          <>
            <MetricCard
              label="Total Sent"
              value={overview?.totalSent?.value}
              change={overview?.totalSent?.change}
              type={overview?.totalSent?.type}
            />
            <MetricCard
              label="Delivery Rate"
              value={overview?.deliveryRate?.value}
              change={overview?.deliveryRate?.change}
              type={overview?.deliveryRate?.type}
            />
            <MetricCard
              label="Read Rate"
              value={overview?.readRate?.value}
              change={overview?.readRate?.change}
              type={overview?.readRate?.type}
            />
            <MetricCard
              label="Reply Rate"
              value={overview?.replyRate?.value}
              change={overview?.replyRate?.change}
              type={overview?.replyRate?.type}
            />
            <MetricCard
              label="Failure Rate"
              value={overview?.failureRate?.value}
              change={overview?.failureRate?.change}
              type={overview?.failureRate?.type}
              isNegativeGood={true}
            />
          </>
        )}
      </div>

      {/* Funnel & Volume Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {loading ? (
          <>
            <div className="card p-6 border border-slate-200 bg-white rounded-xl h-72 animate-pulse"></div>
            <div className="card p-6 border border-slate-200 bg-white rounded-xl h-72 animate-pulse"></div>
          </>
        ) : (
          <>
            <ConversionFunnel steps={funnel} />
            <MessageVolumeChart
              data={traffic}
              granularity={granularity}
              setGranularity={setGranularity}
            />
          </>
        )}
      </div>

      {/* Broadcast Campaign Performance Table */}
      {loading ? (
        <div className="card p-6 border border-slate-200 bg-white rounded-xl h-64 animate-pulse"></div>
      ) : (
        <CampaignReportTable
          campaigns={campaignsData.items}
          page={campaignPage}
          totalPages={campaignsData.totalPages}
          onPageChange={setCampaignPage}
        />
      )}

      {/* Team & Agent Performance Leaderboard */}
      {loading ? (
        <div className="card p-6 border border-slate-200 bg-white rounded-xl h-64 animate-pulse"></div>
      ) : (
        <TeamPerformance
          summary={agentData.summary}
          leaderboard={agentData.leaderboard}
        />
      )}
    </div>
  );
}