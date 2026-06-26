import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  limit,
  onPageChange,
  onLimitChange,
  itemName = "items"
}) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalItems);

  // Generate numbered list with ellipsis truncation (e.g. 1, 2, ..., 15)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1); // Always show first page

      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 2) {
        end = 4;
      } else if (currentPage >= totalPages - 1) {
        start = totalPages - 3;
      }

      if (start > 2) {
        pages.push("...");
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 1) {
        pages.push("...");
      }

      pages.push(totalPages); // Always show last page
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/20 text-xs text-slate-500">
      {/* Show record scale text */}
      <div className="flex items-center gap-4">
        <span>
          Showing <span className="font-semibold text-slate-800">{startItem}</span> to{" "}
          <span className="font-semibold text-slate-800">{endItem}</span> of{" "}
          <span className="font-semibold text-slate-800">{totalItems}</span> {itemName}
        </span>
        
        {/* Limit Dropdown selector */}
        {onLimitChange && (
          <div className="flex items-center gap-1.5">
            <span>Show:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 outline-none focus:border-[#125EF2] cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        )}
      </div>

      {/* Pages Switch Buttons */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition"
          title="Previous Page"
        >
          <ChevronLeft size={14} />
        </button>

        {getPageNumbers().map((p, idx) => {
          if (p === "...") {
            return <span key={`ell-${idx}`} className="px-2 py-1 text-slate-400">...</span>;
          }
          return (
            <button
              key={`pg-${p}`}
              type="button"
              onClick={() => onPageChange(p)}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                currentPage === p
                  ? "bg-[#125EF2] text-white shadow-sm font-bold"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition"
          title="Next Page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
