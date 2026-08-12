import React, { useEffect, useState } from "react";
import { CreditCard, Calendar, AlertTriangle, ArrowRight, Download, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/axios";
import CancelSubscriptionModal from "./CancelSubscriptionModal";

export default function BillingPage() {
  const [billingData, setBillingData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, invoiceRes] = await Promise.all([
        api.get("/billing"),
        api.get(`/billing/invoices?page=${page}&limit=10`)
      ]);
      setBillingData(overviewRes.data.data);
      setInvoices(invoiceRes.data.data.invoices);
      setTotalPages(invoiceRes.data.data.totalPages);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load billing information.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page]);

  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      const res = await api.post("/billing/reactivate");
      if (res.data.success) {
        fetchData();
      } else {
        alert(res.data.message || "Failed to reactivate.");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Error reactivating subscription.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownload = async (invoiceId, invoiceNumber) => {
    try {
      const response = await api.get(`/billing/invoices/${invoiceId}/download`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${invoiceNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download PDF invoice.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600" />
      </div>
    );
  }

  const { subscriptionStatus, currentPlan, planPeriodEnd, dataDeletionDate } = billingData || {};

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Subscription Plan</span>
              {subscriptionStatus === 'active' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Plan
                </span>
              )}
              {subscriptionStatus === 'cancel_at_period_end' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Cancelling
                </span>
              )}
              {subscriptionStatus === 'expired' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  Expired
                </span>
              )}
              {subscriptionStatus === 'paused' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Paused
                </span>
              )}
            </div>

            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">{currentPlan || "Starter"} Plan</h2>

            {subscriptionStatus === 'active' && planPeriodEnd && (
              <p className="text-sm text-slate-500 font-medium">
                Next billing date: <strong>{new Date(planPeriodEnd).toLocaleDateString()}</strong>
              </p>
            )}

            {subscriptionStatus === 'cancel_at_period_end' && planPeriodEnd && (
              <div className="flex items-center gap-2 text-sm text-amber-700 font-semibold bg-amber-50/50 rounded-xl px-4 py-2 border border-amber-100/50">
                <Calendar size={16} />
                <span>Your subscription features will end on {new Date(planPeriodEnd).toLocaleDateString()}</span>
              </div>
            )}

            {subscriptionStatus === 'expired' && planPeriodEnd && (
              <div className="space-y-2">
                <p className="text-sm text-red-600 font-bold">
                  Your plan expired on {new Date(planPeriodEnd).toLocaleDateString()}
                </p>
                {dataDeletionDate && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl p-3.5">
                    <AlertTriangle size={15} />
                    <span>Warning: Under data policies, your workspace details will be permanently deleted on {new Date(dataDeletionDate).toLocaleDateString()}.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 flex items-center">
            {subscriptionStatus === 'active' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition"
              >
                Cancel Subscription
              </button>
            )}
            {subscriptionStatus === 'cancel_at_period_end' && (
              <button
                onClick={handleReactivate}
                disabled={actionLoading}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-sm font-bold text-white transition"
              >
                {actionLoading ? "Reactivating..." : "Reactivate Subscription"}
              </button>
            )}
            {subscriptionStatus === 'expired' && (
              <button
                onClick={() => navigate("/plans")}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-bold text-white transition flex items-center justify-center gap-2"
              >
                Resubscribe Now <ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="text-blue-600" size={20} />
            <h3 className="font-bold text-slate-800">Invoice History</h3>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">
            No invoices found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Invoice #</th>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Plan</th>
                  <th className="py-4 px-6">Amount</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="text-sm font-medium text-slate-700 hover:bg-slate-50/50 transition">
                    <td className="py-4.5 px-6 font-semibold">{invoice.invoiceNumber}</td>
                    <td className="py-4.5 px-6 text-slate-500">{new Date(invoice.createdAt).toLocaleDateString()}</td>
                    <td className="py-4.5 px-6">{invoice.planName}</td>
                    <td className="py-4.5 px-6">{invoice.currency} {invoice.amount}</td>
                    <td className="py-4.5 px-6">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Paid
                      </span>
                    </td>
                    <td className="py-4.5 px-6 text-right">
                      <button
                        onClick={() => handleDownload(invoice.id, invoice.invoiceNumber)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline px-3 py-1.5 rounded-lg hover:bg-blue-50 transition"
                      >
                        <Download size={13} />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-slate-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <CancelSubscriptionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        planName={currentPlan || "Starter"}
        periodEndDate={planPeriodEnd}
        onSuccess={fetchData}
      />
    </div>
  );
}