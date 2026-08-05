// tenant-web/src/hooks/useAnalyticsData.js

import { useState, useEffect, useCallback } from "react";
import {
  getAnalyticsOverview,
  getAnalyticsFunnel,
  getAnalyticsTraffic,
  getAnalyticsCampaigns,
  getAnalyticsAgents,
  getAnalyticsFilters,
  downloadAnalyticsCSV
} from "../services/analytics.service";

export function useAnalyticsData() {
  // Global Filter States
  const [dateRangePreset, setDateRangePreset] = useState("last30"); // today, yesterday, last7, last30, last90, custom
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [campaignId, setCampaignId] = useState("all");
  const [agentId, setAgentId] = useState("all");

  // Chart & Table Options
  const [granularity, setGranularity] = useState("daily"); // hourly, daily
  const [campaignPage, setCampaignPage] = useState(1);

  // Data States
  const [filterOptions, setFilterOptions] = useState({ campaigns: [], agents: [] });
  const [overview, setOverview] = useState(null);
  const [funnel, setFunnel] = useState([]);
  const [traffic, setTraffic] = useState([]);
  const [campaignsData, setCampaignsData] = useState({ items: [], totalPages: 1 });
  const [agentData, setAgentData] = useState({ summary: {}, leaderboard: [] });

  // Status States
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Helper to compute start & end dates from preset
  const getComputedDates = useCallback(() => {
    const end = new Date();
    let start = new Date();

    if (dateRangePreset === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (dateRangePreset === "yesterday") {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (dateRangePreset === "last7") {
      start.setDate(start.getDate() - 7);
    } else if (dateRangePreset === "last30") {
      start.setDate(start.getDate() - 30);
    } else if (dateRangePreset === "last90") {
      start.setDate(start.getDate() - 90);
    } else if (dateRangePreset === "custom" && customStartDate && customEndDate) {
      start = new Date(customStartDate);
      return { startDate: start.toISOString(), endDate: new Date(customEndDate).toISOString() };
    }

    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [dateRangePreset, customStartDate, customEndDate]);

  // Load filter dropdown options once
  useEffect(() => {
    getAnalyticsFilters().then(res => {
      if (res.success) setFilterOptions(res.data);
    });
  }, []);

  // Fetch all section metrics in parallel
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const dateParams = getComputedDates();
    const queryParams = {
      ...dateParams,
      campaignId: campaignId !== 'all' ? campaignId : undefined,
      agentId: agentId !== 'all' ? agentId : undefined,
    };

    try {
      const [overviewRes, funnelRes, trafficRes, campaignsRes, agentsRes] = await Promise.all([
        getAnalyticsOverview(queryParams),
        getAnalyticsFunnel(queryParams),
        getAnalyticsTraffic({ ...queryParams, granularity }),
        getAnalyticsCampaigns({ ...queryParams, page: campaignPage, limit: 8 }),
        getAnalyticsAgents(queryParams)
      ]);

      if (overviewRes.success)  setOverview(overviewRes.data);
      if (funnelRes.success)    setFunnel(funnelRes.data);
      if (trafficRes.success)   setTraffic(trafficRes.data);
      if (campaignsRes.success) setCampaignsData(campaignsRes.data);
      if (agentsRes.success)    setAgentData(agentsRes.data);

      if (!overviewRes.success && !funnelRes.success) {
        setError("Failed to load analytics data. Please check connection.");
      }
    } catch (err) {
      setError("An unexpected error occurred while loading reports.");
    } finally {
      setLoading(false);
    }
  }, [getComputedDates, campaignId, agentId, granularity, campaignPage]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // CSV Export Action
  const handleExportCSV = async () => {
    setExporting(true);
    const dateParams = getComputedDates();
    await downloadAnalyticsCSV({
      ...dateParams,
      campaignId: campaignId !== 'all' ? campaignId : undefined,
      agentId: agentId !== 'all' ? agentId : undefined,
    });
    setExporting(false);
  };

  // PDF Print Action
  const handleExportPDF = () => {
    window.print();
  };

  return {
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
    refetch: fetchAllData,
    handleExportCSV,
    handleExportPDF
  };
}