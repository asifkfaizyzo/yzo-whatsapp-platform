// tenant-web/src/pages/Checkout.jsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import {
  getPublicPlans,
  createPaymentOrder,
  verifyPayment,
} from "../services/plan.service";

// ── Indian States List ──
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli",
  "Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh",
  "Lakshadweep", "Puducherry",
];

// ── Your Company State ──
const COMPANY_STATE = "Kerala"; // Change this to your company's state for GST calculations

// ── Format INR ──
const formatINR = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
};

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("planId");
  const billingType = searchParams.get("billing") || "monthly";

  const { user, login, accessToken } = useAuthStore();

  // ── States ──
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paid, setPaid] = useState(false);

  // ── Billing Details Form ──
  const [billingDetails, setBillingDetails] = useState({
    companyName: user?.tenantName || user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: user?.address || "",
    state: "",
    gstin: "",
  });

  const [errors, setErrors] = useState({});

  // ── Load Plan ──
  useEffect(() => {
    if (!planId) {
      navigate("/select-plan");
      return;
    }

    const loadPlan = async () => {
      setLoading(true);
      const res = await getPublicPlans();
      if (res.success) {
        const found = res.data.find((p) => p.id === planId);
        if (!found) {
          navigate("/select-plan");
          return;
        }
        setPlan(found);
      }
      setLoading(false);
    };
    loadPlan();
  }, [planId]);

  // ── Price Calculations ──
  const getBasePrice = () => {
    if (!plan) return 0;
    if (billingType === "annual" && plan.annualPrice) {
      return plan.annualPrice;
    }
    return plan.monthlyPrice;
  };

  const basePrice = getBasePrice();
  const gstPercent = 18;
  const gstAmount = parseFloat(((basePrice * gstPercent) / 100).toFixed(2));
  const totalAmount = parseFloat((basePrice + gstAmount).toFixed(2));

  // ── GST Type based on State ──
  const isSameState =
    billingDetails.state.toUpperCase() === COMPANY_STATE.toUpperCase();

  const cgst = isSameState ? gstAmount / 2 : 0;
  const sgst = isSameState ? gstAmount / 2 : 0;
  const igst = !isSameState && billingDetails.state ? gstAmount : 0;

  // ── Handle Input Change ──
  const handleChange = (e) => {
    const { name, value } = e.target;
    setBillingDetails((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // ── Validate Form ──
  const validate = () => {
    const newErrors = {};
    if (!billingDetails.companyName.trim()) {
      newErrors.companyName = "Company name is required";
    }
    if (!billingDetails.email.trim()) {
      newErrors.email = "Email is required";
    }
    if (!billingDetails.phone.trim()) {
      newErrors.phone = "Phone is required";
    }
    if (!billingDetails.state) {
      newErrors.state = "Please select your state";
    }
    if (
      billingDetails.gstin &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
        billingDetails.gstin
      )
    ) {
      newErrors.gstin = "Invalid GSTIN format";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Handle Payment ──
  const handlePayment = async () => {
    if (!validate()) return;

    setProcessing(true);

    try {
      // Step 1: Create order
      const orderRes = await createPaymentOrder(planId, billingType);

      if (!orderRes.success) {
        alert("Failed to create order: " + orderRes.message);
        setProcessing(false);
        return;
      }

      const { orderId, amount, currency } = orderRes.data;

      // Step 2: Open Razorpay
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount,
        currency,
        name: "SudoReply",
        description: `${plan.name} Plan - ${billingType}`,
        image: "/sudo2.png",
        order_id: orderId,

        // Step 3: Payment success handler
        handler: async function (response) {
          const verifyRes = await verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            planId,
            billingType,
          });

          if (verifyRes.success) {
            setPaid(true);

            // Update auth store
            const updatedUser = {
              ...user,
              planId,
              planStatus: "active",
              billingType,
            };
            login(updatedUser, accessToken);

            // Redirect to billing page
            setTimeout(() => {
              navigate("/dashboard/billing");
            }, 2500);
          } else {
            alert("Payment verification failed: " + verifyRes.message);
            setProcessing(false);
          }
        },

        prefill: {
          name: billingDetails.companyName,
          email: billingDetails.email,
          contact: billingDetails.phone,
        },

        theme: { color: "#125EF2" },

        modal: {
          ondismiss: function () {
            setProcessing(false);
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.open();
    } catch (err) {
      console.error("Payment error:", err);
      alert("Something went wrong. Please try again.");
      setProcessing(false);
    }
  };

  // ══════════════════════════════════════════
  // LOADING STATE
  // ══════════════════════════════════════════
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#125EF2]" />
      </div>
    );
  }

  // ══════════════════════════════════════════
  // PAYMENT SUCCESS STATE
  // ══════════════════════════════════════════
  if (paid) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-3xl p-10 shadow-lg text-center max-w-sm w-full mx-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Successful! 🎉
          </h2>
          <p className="text-gray-500 text-sm mb-1">
            Welcome to <strong>{plan?.name}</strong> plan.
          </p>
          <p className="text-gray-400 text-xs mb-1">
            Invoice has been sent to{" "}
            <strong>{billingDetails.email}</strong>
          </p>
          <p className="text-gray-400 text-xs mb-4">
            Redirecting to billing page...
          </p>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#125EF2]" />
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════
  // MAIN CHECKOUT PAGE
  // ══════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center">
          <img
            src="/sudo_bg.png"
            alt="SudoReply Logo"
            className="w-12 h-12 object-contain"
          />
        </Link>
        <div className="flex items-center gap-3">
          {/* Step Indicator */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold">
                ✓
              </span>
              Select Plan
            </span>
            <span className="text-gray-300">→</span>
            <span className="flex items-center gap-1.5 text-[#125EF2]">
              <span className="w-5 h-5 rounded-full bg-[#125EF2] flex items-center justify-center text-[10px] font-bold text-white">
                2
              </span>
              Checkout
            </span>
            <span className="text-gray-300">→</span>
            <span className="flex items-center gap-1.5 text-gray-400">
              <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold">
                3
              </span>
              Payment
            </span>
          </div>
        </div>
        <span className="text-sm text-gray-500">
          {user?.email}
        </span>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Page Title */}
        <div className="text-center mb-8">
          <span className="text-[#125EF2] font-semibold text-sm uppercase tracking-wider">
            Step 2 of 3
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            Review & <span className="text-[#125EF2]">Checkout</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Confirm your order and billing details before payment
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">

          {/* LEFT COLUMN — Billing Details Form */}
          <div className="lg:col-span-3 space-y-6">

            {/* Billing Details Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#EAF2FE] text-[#125EF2] flex items-center justify-center text-xs font-bold">
                  1
                </span>
                Billing Details
              </h2>

              <div className="space-y-4">

                {/* Company Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Company / Business Name
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={billingDetails.companyName}
                    onChange={handleChange}
                    placeholder="Acme Corp Pvt Ltd"
                    className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] transition ${
                      errors.companyName
                        ? "border-red-300 bg-red-50"
                        : "border-gray-200"
                    }`}
                  />
                  {errors.companyName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.companyName}
                    </p>
                  )}
                </div>

                {/* Email + Phone Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Email
                      <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={billingDetails.email}
                      onChange={handleChange}
                      placeholder="admin@company.com"
                      className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] transition ${
                        errors.email
                          ? "border-red-300 bg-red-50"
                          : "border-gray-200"
                      }`}
                    />
                    {errors.email && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.email}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Phone
                      <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={billingDetails.phone}
                      onChange={handleChange}
                      placeholder="+91 98765 43210"
                      className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] transition ${
                        errors.phone
                          ? "border-red-300 bg-red-50"
                          : "border-gray-200"
                      }`}
                    />
                    {errors.phone && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.phone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Billing Address
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={billingDetails.address}
                    onChange={handleChange}
                    placeholder="123, Business Park, City"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] transition"
                  />
                </div>

                {/* State */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    State
                    <span className="text-red-500 ml-0.5">*</span>
                    <span className="text-gray-400 font-normal ml-1">
                      (determines GST type)
                    </span>
                  </label>
                  <select
                    name="state"
                    value={billingDetails.state}
                    onChange={handleChange}
                    className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] transition bg-white ${
                      errors.state
                        ? "border-red-300 bg-red-50"
                        : "border-gray-200"
                    }`}
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  {errors.state && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.state}
                    </p>
                  )}

                  {/* GST Type Indicator */}
                  {billingDetails.state && (
                    <div
                      className={`mt-2 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                        isSameState
                          ? "bg-blue-50 text-blue-700"
                          : "bg-purple-50 text-purple-700"
                      }`}
                    >
                      <span>{isSameState ? "ℹ️" : "ℹ️"}</span>
                      {isSameState
                        ? `Same state as seller (${COMPANY_STATE}) → CGST (9%) + SGST (9%) applies`
                        : `Different state → IGST (18%) applies`}
                    </div>
                  )}
                </div>

                {/* GSTIN (Optional) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    GSTIN
                    <span className="text-gray-400 font-normal ml-1">
                      (Optional — for B2B billing)
                    </span>
                  </label>
                  <input
                    type="text"
                    name="gstin"
                    value={billingDetails.gstin}
                    onChange={(e) =>
                      handleChange({
                        target: {
                          name: "gstin",
                          value: e.target.value.toUpperCase(),
                        },
                      })
                    }
                    placeholder="27AABCU9603R1ZM"
                    maxLength={15}
                    className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] transition font-mono ${
                      errors.gstin
                        ? "border-red-300 bg-red-50"
                        : "border-gray-200"
                    }`}
                  />
                  {errors.gstin && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.gstin}
                    </p>
                  )}
                  {billingDetails.gstin && !errors.gstin && (
                    <p className="text-emerald-600 text-xs mt-1 font-medium">
                      ✓ GSTIN will appear on your invoice
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Method Info */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#EAF2FE] text-[#125EF2] flex items-center justify-center text-xs font-bold">
                  2
                </span>
                Payment Method
              </h2>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <img
                  src="https://razorpay.com/assets/razorpay-glyph.svg"
                  alt="Razorpay"
                  className="w-8 h-8"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
                <div>
                  <p className="text-sm font-bold text-gray-800">
                    Razorpay Secure Checkout
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    UPI • Credit/Debit Card • Net Banking • Wallets
                  </p>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Your payment information is encrypted and secure
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN — Order Summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-6 space-y-4">

              {/* Order Summary Card */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-base font-bold text-gray-900 mb-4">
                  Order Summary
                </h2>

                {/* Plan Info */}
                <div className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-xl mb-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {plan?.name} Plan
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">
                      {billingType} billing
                    </p>
                  </div>
                  <span className="text-xs font-bold bg-[#EAF2FE] text-[#125EF2] px-2 py-1 rounded-lg capitalize">
                    {billingType}
                  </span>
                </div>

                {/* Price Breakdown */}
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Base Price</span>
                    <span className="font-semibold text-gray-800">
                      {formatINR(basePrice)}
                    </span>
                  </div>

                  {/* GST Breakdown */}
                  {billingDetails.state ? (
                    isSameState ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-500">CGST (9%)</span>
                          <span className="font-semibold text-gray-800">
                            {formatINR(cgst)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">SGST (9%)</span>
                          <span className="font-semibold text-gray-800">
                            {formatINR(sgst)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-gray-500">IGST (18%)</span>
                        <span className="font-semibold text-gray-800">
                          {formatINR(igst)}
                        </span>
                      </div>
                    )
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-gray-500">GST (18%)</span>
                      <span className="font-semibold text-gray-800">
                        {formatINR(gstAmount)}
                      </span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                    <span className="font-bold text-gray-900">
                      Total Payable
                    </span>
                    <span className="text-xl font-extrabold text-[#125EF2]">
                      {formatINR(totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Annual billing note */}
                {billingType === "annual" && (
                  <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-100">
                    <p className="text-xs text-green-700 font-semibold">
                      🎉 Annual billing — Save{" "}
                      {formatINR(
                        (plan?.monthlyPrice - basePrice) * 12
                      )}{" "}
                      per year!
                    </p>
                  </div>
                )}
              </div>

              {/* What's Included */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-3">
                  What's included:
                </h3>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                    <span className="text-emerald-500 font-bold">✓</span>
                    Up to {plan?.maxAgents} agents
                  </li>
                  {plan?.maxBroadcasts && (
                    <li className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                      <span className="text-emerald-500 font-bold">✓</span>
                      {plan.maxBroadcasts} broadcasts/month
                    </li>
                  )}
                  {plan?.features?.map((pf) => (
                    <li
                      key={pf.id}
                      className="flex items-center gap-2 text-xs text-gray-600 font-medium"
                    >
                      <span className="text-emerald-500 font-bold">✓</span>
                      {pf.feature?.name || pf.name}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pay Button */}
              <button
                onClick={handlePayment}
                disabled={processing}
                className={`w-full py-4 rounded-xl font-bold text-sm transition-all duration-300 ${
                  processing
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-[#125EF2] text-white hover:bg-[#0F4FCC] shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                }`}
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    Opening Payment...
                  </span>
                ) : (
                  `🔒 Pay ${formatINR(totalAmount)}`
                )}
              </button>

              {/* Back Button */}
              <button
                onClick={() =>
                  navigate(
                    `/select-plan?planId=${planId}&billing=${billingType}`
                  )
                }
                className="w-full py-2.5 text-gray-400 text-sm font-medium hover:text-gray-600 transition text-center"
              >
                ← Back to Plans
              </button>

              {/* Security */}
              <p className="text-center text-[11px] text-gray-400">
                🔒 256-bit SSL Encrypted • PCI DSS Compliant
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}