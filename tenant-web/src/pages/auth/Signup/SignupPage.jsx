// tenant-web/src/pages/auth/Signup/SignupPage.jsx
import { Link } from "react-router-dom";
import { useSignupStepper } from "./comps/hooks/useSignupStepper";
import CreateAccount from "./comps/CreateAccount";
import EmailOTP from "./comps/EmailOTP";
import ProfileSetup from "./comps/ProfileSetup";
import OAuthSetup from "./comps/OAuthSetup";
import CompanyDetails from "./comps/CompanyDetails";
import BusinessDetails from "./comps/BusinessDetails";

// ═══════════════════════════════════════════════════════════════════
//  MOCK MODE — set to false when backend is ready
//  When true: all API calls are skipped, forms just advance steps,
//  and a dummy user is seeded into the auth store so route guards pass.
// ═══════════════════════════════════════════════════════════════════
const MOCK_SIGNUP = true;

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

const benefits = [
  {
    title: "Official WhatsApp Cloud API",
    text: "Direct integration with Meta's official API for maximum reliability and green-tick eligibility.",
  },
  {
    title: "Bulk WhatsApp Broadcasting",
    text: "Send personalized campaign messages to thousands of contacts with a single click.",
  },
  {
    title: "Multi-Agent Shared Inbox",
    text: "Collaborate seamlessly. Assign chats, label contacts, and support customers together.",
  },
];

export default function SignupPage() {
  const {
    step,
    totalSteps,
    currentMeta,
    isOAuth,
    userData,
    nextStep,
    goBack,
    handleOAuthStart,
  } = useSignupStepper({ mockMode: MOCK_SIGNUP });

  // ── Dynamic Step Component Resolution ──
  const activeStepList = isOAuth ? OAUTH_STEPS : REGULAR_STEPS;
  const currentStepConfig = activeStepList[step - 1] || activeStepList[0];
  const StepComponent = currentStepConfig.Component;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row font-sans">
      <style>{AUTH_STYLES}</style>

      {/* ════════ Left panel (branding) ════════ */}
      <div
        className="hidden lg:flex w-5/12 min-h-screen p-12 text-white flex-col justify-between relative overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, #0c3aa6 0%, #125fe2 46%, #1547a8 100%)",
        }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5 blur-[110px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-24 w-96 h-96 rounded-full bg-[#0c3aa6]/40 blur-[110px] pointer-events-none" />

        {/* Message constellation */}
        <div
          className="absolute inset-0 pointer-events-none select-none"
          aria-hidden="true"
        >
          <div
            className="absolute sr-bubble-a"
            style={{
              top: "14%",
              left: "8%",
              width: 92,
              height: 34,
              background: "rgba(255,255,255,0.07)",
              borderRadius: "16px 16px 16px 4px",
            }}
          />
          <div
            className="absolute sr-bubble-b"
            style={{
              top: "22%",
              left: "62%",
              width: 70,
              height: 28,
              background: "rgba(255,255,255,0.10)",
              borderRadius: "16px 16px 4px 16px",
            }}
          />
          <div
            className="absolute sr-bubble-c"
            style={{
              top: "38%",
              left: "18%",
              width: 56,
              height: 24,
              background: "rgba(255,255,255,0.06)",
              borderRadius: "16px 16px 16px 4px",
            }}
          />
          <div
            className="absolute sr-bubble-a"
            style={{
              top: "46%",
              left: "70%",
              width: 84,
              height: 30,
              background: "rgba(255,255,255,0.08)",
              borderRadius: "16px 16px 4px 16px",
            }}
          />
          <div
            className="absolute sr-bubble-b"
            style={{
              top: "62%",
              left: "6%",
              width: 64,
              height: 26,
              background: "rgba(255,255,255,0.06)",
              borderRadius: "16px 16px 16px 4px",
            }}
          />
          <div
            className="absolute rounded-full bg-emerald-400 sr-pulse-dot"
            style={{ top: "31%", left: "56%", width: 8, height: 8 }}
          />
          <div
            className="absolute rounded-full bg-white/40 sr-pulse-dot"
            style={{
              top: "57%",
              left: "24%",
              width: 6,
              height: 6,
              animationDelay: "0.8s",
            }}
          />
        </div>

        {/* Logo Header */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center">
            <img
              src="/sudo2.png"
              alt="SudoReply Logo"
              className="h-24 w-auto object-contain filter drop-shadow-md brightness-110"
            />
          </Link>
        </div>

        <div className="relative z-10 my-auto py-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200/80">
            SudoReply Workspace
          </p>
          <h1 className="mt-4 text-4xl xl:text-[2.75rem] font-bold tracking-tight leading-[1.15]">
            Scale your customer relationships on WhatsApp.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-blue-100/70">
            Enterprises rely on SudoReply to orchestrate bulk campaigns,
            maintain shared team inboxes, and process customer interactions on
            Meta's official WhatsApp Cloud API.
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          {benefits.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md transition-colors duration-200 hover:bg-white/[0.09]"
            >
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <CheckIcon />
                {item.title}
              </h3>
              <p className="mt-1 text-[13px] text-blue-100/60 leading-relaxed pl-6">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ════════ Right panel (form) ════════ */}
      <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
        {/* Mobile branding */}
        <div className="flex flex-col items-center text-center lg:hidden mb-8">
          <Link to="/" className="inline-flex items-center mb-4">
            <img
              src="/sudo2.png"
              alt="SudoReply Logo"
              className="h-16 w-auto object-contain"
            />
          </Link>
          <h1 className="text-[1.75rem] font-bold text-slate-900 tracking-tight">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-sm">
            Launch your company WhatsApp platform and start interacting at
            scale.
          </p>
        </div>

        <div className="w-full max-w-[480px]">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-16px_rgba(15,23,42,0.08)] p-8 sm:p-10">
            {/* ── Stepper progress bar ── */}
            <div className="mb-8">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                <span>
                  Step {step} of {totalSteps}
                </span>
                <span>{currentMeta.label}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#125fe2] rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${(step / totalSteps) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* ── Mock mode banner ── */}
            {MOCK_SIGNUP && (
              <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs text-amber-700 font-medium flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                Mock mode — no API calls. Set MOCK_SIGNUP = false to go live.
              </div>
            )}

            {/* ── Dynamic Step Render ── */}
            <div
              className="space-y-4 sr-animate-fade-in-slide"
              key={`${step}-${isOAuth}`}
            >
              <StepComponent
                mockMode={MOCK_SIGNUP}
                meta={currentMeta}
                userData={userData}
                onContinue={nextStep}
                onBack={currentStepConfig.hasBack ? goBack : undefined}
                onOAuth={handleOAuthStart}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */
function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 text-emerald-300 stroke-[3px] shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={3}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

/* ── Self-contained styles ── */
const AUTH_STYLES = `
@keyframes sr-fade-in-slide { from { opacity: 0; transform: translateY(14px);} to { opacity: 1; transform: translateY(0);} }
@keyframes sr-drift-a { 0%,100% { transform: translate(0,0) rotate(0deg);} 50% { transform: translate(6px,-10px) rotate(1.5deg);} }
@keyframes sr-drift-b { 0%,100% { transform: translate(0,0) rotate(0deg);} 50% { transform: translate(-8px,8px) rotate(-1.5deg);} }
@keyframes sr-drift-c { 0%,100% { transform: translate(0,0);} 50% { transform: translate(4px,10px);} }
@keyframes sr-pulse-dot { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }

.sr-animate-fade-in-slide { animation: sr-fade-in-slide 0.55s cubic-bezier(0.16,1,0.3,1) both; }
.sr-bubble-a { animation: sr-drift-a 7s ease-in-out infinite; }
.sr-bubble-b { animation: sr-drift-b 8.5s ease-in-out infinite; }
.sr-bubble-c { animation: sr-drift-c 6.5s ease-in-out infinite; }
.sr-pulse-dot { animation: sr-pulse-dot 2.4s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .sr-animate-fade-in-slide, .sr-bubble-a, .sr-bubble-b, .sr-bubble-c, .sr-pulse-dot { animation: none !important; }
}

.sr-input {
  width: 100%; height: 46px; border-radius: 12px;
  border: 1.5px solid #e6eaf1; background: #fff; color: #0f172a;
  font-size: 0.9375rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.sr-input::placeholder { color: #94a3b8; }
.sr-input:hover { border-color: #cbd5e1; }
.sr-input:focus { outline: none; border-color: #125fe2; box-shadow: 0 0 0 4px rgba(18,95,226,0.16); }
.sr-input.sr-input-error { border-color: #dc2626; }
.sr-input.sr-input-error:focus { box-shadow: 0 0 0 4px rgba(220,38,38,0.1); }
.sr-input.sr-textarea { height: auto; padding-top: 12px; padding-bottom: 12px; resize: none; }

.sr-btn-primary {
  background: #125fe2; color: #fff; border-radius: 12px; height: 46px;
  font-weight: 600; font-size: 0.9375rem; letter-spacing: -0.01em;
  transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
}
.sr-btn-primary:hover:not(:disabled) { background: #0e4bc0; box-shadow: 0 8px 20px -6px rgba(18,95,226,0.45); }
.sr-btn-primary:active:not(:disabled) { background: #0b3d9e; transform: scale(0.98); }
.sr-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.sr-btn-secondary {
  background: #fff; color: #475569; border: 1.5px solid #e6eaf1; border-radius: 12px;
  height: 46px; font-weight: 600; font-size: 0.9375rem;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}
.sr-btn-secondary:hover { border-color: #cbd5e1; color: #0f172a; background: #f8fafc; }
`;