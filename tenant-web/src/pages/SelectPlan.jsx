// tenant-web/src/pages/SelectPlan.jsx

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { getPublicPlans } from "../services/plan.service";


export default function SelectPlan() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
   const [searchParams] = useSearchParams();        // ← ADD THIS

  const isUpgrade = searchParams.get("upgrade") === "true"; // ← ADD THIS

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [billingType, setBillingType] = useState("monthly");

   useEffect(() => {
    // ✅ FIXED: Only redirect if NOT coming from upgrade
    if (!isUpgrade && user?.planId && user?.planStatus === "active") {
      navigate("/dashboard");
      return;
    }

    const loadPlans = async () => {
      setLoading(true);
      const res = await getPublicPlans();
      if (res.success) {
        setPlans(res.data);
      } else {
        setError(res.message);
      }
      setLoading(false);
    };
    loadPlans();
  }, []);

  const getPrice = (plan) => {
    if (billingType === "annual" && plan.annualPrice) {
      return plan.annualPrice;
    }
    return plan.monthlyPrice;
  };

  const handleContinue = () => {
    if (!selectedPlanId) {
      alert("Please select a plan to continue");
      return;
    }
    navigate(`/checkout?planId=${selectedPlanId}&billing=${billingType}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
 <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
  <div className="flex items-center gap-2">
    <Link to="/" className="inline-flex items-center">
      <img
        src="/sudo_bg.png"
        alt="SudoReply Logo"
        className="w-12 h-12 object-contain"
      />
    </Link>
    {/* <span className="font-bold text-gray-900">SudoReply</span> */}
  </div>

   

        <span className="text-sm text-gray-500">
          Logged in as <strong>{user?.email}</strong>
        </span>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* Title */}
        <div className="text-center mb-4">
          <span className="text-[#125EF2] font-semibold text-sm uppercase tracking-wider">
            Step 1 of 2
          </span>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            Choose Your <span className="text-[#125EF2]">Plan</span>
          </h1>
          <p className="text-gray-500 mt-2">
            Select the plan that best fits your business needs
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={() => setBillingType("monthly")}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition ${
              billingType === "monthly"
                ? "bg-[#125EF2] text-white shadow-md"
                : "bg-white border border-gray-200 text-gray-600 hover:border-[#125EF2]"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingType("annual")}
            className={`px-5 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              billingType === "annual"
                ? "bg-[#125EF2] text-white shadow-md"
                : "bg-white border border-gray-200 text-gray-600 hover:border-[#125EF2]"
            }`}
          >
            Annual
            <span className="bg-green-100 text-green-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              Save 25%
            </span>
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-400">
              <svg
                className="animate-spin w-5 h-5 text-[#125EF2]"
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
              <span className="text-sm">Loading plans...</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-10">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {/* Plans Grid */}
        {!loading && !error && (
          <>
            <div className="grid md:grid-cols-3 gap-6 mb-10">
              {plans.map((plan, index) => {
                const isPopular = index === 1;
                const isSelected = selectedPlanId === plan.id;
                const isCurrentPlan = plan.id === user?.planId; 
                const price = getPrice(plan);

                return (
                  <div
                    key={plan.id}
                  onClick={() => !isCurrentPlan && setSelectedPlanId(plan.id)}
                   className={`
  relative rounded-2xl p-6 cursor-pointer
  transition-all duration-300
  ${isCurrentPlan ? "opacity-75 cursor-not-allowed" : ""}
  ${
    isSelected && !isCurrentPlan
      ? "ring-4 ring-[#125EF2] shadow-xl scale-[1.02]"
      : !isCurrentPlan ? "hover:shadow-lg hover:-translate-y-1" : ""
  }
                      ${
                        isPopular
                          ? "bg-gray-900 text-white"
                          : "bg-white border border-gray-200"
                      }
                    `}
                  >
                  
                 {/* Current Plan Badge */}
                    {isCurrentPlan && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-block bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow">
                        ✓ Current Plan
                      </span>
                    )}

                    {/* Popular Badge — only show if NOT current plan */}
                    {isPopular && !isCurrentPlan && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-block bg-[#125EF2] text-white text-xs font-bold px-4 py-1 rounded-full shadow">
                        Most Popular
                      </span>
                    )}

                    {/* Selected Check — only show if NOT current plan */}
                    {isSelected && !isCurrentPlan && (
                      <div className="absolute top-4 right-4 w-6 h-6 bg-[#125EF2] rounded-full flex items-center justify-center">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="3"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}

                    {/* Current Plan Check Icon */}
                    {isCurrentPlan && (
                      <div className="absolute top-4 right-4 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="3"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}

                    {/* Plan Name */}
                    <h3 className="text-xl font-bold mt-2">{plan.name}</h3>

                    {/* Price */}
                    <div className="mt-3 mb-1">
                      <span className="text-4xl font-bold">
                        ₹{price.toLocaleString()}
                      </span>
                      <span
                        className={`text-sm ml-1 ${
                          isPopular ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        /mo
                      </span>
                    </div>

                    {/* Annual Savings */}
                    {billingType === "annual" && plan.annualPrice && (
                      <p className="text-xs text-green-400 font-medium mb-1">
                        Save ₹
                        {(
                          (plan.monthlyPrice - plan.annualPrice) *
                          12
                        ).toLocaleString()}
                        /year
                      </p>
                    )}

                    {/* Description */}
                    <p
                      className={`text-sm mb-5 ${
                        isPopular ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      {plan.description}
                    </p>

                    {/* Features */}
                    <ul className="space-y-2 mb-6">
                      {plan.features?.map((pf) => (
                        <li
                          key={pf.id}
                          className={`flex gap-2 text-sm ${
                            isPopular ? "text-gray-300" : "text-gray-600"
                          }`}
                        >
                          <span className="text-[#125EF2] font-bold shrink-0">
                            ✓
                          </span>
                          {pf.feature?.name || pf.name}
                        </li>
                      ))}
                    </ul>

                    {/* Limits */}
                    <div
                      className={`text-xs space-y-1 pt-3 border-t ${
                        isPopular
                          ? "border-white/10 text-gray-400"
                          : "border-gray-100 text-gray-500"
                      }`}
                    >
                      <p>👥 Up to {plan.maxAgents} agents</p>
                      {plan.maxBroadcasts && (
                        <p>📢 {plan.maxBroadcasts} broadcasts/month</p>
                      )}
                    </div>

                    {/* Select / Current Plan Button */}
                    <button
                      disabled={isCurrentPlan}
                      className={`
                        mt-5 w-full py-2.5 rounded-xl font-semibold text-sm transition
                        ${
                          isCurrentPlan
                            ? "bg-emerald-100 text-emerald-700 cursor-not-allowed"
                            : isSelected
                            ? "bg-[#125EF2] text-white"
                            : isPopular
                            ? "bg-white/20 text-white hover:bg-white/30"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }
                      `}
                    >
                      {isCurrentPlan
                        ? "✓ Current Plan"
                        : isSelected
                        ? "✓ Selected"
                        : "Select Plan"}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Continue Button */}
            <div className="text-center">
              <button
                onClick={handleContinue}
                disabled={!selectedPlanId}
                className={`
                  px-10 py-3.5 rounded-xl font-bold text-sm transition-all duration-300
                  ${
                    selectedPlanId
                      ? "bg-[#125EF2] text-white hover:bg-[#0F4FCC] shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }
                `}
              >
                {isUpgrade ? "Continue to Upgrade →" : "Continue to Payment →"}
              </button>
              <p className="text-xs text-gray-400 mt-3">
                🔒 Secure checkout. Cancel anytime.
              </p>

              {/* Back to Dashboard link for upgrade */}
              {isUpgrade && (
                <Link
                  to="/dashboard/billing"
                  className="inline-block mt-4 text-sm text-[#125EF2] hover:text-[#0F4FCC] font-semibold"
                >
                  ← Back to Billing
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}