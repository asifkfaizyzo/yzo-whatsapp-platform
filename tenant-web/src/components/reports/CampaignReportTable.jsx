// tenant-web/src/components/reports/CampaignReportTable.jsx

import React from "react";
import { Send, ChevronLeft, ChevronRight } from "lucide-react";

export default function CampaignReportTable({
  campaigns = [],
  page = 1,
  totalPages = 1,
  onPageChange
}) {
  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case "COMPLETED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "PROCESSING":
      case "ACTIVE":
        return "bg-blue-50 text-blue-700 border-blue-200 animate-pulse";
      case "SCHEDULED":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "FAILED":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="card border border-slate-200 bg-white rounded-xl shadow-xs overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Send size={18} className="text-[#125EF2]" />
            <span>Broadcast Campaign Performance</span>
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Individual delivery metrics and open performance per campaign
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Campaign Name</th>
              <th className="py-3 px-4">Sent Date</th>
              <th className="py-3 px-4">Recipients</th>
              <th className="py-3 px-4">Delivered</th>
              <th className="py-3 px-4">Read</th>
              <th className="py-3 px-4">Reply</th>
              <th className="py-3 px-4">Failed</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                  No broadcast campaigns found in selected period
                </td>
              </tr>
            ) : (
              campaigns.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-3 px-4 font-bold text-slate-800">{row.name}</td>
                  <td className="py-3 px-4 text-slate-500">{row.sentDate}</td>
                  <td className="py-3 px-4 font-medium text-slate-700">{row.recipients.toLocaleString()}</td>
                  <td className="py-3 px-4 font-semibold text-blue-600">{row.deliveredPct}</td>
                  <td className="py-3 px-4 font-semibold text-indigo-600">{row.readPct}</td>
                  <td className="py-3 px-4 font-semibold text-emerald-600">{row.replyPct}</td>
                  <td className={`py-3 px-4 font-semibold ${row.failed > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {row.failed}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getStatusBadge(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Controls */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
        <span>Showing Page <strong>{page}</strong> of <strong>{totalPages || 1}</strong></span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="p-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}