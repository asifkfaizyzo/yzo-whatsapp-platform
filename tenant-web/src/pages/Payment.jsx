// tenant-web/src/pages/Payment.jsx

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams,Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useToast } from "../context/ToastContext";
import {
  getPublicPlans,
  createPaymentOrder,
  verifyPayment,
} from "../services/plan.service";

// Dynamically load Razorpay checkout.js only when needed
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
      razorpayScriptPromise = null; // allow retry on failure
      reject(new Error("Failed to load Razorpay SDK"));
    };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

export default function Payment() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("planId");
  const billingType = searchParams.get("billing") || "monthly";

  const { user, login, accessToken } = useAuthStore();

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paid, setPaid] = useState(false);

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

  const getPrice = () => {
    if (!plan) return 0;
    if (billingType === "annual" && plan.annualPrice) {
      return plan.annualPrice;
    }
    return plan.monthlyPrice;
  };

  const handlePayment = async () => {
    setProcessing(true);

    try {
      // Load Razorpay SDK dynamically (only on first payment attempt)
      await loadRazorpayScript();

      // Step 1: Create order from backend
      const orderRes = await createPaymentOrder(planId, billingType);

      if (!orderRes.success) {
        toast.error("Failed to create order: " + orderRes.message);
        setProcessing(false);
        return;
      }

      const { orderId, amount, currency } = orderRes.data;

      // Step 2: Open Razorpay popup
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount,
        currency,
        name: "SudoReply",
        description: `${plan.name} Plan - ${billingType}`,
        image: "https://www.sudoreply.com/sudo2.png",
        order_id: orderId,

        // Step 3: Handle payment success
        handler: async function (response) {
          const verifyRes = await verifyPayment({
            razorpay_order_id:  response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
            planId,
            billingType,
          });

          if (verifyRes.success) {
            setPaid(true);

            // Update auth store with new plan info AND approved status
            const updatedUser = {
              ...user,
              planId,
              planStatus: "active",
              billingType,
              status: "APPROVED",
            };
            login(updatedUser, accessToken);

            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
              navigate("/dashboard");
            }, 2000);

          } else {
            toast.error("Payment verification failed: " + verifyRes.message);
            setProcessing(false);
          }
        },

        // Prefill tenant details
        prefill: {
          name:    user?.tenantName || user?.name || "",
          email:   user?.email || "",
          contact: user?.phone || "",
        },

        // Theme color
        theme: {
          color: "#125EF2",
        },

        // Handle popup close
        modal: {
          ondismiss: function () {
            setProcessing(false);
          },
        },
      };

      // Open Razorpay
      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.open();

    } catch (err) {
      console.error("Payment error:", err);
      toast.error("Something went wrong. Please try again.");
      setProcessing(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#125EF2]"></div>
      </div>
    );
  }

  // Payment success screen
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
          <p className="text-gray-400 text-xs mb-4">
            Redirecting to your dashboard...
          </p>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#125EF2]"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
           src="/sudo_bg.png"
        alt="SudoReply Logo"
        className="w-12 h-12 object-contain"
          />
          {/* <span className="font-bold text-gray-900">SudoReply</span> */}
        </div>
        <span className="text-sm text-gray-500">
          Step 2 of 2 — Payment
        </span>
      </div>

      <div className="max-w-lg mx-auto px-6 py-12">

        {/* Title */}
        <div className="text-center mb-8">
          <span className="text-[#125EF2] font-semibold text-sm uppercase tracking-wider">
            Step 2 of 2
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            Complete <span className="text-[#125EF2]">Payment</span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            You are subscribing to <strong>{plan?.name}</strong> plan
          </p>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">
            Order Summary
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">Plan</span>
              <span className="font-semibold text-gray-900 text-sm">
                {plan?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">Billing</span>
              <span className="font-semibold text-gray-900 text-sm capitalize">
                {billingType}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">Agents</span>
              <span className="font-semibold text-gray-900 text-sm">
                Up to {plan?.maxAgents}
              </span>
            </div>

            {/* Total */}
            <div className="border-t border-gray-100 pt-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900">Total</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-[#125EF2]">
                    ₹{getPrice().toLocaleString()}
                  </span>
                  <span className="text-gray-400 text-sm ml-1">
                    /{billingType === "annual" ? "mo" : "month"}
                  </span>
                </div>
              </div>
              {billingType === "annual" && (
                <p className="text-xs text-green-600 text-right mt-1 font-medium">
                  Billed ₹{(getPrice() * 12).toLocaleString()}/year
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            What's included:
          </h3>
          <ul className="space-y-2">
            {plan?.features?.map((pf) => (
              <li
                key={pf.id}
                className="flex gap-2 text-sm text-gray-600"
              >
                <span className="text-[#125EF2] font-bold shrink-0">✓</span>
                {pf.feature?.name || pf.name}
              </li>
            ))}
          </ul>
        </div>

        {/* Pay Button */}
        <button
          onClick={handlePayment}
          disabled={processing}
          className={`
            w-full py-4 rounded-xl font-bold text-sm
            transition-all duration-300
            ${processing
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-[#125EF2] text-white hover:bg-[#0F4FCC] shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            }
          `}
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
            `Pay ₹${getPrice().toLocaleString()} →`
          )}
        </button>

        {/* Back */}
        <button
          onClick={() => navigate("/select-plan")}
          className="w-full py-2.5 mt-3 text-gray-400 text-sm font-medium hover:text-gray-600 transition"
        >
          ← Back to Plans
        </button>

        {/* Security Note */}
        <p className="text-center text-[11px] text-gray-400 mt-4">
          🔒 Secured by Razorpay • UPI • Cards • NetBanking • Wallets
        </p>
      </div>
    </div>
  );
}