// tenant-web/src/pages/SelectPlan.jsx

import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { getPublicPlans } from "../services/plan.service";
import { useToast } from "../context/ToastContext";
import api from "../lib/axios";
import { ShieldAlert, ShieldCheck, Receipt, HelpCircle, ArrowRight, Sparkles, CheckCircle2, CreditCard, ChevronLeft } from "lucide-react";
import { createPortal } from "react-dom";
import { PaymentVerifyingLoader, PaymentSuccessScreen } from "../components/CustomLoader";

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function SelectPlan() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user, logout, login, checkAuth, accessToken } = useAuthStore();
  const [searchParams] = useSearchParams();

  const isUpgrade = searchParams.get("upgrade") === "true";

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trialLoading, setTrialLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState(searchParams.get("planId") || null);
  const [billingType, setBillingType] = useState(searchParams.get("billing") || "monthly");
  
  // Details Modal state
  const [activeDetailsPlan, setActiveDetailsPlan] = useState(null);
  
  // Trial Confirmation Modal state
  const [showTrialConfirmModal, setShowTrialConfirmModal] = useState(false);
  const [trialPlanToConfirm, setTrialPlanToConfirm] = useState(null);
  
  // Verification & Celebration screen states
  const [verifying, setVerifying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [successPlanName, setSuccessPlanName] = useState("");
  
  // Dynamic subscription status tracking
  const [billingDetails, setBillingDetails] = useState(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    // Redirect active tenants (paid or trialing) directly to dashboard unless deliberately on upgrade page
    const hasActivePlan = user?.planId && (user?.planStatus === "active" || user?.subscriptionStatus === "trialing" || user?.subscriptionStatus === "active");
    if (!isUpgrade && hasActivePlan && !isExpired) {
      navigate("/dashboard", { replace: true });
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const [plansRes, billingRes] = await Promise.all([
          getPublicPlans(),
          api.get("/billing").catch(() => null)
        ]);

        if (plansRes.success) {
          setPlans(plansRes.data);
        } else {
          setError(plansRes.message);
        }

        if (billingRes && billingRes.data?.success && billingRes.data?.data) {
          const billingData = billingRes.data.data;
          setBillingDetails(billingData);
          setIsExpired(billingData.subscriptionStatus === 'expired' && !!billingData.planPeriodEnd);
        }
      } catch (err) {
        console.error("Failed to load select plan details:", err);
        setError("An error occurred loading plans data.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, isUpgrade, isExpired]);

  const getPrice = (plan) => {
    if (billingType === "annual" && plan.annualPrice) {
      return plan.annualPrice;
    }
    return plan.monthlyPrice;
  };

  const hasUsedTrial = billingDetails?.hasUsedTrial || user?.hasUsedTrial || false;
  // Free trial is applicable exclusively on monthly billing cycles
  const isEligibleForTrial = !hasUsedTrial && !isExpired && !isUpgrade && billingType === "monthly";

  const handleStartTrial = async (planId) => {
    const chosenPlan = plans.find(p => p.id === planId);
    if (!chosenPlan) return;

    setTrialLoading(true);
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        toast.error("Payment SDK failed to load. Please check your internet connection.");
        setTrialLoading(false);
        return;
      }

      const res = await api.post("/plans/create-subscription-trial", {
        planId,
        billingType: "monthly"
      });

      if (!res.data.success) {
        toast.error(res.data.message || "Failed to initiate free trial");
        setTrialLoading(false);
        return;
      }

      const { subscriptionId, keyId, trialDays = 14 } = res.data;

      const options = {
        key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        subscription_id: subscriptionId,
        name: "SudoReply",
        description: `${chosenPlan.name} Plan ${trialDays}-Day Free Trial (Autopay Setup)`,
        image: "/sudo_bg.png",
        handler: async function (response) {
          setTrialLoading(false);
          setVerifying(true);
          try {
            const verifyRes = await api.post("/plans/verify-subscription-trial", {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.data.success) {
              setVerifying(false);
              setSuccessPlanName(`${chosenPlan.name} (${trialDays}-Day Free Trial)`);
              setPaid(true);
              
              // 1. Update client-side user session in Zustand & localStorage
              const token = accessToken || localStorage.getItem("access_token");
              const updatedUser = {
                ...user,
                planId: chosenPlan.id,
                planStatus: "active",
                subscriptionStatus: "trialing",
                currentPlan: chosenPlan.name,
                hasUsedTrial: true,
              };
              login(updatedUser, token);

              // 2. Re-verify session in background
              await checkAuth().catch(() => {});

              // 3. Navigation to dashboard after celebration screen
              setTimeout(() => {
                window.location.href = "/dashboard";
              }, 2500);
            } else {
              setVerifying(false);
              toast.error(verifyRes.data?.message || "Failed to verify mandate.");
            }
          } catch (verifyErr) {
            setVerifying(false);
            toast.error(verifyErr.response?.data?.message || "Failed to verify mandate.");
          }
        },
        prefill: {
          name: user?.tenantName || user?.name || "",
          email: user?.email || "",
        },
        theme: {
          color: "#125EF2",
        },
        modal: {
          ondismiss: function () {
            setTrialLoading(false);
            setVerifying(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response) {
        setVerifying(false);
        toast.error("Mandate authorization failed: " + (response.error?.description || "Please try again."));
      });
      rzp.open();
    } catch (err) {
      console.error("Trial setup error:", err);
      toast.error(err.response?.data?.message || "Error starting trial");
    } finally {
      setTrialLoading(false);
    }
  };

  const handleContinue = () => {
    if (!selectedPlanId) {
      toast.warning("Please select a plan to continue");
      return;
    }
    if (selectedPlanId === "enterprise") {
      navigate("/enterprise-request");
      return;
    }

    const chosenPlan = plans.find(p => p.id === selectedPlanId);
    if (isEligibleForTrial && chosenPlan?.hasTrial !== false) {
      setTrialPlanToConfirm(chosenPlan);
      setShowTrialConfirmModal(true);
    } else {
      navigate(`/checkout?planId=${selectedPlanId}&billing=${billingType}`);
    }
  };

  // Payment Success Screen Celebration
  if (paid) {
    return <PaymentSuccessScreen planName={successPlanName} email={user?.email} />;
  }

  const { planPeriodEnd, dataDeletionDate } = billingDetails || {};

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Payment Verifying Full-Screen Overlay */}
      <PaymentVerifyingLoader visible={verifying} />

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="inline-flex items-center">
            <img
              src="/sudo_bg.png"
              alt="SudoReply Logo"
              className="w-12 h-12 object-contain"
            />
          </Link>
          {isUpgrade && (
            <Link
              to="/dashboard/billing"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
            >
              <ChevronLeft size={14} />
              <span>Back to Billing</span>
            </Link>
          )}
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

        {/* Free Trial Banner for new signups on monthly view */}
        {isEligibleForTrial && (
          <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                <Sparkles size={32} className="text-yellow-300" />
              </div>
              <div>
                <h2 className="text-xl font-black">Free Trial Available on Monthly Plans</h2>
                <p className="text-sm text-blue-100 font-medium mt-1">
                  Enjoy full access with ₹0 today. A ₹1–₹5 refundable token is verified by your bank to set up Autopay, then automatically redirected to your dashboard.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-bold bg-white/20 px-3.5 py-1.5 rounded-full backdrop-blur-sm">
                Cancel anytime during trial
              </span>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="text-center mb-4">
          <span className="text-[#125EF2] font-semibold text-sm uppercase tracking-wider">
            {isExpired ? "Account Expired" : isUpgrade ? "Plan Upgrade" : isEligibleForTrial ? "Start Free Trial" : "Step 1 of 2"}
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900 mt-2">
            {isExpired ? "Select a Subscription Plan" : <>Choose Your <span className="text-[#125EF2]">Plan</span></>}
          </h1>
          <p className="text-gray-500 mt-2 font-medium">
            {isExpired 
              ? "Choose a suitable business package below to regain instant access to your SudoReply workspace."
              : billingType === "annual"
              ? "Annual billing saves 25% with full-year paid subscription & immediate tax invoices."
              : isEligibleForTrial
              ? "Start a 14-day free trial or purchase directly to unlock your SudoReply workspace."
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
              Save 25% (Pay Upfront)
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

                    {/* Selected Check */}
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

                      {/* Free Trial Chip (Only on Monthly) */}
                      {isEligibleForTrial && !plan.isEnterprise && plan.hasTrial !== false && (
                        <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 font-extrabold text-[11px] px-2.5 py-1 rounded-full mb-2">
                          <CheckCircle2 size={13} />
                          <span>{plan.trialDays || 14}-Day Free Trial (₹0 Today)</span>
                        </div>
                      )}

                      {/* Annual Savings */}
                      {!plan.isEnterprise && billingType === "annual" && plan.annualPrice && (
                        <p className="text-xs text-green-400 font-medium mb-1">
                          Save ₹
                          {(
                            (plan.monthlyPrice - plan.annualPrice) *
                            12
                          ).toLocaleString()}
                          /year (25% OFF)
                        </p>
                      )}

                      {/* Description */}
                      <p
                        className={`text-xs mt-2 mb-4 leading-relaxed font-medium ${
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

                      {/* Dual Button Structure */}
                      <div className="mt-5 space-y-2">
                        {isDisabled ? (
                           <button
                            disabled
                            className="w-full py-2.5 rounded-xl font-bold text-sm bg-emerald-100 text-emerald-700 cursor-not-allowed text-center"
                          >
                            ✓ Current Plan
                          </button>
                        ) : plan.isEnterprise ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate("/enterprise-request");
                            }}
                            className="w-full py-2.5 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition text-center shadow"
                          >
                            Contact Sales →
                          </button>
                        ) : isEligibleForTrial && plan.hasTrial !== false ? (
                          <>
                            {/* Button 1: Start Trial with Confirmation Modal */}
                            <button
                              disabled={trialLoading}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPlanId(plan.id);
                                setTrialPlanToConfirm(plan);
                                setShowTrialConfirmModal(true);
                              }}
                              className={`
                                w-full py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm
                                ${
                                  isPopular
                                    ? "bg-[#125EF2] text-white hover:bg-[#0F4FCC]"
                                    : "bg-[#125EF2] text-white hover:bg-[#0F4FCC]"
                                }
                              `}
                            >
                              <Sparkles size={14} />
                              <span>Start {plan.trialDays || 14}-Day Free Trial (₹0)</span>
                            </button>

                            {/* Button 2: Pay Monthly Now (Skip Trial) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/checkout?planId=${plan.id}&billing=monthly`);
                              }}
                              className={`
                                w-full py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 border
                                ${
                                  isPopular
                                    ? "border-white/20 text-white hover:bg-white/10"
                                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                                }
                              `}
                            >
                              <CreditCard size={14} />
                              <span>Pay Monthly (Skip Trial)</span>
                            </button>
                          </>
                        ) : (
                          /* Standard Paid Direct Button (For Annual or Post-Trial) */
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/checkout?planId=${plan.id}&billing=${billingType}`);
                            }}
                            className={`
                              w-full py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-1.5 shadow
                              ${
                                isPopular
                                  ? "bg-[#125EF2] text-white hover:bg-[#0F4FCC]"
                                  : "bg-[#125EF2] text-white hover:bg-[#0F4FCC]"
                              }
                            `}
                          >
                            <CreditCard size={15} />
                            <span>
                              {billingType === "annual"
                                ? `Subscribe Annual (Save 25%)`
                                : `Subscribe Now (₹${price?.toLocaleString()})`}
                            </span>
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Secure Encryption Badge */}
        <div className="pt-8 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 border-t border-slate-100">
          <ShieldCheck size={16} className="text-emerald-500" />
          <span>Secure 256-bit SSL encrypted billing operations • Cancel anytime with 1 click</span>
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
                  <h3 className="text-xl font-extrabold text-slate-900 mt-1">{activeDetailsPlan.name} Plan</h3>
                </div>
                <button
                  onClick={() => setActiveDetailsPlan(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Resource Limits</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-xs text-slate-400 font-semibold">Agents</p>
                      <p className="font-bold text-slate-800 mt-0.5">{activeDetailsPlan.maxAgents === "Unlimited" ? "Unlimited" : `Up to ${activeDetailsPlan.maxAgents}`}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-xs text-slate-400 font-semibold">Monthly Broadcasts</p>
                      <p className="font-bold text-slate-800 mt-0.5">{activeDetailsPlan.maxBroadcasts ? `${activeDetailsPlan.maxBroadcasts.toLocaleString()}` : "Unlimited"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Included Features</h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    {activeDetailsPlan.features?.map((f) => (
                      <div key={f.id} className="flex items-center gap-3 text-sm text-slate-700 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/60">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-bold">✓</div>
                        <span className="font-medium">{f.name || f.feature?.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  onClick={() => setActiveDetailsPlan(null)}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition"
                >
                  Close
                </button>
              </div>

            </div>
          </div>,
          document.body
        )}

        {/* Free Trial Confirmation Modal */}
        {showTrialConfirmModal && trialPlanToConfirm && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden border-0 flex flex-col animate-in scale-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white relative">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-bold uppercase tracking-wider text-white">
                    <Sparkles size={13} />
                    <span>Risk-Free {trialPlanToConfirm.trialDays || 14}-Day Trial</span>
                  </div>
                  <button
                    onClick={() => setShowTrialConfirmModal(false)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                  >
                    ✕
                  </button>
                </div>
                <h3 className="text-2xl font-extrabold mt-3">Start your Free Trial</h3>
                <p className="text-blue-100 text-xs mt-1 font-medium">
                  Enjoy full access to {trialPlanToConfirm.name} Plan features for {trialPlanToConfirm.trialDays || 14} days.
                </p>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                
                {/* Pricing Summary Box */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-slate-600">Due Today (Trial Setup)</span>
                    <span className="text-emerald-600 font-extrabold text-base">₹0.00 (Free)</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-200">
                    <span>First Auto-Renewal (in {trialPlanToConfirm.trialDays || 14} days)</span>
                    <span className="font-bold text-slate-800">
                      ₹{(trialPlanToConfirm.monthlyPrice || 0).toLocaleString()} + 18% GST / month
                    </span>
                  </div>
                </div>

                {/* How Autopay Works Guarantees */}
                <div className="space-y-3 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 font-bold mt-0.5 text-[11px]">✓</div>
                    <div>
                      <p className="font-bold text-slate-800">₹0 Total Trial Cost</p>
                      <p className="text-slate-500 mt-0.5">Your bank/UPI app (GPay/PhonePe/Card) debits a small verification token (₹1–₹5) to register the mandate, which is <strong>automatically refunded immediately</strong> by Razorpay.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold mt-0.5 text-[11px]">⚡</div>
                    <div>
                      <p className="font-bold text-slate-800">Instant Dashboard Redirect</p>
                      <p className="text-slate-500 mt-0.5">Once you authorize the mandate in your UPI or banking app, you will be automatically redirected directly to your workspace dashboard.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 font-bold mt-0.5 text-[11px]">🛡️</div>
                    <div>
                      <p className="font-bold text-slate-800">Cancel Anytime in 1-Click</p>
                      <p className="text-slate-500 mt-0.5">You can cancel Autopay anytime under Billing Settings before Day {trialPlanToConfirm.trialDays || 14} with zero penalties or charges.</p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 px-6 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button
                  onClick={() => {
                    const planIdToRun = trialPlanToConfirm.id;
                    setShowTrialConfirmModal(false);
                    handleStartTrial(planIdToRun);
                  }}
                  disabled={trialLoading}
                  className="flex-1 py-3 bg-[#125EF2] hover:bg-[#0d4fd6] text-white rounded-xl text-sm font-bold transition shadow-md flex items-center justify-center gap-2"
                >
                  {trialLoading ? (
                    <span>Initiating...</span>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Confirm & Setup Autopay (₹0)</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowTrialConfirmModal(false)}
                  className="px-5 py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-bold transition"
                >
                  Cancel
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