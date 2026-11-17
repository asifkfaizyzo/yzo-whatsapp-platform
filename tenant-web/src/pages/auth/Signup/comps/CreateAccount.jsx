// tenant-web/src/pages/auth/Signup/comps/CreateAccount.jsx (do not remove this comment)
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  AlertCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import FormError from "../../../../components/FormError";
import {
  signupWithEmail,
  signupWithGoogle,
  signupWithFacebook,
} from "../../../../api/auth";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[!@#$%^&*]/, "Must contain at least one special character"),
});

const PASSWORD_RULES = [
  { key: "length", label: "8+ chars", test: (pw) => pw.length >= 8 },
  { key: "upper", label: "Uppercase", test: (pw) => /[A-Z]/.test(pw) },
  { key: "number", label: "Number", test: (pw) => /[0-9]/.test(pw) },
  { key: "special", label: "Symbol", test: (pw) => /[!@#$%^&*]/.test(pw) },
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
        <svg
          className="h-3 w-3 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
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
  onFbEmailRequired,
  onSwitchMode,
}) {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [fbError, setFbError] = useState("");

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);

  // ── Floating error overlay state ──
  const [errorDismissed, setErrorDismissed] = useState(true);
  const errorTimerRef = useRef(null);

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

  // ── Auto-show / auto-dismiss the floating error overlay ──
  useEffect(() => {
    const err = error || googleError || fbError;
    if (err) {
      setErrorDismissed(false);
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        setErrorDismissed(true);
        setTimeout(() => {
          setError("");
          setGoogleError("");
          setFbError("");
        }, 300);
      }, 5000);
    }
    return () => clearTimeout(errorTimerRef.current);
  }, [error, googleError, fbError]);

  const dismissError = useCallback(() => {
    setErrorDismissed(true);
    clearTimeout(errorTimerRef.current);
    setTimeout(() => {
      setError("");
      setGoogleError("");
      setFbError("");
    }, 300);
  }, []);

  const onSubmit = async (data) => {
    if (!agreedToTerms) {
      setTermsError(true);
      return;
    }
    setTermsError(false);
    setError("");
    setIsLoading(true);
    if (mockMode) {
      setTimeout(() => {
        setIsLoading(false);
        onContinue(data);
      }, 500);
      return;
    }
    try {
      const result = await signupWithEmail(data.email, data.password);
      if (result.success) {
        const resData = result.data?.data;
        if (resData?.isResuming) {
          onContinue({ ...data, resumeStep: resData.onboardingStep });
        } else {
          onContinue(data);
        }
      } else {
        setError(result.message || "Signup failed. Please try again.");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    }
    setIsLoading(false);
  };

  const googleCallbackRef = useRef(null);

  // ── Google Identity Services init (returns ID token, not access token) ──
  useEffect(() => {
    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (googleCallbackRef.current) {
            googleCallbackRef.current(response.credential);
          }
        },
      });
    };
    initGoogle();
    if (!window.google?.accounts?.id) {
      const t = setTimeout(initGoogle, 1000);
      return () => clearTimeout(t);
    }
  }, []);

  const handleGoogleClick = useCallback(() => {
    if (!agreedToTerms) {
      setTermsError(true);
      return;
    }
    setTermsError(false);
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

    googleCallbackRef.current = async (credential) => {
      try {
        const result = await signupWithGoogle(credential);
        if (result.success) {
          const t = result.data?.data?.tenant || {};
          onOAuth({
            provider: "google",
            email: t.email || "",
            firstName: t.firstName || "",
            lastName: t.lastName || "",
          });
        } else {
          setGoogleError(result.message || "Google sign-up failed.");
        }
      } catch (err) {
        setGoogleError(err.message || "Something went wrong.");
      } finally {
        setIsLoading(false);
        googleCallbackRef.current = null;
      }
    };

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setGoogleError(
            "Google sign-in was blocked. Check your browser settings.",
          );
          setIsLoading(false);
          googleCallbackRef.current = null;
        }
      });
    } else {
      setGoogleError(
        "Google Sign-In is not available. Please refresh the page.",
      );
      setIsLoading(false);
    }
  }, [agreedToTerms, mockMode, onOAuth]);

  const handleFacebookClick = () => {
    if (!agreedToTerms) {
      setTermsError(true);
      return;
    }
    setTermsError(false);
    setFbError("");
    setError("");

    if (!window.FB) {
      setFbError("Facebook SDK not loaded. Please refresh the page.");
      return;
    }

    window.FB.login(
      (response) => {
        if (!response.authResponse) {
          setFbError("Facebook login was cancelled.");
          return;
        }
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
        (async () => {
          try {
            const result = await signupWithFacebook(
              response.authResponse.accessToken,
            );
            if (result.success) {
              const t = result.data?.data?.tenant || {};
              onOAuth({
                provider: "facebook",
                email: t.email || "",
                firstName: t.firstName || "",
                lastName: t.lastName || "",
              });
                        } else if (result.code === "EMAIL_REQUIRED") {
              let firstName = "";
              let lastName = "";
              try {
                const me = await new Promise((resolve, reject) => {
                  window.FB.api(
                    "/me",
                    { fields: "first_name,last_name" },
                    (res) => (res.error ? reject(res.error) : resolve(res)),
                  );
                });
                firstName = me.first_name || "";
                lastName = me.last_name || "";
              } catch {
                // Non-fatal: profile setup step can collect it later
              }
              onFbEmailRequired?.({
                fbAccessToken: response.authResponse.accessToken,
                firstName,
                lastName,
              });
            } else {
              setFbError(result.message || "Facebook sign-up failed.");
            }
          } catch (err) {
            setFbError(err.message || "Something went wrong.");
          }
          setIsLoading(false);
        })();
      },
      { config_id: import.meta.env.VITE_META_SSO_CONFIG_ID },
    );
  };

  const handleSwitchToLogin = () => {
    if (onSwitchMode) onSwitchMode("login");
    else navigate("/login");
  };

  const unifiedError = error || googleError || fbError;

  // ── Fluid spacing values ──
  const spaceY = "clamp(6px, 1.4vh, 14px)";
  const smallGap = "clamp(4px, 1vh, 10px)";
  const tinyGap = "clamp(2px, 0.5vh, 6px)";
  const sectionGap = "clamp(8px, 1.6vh, 16px)";

  return (
    <>
    <style>{`
      .sr-custom-scrollbar::-webkit-scrollbar { display: none; }
      .sr-custom-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
    <div className="relative">
      {/* ── Floating error overlay (zero layout impact) ── */}
      {unifiedError && (
        <div
          className={`absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-4 py-2.5 bg-red-50/95 backdrop-blur-sm border-b border-red-100 rounded-t-2xl transition-all duration-300 ease-out ${
            !errorDismissed
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-full pointer-events-none"
          }`}
        >
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <span className="text-[0.78rem] text-red-600 flex-1 leading-snug">
            {unifiedError}
          </span>
          <button
            type="button"
            onClick={dismissError}
            className="text-red-300 hover:text-red-500 transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="text-center" style={{ marginBottom: sectionGap }}>
        <h2 className="text-[1.3rem] font-bold text-slate-900 tracking-tight">
          {meta.title}
        </h2>
        <p className="text-[0.78rem] text-slate-400 mt-0.5">{meta.subtitle}</p>
      </div>

      {/* OAuth */}
      <div
        className="rounded-xl bg-slate-50/60 border border-slate-100 p-3"
        style={{ marginBottom: spaceY }}
      >
        <div className="flex flex-col items-center" style={{ gap: smallGap }}>
          <button
            type="button"
            onClick={handleFacebookClick}
            disabled={isLoading}
            className="w-full max-w-[360px] h-[44px] rounded-xl bg-[#1877F2] hover:bg-[#166fe5] flex items-center justify-center gap-2.5 text-[0.84rem] font-medium text-white transition-all duration-150 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Continue with Facebook
          </button>
          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={isLoading}
            className="w-full max-w-[360px] h-[44px] rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2.5 text-[0.84rem] font-medium text-slate-700 transition-all duration-150 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3" style={{ marginBottom: spaceY }}>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <span className="text-[0.68rem] text-slate-300 font-medium uppercase tracking-wider">
          or Sign up with email
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className={`transition-opacity duration-200 ${
          isLoading ? "opacity-70" : ""
        }`}
        style={{ display: "flex", flexDirection: "column", gap: spaceY }}
      >
        <div>
          <label
            className="block text-[0.78rem] font-medium text-slate-600"
            style={{ marginBottom: tinyGap }}
          >
            Work email <span className="text-red-400">*</span>
          </label>
          <div className="sr-input-wrap relative">
            <Mail
              size={16}
              className="sr-input-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors duration-200 pointer-events-none"
            />
            <input
              className={`sr-input w-full h-[44px] pl-10 pr-4 rounded-xl border bg-white text-[0.875rem] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#125fe2]/20 focus:border-[#125fe2] transition-all duration-200 ${
                errors.email ? "border-red-300" : "border-slate-200"
              }`}
              type="email"
              placeholder="jane.doe@company.com"
              {...register("email")}
            />
          </div>
          <FormError message={errors.email?.message} />
        </div>

        <div>
          <label
            className="block text-[0.78rem] font-medium text-slate-600"
            style={{ marginBottom: tinyGap }}
          >
            Password <span className="text-red-400">*</span>
          </label>
          <div className="sr-input-wrap relative">
            <Lock
              size={16}
              className="sr-input-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors duration-200 pointer-events-none"
            />
            <input
              className={`sr-input w-full h-[44px] pl-10 pr-11 rounded-xl border bg-white text-[0.875rem] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#125fe2]/20 focus:border-[#125fe2] transition-all duration-200 ${
                errors.password ? "border-red-300" : "border-slate-200"
              }`}
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              tabIndex={-1}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <FormError message={errors.password?.message} />

          {pw && (
            <div
              className="flex items-center gap-1.5 sr-animate-fade-in-slide"
              style={{ marginTop: smallGap }}
            >
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

        {/* T&C — same row position as "Forgot password?" on Login */}
        <div>
          <label className="flex items-start gap-2.5 text-[0.72rem] text-slate-400 cursor-pointer select-none leading-relaxed group">
            {/* Hidden native checkbox — still accessible via keyboard/screen readers */}
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => {
                setAgreedToTerms(e.target.checked);
                if (e.target.checked) setTermsError(false);
              }}
              className="peer sr-only"
            />
            {/* Custom checkbox visual */}
            <span
              className={`mt-0.5 h-4 w-4 shrink-0 rounded border-[1.5px] flex items-center justify-center transition-all duration-200 ${
                termsError
                  ? "border-red-400 bg-red-50"
                  : agreedToTerms
                    ? "border-[#125fe2] bg-[#125fe2]"
                    : "border-slate-300 bg-white group-hover:border-slate-400"
              }`}
            >
              {/* Checkmark — only visible when checked */}
              <svg
                className={`h-2.5 w-2.5 text-white transition-all duration-200 ${
                  agreedToTerms ? "opacity-100 scale-100" : "opacity-0 scale-50"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </span>
            <span>
              I agree to the{" "}
              <Link
                to="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#125fe2] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#125fe2] hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Privacy
              </Link>
              . <span className="text-red-400">*</span>
            </span>
          </label>
          {termsError && (
            <p
              className="ml-6.5 text-[0.72rem] text-red-500 font-medium sr-animate-fade-in-slide"
              style={{ marginTop: tinyGap }}
            >
              You must accept the terms to continue.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="sr-btn-primary-gradient w-full flex items-center justify-center gap-2"
          style={{ marginTop: tinyGap }}
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Creating account…
            </>
          ) : (
            <>
              Continue <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <div
        className="flex flex-col items-center"
        style={{ marginTop: sectionGap, gap: smallGap }}
      >
        <div className="flex items-center gap-1.5 text-[0.66rem] text-slate-300">
          <ShieldCheck size={11} />
          <span>Encrypted · Your data stays safe</span>
        </div>
        <p className="text-[0.78rem] text-slate-400">
          Already have an account?{" "}
          <button
            type="button"
            onClick={handleSwitchToLogin}
            className="sr-switch-link text-[#125fe2] hover:text-[#0e4bc0] font-semibold inline-flex items-center gap-1"
          >
            Sign in <ArrowRight size={13} className="sr-switch-arrow" />
          </button>
        </p>
      </div>
    </div>
    </>
  );
}
