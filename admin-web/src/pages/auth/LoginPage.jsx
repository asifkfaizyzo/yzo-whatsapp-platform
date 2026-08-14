import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAdminAuthStore } from "../../store/useAdminAuthStore";
import { loginSuperAdmin } from "../../lib/authApi";
import { useFormHandler } from "../../hooks/useFormHandler";
import { loginSchema } from "../../validations/auth.validation";
import FormError from "../../components/FormError";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

const benefits = [
  {
    title: "Tenant Operations",
    text: "Provision workspaces, configure system settings, and manage tenant subscriptions seamlessly.",
  },
  {
    title: "Platform Monitor",
    text: "Real-time auditing, platform health dashboard, and detailed API transaction logs.",
  },
  {
    title: "Provider Console",
    text: "Manage global WhatsApp API gateway configurations, webhooks, and provider access credentials.",
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAdminAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  // If already logged in, redirect away from login page
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const {
    register,
    onSubmit,
    generalError,
    formState: { errors, isSubmitting },
  } = useFormHandler({
    schema: loginSchema,
    defaultValues: { email: "", password: "" },
    onSubmitService: (data) => loginSuperAdmin(data.email, data.password),
    onSuccess: () => navigate("/dashboard"),
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row font-sans">
      <style>{AUTH_STYLES}</style>

      {/* Left panel */}
      <div
        className="hidden lg:flex w-5/12 min-h-screen p-12 text-white flex-col justify-between relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0c3aa6 0%, #125fe2 46%, #1547a8 100%)" }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5 blur-[110px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-24 w-96 h-96 rounded-full bg-[#0c3aa6]/40 blur-[110px] pointer-events-none" />

        {/* Message constellation — signature illustration */}
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
          <div className="absolute sr-bubble-a" style={{ top: "14%", left: "8%", width: 92, height: 34, background: "rgba(255,255,255,0.07)", borderRadius: "16px 16px 16px 4px" }} />
          <div className="absolute sr-bubble-b" style={{ top: "22%", left: "62%", width: 70, height: 28, background: "rgba(255,255,255,0.10)", borderRadius: "16px 16px 4px 16px" }} />
          <div className="absolute sr-bubble-c" style={{ top: "38%", left: "18%", width: 56, height: 24, background: "rgba(255,255,255,0.06)", borderRadius: "16px 16px 16px 4px" }} />
          <div className="absolute sr-bubble-a" style={{ top: "46%", left: "70%", width: 84, height: 30, background: "rgba(255,255,255,0.08)", borderRadius: "16px 16px 4px 16px" }} />
          <div className="absolute sr-bubble-b" style={{ top: "62%", left: "6%", width: 64, height: 26, background: "rgba(255,255,255,0.06)", borderRadius: "16px 16px 16px 4px" }} />
          <div className="absolute rounded-full bg-emerald-400 sr-pulse-dot" style={{ top: "31%", left: "56%", width: 8, height: 8 }} />
          <div className="absolute rounded-full bg-white/40 sr-pulse-dot" style={{ top: "57%", left: "24%", width: 6, height: 6, animationDelay: "0.8s" }} />
        </div>

        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center">
            <img src="/sudo2.png" alt="SudoReply Logo" className="w-14 h-14 object-contain filter drop-shadow-md brightness-110" />
          </Link>
        </div>

        <div className="relative z-10 my-auto py-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200/80">
            SudoReply Admin Console
          </p>
          <h1 className="mt-4 text-4xl xl:text-[2.75rem] font-bold tracking-tight leading-[1.15]">
            Manage platform operations, tenants & global scale.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-blue-100/70">
            Super admins use SudoReply to provision tenant environments, monitor platform health metrics, and govern WhatsApp API provider gateways.
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          {benefits.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md transition-colors duration-200 hover:bg-white/[0.09]">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <CheckIcon />
                {item.title}
              </h3>
              <p className="mt-1 text-[13px] text-blue-100/60 leading-relaxed pl-6">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
        {/* Mobile Logo Branding */}
        <div className="flex flex-col items-center text-center lg:hidden mb-8">
          <Link to="/" className="inline-flex items-center mb-4">
            <img src="/sudo2.png" alt="SudoReply Logo" className="w-14 h-14 object-contain" />
          </Link>
          <h1 className="text-[1.75rem] font-bold text-slate-900 tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-sm">
            Manage tenants, monitor platform health, and oversee all WhatsApp Business API operations.
          </p>
        </div>

        <div className="w-full max-w-[440px]">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-16px_rgba(15,23,42,0.08)] p-8 sm:p-10 sr-animate-fade-in-slide">
            <div>
              <h2 className="text-[1.6rem] font-bold text-slate-900 tracking-tight">Login to Admin Dashboard</h2>
              <p className="text-sm text-slate-500 mt-1.5">Use your admin credentials to continue.</p>
            </div>

            {generalError && (
              <div className="mt-6 rounded-xl bg-red-50 border border-red-100 px-4 py-3.5 text-sm text-red-600 font-medium">
                {generalError}
              </div>
            )}

            <form className="mt-7 space-y-5" onSubmit={onSubmit}>
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Admin email</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    className={`sr-input pl-10 pr-3.5 ${errors.email ? "sr-input-error" : ""}`}
                    type="email"
                    placeholder="admin@company.com"
                    {...register("email")}
                  />
                </div>
                <FormError message={errors.email?.message} />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    className={`sr-input pl-10 pr-11 ${errors.password ? "sr-input-error" : ""}`}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <FormError message={errors.password?.message} />
              </div>

              {/* Remember me / Forgot password */}
              <div className="flex items-center justify-between text-sm pt-1">
                <label className="inline-flex items-center gap-2 text-slate-500 font-medium cursor-pointer select-none">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-[#125fe2] focus:ring-2 focus:ring-[rgba(18,95,226,0.16)]" />
                  Remember me
                </label>
                <Link to="/forgot-password" className="font-semibold text-[#125fe2] hover:text-[#0e4bc0] hover:underline underline-offset-2">
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="sr-btn-primary w-full mt-2 flex gap-2 items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </button>
            </form>

            {/* Switch Mode - Commented out for Admin Portal
            <p className="mt-8 text-center text-sm text-slate-500">
              Need a tenant account?{" "}
              <Link to="/register" className="font-semibold text-[#125fe2] hover:text-[#0e4bc0] hover:underline underline-offset-2">
                Sign up
              </Link>
            </p>
            */}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-300 stroke-[3px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}

// Shared inline styles for inputs, buttons, and motion — kept in this file so
// there's nothing extra to import.
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