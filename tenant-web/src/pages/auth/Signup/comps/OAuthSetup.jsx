// tenant-web/src/pages/auth/Signup/comps/OAuthSetup.jsx
import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AtSign,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Check,
  X,
} from "lucide-react";
import FormError from "../../../../components/FormError";
import { checkUsername } from "../../../../api/auth";

const schema = z
  .object({
    username: z
      .string()
      .min(4, "Username must be at least 4 characters")
      .max(30)
      .regex(/^[a-z0-9_]+$/, "Lowercase, numbers, underscores only"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .regex(/[!@#$%^&*]/, "Must contain at least one special character"),
    confirmPassword: z.string().min(8, "Confirm password is required"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ── Password rule pills ──
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

// ── Username suggestions from name ──
function buildSuggestions(first = "", last = "") {
  const f = first.toLowerCase().replace(/[^a-z0-9]/g, "");
  const l = last.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!f && !l) return [];
  if (!l) return [`${f}_01`, `${f}123`, `the_${f}`].filter((s) => s.length >= 4);
  if (!f) return [`${l}_01`, `${l}123`].filter((s) => s.length >= 4);
  const candidates = [
    `${f}_${l}`,
    `${f}${l}`,
    `${f}_${l[0]}`,
    `${f[0]}_${l}`,
    `${f}${l}99`,
  ];
  return [...new Set(candidates)].filter((s) => s.length >= 4);
}

export default function OAuthSetup({ mockMode, meta, userData, onContinue }) {
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [backendSuggestions, setBackendSuggestions] = useState([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "", confirmPassword: "" },
  });

  const username = watch("username");
  const pw = watch("password");

  // ── Name-based suggestions (live from OAuth profile) ──
  const nameSuggestions = useMemo(
    () => buildSuggestions(userData.firstName, userData.lastName),
    [userData.firstName, userData.lastName],
  );

  // ── Username duplication check ──
  useEffect(() => {
    if (!username || username.length < 4 || !/^[a-z0-9_]+$/.test(username)) {
      setUsernameStatus(null);
      setBackendSuggestions([]);
      return;
    }

    if (mockMode) {
      setUsernameStatus("available");
      return;
    }

    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      const res = await checkUsername(username);
      if (res.success) {
        if (res.data?.available) {
          setUsernameStatus("available");
          setBackendSuggestions([]);
        } else {
          setUsernameStatus("taken");
          setBackendSuggestions(res.data?.suggestions || []);
        }
      } else {
        setUsernameStatus(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username, mockMode]);

  const onSubmit = async (data) => {
    setError("");
    if (!mockMode && usernameStatus === "taken") {
      setError("This username is already taken. Please choose another.");
      return;
    }
    setIsLoading(true);
    if (mockMode) {
      setTimeout(() => {
        setIsLoading(false);
        onContinue(data);
      }, 500);
      return;
    }
    // TODO: await setOAuthPassword(data.password); + updateProfile({ username })
    setIsLoading(false);
  };

  const displaySuggestions =
    usernameStatus === "taken" && backendSuggestions.length > 0
      ? backendSuggestions
      : nameSuggestions;

  return (
    <>
      <div>
        <h2 className="text-[1.6rem] font-bold text-slate-900 tracking-tight">
          {meta.title}
        </h2>
        <p className="text-sm text-slate-500 mt-1.5">{meta.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 font-medium">
            {error}
          </div>
        )}

        {/* Prefilled provider info */}
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
          Signed in as{" "}
          <span className="font-semibold">
            {userData.firstName} {userData.lastName}
          </span>{" "}
          ({userData.email})
        </div>

        {/* ── Username ── */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Username <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <AtSign className="h-4 w-4" />
            </span>
            <input
              className={`sr-input pl-10 pr-10 ${errors.username ? "sr-input-error" : ""}`}
              type="text"
              placeholder="jane_doe"
              {...register("username")}
            />
            {usernameStatus && (
              <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                {usernameStatus === "checking" && (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                )}
                {usernameStatus === "available" && (
                  <Check className="h-4 w-4 text-emerald-500" />
                )}
                {usernameStatus === "taken" && (
                  <X className="h-4 w-4 text-red-500" />
                )}
              </span>
            )}
          </div>
          <FormError message={errors.username?.message} />
          {usernameStatus === "taken" && (
            <p className="mt-1 text-xs text-red-500 font-medium">
              Username already taken. Try one of these:
            </p>
          )}

          {displaySuggestions.length > 0 && (
            <div className="mt-2.5 sr-animate-fade-in-slide">
              {usernameStatus !== "taken" && (
                <p className="text-xs text-slate-500 mb-1.5">Suggestions:</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {displaySuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setValue("username", s, { shouldValidate: true })
                    }
                    className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                      username === s
                        ? "border-[#125fe2] bg-[#125fe2] text-white"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-[#125fe2] hover:text-white hover:border-[#125fe2]"
                    }`}
                  >
                    @{s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Password ── */}
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
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
            >
              {showPw ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <FormError message={errors.password?.message} />

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

        {/* ── Confirm Password ── */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Confirm password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <Lock className="h-4 w-4" />
            </span>
            <input
              className={`sr-input pl-10 pr-11 ${errors.confirmPassword ? "sr-input-error" : ""}`}
              type={showConfirm ? "text" : "password"}
              placeholder="••••••••"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              tabIndex={-1}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <FormError message={errors.confirmPassword?.message} />
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
    </>
  );
}