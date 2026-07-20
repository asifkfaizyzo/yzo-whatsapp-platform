import React from "react";
import { AlertOctagon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ExpiredSubscriptionBanner({ expiredDate, dataDeletionDate }) {
  const navigate = useNavigate();

  const formatDate = (dateVal) => {
    if (!dateVal || dateVal === "N/A") return "—";
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  };

  return (
    <div className="bg-red-600 text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-red-700 shadow-md">
      <div className="flex items-center gap-3.5">
        <div className="shrink-0 p-1.5 bg-red-700/60 rounded-xl border border-red-500">
          <AlertOctagon size={20} />
        </div>
        <div>
          <p className="text-sm font-bold leading-snug">
            Your SudoReply subscription expired on {formatDate(expiredDate)}.
          </p>
          {dataDeletionDate && (
            <p className="text-[11px] text-red-100 font-medium">
              ⚠️ Warning: Complete resubscription before {formatDate(dataDeletionDate)} to prevent permanent data deletion.
            </p>
          )}
        </div>
      </div>
      <button
        onClick={() => navigate("/plans")}
        className="shrink-0 px-4 py-2 rounded-xl bg-white hover:bg-red-50 text-xs font-extrabold text-red-600 transition"
      >
        Resubscribe Now
      </button>
    </div>
  );
}