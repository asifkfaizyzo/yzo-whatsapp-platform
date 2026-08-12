import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Search, Filter, Eye, ArrowLeft, ArrowRight } from "lucide-react";
import api from "../../lib/axios";

export default function EnterpriseLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [timeline, setTimeline] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLeads = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/admin/enterprise-leads", {
        params: {
          page,
          limit: 10,
          status: status || undefined,
          company_size: companySize || undefined,
          timeline: timeline || undefined,
          search: search || undefined,
        },
      });

      if (response.data.success) {
        setLeads(response.data.data);
        setTotalPages(response.data.pagination.totalPages);
        setTotal(response.data.pagination.total);
      } else {
        setError(response.data.message || "Failed to load enterprise leads.");
      }
    } catch (err) {
      console.error("Error loading leads:", err);
      setError(err.response?.data?.message || "Failed to load enterprise leads. Please make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [page, status, companySize, timeline]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLeads();
  };

  const getStatusBadge = (statusVal) => {
    switch (statusVal) {
      case "pending":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider animate-pulse">
            Pending
          </span>
        );
      case "contacted":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider">
            Contacted
          </span>
        );
      case "negotiating":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
            Negotiating
          </span>
        );
      case "converted":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800 border border-green-200 uppercase tracking-wider">
            Converted
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-800 border border-red-200 uppercase tracking-wider">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-800">
            {statusVal}
          </span>
        );
    }
  };

  const getTimelineLabel = (timelineVal) => {
    if (timelineVal === "urgent") return "Urgent";
    if (timelineVal === "1-3months") return "1-3 Months";
    if (timelineVal === "exploring") return "Just Exploring";
    return timelineVal;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="text-[#125EF2]" size={24} />
          <span>Enterprise Onboarding Leads</span>
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          High-intent leads who completed onboarding registration and chose the Enterprise Plan.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="card border border-slate-100 p-5 bg-white rounded-2xl flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
            <input
              type="text"
              placeholder="Search company, name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
            />
            <div className="absolute left-3.5 top-2.5 text-slate-400">
              <Search size={16} />
            </div>
            <button type="submit" className="hidden">Search</button>
          </form>

          {/* Action to trigger quick search */}
          <button
            onClick={fetchLeads}
            className="w-full md:w-auto px-4 py-2 bg-slate-900 hover:bg-gray-800 text-white rounded-xl text-sm font-semibold transition"
          >
            Apply Filters
          </button>
        </div>

        {/* Filters Select Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          {/* Status Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-slate-400 font-bold uppercase">Status</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="contacted">Contacted</option>
              <option value="negotiating">Negotiating</option>
              <option value="converted">Converted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Size Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-slate-400 font-bold uppercase">Company Size</span>
            <select
              value={companySize}
              onChange={(e) => {
                setCompanySize(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sizes</option>
              <option value="1-10">1-10 Employees</option>
              <option value="11-50">11-50 Employees</option>
              <option value="51-200">51-200 Employees</option>
              <option value="200+">200+ Employees</option>
            </select>
          </div>

          {/* Timeline Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-slate-400 font-bold uppercase">Timeline</span>
            <select
              value={timeline}
              onChange={(e) => {
                setTimeline(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Timelines</option>
              <option value="urgent">Urgent</option>
              <option value="1-3months">1-3 Months</option>
              <option value="exploring">Just Exploring</option>
            </select>
          </div>
        </div>
      </div>

      {/* Leads Table Card */}
      <div className="card border border-slate-100 bg-white rounded-2xl shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-100 text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
            <span className="text-sm">Loading enterprise leads...</span>
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-4xl">💼</span>
            <h3 className="mt-4 text-lg font-bold text-slate-700">No leads found</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
              There are no sales leads matching your selection criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-slate-400 font-bold border-b border-slate-100 bg-slate-50/50">
                  <th className="py-3.5 px-6 font-semibold w-16">#</th>
                  <th className="py-3.5 px-4 font-semibold">Company</th>
                  <th className="py-3.5 px-4 font-semibold">Contact Name</th>
                  <th className="py-3.5 px-4 font-semibold">Email</th>
                  <th className="py-3.5 px-4 font-semibold">Size</th>
                  <th className="py-3.5 px-4 font-semibold">Timeline</th>
                  <th className="py-3.5 px-4 font-semibold">Submitted Date</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {leads.map((lead, index) => {
                  const isPending = lead.status === "pending";
                  return (
                    <tr
                      key={lead.id}
                      className={`transition group ${
                        isPending ? "bg-amber-50/10 font-medium hover:bg-amber-50/20" : "hover:bg-slate-50/50"
                      }`}
                    >
                      <td className="py-4 px-6 text-slate-500">{(page - 1) * 10 + index + 1}</td>
                      <td className="py-4 px-4 text-slate-800">
                        <span className="flex items-center gap-2">
                          <strong>{lead.companyName}</strong>
                          {isPending && (
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block animate-ping" />
                          )}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-700">{lead.contactName}</td>
                      <td className="py-4 px-4 text-slate-600">{lead.email}</td>
                      <td className="py-4 px-4 text-slate-600 font-medium">{lead.companySize}</td>
                      <td className="py-4 px-4 text-slate-600">{getTimelineLabel(lead.timeline)}</td>
                      <td className="py-4 px-4 text-slate-500">
                        {new Date(lead.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(lead.status)}</td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          to={`/dashboard/enterprise-leads/${lead.id}`}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-semibold rounded-xl text-xs transition-all"
                        >
                          <Eye size={14} />
                          <span>View Details</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/30">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold">{(page - 1) * 10 + 1}</span> to{" "}
              <span className="font-semibold">{Math.min(page * 10, total)}</span> of{" "}
              <span className="font-semibold">{total}</span> results
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={page === totalPages}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
