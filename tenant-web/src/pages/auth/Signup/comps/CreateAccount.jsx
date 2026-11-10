// tenant-web/src/pages/auth/Signup/comps/CreateAccount.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import FacebookLoginButton from "../../../../components/auth/FacebookLoginButton";
import FormError from "../../../../components/FormError";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[!@#$%^&*]/, "Must contain at least one special character"),
});

// ── Password rule checker ──
const PASSWORD_RULES = [
  { key: "length",  label: "8+ chars",  test: (pw) => pw.length >= 8 },
  { key: "upper",   label: "Uppercase", test: (pw) => /[A-Z]/.test(pw) },
  { key: "number",  label: "Number",    test: (pw) => /[0-9]/.test(pw) },
  { key: "special", label: "Symbol",    test: (pw) => /[!@#$%^&*]/.test(pw) },
];

function PasswordRulePill({ valid, text }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-[3px] rounded-full border text-[11px] font-medium whitespace-nowrap transition-colors duration-200 ${
        valid
          ? "border-emerald-300 bg-emerald-50 text-emerald-600"
          : "border-slate-200 bg-slate-50 text-slate-400"
      }`}
    >
      {valid ? (
        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
      )}
      {text}
    </span>
  );
}

export default function CreateAccount({
  mockMode,
  meta,
  onContinue,
  onOAuth,
}) {
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [fbError, setFbError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const pw = watch("password");

  /* ── Email submit ── */
  const onSubmit = async (data) => {
    setError("");
    setIsLoading(true);
    if (mockMode) {
      setTimeout(() => {
        setIsLoading(false);
        onContinue(data);
      }, 500);
      return;
    }
    // TODO: const result = await signupWithEmail(data.email, data.password);
    setIsLoading(false);
  };

  /* ── Google OAuth ── */
  const handleGoogleSuccess = async (credentialResponse) => {
    setGoogleError("");
    setError("");
    setIsLoading(true);
    if (mockMode) {
      setTimeout(() => {
        setIsLoading(false);
        onOAuth({
          provider: "google",
          email: "jane@gmail.com",
          firstName: "Jane",
          lastName: "Doe",
        });
      }, 700);
      return;
    }
    // TODO: const result = await signupWithGoogle(credentialResponse.credential);
    setIsLoading(false);
  };

  /* ── Facebook OAuth ── */
  const handleFacebookSuccess = async (accessToken) => {
    setFbError("");
    setError("");
    setIsLoading(true);
    if (mockMode) {
      setTimeout(() => {
        setIsLoading(false);
        onOAuth({
          provider: "facebook",
          email: "jane@facebook.com",
          firstName: "Jane",
          lastName: "Doe",
        });
      }, 700);
      return;
    }
    // TODO: const result = await signupWithFacebook(accessToken);
    setIsLoading(false);
  };

  return (
    <>
      {/* ── Error banners ── */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}
      {googleError && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {googleError}
        </div>
      )}
      {fbError && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {fbError}
        </div>
      )}

      {/* ── OAuth buttons ── */}
      <div className="flex justify-center w-full">
        <FacebookLoginButton
          onSuccess={handleFacebookSuccess}
          onError={(msg) => setFbError(msg)}
          text="Sign up with Facebook"
        />
      </div>
      <div className="flex justify-center w-full mt-3">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() =>
            setGoogleError("Google Sign-In was unsuccessful. Please try again.")
          }
          shape="pill"
          theme="outline"
          width="360px"
          text="signup_with"
          logo_alignment="center"
        />
      </div>

      {/* ── Divider ── */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs font-medium text-slate-400 tracking-wide">
            Or continue with
          </span>
        </div>
      </div>

      {/* ── Title ── */}
      <div className="text-center">
        <h2 className="text-[1.6rem] font-bold text-slate-900 tracking-tight">
          {meta.title}
        </h2>
        <p className="text-sm text-slate-500 mt-1.5">{meta.subtitle}</p>
      </div>

      {/* ── Email + Password form ── */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Work email <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <Mail className="h-4 w-4" />
            </span>
            <input
              className={`sr-input pl-10 pr-3.5 ${errors.email ? "sr-input-error" : ""}`}
              type="email"
              placeholder="jane.doe@company.com"
              {...register("email")}
            />
          </div>
          <FormError message={errors.email?.message} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <Lock className="h-4 w-4" />
            </span>
            <input
              className={`sr-input pl-10 pr-11 ${errors.password ? "sr-input-error" : ""}`}
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              tabIndex={-1}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPw ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <FormError message={errors.password?.message} />

          {/* ── Inline password rule pills ── */}
{pw && (
  <div className="mt-2.5 flex items-center gap-1.5 sr-animate-fade-in-slide">
    {PASSWORD_RULES.map((rule) => (
      <PasswordRulePill
        key={rule.key}
        valid={rule.test(pw)}
        text={rule.label}
      />
    ))}
  </div>
)}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="sr-btn-primary w-full mt-2 flex gap-2 items-center justify-center"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Continue <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500 sr-animate-fade-in-slide">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-semibold text-[#125fe2] hover:text-[#0e4bc0] hover:underline underline-offset-2"
        >
          Login
        </Link>
      </p>
    </>
  );
}