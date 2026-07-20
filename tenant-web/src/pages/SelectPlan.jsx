// tenant-web/src/pages/SelectPlan.jsx

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { getPublicPlans } from "../services/plan.service";
import { useToast } from "../context/ToastContext";
import api from "../lib/axios";
import { ShieldAlert, ShieldCheck, Receipt, HelpCircle, ArrowRight } from "lucide-react";
import { createPortal } from "react-dom";

export default function SelectPlan() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [searchParams] = useSearchParams();

  const isUpgrade = searchParams.get("upgrade") === "true";

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [billingType, setBillingType] = useState("monthly");
  
  // Details Modal state
  const [activeDetailsPlan, setActiveDetailsPlan] = useState(null);
  
  // Dynamic subscription status tracking
  const [billingDetails, setBillingDetails] = useState(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    // Only redirect if NOT coming from upgrade and NOT expired
    if (!isUpgrade && user?.planId && user?.planStatus === "active") {
      navigate("/dashboard");
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const [plansRes, billingRes] = await Promise.all([
          getPublicPlans(),
          api.get("/billing").catch(() => null) // Ignore fallback errors
        ]);

        if (plansRes.success) {
          setPlans(plansRes.data);
        } else {
          setError(plansRes.message);
        }

        if (billingRes && billingRes.data?.success && billingRes.data?.data) {
          const billingData = billingRes.data.data;
          setBillingDetails(billingData);
          setIsExpired(billingData.subscriptionStatus === 'expired');
        }
      } catch (err) {
        console.error("Failed to load select plan details:", err);
        setError("An error occurred loading plans data.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getPrice = (plan) => {
    if (billingType === "annual" && plan.annualPrice) {
      return plan.annualPrice;
    }
    return plan.monthlyPrice;
  };

  const handleContinue = () => {
    if (!selectedPlanId) {
      toast.warning("Please select a plan to continue");
      return;
    }
    if (selectedPlanId === "enterprise") {
      navigate("/enterprise-request");
    } else {
      navigate(`/checkout?planId=${selectedPlanId}&billing=${billingType}`);
    }
  };

  const { planPeriodEnd, dataDeletionDate } = billingDetails || {};

  return (
    <div className="min-h-screen bg-gray-50 pb-12">

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
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 font-semibold">
            Logged in as <strong>{user?.email}</strong>
          </span>
          <button
            onClick={logout}
            className="px-4 py-2 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">

        {/* Dynamic Ended Subscription Banner */}
        {isExpired && (
          <div className="rounded-3xl bg-red-50 border border-red-100 p-6 flex flex-col md:flex-row md:items-center gap-6 shadow-sm animate-in fade-in duration-200">
            <div className="p-3 bg-red-500 text-white rounded-2xl shrink-0">
              <ShieldAlert size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-red-800">Your Subscription Has Ended</h3>
              <p className="text-sm text-red-600">
                Expired on: <strong>{planPeriodEnd ? new Date(planPeriodEnd).toLocaleDateString() : 'N/A'}</strong>. 
                {dataDeletionDate && ` Complete resubscription before ${new Date(dataDeletionDate).toLocaleDateString()} to avoid data removal.`}
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Prominent Support/Invoice Cards */}
        {isExpired && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
            <Link
              to="/dashboard/billing"
              className="group bg-white border border-slate-200 hover:border-blue-500 rounded-3xl p-5 shadow-sm hover:shadow-md transition duration-300 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-100 transition">
                  <Receipt size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm md:text-base">View Invoice History</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">Access and download your past billing receipts</p>
                </div>
              </div>
              <ArrowRight size={18} className="text-slate-400 group-hover:translate-x-1 group-hover:text-blue-600 transition" />
            </Link>

            <Link
              to="/contact"
              className="group bg-white border border-slate-200 hover:border-blue-500 rounded-3xl p-5 shadow-sm hover:shadow-md transition duration-300 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-100 transition">
                  <HelpCircle size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm md:text-base">Contact Support</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">Need help? Get in touch with our billing team</p>
                </div>
              </div>
              <ArrowRight size={18} className="text-slate-400 group-hover:translate-x-1 group-hover:text-amber-600 transition" />
            </Link>
          </div>
        )}

        {/* Title */}
        <div className="text-center mb-4">
          <span className="text-[#125EF2] font-semibold text-sm uppercase tracking-wider">
            {isExpired ? "Account Expired" : isUpgrade ? "Plan Upgrade" : "Step 1 of 2"}
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900 mt-2">
            {isExpired ? "Select a Subscription Plan" : <>Choose Your <span className="text-[#125EF2]">Plan</span></>}
          </h1>
          <p className="text-gray-500 mt-2 font-medium">
            {isExpired 
              ? "Choose a suitable business package below to regain instant access to your SudoReply workspace."
              : "Select the plan that best fits your business needs"
            }
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={() => setBillingType("monthly")}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
              billingType === "monthly"
                ? "bg-[#125EF2] text-white shadow-md"
                : "bg-white border border-gray-200 text-gray-600 hover:border-[#125EF2]"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingType("annual")}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
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
              <span className="text-sm font-semibold">Loading plans...</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-10">
            <p className="text-red-500 text-sm font-bold">{error}</p>
          </div>
        )}

        {/* Plans Grid */}
        {!loading && !error && (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {[
                ...plans,
                {
                  id: "enterprise",
                  name: "Enterprise",
                  description: "For large teams requiring custom volume, dedicated channels, and full-scale WhatsApp operations.",
                  monthlyPrice: 0,
                  isEnterprise: true,
                  features: [
                    { id: "e1", name: "Unlimited Agents & Users" },
                    { id: "e2", name: "Official WhatsApp Green Tick" },
                    { id: "e3", name: "Custom API & Webhook limits" },
                    { id: "e4", name: "Dedicated Account Manager" },
                    { id: "e5", name: "24/7 SLA Priority Support" },
                    { id: "e6", name: "Custom integrations" }
                  ],
                  maxAgents: "Unlimited",
                  maxBroadcasts: null
                }
              ].map((plan, index) => {
                const isPopular = index === 1;
                const isSelected = selectedPlanId === plan.id;
                const isCurrentPlan =
                  plan.id === user?.planId ||
                  (plan.id === "enterprise" && user?.planStatus === "enterprise_active");
                const isDisabled = isCurrentPlan && !isExpired && !isUpgrade;
                const price = plan.isEnterprise ? null : getPrice(plan);

                return (
                  <div
                    key={plan.id}
                    onClick={() => !isDisabled && setSelectedPlanId(plan.id)}
                    className={`
                      relative rounded-3xl p-6 cursor-pointer border
                      transition-all duration-300 flex flex-col justify-between
                      ${isDisabled ? "opacity-75 cursor-not-allowed" : ""}
                      ${
                        isSelected && !isDisabled
                          ? "ring-4 ring-[#125EF2] shadow-xl scale-[1.02]"
                          : !isDisabled ? "hover:shadow-lg hover:-translate-y-1 hover:border-[#125EF2]" : ""
                      }
                      ${
                        isPopular
                          ? "bg-gray-900 text-white font-medium border-transparent"
                          : plan.isEnterprise
                          ? "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200"
                          : "bg-white border-slate-100"
                      }
                    `}
                  >
                  
                    {/* Current Plan Badge */}
                    {isCurrentPlan && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-block bg-emerald-500 text-white text-[11px] font-bold px-4 py-1 rounded-full shadow">
                        ✓ Current Plan
                      </span>
                    )}

                    {/* Popular Badge — only show if NOT current plan */}
                    {isPopular && !isCurrentPlan && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-block bg-[#125EF2] text-white text-[10px] font-bold px-4 py-1 rounded-full shadow uppercase tracking-wide">
                        Most Popular
                      </span>
                    )}

                    {/* Enterprise Special Badge */}
                    {plan.isEnterprise && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-block bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold px-4 py-1 rounded-full shadow uppercase tracking-wide">
                        Enterprise
                      </span>
                    )}

                    {/* Selected Check — only show if NOT disabled */}
                    {isSelected && !isDisabled && (
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

                    {/* Current Plan Check Icon (only when not selected) */}
                    {isCurrentPlan && !isSelected && (
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

                    <div>
                      {/* Plan Name */}
                      <h3 className="text-xl font-bold mt-2">{plan.name}</h3>

                      {/* Price */}
                      <div className="mt-3 mb-1">
                        {plan.isEnterprise ? (
                          <span className="text-2xl font-extrabold text-blue-700">Custom Pricing</span>
                        ) : (
                          <>
                            <span className="text-4xl font-extrabold">
                              ₹{price.toLocaleString()}
                            </span>
                            <span
                              className={`text-sm font-semibold ml-1 ${
                                isPopular ? "text-gray-400" : "text-gray-500"
                              }`}
                            >
                              /{billingType === "annual" ? "yr" : "mo"}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Annual Savings */}
                      {!plan.isEnterprise && billingType === "annual" && plan.annualPrice && (
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
                        className={`text-xs mt-3 mb-5 leading-relaxed font-medium ${
                          isPopular ? "text-gray-300" : plan.isEnterprise ? "text-slate-600" : "text-gray-500"
                        }`}
                      >
                        {plan.description}
                      </p>

                      {/* Description */}
                      <p
                        className={`text-xs mt-3 mb-4 leading-relaxed font-medium ${
                          isPopular ? "text-gray-300" : plan.isEnterprise ? "text-slate-600" : "text-gray-500"
                        }`}
                      >
                        {plan.description}
                      </p>

                      {/* More Details Toggle Trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDetailsPlan(plan);
                        }}
                        className={`text-xs font-bold underline transition mb-4 block ${
                          isPopular ? "text-blue-300 hover:text-white" : "text-[#125EF2] hover:text-[#0F4FCC]"
                        }`}
                      >
                        More details
                      </button>

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
                    </div>

                    <div>
                      {/* Limits */}
                      <div
                        className={`text-xs space-y-1 pt-3 border-t ${
                          isPopular
                            ? "border-white/10 text-gray-400"
                            : plan.isEnterprise
                            ? "border-blue-200 text-blue-800 font-semibold"
                            : "border-gray-100 text-gray-500"
                        }`}
                      >
                        <p>👥 {plan.maxAgents === "Unlimited" ? "Unlimited agents" : `Up to ${plan.maxAgents} agents`}</p>
                        {plan.isEnterprise ? (
                          <p>📢 Unlimited broadcasts</p>
                        ) : plan.maxBroadcasts ? (
                          <p>📢 {plan.maxBroadcasts} broadcasts/month</p>
                        ) : (
                          <p>📢 Unlimited broadcasts</p>
                        )}
                      </div>

                      {/* Select / Current Plan Button */}
                      <button
                        disabled={isDisabled}
                        className={`
                          mt-5 w-full py-2.5 rounded-xl font-bold text-sm transition
                          ${
                            isDisabled
                              ? "bg-emerald-100 text-emerald-700 cursor-not-allowed"
                              : isSelected
                              ? "bg-[#125EF2] text-white shadow"
                              : isPopular
                              ? "bg-white/20 text-white hover:bg-white/30"
                              : plan.isEnterprise
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }
                        `}
                      >
                        {isDisabled
                          ? "✓ Current Plan"
                          : isSelected
                          ? "✓ Selected"
                          : plan.isEnterprise
                          ? "Contact Sales"
                          : "Select Plan"}
                      </button>
                    </div>
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
                {selectedPlanId === "enterprise" 
                  ? "Talk to Sales →" 
                  : isUpgrade 
                  ? "Continue to Upgrade →" 
                  : "Continue to Payment →"}
              </button>
              <p className="text-xs text-gray-400 mt-3 font-semibold">
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

        {/* Secure Encryption Badge */}
        <div className="pt-8 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 border-t border-slate-100">
          <ShieldCheck size={16} className="text-emerald-500" />
          <span>Secure 256-bit SSL encrypted billing operations</span>
        </div>

        {/* Detailed Plan Specifications Modal */}
        {activeDetailsPlan && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in scale-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                <div>
                  <span className="text-[10px] font-extrabold text-[#125EF2] bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {activeDetailsPlan.name} Plan Details
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-800 mt-1.5">
                    Plan Specifications
                  </h3>
                </div>
                <button
                  onClick={() => setActiveDetailsPlan(null)}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pricing & Terms</p>
                  <div className="mt-2 flex items-baseline">
                    <span className="text-3xl font-extrabold text-slate-800">
                      {activeDetailsPlan.isEnterprise ? "Custom Pricing" : `₹${getPrice(activeDetailsPlan).toLocaleString()}`}
                    </span>
                    {!activeDetailsPlan.isEnterprise && (
                      <span className="text-sm font-semibold text-slate-400 ml-1">
                        /{billingType === "annual" ? "yr" : "mo"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-2">
                    {activeDetailsPlan.description}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Core Limits</p>
                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-100 rounded-2xl p-4">
                    <div>
                      <p className="text-slate-400 font-semibold">👥 Team Agents</p>
                      <p className="font-extrabold text-slate-700 mt-1">{activeDetailsPlan.maxAgents === "Unlimited" ? "Unlimited seats" : `${activeDetailsPlan.maxAgents} seats`}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-semibold">📢 Broadcast Limit</p>
                      <p className="font-extrabold text-slate-700 mt-1">{activeDetailsPlan.maxBroadcasts === "Unlimited" || !activeDetailsPlan.maxBroadcasts ? "Unlimited campaigns" : `${activeDetailsPlan.maxBroadcasts}/mo`}</p>
                    </div>
                    <div className="col-span-2 border-t border-slate-200/50 pt-2.5 mt-1">
                      <p className="text-slate-400 font-semibold">⚡ Support Channel SLA</p>
                      <p className="font-extrabold text-slate-700 mt-1">
                        {activeDetailsPlan.name.toLowerCase().includes("starter")
                          ? "Email support (24 hours response time)"
                          : activeDetailsPlan.isEnterprise
                          ? "24/7 SLA Priority chat support (1 hour response time)"
                          : "Priority Whatsapp & Chat support (4 hours response time)"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Included Features</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
                    {activeDetailsPlan.features?.map((pf) => (
                      <li key={pf.id} className="flex gap-2 text-xs text-slate-600 font-medium items-start">
                        <span className="text-[#125EF2] font-bold shrink-0 mt-0.5">✓</span>
                        <span>{pf.feature?.name || pf.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  onClick={() => {
                    setSelectedPlanId(activeDetailsPlan.id);
                    setActiveDetailsPlan(null);
                  }}
                  disabled={
                    !activeDetailsPlan.isEnterprise && (
                      activeDetailsPlan.id === user?.planId ||
                      (activeDetailsPlan.id === "enterprise" && user?.planStatus === "enterprise_active")
                    )
                  }
                  className="flex-1 py-3 rounded-xl bg-[#125EF2] hover:bg-[#0F4FCC] text-xs font-extrabold text-white shadow-sm hover:shadow transition disabled:opacity-50"
                >
                  Select this Plan
                </button>
                <button
                  onClick={() => setActiveDetailsPlan(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-600 hover:bg-slate-50 transition"
                >
                  Close details
                </button>
              </div>

            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}