// tenant-web/src/pages/auth/Signup/SignupPage.jsx (do not remove this comment)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuthStore } from "../../../store/useAuthStore";
import { useSignupStepper } from "./comps/hooks/useSignupStepper";
import CreateAccount from "./comps/CreateAccount";
import EmailOTP from "./comps/EmailOTP";
import ProfileSetup from "./comps/ProfileSetup";
import OAuthSetup from "./comps/OAuthSetup";
import CompanyDetails from "./comps/CompanyDetails";
import BusinessDetails from "./comps/BusinessDetails";

// ═══════════════════════════════════════════════════════════════════
//  MOCK MODE — set to false when backend is ready
// ═══════════════════════════════════════════════════════════════════
const MOCK_SIGNUP = false;

// ── Step Component Maps ──
const REGULAR_STEPS = [
  { key: "create-account", Component: CreateAccount, hasBack: false },
  { key: "email-otp", Component: EmailOTP, hasBack: true },
  { key: "profile-setup", Component: ProfileSetup, hasBack: true },
  { key: "company-details", Component: CompanyDetails, hasBack: true },
  { key: "business-details", Component: BusinessDetails, hasBack: true },
];

const OAUTH_STEPS = [
  { key: "create-account", Component: CreateAccount, hasBack: false },
  { key: "oauth-setup", Component: OAuthSetup, hasBack: false },
  { key: "company-details", Component: CompanyDetails, hasBack: true },
  { key: "business-details", Component: BusinessDetails, hasBack: true },
];

export default function SignupPage({ onSwitchMode }) {
  const navigate = useNavigate();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const {
    step,
    totalSteps,
    currentMeta,
    isOAuth,
    isPreOnboarding,
    visibleStep,
    visibleTotalSteps,
    userData,
    nextStep,
    goBack,
    handleOAuthStart,
  } = useSignupStepper({ mockMode: MOCK_SIGNUP });

  const handleLogout = async () => {
    await useAuthStore.getState().logout();
    navigate("/login");
  };

  // ── Dynamic Step Component Resolution ──
  const activeStepList = isOAuth ? OAUTH_STEPS : REGULAR_STEPS;
  const currentStepConfig = activeStepList[step - 1] || activeStepList[0];
  const StepComponent = currentStepConfig.Component;

  return (
    <div className="w-full max-w-[420px] mx-auto sr-animate-fade-in-slide">
      {/* ── Save & exit ── */}
      {step > 1 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setShowExitConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.7rem] font-medium text-slate-400 border border-transparent hover:text-slate-600 hover:bg-slate-50 hover:border-slate-200 transition-all duration-200 cursor-pointer"
          >
            <LogOut size={12} />
            Save & exit
          </button>
        </div>
      )}

<div className="relative bg-white rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_32px_-8px_rgba(15,23,42,0.08)] p-6 sm:p-8 min-h-[540px] flex flex-col overflow-hidden">

  {/* ── Stepper (pinned to top, never centered) ── */}
  {!isPreOnboarding && (
    <div className="mb-5 shrink-0">
      <div className="flex items-center justify-between text-[0.68rem] font-semibold text-slate-400 uppercase tracking-wider mb-2">
        <span>
          Step {visibleStep} of {visibleTotalSteps}
        </span>
        <span className="text-[#125fe2] normal-case tracking-normal">
          {currentMeta.label}
        </span>
      </div>
      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${(visibleStep / visibleTotalSteps) * 100}%`,
            background: "linear-gradient(90deg, #125fe2, #3b82f6)",
          }}
        />
      </div>
    </div>
  )}

  {/* ── Mock mode banner ── */}
  {MOCK_SIGNUP && (
    <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-[0.75rem] text-amber-700 font-medium flex items-center gap-2 shrink-0">
      <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
      Mock mode — no API calls. Set MOCK_SIGNUP = false to go live.
    </div>
  )}

  {/* ── Centered content area (takes remaining vertical space) ── */}
  <div className="flex-1 flex items-center justify-center">
    <div
      className="w-full space-y-3 sr-animate-fade-in-slide"
      key={`${step}-${isOAuth}`}
    >
      <StepComponent
        mockMode={MOCK_SIGNUP}
        meta={currentMeta}
        userData={userData}
        onContinue={nextStep}
        onBack={currentStepConfig.hasBack ? goBack : undefined}
        onOAuth={handleOAuthStart}
        onSwitchMode={onSwitchMode}
      />
    </div>
  </div>

  {/* ── Custom exit confirmation overlay ── */}
  {showExitConfirm && (
    <div className="absolute inset-0 z-20 rounded-2xl bg-white/80 backdrop-blur-sm flex items-center justify-center sr-animate-fade-in-slide">
      <div className="w-[280px] bg-white rounded-2xl border border-slate-200 shadow-xl p-5 text-center">
        <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
          <LogOut size={18} className="text-slate-500" />
        </div>
        <h3 className="text-[0.95rem] font-bold text-slate-900 mb-1">
          Save & exit?
        </h3>
        <p className="text-[0.75rem] text-slate-400 mb-5 leading-relaxed">
          Your progress is saved automatically. You can pick up where you left off next time.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setShowExitConfirm(false)}
            className="flex-1 h-[38px] rounded-xl border border-slate-200 bg-white text-[0.8rem] font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150"
          >
            Cancel
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 h-[38px] rounded-xl bg-slate-900 text-[0.8rem] font-medium text-white hover:bg-slate-800 transition-all duration-150"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  )}
</div>
    </div>
  );
}
