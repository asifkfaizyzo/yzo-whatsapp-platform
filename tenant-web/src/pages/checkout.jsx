// tenant-web/src/pages/Checkout.jsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useToast } from "../context/ToastContext";
import {
  getPublicPlans,
  createPaidSubscription,
  verifyPaidSubscription,
  createPaymentOrder,
  verifyPayment,
  getPublicTaxSettings,
} from "../services/plan.service";
import { Sparkles, ShieldCheck, ChevronLeft } from "lucide-react";
import { PaymentVerifyingLoader, PaymentSuccessScreen } from "../components/CustomLoader";



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
const COMPANY_STATE = "Kerala";

// ── Format INR ──
const formatINR = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
};

// Dynamically load Razorpay
let razorpayScriptPromise = null;
function loadRazorpayScript() {
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayScriptPromise = null;
      reject(new Error("Failed to load Razorpay SDK"));
    };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

export default function Checkout() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("planId");
  const billingType = searchParams.get("billing") || "monthly";

  const { user, login, accessToken } = useAuthStore();

  // ── States ──
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paid, setPaid] = useState(false);

  // ── GST Config from Backend ──
  const [taxConfig, setTaxConfig] = useState({
    gstEnabled: true,
    gstPercent: 18,
    gstType: "CGST_SGST",
  });

  // ── Billing Details ──
  const [billingDetails, setBillingDetails] = useState({
    companyName: user?.tenantName || user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    address: user?.address || "",
    state: "",
    gstin: "",
  });

  const [errors, setErrors] = useState({});

  // ── Load Plan + Tax Config ──
  useEffect(() => {
    if (!planId) {
      navigate("/select-plan");
      return;
    }

    const loadData = async () => {
      setLoading(true);

      // Load plan and tax settings in parallel
      const [planRes, taxRes] = await Promise.all([
        getPublicPlans(),
        getPublicTaxSettings(),
      ]);

      if (planRes.success) {
        const found = planRes.data.find((p) => p.id === planId);
        if (!found) {
          navigate("/select-plan");
          return;
        }
        setPlan(found);
      }

      if (taxRes.success) {
        setTaxConfig(taxRes.data);
      }

      setLoading(false);
    };
    loadData();
  }, [planId]);

  // ── Sync User Data ──
  useEffect(() => {
    if (user) {
      setBillingDetails((prev) => ({
        ...prev,
        companyName: prev.companyName || user.tenantName || user.name || "",
        email: prev.email || user.email || "",
        phone: prev.phone || user.phone || "",
        address: prev.address || user.address || "",
      }));
    }
  }, [user]);

  // ── Price Calculations ──
  const getBasePrice = () => {
    if (!plan) return 0;
    if (billingType === "annual" && plan.annualPrice) {
      return plan.annualPrice;
    }
    return plan.monthlyPrice;
  };

  const basePrice = getBasePrice();

  // ── Dynamic GST Calculation ──
  const gstEnabled = taxConfig.gstEnabled;
  const gstPercent = gstEnabled ? taxConfig.gstPercent : 0;
  const gstAmount = gstEnabled
    ? parseFloat(((basePrice * gstPercent) / 100).toFixed(2))
    : 0;
  const totalAmount = parseFloat((basePrice + gstAmount).toFixed(2));

  // ── GST Type based on State ──
  const isSameState =
    billingDetails.state.toUpperCase() === COMPANY_STATE.toUpperCase();

  const cgst = gstEnabled && isSameState ? gstAmount / 2 : 0;
  const sgst = gstEnabled && isSameState ? gstAmount / 2 : 0;
  const igst = gstEnabled && !isSameState && billingDetails.state ? gstAmount : 0;

  // ── Handle Input Change ──
  const handleChange = (e) => {
    const { name, value } = e.target;
    setBillingDetails((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // ── Validate Form ──
  const validate = () => {
    const newErrors = {};
    if (!billingDetails.companyName.trim())
      newErrors.companyName = "Company name is required";
    if (!billingDetails.email.trim()) newErrors.email = "Email is required";
    if (!billingDetails.phone.trim()) newErrors.phone = "Phone is required";
    
    // Only require state if GST is enabled
    if (gstEnabled && !billingDetails.state) {
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

  // ── Handle Payment (Recurring Autopay Subscription with Upfront Debit) ──
  const handlePayment = async () => {
    if (!validate()) return;
    setProcessing(true);

    try {
      await loadRazorpayScript();

      // Create Razorpay Subscription with upfront debit
      const subRes = await createPaidSubscription(planId, billingType);

      if (!subRes.success) {
        toast.error("Failed to initiate subscription: " + subRes.message);
        setProcessing(false);
        return;
      }

      const { subscriptionId, keyId } = subRes.data;

      const options = {
        key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        subscription_id: subscriptionId,
        name: "SudoReply",
        description: `${plan.name} Plan (${billingType === "annual" ? "Annual" : "Monthly"}) - Autopay Mandate`,
        image: "/sudo_bg.png",
        handler: async function (response) {
          setProcessing(false);
          setVerifying(true);
          const verifyRes = await verifyPaidSubscription({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_subscription_id: response.razorpay_subscription_id,
            razorpay_signature: response.razorpay_signature,
            planId,
            billingType,
            address: billingDetails.address,
            phone: billingDetails.phone,
          });

          if (verifyRes.success) {
            setVerifying(false);
            setPaid(true);
            const updatedUser = {
              ...user,
              planId,
              planStatus: "active",
              subscriptionStatus: "active",
              currentPlan: plan.name,
              billingType,
              autopayEnabled: true,
              address: billingDetails.address,
              phone: billingDetails.phone,
            };
            login(updatedUser, accessToken);
            setTimeout(() => {
              navigate("/dashboard/billing");
            }, 2500);
          } else {
            setVerifying(false);
            toast.error("Subscription verification failed: " + verifyRes.message);
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
            setVerifying(false);
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.on("payment.failed", function (response) {
        console.error("Razorpay payment failed:", response.error);
        toast.error(response.error?.description || "Payment authorization failed. Please try again.");
        setProcessing(false);
        setVerifying(false);
      });
      razorpayInstance.open();
    } catch (err) {
      console.error("Payment error:", err);
      toast.error("Something went wrong. Please try again.");
      setProcessing(false);
      setVerifying(false);
    }
  };

  // ── LOADING ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#125EF2]" />
      </div>
    );
  }

  // ── PAYMENT SUCCESS ──
  if (paid) {
    return <PaymentSuccessScreen planName={plan?.name} email={billingDetails.email} />;
  }

  // ── MAIN CHECKOUT ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Payment Verifying Overlay */}
      <PaymentVerifyingLoader visible={verifying} />

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="inline-flex items-center">
            <img src="/sudo_bg.png" alt="SudoReply Logo" className="w-12 h-12 object-contain" />
          </Link>
          <Link
            to={`/select-plan?upgrade=true&planId=${planId}&billing=${billingType}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
          >
            <ChevronLeft size={14} />
            <span>Back to Plans</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
            <Link to={`/select-plan?upgrade=true&planId=${planId}&billing=${billingType}`} className="flex items-center gap-1.5 text-emerald-600 hover:underline">
              <span className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold">✓</span>
              Select Plan
            </Link>
            <span className="text-gray-300">→</span>
            <span className="flex items-center gap-1.5 text-[#125EF2]">
              <span className="w-5 h-5 rounded-full bg-[#125EF2] flex items-center justify-center text-[10px] font-bold text-white">2</span>
              Checkout
            </span>
            <span className="text-gray-300">→</span>
            <span className="flex items-center gap-1.5 text-gray-400">
              <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold">3</span>
              Payment
            </span>
          </div>
        </div>
        <span className="text-sm text-gray-500">{user?.email}</span>
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

          {/* LEFT — Billing Form */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#EAF2FE] text-[#125EF2] flex items-center justify-center text-xs font-bold">1</span>
                Billing Details
              </h2>

              <div className="space-y-4">
                {/* Company */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Company / Business Name<span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={billingDetails.companyName}
                    onChange={handleChange}
                    placeholder="Acme Corp Pvt Ltd"
                    className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] transition ${
                      errors.companyName ? "border-red-300 bg-red-50" : "border-gray-200"
                    }`}
                  />
                  {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>}
                </div>

                {/* Email + Phone */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Email<span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={billingDetails.email}
                      onChange={handleChange}
                      placeholder="admin@company.com"
                      className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] transition ${
                        errors.email ? "border-red-300 bg-red-50" : "border-gray-200"
                      }`}
                    />
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Phone<span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={billingDetails.phone}
                      onChange={handleChange}
                      placeholder="+91 98765 43210"
                      className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] transition ${
                        errors.phone ? "border-red-300 bg-red-50" : "border-gray-200"
                      }`}
                    />
                    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
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

                {/* State — only show if GST enabled */}
                {gstEnabled && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      State<span className="text-red-500 ml-0.5">*</span>
                      <span className="text-gray-400 font-normal ml-1">(determines GST type)</span>
                    </label>
                    <select
                      name="state"
                      value={billingDetails.state}
                      onChange={handleChange}
                      className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] transition bg-white ${
                        errors.state ? "border-red-300 bg-red-50" : "border-gray-200"
                      }`}
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                    {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}

                    {billingDetails.state && (
                      <div className={`mt-2 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                        isSameState ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                      }`}>
                        <span>ℹ️</span>
                        {isSameState
                          ? `Same state as seller (${COMPANY_STATE}) → CGST (${gstPercent/2}%) + SGST (${gstPercent/2}%)`
                          : `Different state → IGST (${gstPercent}%)`}
                      </div>
                    )}
                  </div>
                )}

                {/* GSTIN — only if GST enabled */}
                {gstEnabled && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      GSTIN
                      <span className="text-gray-400 font-normal ml-1">(Optional — for B2B billing)</span>
                    </label>
                    <input
                      type="text"
                      name="gstin"
                      value={billingDetails.gstin}
                      onChange={(e) => handleChange({
                        target: { name: "gstin", value: e.target.value.toUpperCase() }
                      })}
                      placeholder="27AABCU9603R1ZM"
                      maxLength={15}
                      className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#125EF2]/20 focus:border-[#125EF2] transition font-mono ${
                        errors.gstin ? "border-red-300 bg-red-50" : "border-gray-200"
                      }`}
                    />
                    {errors.gstin && <p className="text-red-500 text-xs mt-1">{errors.gstin}</p>}
                    {billingDetails.gstin && !errors.gstin && (
                      <p className="text-emerald-600 text-xs mt-1 font-medium">
                        ✓ GSTIN will appear on your invoice
                      </p>
                    )}
                  </div>
                )}

                {/* GST OFF Notice */}
                {!gstEnabled && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-700 font-semibold flex items-center gap-2">
                      <span>ℹ️</span>
                      GST is currently not applied. You will be charged base price only.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method Info */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#EAF2FE] text-[#125EF2] flex items-center justify-center text-xs font-bold">2</span>
                Payment Method
              </h2>
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <img
                  src="https://razorpay.com/assets/razorpay-glyph.svg"
                  alt="Razorpay"
                  className="w-8 h-8"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
                <div>
                  <p className="text-sm font-bold text-gray-800">Razorpay Secure Checkout</p>
                  <p className="text-xs text-gray-500 mt-0.5">UPI • Credit/Debit Card • Net Banking • Wallets</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Your payment information is encrypted and secure
              </p>
            </div>
          </div>

          {/* RIGHT — Order Summary */}
          <div className="lg:col-span-2">
            <div className="sticky top-6 space-y-4">

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-base font-bold text-gray-900 mb-4">Order Summary</h2>

                <div className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-xl mb-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{plan?.name} Plan</p>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">{billingType} billing</p>
                  </div>
                  <span className="text-xs font-bold bg-[#EAF2FE] text-[#125EF2] px-2 py-1 rounded-lg capitalize">
                    {billingType}
                  </span>
                </div>

                {/* Dynamic Price Breakdown */}
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Base Price</span>
                    <span className="font-semibold text-gray-800">
                      {formatINR(basePrice)}
                    </span>
                  </div>

                  {/* GST Breakdown — only when enabled */}
                  {gstEnabled ? (
                    billingDetails.state ? (
                      isSameState ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-500">CGST ({gstPercent/2}%)</span>
                            <span className="font-semibold text-gray-800">{formatINR(cgst)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">SGST ({gstPercent/2}%)</span>
                            <span className="font-semibold text-gray-800">{formatINR(sgst)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-gray-500">IGST ({gstPercent}%)</span>
                          <span className="font-semibold text-gray-800">{formatINR(igst)}</span>
                        </div>
                      )
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-gray-500">GST ({gstPercent}%)</span>
                        <span className="font-semibold text-gray-800">{formatINR(gstAmount)}</span>
                      </div>
                    )
                  ) : (
                    <div className="flex justify-between text-gray-400 italic">
                      <span>Tax</span>
                      <span>Not Applicable</span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                    <span className="font-bold text-gray-900">Total Payable</span>
                    <span className="text-xl font-extrabold text-[#125EF2]">
                      {formatINR(totalAmount)}
                    </span>
                  </div>
                </div>

                {billingType === "annual" && (
                  <div className="mt-3 p-3 bg-green-50 rounded-xl border border-green-100">
                    <p className="text-xs text-green-700 font-semibold">
                      🎉 Annual billing — Save{" "}
                      {formatINR((plan?.monthlyPrice - basePrice) * 12)} per year!
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-3">What's included:</h3>
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
                    <li key={pf.id} className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                      <span className="text-emerald-500 font-bold">✓</span>
                      {pf.feature?.name || pf.name}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Subscription & Billing Guarantee Notice */}
              <div className="rounded-2xl p-4 bg-blue-50/80 border border-blue-100 text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-blue-900">
                  <Sparkles size={14} className="text-[#125EF2]" />
                  <span>Subscription & Billing Notice</span>
                </div>
                <p className="text-blue-800/80 leading-relaxed">
                  Billed upfront today ({billingType === "annual" ? "Annual License" : "Monthly"}). Instant GST invoice generated. Manage or cancel subscription anytime under Workspace Billing.
                </p>
              </div>

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
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Opening Payment...
                  </span>
                ) : (
                  `🔒 Pay ${formatINR(totalAmount)}`
                )}
              </button>

              <button
                onClick={() => navigate(`/select-plan?upgrade=true&planId=${planId}&billing=${billingType}`)}
                className="w-full py-2.5 text-gray-400 text-sm font-medium hover:text-gray-600 transition text-center"
              >
                ← Back to Plans
              </button>

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