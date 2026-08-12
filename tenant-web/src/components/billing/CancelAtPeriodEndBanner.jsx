import React from "react";
import { Info } from "lucide-react";

export default function CancelAtPeriodEndBanner({ periodEndDate, onReactivate }) {
  const formatDate = (dateVal) => {
    if (!dateVal || dateVal === "N/A") return "—";
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  };

  return (
    <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Info className="text-amber-500 shrink-0" size={20} />
        <div>
          <p className="text-sm font-bold text-amber-900">Subscription scheduled to end</p>
          <p className="text-xs text-amber-700">All services will terminate on <strong>{formatDate(periodEndDate)}</strong>.</p>
        </div>
      </div>
      <button
        onClick={onReactivate}
        className="shrink-0 px-4.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs font-bold text-white transition"
      >
        Reactivate Subscription
      </button>
    </div>
  );
}