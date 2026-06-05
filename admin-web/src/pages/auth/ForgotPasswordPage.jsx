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
        {/* ── Left Panel ── */}
        <div
          className="hidden min-h-[700px] rounded-[32px] p-8 text-white lg:flex lg:flex-col lg:justify-between"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), var(--primary-dark))",
          }}
        >
          <Link to="/" className="text-2xl font-semibold">
            {siteConfig.brand}
          </Link>

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

        {/* ── Right Panel ── */}
        <div className="mx-auto w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Link
            to="/"
            className="mb-6 inline-flex text-xl font-semibold lg:hidden"
          >
            {siteConfig.brand}
          </Link>

          <div className="card p-6 sm:p-8">
            {!success ? (
              <>
                {/* Heading */}
                <div>
                  <h2 className="text-2xl font-semibold text-slate-800">Forgot Password?</h2>
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
                <div className="mx-auto w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-100">
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
                    <p className="mt-2 text-xs text-emerald-600 font-medium">{resendMessage}</p>
                  )}
                  {error && (
                    <p className="mt-2 text-xs text-red-600 font-medium">{error}</p>
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
        </div>
      </div>
    </div>
  );
}
