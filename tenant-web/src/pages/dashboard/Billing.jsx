// src/pages/dashboard/Billing.jsx
import React, { useEffect, useState } from "react";
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Zap,
  RefreshCw,
  Receipt,
  BadgeIndianRupee,
  ArrowUpRight,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getBillingDetails, downloadInvoice } from "../../services/billing.service";
import api from "../../lib/axios";
import CancelSubscriptionModal from "../../components/billing/CancelSubscriptionModal";
import SubscriptionExpiryBanner from "../../components/billing/SubscriptionExpiryBanner";
import { createPortal } from "react-dom";

// ── Helper: Format currency ──
const formatINR = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
};

// ── Helper: Format date ──
const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ── Helper: Payment status badge ──
const StatusBadge = ({ status }) => {
  const map = {
    SUCCESS: {
      label: "Paid",
      className: "bg-emerald-50 text-emerald-700 border border-emerald-100",
      icon: <CheckCircle2 size={11} />,
    },
    PENDING: {
      label: "Pending",
      className: "bg-amber-50 text-amber-700 border border-amber-100",
      icon: <Clock size={11} />,
    },
    FAILED: {
      label: "Failed",
      className: "bg-red-50 text-red-600 border border-red-100",
      icon: <AlertCircle size={11} />,
    },
  };
  const config = map[status] || map.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
};

// ── Helper: Plan status badge ──
const PlanStatusBadge = ({ status }) => {
  const map = {
    active: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    cancel_at_period_end: "bg-amber-50 text-amber-700 border border-amber-100",
    inactive: "bg-slate-100 text-slate-500 border border-slate-200",
    expired: "bg-red-50 text-red-600 border border-red-100",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${map[status] || map.inactive
        }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "active" 
            ? "bg-emerald-500 animate-pulse" 
            : status === "cancel_at_period_end" 
            ? "bg-amber-500 animate-pulse" 
            : "bg-slate-400"
        }`}
      />
      {status === "active"
        ? "Active"
        : status === "cancel_at_period_end"
          ? "Cancelling"
          : status === "expired"
            ? "Expired"
            : "Inactive"}
    </span>
  );
};

// ══════════════════════════════════════════
// Payment Row (expandable)
// ══════════════════════════════════════════
const PaymentRow = ({ payment, index }) => {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const cgst = parseFloat((payment.gstAmount / 2).toFixed(2));
  const sgst = parseFloat((payment.gstAmount / 2).toFixed(2));

  const handleDownloadInvoice = async () => {
    setDownloading(true);
    try {
      const res = await downloadInvoice(payment.id);
      if (res.success) {
        window.open(res.data.invoiceUrl, "_blank");
      } else {
        alert(res.message || "Failed to download invoice");
      }
    } catch (err) {
      alert("Failed to download invoice");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {/* Main Row */}
      <tr
        className={`hover:bg-slate-50/60 transition cursor-pointer ${expanded ? "bg-slate-50" : ""
          }`}
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-5 py-4 text-sm text-slate-600 font-medium whitespace-nowrap">
          {formatDate(payment.paidAt || payment.createdAt)}
        </td>
        <td className="px-5 py-4">
          <div className="text-sm font-semibold text-slate-800">
            {payment.planName}
          </div>
          <div className="text-xs text-slate-400 mt-0.5 capitalize">
            {payment.billingType} billing
          </div>
        </td>
        <td className="px-5 py-4 text-sm font-bold text-slate-800 whitespace-nowrap">
          {formatINR(payment.totalAmount)}
        </td>
        <td className="px-5 py-4">
          <span className="text-xs font-semibold text-slate-500 capitalize bg-slate-100 px-2 py-1 rounded-lg">
            {payment.paymentMethod || "—"}
          </span>
        </td>
        <td className="px-5 py-4">
          <StatusBadge status={payment.status} />
        </td>
        <td className="px-5 py-4 text-right">
          <button className="p-1.5 hover:bg-slate-200 rounded-lg transition text-slate-400">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>
      </tr>

      {/* Expanded Detail Row */}
      {expanded && (
        <tr className="bg-[#EAF2FE]/30">
          <td colSpan={6} className="px-5 py-5">
            <div className="flex flex-col sm:flex-row gap-6">

              {/* Amount Breakdown */}
              <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Amount Breakdown
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">
                      {payment.planName} ({payment.billingType})
                    </span>
                    <span className="font-semibold text-slate-700">
                      {formatINR(payment.baseAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">CGST (9%)</span>
                    <span className="font-semibold text-slate-700">
                      {formatINR(cgst)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">SGST (9%)</span>
                    <span className="font-semibold text-slate-700">
                      {formatINR(sgst)}
                    </span>
                  </div>
                  <div className="border-t border-slate-100 pt-2 flex justify-between">
                    <span className="font-bold text-slate-800">Total Paid</span>
                    <span className="font-bold text-[#125EF2]">
                      {formatINR(payment.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Transaction Details
                </p>
                <div className="space-y-2.5 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-400 font-semibold">Payment ID</span>
                    <span className="font-mono text-slate-700 text-[11px] bg-slate-50 px-2 py-1 rounded-lg break-all">
                      {payment.razorpayPaymentId || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-400 font-semibold">Order ID</span>
                    <span className="font-mono text-slate-700 text-[11px] bg-slate-50 px-2 py-1 rounded-lg break-all">
                      {payment.razorpayOrderId || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Payment Method</span>
                    <span className="font-semibold text-slate-700 capitalize">
                      {payment.paymentMethod || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Currency</span>
                    <span className="font-semibold text-slate-700">
                      {payment.currency}
                    </span>
                  </div>
                </div>

                {/* Download Invoice Button */}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadInvoice();
                    }}
                    disabled={downloading || payment.status !== "SUCCESS"}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${downloading || payment.status !== "SUCCESS"
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-[#125EF2] text-white hover:bg-[#0d4fd6] shadow-sm"
                      }`}
                  >
                    {downloading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Receipt size={14} />
                        Download Invoice
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ══════════════════════════════════════════
// MAIN BILLING PAGE COMPONENT
// ══════════════════════════════════════════
export default function Billing() {
  const [billingData, setBillingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isReactivateModalOpen, setIsReactivateModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBilling = async () => {
    setLoading(true);
    setError(null);
    const res = await getBillingDetails();
    if (res.success) {
      setBillingData(res.data);
    } else {
      setError(res.message);
    }
    setLoading(false);
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      const res = await api.post("/billing/reactivate");
      if (res.data.success) {
        fetchBilling();
      } else {
        alert(res.data.message || "Failed to reactivate");
      }
    } catch (err) {
      alert("Error reactivating subscription");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="h-8 w-48 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-44 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
          <AlertCircle className="text-red-500" size={32} />
        </div>
        <p className="text-sm font-semibold text-slate-600">{error}</p>
        <button
          onClick={fetchBilling}
          className="flex items-center gap-2 px-4 py-2 bg-[#125EF2] text-white text-sm font-semibold rounded-xl hover:bg-[#0d4fd6] transition"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  const { currentPlan, payments } = billingData;

  const successPayments = payments.filter((p) => p.status === "SUCCESS");
  const totalSpent = successPayments.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalGstPaid = successPayments.reduce((sum, p) => sum + p.gstAmount, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Billing & Payments
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Manage your subscription and view payment history
          </p>
        </div>
        <button
          onClick={fetchBilling}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition border border-slate-200"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Cancellation Pending Banner */}
      {currentPlan && currentPlan.subscriptionStatus === 'cancel_at_period_end' && (
        <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-100 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-amber-500 shrink-0" size={20} />
            <div>
              <p className="text-sm font-bold text-amber-900">Subscription scheduled to end</p>
              <p className="text-xs text-amber-700">
                All services will terminate on <strong>{formatDate(currentPlan.planPeriodEnd)}</strong>. You can reactivate anytime before then.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsReactivateModalOpen(true)}
            disabled={actionLoading}
            className="shrink-0 px-4.5 py-2 rounded-xl bg-[#d97706] hover:bg-[#b45309] text-xs font-bold text-white transition disabled:opacity-50"
          >
            {actionLoading ? "Reactivating..." : "Reactivate Subscription"}
          </button>
        </div>
      )}

      {/* Subscription Expiry Alert Banner */}
      {currentPlan && (
        <SubscriptionExpiryBanner
          planPeriodEnd={currentPlan.planPeriodEnd}
          subscriptionStatus={currentPlan.subscriptionStatus}
        />
      )}

      {/* Current Plan Card */}
      {currentPlan ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#CFE0FD] bg-gradient-to-r from-[#EAF2FE] via-white to-blue-50 p-6 shadow-sm">
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-[#125EF2]/5 pointer-events-none" />
          <div className="absolute bottom-0 left-32 w-24 h-24 rounded-full bg-blue-100/30 pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-[#125EF2] shadow-md shrink-0">
                <Zap size={22} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl font-extrabold text-slate-800">
                    {currentPlan.name}
                  </h2>
                  <PlanStatusBadge status={currentPlan.subscriptionStatus} />
                  <span className="text-xs font-bold bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full capitalize">
                    {currentPlan.billingType}
                  </span>
                </div>
                {currentPlan.description && (
                  <p className="text-xs text-slate-500 font-medium mt-1 max-w-sm">
                    {currentPlan.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                    <Calendar size={13} className="text-[#125EF2]" />
                    <span>Activated: {formatDate(currentPlan.activatedAt)}</span>
                  </div>
                  {currentPlan.nextRenewalDate && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                      <RefreshCw size={13} className="text-[#125EF2]" />
                      <span>
                        {currentPlan.subscriptionStatus === 'cancel_at_period_end' ? "Ends" : "Renews"}: {formatDate(currentPlan.nextRenewalDate)}
                      </span>
                    </div>
                  )}
                  {currentPlan.maxAgents && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
                      <CheckCircle2 size={13} className="text-emerald-500" />
                      <span>Up to {currentPlan.maxAgents} agents</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3 shrink-0">
              {currentPlan.price && (
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-slate-800">
                    {formatINR(currentPlan.price.total)}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {formatINR(currentPlan.price.base)} + 18% GST /{" "}
                    {currentPlan.billingType === "annual" ? "year" : "month"}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 justify-end">
                {currentPlan.subscriptionStatus === 'active' && (
                  <button
                    onClick={() => setIsCancelModalOpen(true)}
                    className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition shadow-sm"
                  >
                    Cancel Subscription
                  </button>
                )}

                {currentPlan.id === "enterprise" ? (
                  <Link
                    to="/select-plan?upgrade=true"
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-850 transition shadow-sm"
                  >
                    <RefreshCw size={13} />
                    Change Plan
                  </Link>
                ) : (
                  <Link
                    to="/select-plan?upgrade=true"
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-[#125EF2] text-white hover:bg-[#0d4fd6] transition shadow-sm"
                  >
                    <ArrowUpRight size={13} />
                    Upgrade Plan
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 mb-4">
            <CreditCard size={26} className="text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-slate-700">No Active Plan</h3>
          <p className="text-sm text-slate-400 font-medium mt-1 max-w-xs mx-auto">
            You haven't selected a subscription plan yet. Choose a plan to get started.
          </p>
          <Link
            to="/select-plan"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-[#125EF2] text-white text-sm font-bold rounded-xl hover:bg-[#0d4fd6] transition shadow-sm"
          >
            <Zap size={15} />
            Select a Plan
          </Link>
        </div>
      )}

      {/* Summary Stats */}
      {successPayments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card p-5 border border-slate-100 bg-white flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total Payments
              </span>
              <div className="p-2 rounded-xl bg-[#EAF2FE] border border-[#CFE0FD]">
                <Receipt size={16} className="text-[#125EF2]" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-slate-800">
                {successPayments.length}
              </span>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                Successful transactions
              </p>
            </div>
          </div>

          <div className="card p-5 border border-slate-100 bg-white flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total Spent
              </span>
              <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
                <BadgeIndianRupee size={16} className="text-blue-600" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-slate-800">
                {formatINR(totalSpent)}
              </span>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                Lifetime payments made
              </p>
            </div>
          </div>

          <div className="card p-5 border border-slate-100 bg-white flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                GST Paid
              </span>
              <div className="p-2 rounded-xl bg-purple-50 border border-purple-100">
                <TrendingUp size={16} className="text-purple-600" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-slate-800">
                {formatINR(totalGstPaid)}
              </span>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                Total GST (18%) across all payments
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Table */}
      <div className="card border border-slate-100 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Payment History
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {payments.length > 0
                ? `${payments.length} transaction${payments.length > 1 ? "s" : ""} found`
                : "No transactions yet"}
            </p>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <CreditCard size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">No payments yet</p>
            <p className="text-xs text-slate-400 font-medium">
              Your payment history will appear here after your first transaction
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Plan</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Method</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payments.map((payment, index) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    index={index}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GST Info Footer Note */}
      {payments.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
          <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 font-medium leading-relaxed">
            All amounts include 18% GST (CGST 9% + SGST 9%) as applicable under
            Indian tax regulations for SaaS services (SAC Code 998314). For GST
            invoices or GSTIN-based billing, please contact{" "}
            <a href="mailto:support@sudoreply.com" className="underline font-bold">
              support@sudoreply.com
            </a>
          </p>
        </div>
      )}

      {currentPlan && (
        <CancelSubscriptionModal
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          planName={currentPlan.name}
          periodEndDate={currentPlan.planPeriodEnd || currentPlan.nextRenewalDate}
          onSuccess={fetchBilling}
        />
      )}

      {/* Reactivate Confirmation Modal */}
      {isReactivateModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-in scale-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                Reactivate Subscription
              </h3>
              <button 
                onClick={() => setIsReactivateModalOpen(false)} 
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to reactivate your subscription? This will cancel your scheduled termination and keep your plan active. Your billing period and renewal cycle will continue without interruption.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={async () => {
                  setIsReactivateModalOpen(false);
                  await handleReactivate();
                }}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-sm font-bold text-white transition shadow-sm"
              >
                {actionLoading ? "Reactivating..." : "Yes, Reactivate"}
              </button>
              <button
                onClick={() => setIsReactivateModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}