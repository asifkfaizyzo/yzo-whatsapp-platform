import React from "react";
import { AlertOctagon, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ExpiredSubscriptionBanner({ expiredDate, dataDeletionDate }) {
  const navigate = useNavigate();

  if (!expiredDate) return null;

  const formatDate = (dateVal) => {
    if (!dateVal || dateVal === "N/A") return "—";
    const d = new Date(dateVal);
    return isNaN(d.getTime())
      ? "—"
      : d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  };

  return (
    <div className="w-full bg-red-600 text-white px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-700 shadow-xs shrink-0 z-30">
      <div className="flex items-center gap-3">
        <div className="shrink-0 p-1.5 bg-red-700/80 rounded-xl border border-red-500/60 shadow-2xs">
          <AlertOctagon size={18} />
        </div>
        <div>
          <p className="text-xs sm:text-sm font-bold leading-tight text-white">
            Your SudoReply subscription has expired ({formatDate(expiredDate)}).
          </p>
          {dataDeletionDate && (
            <p className="text-[11px] text-red-100 font-medium mt-0.5">
              ⚠️ Warning: Complete resubscription before {formatDate(dataDeletionDate)} to retain your configured bots and data.
            </p>
          )}
        </div>
      </div>
      <button
        onClick={() => navigate("/select-plan?upgrade=true")}
        className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-red-50 text-xs font-extrabold text-red-600 transition shadow-sm self-start sm:self-auto cursor-pointer"
      >
        <span>Resubscribe Now</span>
        <ArrowRight size={13} />
      </button>
    </div>
  );
}