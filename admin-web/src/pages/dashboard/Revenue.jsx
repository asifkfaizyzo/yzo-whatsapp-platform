// admin-web/src/pages/dashboard/Revenue.jsx
import React, { useEffect, useState } from "react";
import {
  BadgeIndianRupee,
  TrendingUp,
  Users,
  Receipt,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowLeft,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import api from "../../lib/axios";

// ── Helpers ──
const formatINR = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ── Status Badge ──
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
      icon: <XCircle size={11} />,
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


// ── Custom Tooltip for Chart ──
const ChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-sm">
        <p className="font-bold text-slate-700 mb-1">{label}</p>
        <p className="text-[#125EF2] font-bold">
          {formatINR(payload[0].value)}
        </p>
        {payload[0].payload.transactions !== undefined && (
          <p className="text-slate-400 text-xs mt-0.5">
            {payload[0].payload.transactions} transaction
            {payload[0].payload.transactions !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    );
  }
  return null;
};

// ── Revenue Chart Component ──
const RevenueChart = ({ data = [] }) => {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 0);
  const hasData = data.some((d) => d.revenue > 0);

  if (!hasData) {
    return (
      <div className="h-52 flex flex-col items-center justify-center text-slate-300">
        <Receipt size={40} className="mb-2" />
        <p className="text-sm font-semibold text-slate-400">
          No revenue data yet
        </p>
        <p className="text-xs text-slate-300 mt-1">
          Chart will populate once payments are received
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={208}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 4, left: -8, bottom: 0 }}
        barSize={32}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#f1f5f9"
          vertical={false}
        />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) =>
            v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`
          }
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
        <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.revenue === maxRevenue && entry.revenue > 0
                  ? "#125EF2"
                  : "#BFDBFE"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Payment Row (expandable) ──
const PaymentRow = ({ payment, onDownloadInvoice }) => {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const cgst = parseFloat((payment.gstAmount / 2).toFixed(2));
  const sgst = parseFloat((payment.gstAmount / 2).toFixed(2));

  const handleDownload = async (e) => {
    e.stopPropagation();
    setDownloading(true);
    await onDownloadInvoice(payment.id);
    setDownloading(false);
  };

  return (
    <>
      <tr
        className={`hover:bg-slate-50/60 transition cursor-pointer ${
          expanded ? "bg-slate-50" : ""
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Date */}
        <td className="px-5 py-4 text-sm text-slate-600 font-medium whitespace-nowrap">
          {formatDate(payment.paidAt || payment.createdAt)}
        </td>

        {/* Tenant */}
        <td className="px-5 py-4">
          <div className="text-sm font-semibold text-slate-800">
            {payment.tenant?.tenantName || "—"}
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {payment.tenant?.email || "—"}
          </div>
        </td>

        {/* Plan */}
        <td className="px-5 py-4">
          <div className="text-sm font-semibold text-slate-700">
            {payment.planName}
          </div>
          <div className="text-xs text-slate-400 capitalize">
            {payment.billingType}
          </div>
        </td>

        {/* Amount */}
        <td className="px-5 py-4 text-sm font-bold text-slate-800">
          {formatINR(payment.totalAmount)}
        </td>

        {/* GST */}
        <td className="px-5 py-4 text-sm text-slate-500 font-medium">
          {formatINR(payment.gstAmount)}
        </td>

        {/* Status */}
        <td className="px-5 py-4">
          <StatusBadge status={payment.status} />
        </td>

        {/* Expand */}
        <td className="px-5 py-4 text-right">
          <button className="p-1.5 hover:bg-slate-200 rounded-lg transition text-slate-400">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>
      </tr>

      {/* Expanded Row */}
      {expanded && (
        <tr className="bg-[#EAF2FE]/20">
          <td colSpan={7} className="px-5 py-5">
            <div className="flex flex-col sm:flex-row gap-6">

              {/* Amount Breakdown */}
              <div className="flex-1 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Amount Breakdown
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Base Amount</span>
                    <span className="font-semibold text-slate-700">
                      {formatINR(payment.baseAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
  CGST ({payment.gstPercent ? payment.gstPercent / 2 : 9}%)
</span>
                    <span className="font-semibold text-slate-700">
                      {formatINR(cgst)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
  SGST ({payment.gstPercent ? payment.gstPercent / 2 : 9}%)
</span>
                    <span className="font-semibold text-slate-700">
                      {formatINR(sgst)}
                    </span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-bold text-slate-800">Total</span>
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
                <div className="space-y-2 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-400 font-semibold">
                      Payment ID
                    </span>
                    <span className="font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded-lg break-all">
                      {payment.razorpayPaymentId || "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-slate-400 font-semibold">
                      Order ID
                    </span>
                    <span className="font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded-lg break-all">
                      {payment.razorpayOrderId || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold">Method</span>
                    <span className="font-semibold text-slate-700 capitalize">
                      {payment.paymentMethod || "—"}
                    </span>
                  </div>
                </div>

                {/* Download Invoice */}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleDownload}
                    disabled={downloading || payment.status !== "SUCCESS"}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${
                      downloading || payment.status !== "SUCCESS"
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
                        <Download size={14} />
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
// TENANT BILLING DETAIL (Slide-in Panel)
// ══════════════════════════════════════════
const TenantBillingDetail = ({ tenantId, onBack, onDownloadInvoice }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/revenue/tenant/${tenantId}`);
        if (res.data.success) setData(res.data.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const { tenant, payments, totalSpent } = data;
  const successPayments = payments.filter((p) => p.status === "SUCCESS");

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-semibold text-[#125EF2] hover:text-[#0d4fd6] transition"
      >
        <ArrowLeft size={16} />
        Back to Revenue
      </button>

      {/* Tenant Info Card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {tenant.tenantName}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{tenant.email}</p>
            {tenant.phone && (
              <p className="text-xs text-slate-400 mt-0.5">{tenant.phone}</p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                tenant.planStatus === "active"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  tenant.planStatus === "active"
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-slate-400"
                }`}
              />
              {tenant.planStatus === "active" ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        {/* Plan Details */}
        {tenant.plan && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 font-semibold">Plan</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">
                {tenant.plan.name}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 font-semibold">Billing</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5 capitalize">
                {tenant.billingType || "—"}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 font-semibold">
                Activated
              </p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">
                {formatDate(tenant.planActivatedAt)}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-400 font-semibold">
                Next Renewal
              </p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">
                {formatDate(tenant.nextRenewalDate)}
              </p>
            </div>
          </div>
        )}

        {/* Total Spent */}
        <div className="mt-4 p-4 bg-[#EAF2FE] rounded-xl border border-[#CFE0FD]">
          <p className="text-xs text-[#125EF2] font-bold uppercase tracking-wider">
            Total Spent by Tenant
          </p>
          <p className="text-2xl font-extrabold text-[#125EF2] mt-1">
            {formatINR(totalSpent)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Across {successPayments.length} successful payment
            {successPayments.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">
            Payment History
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {payments.length} transaction{payments.length !== 1 ? "s" : ""}{" "}
            found
          </p>
        </div>

        {payments.length === 0 ? (
          <div className="py-12 text-center">
            <Receipt className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500">
              No payments yet
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
                  <th className="px-5 py-3.5">GST</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4 text-sm text-slate-600 font-medium whitespace-nowrap">
                      {formatDate(payment.paidAt || payment.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-semibold text-slate-700">
                        {payment.planName}
                      </div>
                      <div className="text-xs text-slate-400 capitalize">
                        {payment.billingType}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-800">
                      {formatINR(payment.totalAmount)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {formatINR(payment.gstAmount)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      {payment.status === "SUCCESS" && (
                        <button
                          onClick={() => onDownloadInvoice(payment.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#125EF2] bg-[#EAF2FE] hover:bg-[#CFE0FD] rounded-lg transition ml-auto"
                        >
                          <Download size={12} />
                          Invoice
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════
// MAIN REVENUE PAGE
// ══════════════════════════════════════════
export default function Revenue() {
  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterPlan, setFilterPlan] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    console.log("🔥 Revenue fetchData called"); //- Add
    try {
      const [statsRes, paymentsRes] = await Promise.all([
        api.get("/revenue/stats"),
        api.get("/revenue/payments"),
      ]);
       console.log("✅ Stats:", statsRes.data);        // ← ADD
    console.log("✅ Payments:", paymentsRes.data);  // ← ADD
      if (statsRes.data.success) setStats(statsRes.data.data);
      if (paymentsRes.data.success) setPayments(paymentsRes.data.data);
    } catch (e) {
      console.log("❌ Error:", e.message);            // ← ADD
      setError("Failed to fetch revenue data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDownloadInvoice = async (paymentId) => {
    try {
      const res = await api.get(`/revenue/invoice/${paymentId}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${paymentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to download invoice");
    }
  };

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    const matchStatus = filterStatus === "ALL" || p.status === filterStatus;
    const matchPlan =
      filterPlan === "ALL" || p.planName === filterPlan;
    const matchSearch =
      searchQuery === "" ||
      p.tenant?.tenantName
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      p.tenant?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchPlan && matchSearch;
  });

  // Unique plan names for filter
  const uniquePlans = [...new Set(payments.map((p) => p.planName))];

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="h-8 w-48 bg-slate-100 rounded-xl animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 bg-slate-100 rounded-2xl animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="p-4 rounded-2xl bg-red-50 border border-red-100">
          <AlertCircle className="text-red-500" size={32} />
        </div>
        <p className="text-sm font-semibold text-slate-600">{error}</p>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-[#125EF2] text-white text-sm font-semibold rounded-xl hover:bg-[#0d4fd6] transition"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  // ── Tenant Detail View ──
  if (selectedTenantId) {
    return (
      <TenantBillingDetail
        tenantId={selectedTenantId}
        onBack={() => setSelectedTenantId(null)}
        onDownloadInvoice={handleDownloadInvoice}
      />
    );
  }

  // ── Main Revenue View ──
  return (
    <div className="space-y-8 animate-in fade-in duration-200">

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Revenue & Billing
          </h1>
          <p className="mt-1 text-sm text-slate-500 font-medium">
            Platform-wide payment analytics and tenant billing overview
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition border border-slate-200"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {/* Total Revenue */}
          <div className="card p-5 border border-slate-100 bg-white flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Total Revenue
              </span>
              <div className="p-2 rounded-xl bg-[#EAF2FE] border border-[#CFE0FD]">
                <BadgeIndianRupee size={16} className="text-[#125EF2]" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-extrabold text-slate-800">
                {formatINR(stats.totalRevenue)}
              </span>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                Lifetime platform revenue
              </p>
            </div>
          </div>

          {/* This Month */}
          <div className="card p-5 border border-slate-100 bg-white flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                This Month
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
                <TrendingUp size={16} className="text-emerald-600" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-extrabold text-slate-800">
                {formatINR(stats.thisMonthRevenue)}
              </span>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                vs {formatINR(stats.lastMonthRevenue)} last month
              </p>
            </div>
          </div>

          {/* MRR */}
          <div className="card p-5 border border-slate-100 bg-white flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                MRR
              </span>
              <div className="p-2 rounded-xl bg-purple-50 border border-purple-100">
                <Receipt size={16} className="text-purple-600" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-extrabold text-slate-800">
                {formatINR(stats.mrr)}
              </span>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                Monthly Recurring Revenue
              </p>
            </div>
          </div>

          {/* Active Tenants */}
          <div className="card p-5 border border-slate-100 bg-white flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Active Tenants
              </span>
              <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
                <Users size={16} className="text-blue-600" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-2xl font-extrabold text-slate-800">
                {stats.activeTenants}
              </span>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                Tenants with active plans
              </p>
            </div>
          </div>

        </div>
      )}

      {/* Secondary Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">

          {/* GST Collected */}
          <div className="card p-5 border border-slate-100 bg-white">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total GST Collected
            </p>
            <p className="text-xl font-extrabold text-slate-800 mt-2">
              {formatINR(stats.totalGST)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
  {stats.totalGST > 0
    ? "GST collected across all payments"
    : "No GST collected yet"
  }
</p>
          </div>

          {/* ARR */}
          <div className="card p-5 border border-slate-100 bg-white">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              ARR
            </p>
            <p className="text-xl font-extrabold text-slate-800 mt-2">
              {formatINR(stats.arr)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Annual Recurring Revenue (projected)
            </p>
          </div>

          {/* Total Transactions */}
          <div className="card p-5 border border-slate-100 bg-white">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Transactions
            </p>
            <p className="text-xl font-extrabold text-slate-800 mt-2">
              {stats.totalPayments}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Successful payments processed
            </p>
          </div>

        </div>
      )}


            {/* ── Revenue Chart ── */}
      {stats && (
        <div className="card border border-slate-100 bg-white p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                Monthly Revenue
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Last 6 months collected revenue from all subscriptions
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#125EF2]" />
                Peak Month
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#BFDBFE]" />
                Other Months
              </span>
            </div>
          </div>

          <RevenueChart data={stats.monthlyBreakdown ?? []} />

          {stats.monthlyBreakdown?.some((d) => d.revenue > 0) && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
              <span>
                This Month:{" "}
                <span className="font-bold text-slate-800">
                  {formatINR(stats.thisMonthRevenue)}
                </span>
              </span>
              <span>
                Last Month:{" "}
                <span className="font-bold text-slate-800">
                  {formatINR(stats.lastMonthRevenue)}
                </span>
              </span>
              <span>
                Total (6 months):{" "}
                <span className="font-bold text-slate-800">
                  {formatINR(
                    stats.monthlyBreakdown.reduce(
                      (sum, d) => sum + d.revenue, 0
                    )
                  )}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Plan Distribution */}
      {stats?.planDistribution?.length > 0 && (
        <div className="card border border-slate-100 bg-white p-6">
          <h2 className="text-base font-bold text-slate-800 mb-4">
            Plan Distribution
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {stats.planDistribution.map((plan) => (
              <div
                key={plan.planId}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {plan.planName}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatINR(plan.monthlyPrice)}/mo
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-extrabold text-[#125EF2]">
                    {plan.count}
                  </p>
                  <p className="text-xs text-slate-400">tenants</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Payments Table */}
      <div className="card border border-slate-100 bg-white overflow-hidden">

        {/* Table Header + Filters */}
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">
                All Payments
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filteredPayments.length} of {payments.length} transactions
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {/* Search */}
              <input
                type="text"
                placeholder="Search tenant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20 w-40"
              />

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20"
              >
                <option value="ALL">All Status</option>
                <option value="SUCCESS">Paid</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>

              {/* Plan Filter */}
              <select
                value={filterPlan}
                onChange={(e) => setFilterPlan(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20"
              >
                <option value="ALL">All Plans</option>
                {uniquePlans.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        {filteredPayments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Receipt size={28} className="text-slate-200" />
            <p className="text-sm font-semibold text-slate-500">
              No payments found
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Tenant</th>
                  <th className="px-5 py-3.5">Plan</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">GST</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPayments.map((payment) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    onDownloadInvoice={handleDownloadInvoice}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tenant List for Billing Detail */}
      <div className="card border border-slate-100 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">
            Tenant Billing Detail
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Click on a tenant to view their full billing history
          </p>
        </div>

        <div className="divide-y divide-slate-50">
          {/* Get unique tenants from payments */}
          {[
            ...new Map(
              payments
                .filter((p) => p.tenant)
                .map((p) => [p.tenant.id, p.tenant])
            ).values(),
          ].map((tenant) => {
            const tenantPayments = payments.filter(
              (p) => p.tenant?.id === tenant.id && p.status === "SUCCESS"
            );
            const tenantTotal = tenantPayments.reduce(
              (sum, p) => sum + p.totalAmount, 0
            );

            return (
              <div
                key={tenant.id}
                onClick={() => setSelectedTenantId(tenant.id)}
                className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 cursor-pointer transition"
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {tenant.tenantName}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {tenant.email}
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">
                      {formatINR(tenantTotal)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {tenantPayments.length} payment
                      {tenantPayments.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <ChevronDown
                    size={16}
                    className="text-slate-400 rotate-[-90deg]"
                  />
                </div>
              </div>
            );
          })}

          {payments.filter((p) => p.tenant).length === 0 && (
            <div className="py-12 text-center">
              <Users size={28} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">
                No tenant payments yet
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}