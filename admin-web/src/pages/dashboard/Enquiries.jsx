// admin-web/src/pages/dashboard/Enquiries.jsx

import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  HelpCircle,
  Sparkles,
  Search,
  Filter,
  Eye,
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Users2,
  TrendingUp,
  Inbox,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import api from "../../lib/axios";

export default function Enquiries() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "enterprise" ? "enterprise" : "marketing";

  const handleTabChange = (tabKey) => {
    if (tabKey === "enterprise") {
      setSearchParams({ tab: "enterprise" });
    } else {
      setSearchParams({});
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // MARKETING ENQUIRIES STATE
  // ══════════════════════════════════════════════════════════════════════════════
  const [enquiries, setEnquiries] = useState([]);
  const [enquiriesLoading, setEnquiriesLoading] = useState(true);
  const [enquiriesError, setEnquiriesError] = useState("");
  const [enquirySearch, setEnquirySearch] = useState("");
  const [enquiryStatus, setEnquiryStatus] = useState("");
  const [enquiryPage, setEnquiryPage] = useState(1);
  const [enquiryTotalPages, setEnquiryTotalPages] = useState(1);
  const [enquiryTotal, setEnquiryTotal] = useState(0);

  const fetchEnquiries = async () => {
    setEnquiriesLoading(true);
    setEnquiriesError("");
    try {
      const response = await api.get("/admin/enquiries", {
        params: {
          page: enquiryPage,
          limit: 10,
          status: enquiryStatus || undefined,
          search: enquirySearch || undefined,
        },
      });

      if (response.data?.success) {
        setEnquiries(response.data.data || []);
        setEnquiryTotalPages(response.data.pagination?.totalPages || 1);
        setEnquiryTotal(response.data.pagination?.total || 0);
      } else {
        setEnquiriesError(response.data?.message || "Failed to load marketing enquiries.");
      }
    } catch (err) {
      console.error("Error loading enquiries:", err);
      setEnquiriesError(err.response?.data?.message || "Failed to load enquiries. Please make sure the server is running.");
    } finally {
      setEnquiriesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "marketing") {
      fetchEnquiries();
    }
  }, [activeTab, enquiryPage, enquiryStatus]);

  const handleEnquirySearchSubmit = (e) => {
    e.preventDefault();
    setEnquiryPage(1);
    fetchEnquiries();
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // ENTERPRISE LEADS STATE
  // ══════════════════════════════════════════════════════════════════════════════
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [leadStatus, setLeadStatus] = useState("");
  const [leadCompanySize, setLeadCompanySize] = useState("");
  const [leadTimeline, setLeadTimeline] = useState("");
  const [leadPage, setLeadPage] = useState(1);
  const [leadTotalPages, setLeadTotalPages] = useState(1);
  const [leadTotal, setLeadTotal] = useState(0);

  const fetchLeads = async () => {
    setLeadsLoading(true);
    setLeadsError("");
    try {
      const response = await api.get("/admin/enterprise-leads", {
        params: {
          page: leadPage,
          limit: 10,
          status: leadStatus || undefined,
          company_size: leadCompanySize || undefined,
          timeline: leadTimeline || undefined,
          search: leadSearch || undefined,
        },
      });

      if (response.data?.success) {
        setLeads(response.data.data || []);
        setLeadTotalPages(response.data.pagination?.totalPages || 1);
        setLeadTotal(response.data.pagination?.total || 0);
      } else {
        setLeadsError(response.data?.message || "Failed to load enterprise leads.");
      }
    } catch (err) {
      console.error("Error loading leads:", err);
      setLeadsError(err.response?.data?.message || "Failed to load enterprise leads. Please make sure the server is running.");
    } finally {
      setLeadsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "enterprise") {
      fetchLeads();
    }
  }, [activeTab, leadPage, leadStatus, leadCompanySize, leadTimeline]);

  const handleLeadSearchSubmit = (e) => {
    e.preventDefault();
    setLeadPage(1);
    fetchLeads();
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // HELPERS & BADGES
  // ══════════════════════════════════════════════════════════════════════════════
  const getEnquiryStatusBadge = (statusVal) => {
    switch ((statusVal || "").toLowerCase()) {
      case "new":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            New
          </span>
        );
      case "read":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Read
          </span>
        );
      case "replied":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} className="text-emerald-500" />
            Replied
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700">
            {statusVal || "New"}
          </span>
        );
    }
  };

  const getLeadStatusBadge = (statusVal) => {
    switch ((statusVal || "").toLowerCase()) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending Review
          </span>
        );
      case "contacted":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Contacted
          </span>
        );
      case "negotiating":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            Negotiating
          </span>
        );
      case "converted":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Sparkles size={11} className="text-emerald-500" />
            Converted
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700">
            {statusVal || "Pending"}
          </span>
        );
    }
  };

  const getTimelineLabel = (timelineVal) => {
    if (timelineVal === "urgent") return "🔥 Urgent (< 1 month)";
    if (timelineVal === "1-3months") return "⏳ 1-3 Months";
    if (timelineVal === "exploring") return "🔍 Exploring";
    return timelineVal || "Standard";
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#125fe2] to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-200 text-white">
              {activeTab === "enterprise" ? <Sparkles size={18} /> : <HelpCircle size={18} />}
            </div>
            <span>Enquiries & Enterprise Leads</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 ml-11">
            Centralized hub for handling general public marketing contact requests and high-intent enterprise plan leads.
          </p>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => (activeTab === "enterprise" ? fetchLeads() : fetchEnquiries())}
            disabled={activeTab === "enterprise" ? leadsLoading : enquiriesLoading}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white hover:border-slate-300 transition shadow-xs"
          >
            <RefreshCw
              size={13}
              className={(activeTab === "enterprise" ? leadsLoading : enquiriesLoading) ? "animate-spin" : ""}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Segmented Tab Switcher (The 2 Core Fields) ── */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row gap-1.5 max-w-xl">
        <button
          onClick={() => handleTabChange("marketing")}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 ${
            activeTab === "marketing"
              ? "bg-white text-[#125fe2] shadow-sm border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Inbox size={16} className={activeTab === "marketing" ? "text-[#125fe2]" : "text-slate-400"} />
          <span>Marketing Enquiries</span>
          {enquiryTotal > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === "marketing" ? "bg-blue-50 text-[#125fe2]" : "bg-slate-200/80 text-slate-600"
              }`}
            >
              {enquiryTotal}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange("enterprise")}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 ${
            activeTab === "enterprise"
              ? "bg-white text-indigo-600 shadow-sm border border-slate-200/60"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          }`}
        >
          <Briefcase size={16} className={activeTab === "enterprise" ? "text-indigo-600" : "text-slate-400"} />
          <span>Enterprise Leads</span>
          {leadTotal > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === "enterprise" ? "bg-indigo-50 text-indigo-600" : "bg-slate-200/80 text-slate-600"
              }`}
            >
              {leadTotal}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 1: MARKETING ENQUIRIES
         ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "marketing" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Search & Filter Toolbar */}
          <div className="card border border-slate-100 p-4 bg-white rounded-2xl flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
            {/* Search */}
            <form onSubmit={handleEnquirySearchSubmit} className="relative w-full md:w-80">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search sender name, email, subject..."
                value={enquirySearch}
                onChange={(e) => setEnquirySearch(e.target.value)}
                className="w-full pl-10 pr-8 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#125fe2] focus:ring-2 focus:ring-blue-100 transition"
              />
              {enquirySearch && (
                <button
                  type="button"
                  onClick={() => {
                    setEnquirySearch("");
                    setEnquiryPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </form>

            {/* Filters */}
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                <Filter size={13} className="text-slate-400" />
                <span>Status:</span>
              </div>
              <select
                value={enquiryStatus}
                onChange={(e) => {
                  setEnquiryStatus(e.target.value);
                  setEnquiryPage(1);
                }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:border-[#125fe2] shadow-2xs"
              >
                <option value="">All Statuses</option>
                <option value="new">New (Unread)</option>
                <option value="read">Read</option>
                <option value="replied">Replied</option>
                <option value="closed">Closed</option>
              </select>

              {(enquirySearch || enquiryStatus) && (
                <button
                  onClick={() => {
                    setEnquirySearch("");
                    setEnquiryStatus("");
                    setEnquiryPage(1);
                  }}
                  className="text-xs text-[#125fe2] hover:underline font-semibold ml-2"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Table Card */}
          <div
            className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(18,95,226,0.05)" }}
          >
            {enquiriesError && (
              <div className="p-4 bg-rose-50 border-b border-rose-100 text-xs text-rose-600 font-medium flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{enquiriesError}</span>
              </div>
            )}

            <div className="overflow-x-auto min-h-[360px]">
              {enquiriesLoading ? (
                <div className="p-20 text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                    <RefreshCw className="w-6 h-6 text-[#125fe2] animate-spin" />
                  </div>
                  <p className="text-slate-700 font-semibold text-sm">Loading marketing enquiries...</p>
                </div>
              ) : enquiries.length === 0 ? (
                <div className="p-20 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <Inbox size={24} />
                  </div>
                  <p className="text-slate-700 font-semibold text-sm">No enquiries found</p>
                  <p className="text-slate-400 text-xs mt-1">No contact requests match your active filters.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-400 uppercase tracking-widest text-[10px] font-bold">
                      <th className="py-3.5 px-5">Sender / Contact</th>
                      <th className="py-3.5 px-5">Subject & Message Snippet</th>
                      <th className="py-3.5 px-5">Status</th>
                      <th className="py-3.5 px-5">Received On</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {enquiries.map((enquiry, idx) => (
                      <tr
                        key={enquiry.id}
                        className={`hover:bg-blue-50/20 transition-colors duration-100 group ${
                          idx % 2 === 1 ? "bg-slate-50/20" : "bg-white"
                        }`}
                      >
                        {/* Sender */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm shadow-blue-100">
                              {(enquiry.name || "U").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-xs leading-tight group-hover:text-[#125fe2] transition-colors">
                                {enquiry.name}
                              </p>
                              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Mail size={10} />
                                <span>{enquiry.email}</span>
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Subject & Message Preview */}
                        <td className="py-4 px-5 max-w-sm">
                          <p className="text-xs font-semibold text-slate-800 leading-snug">
                            {enquiry.subject || <span className="text-slate-400 italic font-normal">No subject</span>}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {enquiry.message || "—"}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-5">
                          {getEnquiryStatusBadge(enquiry.status)}
                        </td>

                        {/* Date */}
                        <td className="py-4 px-5 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <Calendar size={12} className="text-slate-400" />
                            <span>{new Date(enquiry.createdAt).toLocaleDateString()}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {new Date(enquiry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right">
                          <Link
                            to={`/dashboard/enquiries/${enquiry.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#125fe2] hover:bg-blue-50 text-slate-600 hover:text-[#125fe2] text-xs font-semibold transition"
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Footer */}
            {enquiryTotalPages > 1 && (
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
                <p>
                  Showing page <span className="font-semibold text-slate-700">{enquiryPage}</span> of{" "}
                  <span className="font-semibold text-slate-700">{enquiryTotalPages}</span> ({enquiryTotal} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEnquiryPage((prev) => Math.max(prev - 1, 1))}
                    disabled={enquiryPage === 1 || enquiriesLoading}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1"
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <button
                    onClick={() => setEnquiryPage((prev) => Math.min(prev + 1, enquiryTotalPages))}
                    disabled={enquiryPage === enquiryTotalPages || enquiriesLoading}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          SECTION 2: ENTERPRISE LEADS
         ══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === "enterprise" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Search & Filter Toolbar */}
          <div className="card border border-slate-100 p-4 bg-white rounded-2xl flex flex-col gap-3.5 shadow-xs">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              {/* Search */}
              <form onSubmit={handleLeadSearchSubmit} className="relative w-full md:w-80">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search company, contact name, email..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className="w-full pl-10 pr-8 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition"
                />
                {leadSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setLeadSearch("");
                      setLeadPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </form>

              <button
                onClick={fetchLeads}
                className="w-full md:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
              >
                Apply Filters
              </button>
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Lead Status
                </label>
                <select
                  value={leadStatus}
                  onChange={(e) => {
                    setLeadStatus(e.target.value);
                    setLeadPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:border-indigo-600"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending Review</option>
                  <option value="contacted">Contacted</option>
                  <option value="negotiating">Negotiating</option>
                  <option value="converted">Converted to Enterprise</option>
                  <option value="rejected">Rejected / Ineligible</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Company Size
                </label>
                <select
                  value={leadCompanySize}
                  onChange={(e) => {
                    setLeadCompanySize(e.target.value);
                    setLeadPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:border-indigo-600"
                >
                  <option value="">All Company Sizes</option>
                  <option value="1-10">1-10 Employees</option>
                  <option value="11-50">11-50 Employees</option>
                  <option value="51-200">51-200 Employees</option>
                  <option value="201-500">201-500 Employees</option>
                  <option value="500+">500+ Employees</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Deployment Timeline
                </label>
                <select
                  value={leadTimeline}
                  onChange={(e) => {
                    setLeadTimeline(e.target.value);
                    setLeadPage(1);
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 focus:outline-none focus:border-indigo-600"
                >
                  <option value="">All Timelines</option>
                  <option value="urgent">Urgent (&lt; 1 month)</option>
                  <option value="1-3months">1-3 Months</option>
                  <option value="exploring">Just Exploring</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Card */}
          <div
            className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(99,102,241,0.05)" }}
          >
            {leadsError && (
              <div className="p-4 bg-rose-50 border-b border-rose-100 text-xs text-rose-600 font-medium flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{leadsError}</span>
              </div>
            )}

            <div className="overflow-x-auto min-h-[360px]">
              {leadsLoading ? (
                <div className="p-20 text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                    <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                  </div>
                  <p className="text-slate-700 font-semibold text-sm">Loading enterprise leads...</p>
                </div>
              ) : leads.length === 0 ? (
                <div className="p-20 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <Briefcase size={24} />
                  </div>
                  <p className="text-slate-700 font-semibold text-sm">No enterprise leads found</p>
                  <p className="text-slate-400 text-xs mt-1">No custom enterprise inquiries match your current filters.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[950px]">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-400 uppercase tracking-widest text-[10px] font-bold">
                      <th className="py-3.5 px-5">Company & Contact</th>
                      <th className="py-3.5 px-5">Work Contact</th>
                      <th className="py-3.5 px-5">Size & Urgency</th>
                      <th className="py-3.5 px-5">Status</th>
                      <th className="py-3.5 px-5">Registered</th>
                      <th className="py-3.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {leads.map((lead, idx) => (
                      <tr
                        key={lead.id}
                        className={`hover:bg-indigo-50/20 transition-colors duration-100 group ${
                          idx % 2 === 1 ? "bg-slate-50/20" : "bg-white"
                        }`}
                      >
                        {/* Company & Contact */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm shadow-indigo-100">
                              {(lead.companyName || lead.name || "E").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-xs leading-tight group-hover:text-indigo-600 transition-colors">
                                {lead.companyName || "Enterprise Lead"}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Contact: <span className="font-medium text-slate-700">{lead.name}</span>
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Contact details */}
                        <td className="py-4 px-5">
                          <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                            <Mail size={11} className="text-slate-400" />
                            <span>{lead.email}</span>
                          </p>
                          {lead.phone && (
                            <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <Phone size={10} />
                              <span>{lead.phone}</span>
                            </p>
                          )}
                        </td>

                        {/* Size & Urgency */}
                        <td className="py-4 px-5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            <Users2 size={11} className="text-slate-400" />
                            <span>{lead.companySize ? `${lead.companySize} employees` : "Size not set"}</span>
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-1">
                            {getTimelineLabel(lead.timeline)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-5">
                          {getLeadStatusBadge(lead.status)}
                        </td>

                        {/* Date */}
                        <td className="py-4 px-5 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <Calendar size={12} className="text-slate-400" />
                            <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {new Date(lead.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right">
                          <Link
                            to={`/dashboard/enterprise-leads/${lead.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-600 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-xs font-semibold transition"
                          >
                            <Eye size={13} />
                            <span>Review</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Footer */}
            {leadTotalPages > 1 && (
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
                <p>
                  Showing page <span className="font-semibold text-slate-700">{leadPage}</span> of{" "}
                  <span className="font-semibold text-slate-700">{leadTotalPages}</span> ({leadTotal} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLeadPage((prev) => Math.max(prev - 1, 1))}
                    disabled={leadPage === 1 || leadsLoading}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1"
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <button
                    onClick={() => setLeadPage((prev) => Math.min(prev + 1, leadTotalPages))}
                    disabled={leadPage === leadTotalPages || leadsLoading}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-semibold disabled:opacity-40 hover:bg-slate-50 flex items-center gap-1"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
