// tenant-web/src/pages/auth/ForgotPassword.jsx
import { Link } from "react-router-dom";
import { useState } from "react";
import { siteConfig } from "../../config/site";
import { ArrowLeft, CheckCircle2, Mail, RefreshCw } from "lucide-react";
import { forgotPasswordTenant } from "../../services/auth.service";
import { useFormHandler } from "../../hooks/useFormHandler";
import { forgotPasswordSchema } from "../../validations/auth.validation";
import FormError from "../../components/FormError";

const benefits = [
  {
    title: "Global styles",
    text: "Update colors and base styles from one place.",
  },
  {
    title: "Reusable UI",
    text: "Buttons, cards, and inputs are shared across pages.",
  },
  {
    title: "Clean auth flow",
    text: "Dedicated login and registration screens.",
  },
];

export default function ForgotPassword() {
  const [roleType] = useState("TENANT");
  const [resending, setResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [resendMessage, setResendMessage] = useState("");
  const [success, setSuccess] = useState(false);

  // 1. Setup Form Handler Hook
  const {
    register,
    onSubmit,
    generalError,
    getValues, // Required to read email value for resend functionality
    formState: { errors, isSubmitting }
  } = useFormHandler({
    schema: forgotPasswordSchema,
    defaultValues: { email: "" },
    onSubmitService: (data) => forgotPasswordTenant(data.email, roleType),
    onSuccess: () => setSuccess(true),
  });

  // 2. Handle Resend email
  const handleResend = async () => {
    if (resendTimer > 0 || resending) return;
    setResending(true);
    setResendMessage("");

    // Grab the current email value typed into the form
    const currentEmail = getValues("email");

    const result = await forgotPasswordTenant(currentEmail, roleType);
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
              Frontend UI
            </p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight">
              Reset Password
            </h1>
            <p className="mt-4 max-w-md text-base text-white/80">
              Recover your access by verifying your registered business or user email address.
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
                <div>
                  <h2 className="text-2xl font-semibold text-slate-800">Forgot Password?</h2>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    No worries. Enter your email and we'll send you a link to reset your password.
                  </p>
                </div>

                {/* General server error */}
                {generalError && (
                  <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-650 font-medium">
                    {generalError}
                  </div>
                )}

                {/* Form */}
                <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                  <div>
                    <label className="label text-xs">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3.5 text-slate-400" size={16} />
                      <input
                        className={`input pl-10 text-xs ${errors.email ? "border-red-500 focus:ring-red-200" : ""}`}
                        type="email"
                        placeholder="user@company.com"
                        {...register("email")}
                        disabled={isSubmitting}
                      />
                    </div>
                    <FormError message={errors.email?.message} />
                  </div>

                  <button
                    type="submit"
                    className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 font-bold text-xs shadow-sm hover:shadow"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending Link...</span>
                      </>
                    ) : (
                      <span>Send Reset Link</span>
                    )}
                  </button>
                </form>

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
                  <h3 className="text-xl font-bold text-slate-800">Check your email</h3>
                  <p className="text-sm text-[color:var(--muted)] leading-relaxed">
                    We have sent a secure password reset link to <strong className="text-slate-700">{getValues("email")}</strong>.
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
                  {generalError && (
                    <p className="mt-2 text-xs text-red-600 font-medium">{generalError}</p>
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