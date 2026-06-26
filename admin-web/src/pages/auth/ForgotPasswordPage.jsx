import { Link } from "react-router-dom";
import { useState } from "react";
import { siteConfig } from "../../config/site";
import { ArrowLeft, CheckCircle2, Mail, RefreshCw } from "lucide-react";
import { forgotPasswordSuperAdmin } from "../../lib/authApi";

const benefits = [
  {
    title: "Secure recovery",
    text: "Verification links expire in 1 hour for safety.",
  },
  {
    title: "Multi-tenant isolation",
    text: "Recovery triggers only within your specific domain scope.",
  },
  {
    title: "Real-time auditing",
    text: "All security resets are logged for compliance monitoring.",
  },
];

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [resendMessage, setResendMessage] = useState("");

// Inside ForgotPasswordPage component:
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError("");
  if (!email) {
    setError("Please enter your email address.");
    setLoading(false);
    return;
  }
  const result = await forgotPasswordSuperAdmin(email);
  setLoading(false);
  if (result.success) {
    setSuccess(true);
  } else {
    setError(result.message);
  }
};

  const handleResend = async () => {
    if (resendTimer > 0 || resending) return;
    setResending(true);
    setResendMessage("");
    setError("");

    const result = await forgotPasswordSuperAdmin(email);
    setResending(false);

    if (result.success) {
      setResendMessage("Reset email resent successfully!");
      setResendTimer(60);
      const timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="container-shell grid min-h-screen items-center gap-8 py-8 lg:grid-cols-2">
        {/* ── Left Panel (Desktop only) ── */}
        <div
          className="hidden min-h-[700px] rounded-[32px] p-8 text-white lg:flex lg:flex-col lg:justify-between"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), var(--primary-dark))",
          }}
        >
          {/* Top: Logo */}
          <div>
            <Link to="/" className="inline-flex items-center">
              <img
                src="/sudo2.png"
                alt="SudoReply Logo"
                className="w-20 h-20 object-contain"
              />
            </Link>
          </div>

          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/70">
              Root Console
            </p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight">
              Restore Access
            </h1>
            <p className="mt-4 max-w-md text-base text-white/80">
              Recover your administrator account password using our secure token verification flow.
            </p>
          </div>

          <div className="space-y-4">
            {benefits.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm"
              >
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-white/75">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Panel (Form & Mobile Branding) ── */}
        <div className="mx-auto w-full max-w-md sm:max-w-2xl lg:max-w-md">
          {/* Mobile/Tablet Header */}
          <div className="flex flex-col items-center text-center lg:hidden mb-8">
            <Link to="/" className="inline-flex items-center mb-4">
              <img
                src="/sudo2.png"
                alt="SudoReply Logo"
                className="w-16 h-16 object-contain"
              />
            </Link>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Root Console
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-900">
              Restore Access
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted)] max-w-md">
              Recover your administrator account password using our secure token verification flow.
            </p>
          </div>

          {/* Form Card */}
          <div className="card p-6 sm:p-8 max-w-md mx-auto w-full">
            {!success ? (
              <>
                {/* Heading */}
                <div className="hidden lg:block">
                  <h2 className="text-2xl font-semibold text-slate-800">ForgotPassword?</h2>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    No worries. Enter your email and we'll send you a link to reset your password.
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-650 font-medium">
                    {error}
                  </div>
                )}

                {/* Form */}
                <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                  {/* Email Input */}
                  <div>
                    <label className="label text-xs">Email Address</label>
                    <div className="relative">
                      {/* <Mail className="absolute left-3 top-3.5 text-slate-400" size={16} /> */}
                      <input
                        className="input pl-10 text-xs"
                        type="email"
                        placeholder="admin@company.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setError("");
                        }}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 font-bold text-xs shadow-sm hover:shadow"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending Link...</span>
                      </>
                    ) : (
                      <span>Send Recovery Email</span>
                    )}
                  </button>
                </form>

                {/* Back to login */}
                <div className="mt-6 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--primary-dark)] hover:underline"
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Login</span>
                  </Link>
                </div>
              </>
            ) : (
              /* Success State */
              <div className="text-center py-4 space-y-4 animate-in zoom-in-95 duration-250">
                <div className="mx-auto w-12 h-12 bg-[#EAF2FE] rounded-full flex items-center justify-center text-[#125EF2] border border-[#CFE0FD]">
                  <CheckCircle2 size={24} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-800">Check your inbox</h3>
                  <p className="text-sm text-[color:var(--muted)] leading-relaxed">
                    We have sent a secure password reset link to <strong className="text-slate-700">{email}</strong>.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={handleResend}
                    disabled={resendTimer > 0 || resending}
                    className="text-xs font-semibold text-[color:var(--primary-dark)] hover:underline disabled:text-slate-400 disabled:no-underline"
                  >
                    {resending ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Resending...
                      </span>
                    ) : resendTimer > 0 ? (
                      `Resend email in ${resendTimer}s`
                    ) : (
                      "Resend email"
                    )}
                  </button>
                  {resendMessage && (
                    <p className="mt-2 text-xs text-[#125EF2] font-medium">{resendMessage}</p>
                  )}
                  {error && (
                    <p className="mt-2 text-xs text-red-650 font-medium">{error}</p>
                  )}
                </div>
                <div className="pt-4 border-t border-slate-50">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--primary-dark)] hover:underline"
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Login</span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Mobile/Tablet Benefits */}
          <div className="mt-8 lg:hidden max-w-md sm:max-w-2xl mx-auto w-full">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] text-center mb-4">
              Platform Benefits
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {benefits.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                >
                  <p className="font-semibold text-slate-800 text-sm">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
