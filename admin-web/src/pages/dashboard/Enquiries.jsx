import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { HelpCircle, Search, Filter, Eye, ArrowLeft, ArrowRight } from "lucide-react";
import api from "../../lib/axios";

export default function Enquiries() {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchEnquiries = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/admin/enquiries", {
        params: {
          page,
          limit: 10,
          status: status || undefined,
          search: search || undefined,
        },
      });

      if (response.data.success) {
        setEnquiries(response.data.data);
        setTotalPages(response.data.pagination.totalPages);
        setTotal(response.data.pagination.total);
      } else {
        setError(response.data.message || "Failed to load enquiries.");
      }
    } catch (err) {
      console.error("Error loading enquiries:", err);
      setError(err.response?.data?.message || "Failed to load enquiries. Please make sure the server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();
  }, [page, status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchEnquiries();
  };

  const getStatusBadge = (statusVal) => {
    switch (statusVal) {
      case "new":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider animate-pulse">
            New
          </span>
        );
      case "read":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wider">
            Read
          </span>
        );
      case "replied":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800 border border-green-200 uppercase tracking-wider">
            Replied
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-wider">
            Closed
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HelpCircle className="text-[#125EF2]" size={24} />
            <span>Marketing Enquiries</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage contact form submissions from anonymous visitors on the public marketing site.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card border border-slate-100 p-4 bg-white rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
          />
          <div className="absolute left-3.5 top-2.5 text-slate-400">
            <Search size={16} />
          </div>
          <button type="submit" className="hidden">Search</button>
        </form>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
            <Filter size={16} />
            <span>Status:</span>
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Enquiries Table Card */}
      <div className="card border border-slate-100 bg-white rounded-2xl shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-100 text-sm text-red-600">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
            <span className="text-sm">Loading enquiries...</span>
          </div>
        ) : enquiries.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-4xl">📬</span>
            <h3 className="mt-4 text-lg font-bold text-slate-700">No enquiries found</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto">
              There are no submissions matching your filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-slate-400 font-bold border-b border-slate-100 bg-slate-50/50">
                  <th className="py-3.5 px-6 font-semibold w-16">#</th>
                  <th className="py-3.5 px-4 font-semibold">Name</th>
                  <th className="py-3.5 px-4 font-semibold">Email</th>
                  <th className="py-3.5 px-4 font-semibold">Subject</th>
                  <th className="py-3.5 px-4 font-semibold">Date Submitted</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {enquiries.map((enquiry, index) => {
                  const isNew = enquiry.status === "new";
                  return (
                    <tr
                      key={enquiry.id}
                      className={`transition group ${
                        isNew ? "bg-blue-50/20 font-medium hover:bg-blue-50/40" : "hover:bg-slate-50/50"
                      }`}
                    >
                      <td className="py-4 px-6 text-slate-500">{(page - 1) * 10 + index + 1}</td>
                      <td className="py-4 px-4 text-slate-800">
                        <span className="flex items-center gap-2">
                          {enquiry.name}
                          {isNew && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 inline-block animate-ping" />
                          )}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-600">{enquiry.email}</td>
                      <td className="py-4 px-4 text-slate-600 truncate max-w-[200px]" title={enquiry.subject || "No Subject"}>
                        {enquiry.subject || <span className="text-slate-400 italic">No Subject</span>}
                      </td>
                      <td className="py-4 px-4 text-slate-500">
                        {new Date(enquiry.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(enquiry.status)}</td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          to={`/dashboard/enquiries/${enquiry.id}`}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-semibold rounded-xl text-xs transition-all"
                        >
                          <Eye size={14} />
                          <span>View</span>
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
