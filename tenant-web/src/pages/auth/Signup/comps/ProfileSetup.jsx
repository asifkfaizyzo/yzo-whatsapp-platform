// tenant-web/src/pages/auth/Signup/comps/ProfileSetup.jsx (do not remove this comment)

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User,
  AtSign,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import FormError from "../../../../components/FormError";
import {
  checkUsername,
  updateOnboardingProfile,
  getUsernameSuggestions,
} from "../../../../api/auth";
import { useAuthStore } from "../../../../store/useAuthStore";

const schema = z.object({
  firstName: z.string().min(1, "First name is required").max(20, "First name must be under 20 characters"),
  lastName: z.string().min(1, "Last name is required").max(20, "Last name must be under 20 characters"),
  username: z
    .string()
    .min(4, "Username must be at least 4 characters")
    .max(30, "Username must be under 30 characters")
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, and underscores only"),
});

// ── Parse email prefix into name parts (client-side mirror) ──
function parseEmailName(email) {
  if (!email) return { firstName: "", lastName: "" };
  const local = email.split("@")[0].toLowerCase();
  const stripped = local.replace(/\d+$/, "");
  if (!stripped) return { firstName: "", lastName: "" };
  const parts = stripped.split(/[._-]+/).filter(Boolean);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  if (parts.length >= 2) {
    return {
      firstName: cap(parts[0]),
      lastName: cap(parts.slice(1).join(" ")),
    };
  }
  return { firstName: cap(parts[0] || ""), lastName: "" };
}

export default function ProfileSetup({
  mockMode,
  meta,
  userData,
  onContinue,
  onBack,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // ── Read tenant from auth store (has email + any OAuth names) ──
  const tenant = useAuthStore((s) => s.tenant);
  const storeEmail = tenant?.email || userData?.email || "";
  const storeFirstName = tenant?.firstName || userData?.firstName || "";
  const storeLastName = tenant?.lastName || userData?.lastName || "";

  // ── Derive initial names: OAuth/store first, email-parsed fallback ──
  const initialNames =
    storeFirstName || storeLastName
      ? { firstName: storeFirstName, lastName: storeLastName }
      : parseEmailName(storeEmail);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: initialNames.firstName,
      lastName: initialNames.lastName,
      username: "",
    },
  });

  const firstName = watch("firstName");
  const lastName = watch("lastName");
  const username = watch("username");

  // ── Fetch 3 suggestions from backend ──
  const fetchSuggestions = useCallback(
    async (fn, ln, email) => {
      if (mockMode) {
        const f = (fn || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const l = (ln || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const base =
          f || email?.split("@")[0]?.replace(/[^a-z0-9]/g, "") || "user";
        setSuggestions(
          [`${base}_${l || "01"}`, `${base}123`, `${base}_hq`]
            .filter((s) => s.length >= 4)
            .slice(0, 3),
        );
        return;
      }

      setSuggestionsLoading(true);
      const res = await getUsernameSuggestions(fn, ln, email);
      if (res.success && res.data?.suggestions?.length > 0) {
        setSuggestions(res.data.suggestions);
      }
      setSuggestionsLoading(false);
    },
    [mockMode],
  );

  // ── On mount: auto-fill names + fetch initial suggestions ──
  useEffect(() => {
    if (initialNames.firstName) setValue("firstName", initialNames.firstName);
    if (initialNames.lastName) setValue("lastName", initialNames.lastName);

    const timer = setTimeout(() => {
      fetchSuggestions(
        initialNames.firstName,
        initialNames.lastName,
        storeEmail,
      );
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-fetch suggestions when names change (debounced) ──
  useEffect(() => {
    if (!firstName && !lastName) return;
    const timer = setTimeout(() => {
      fetchSuggestions(firstName, lastName, storeEmail);
    }, 700);
    return () => clearTimeout(timer);
  }, [firstName, lastName, storeEmail, fetchSuggestions]);

  // ── Username duplication check (debounced) ──
  useEffect(() => {
    if (!username || username.length < 4 || !/^[a-z0-9_]+$/.test(username)) {
      setUsernameStatus(null);
      return;
    }

    if (mockMode) {
      setUsernameStatus("available");
      return;
    }

    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      const res = await checkUsername(username, storeEmail);
      if (res.success) {
        if (res.data?.available) {
          setUsernameStatus("available");
        } else {
          setUsernameStatus("taken");
          if (res.data?.suggestions?.length > 0) {
            setSuggestions(res.data.suggestions);
          }
        }
      } else {
        setUsernameStatus(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username, mockMode, storeEmail]);

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
    try {
      const result = await updateOnboardingProfile(data);
      if (result.success) {
        onContinue(data);
      } else {
        setError(result.message || "Failed to save profile.");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    }
    setIsLoading(false);
  };

  return (
    <>
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-[1.3rem] font-bold text-slate-900 tracking-tight">
          {meta.title}
        </h2>
        <p className="text-[0.78rem] text-slate-400 mt-0.5">{meta.subtitle}</p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className={`space-y-3 transition-opacity duration-200 ${
          isLoading ? "opacity-70" : ""
        }`}
      >
        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[0.78rem] sr-animate-fade-in-slide">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── First + Last Name ── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[0.78rem] font-medium text-slate-600 mb-1">
              First name <span className="text-red-400">*</span>
            </label>
            <div className="sr-input-wrap relative">
              <User
                size={16}
                className="sr-input-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors duration-200 pointer-events-none"
              />
              <input
                className={`sr-input w-full h-[44px] pl-10 pr-3 rounded-xl border bg-white text-[0.875rem] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#125fe2]/20 focus:border-[#125fe2] transition-all duration-200 ${
                  errors.firstName ? "border-red-300" : "border-slate-200"
                }`}
                type="text"
                placeholder="Firstname"
                maxLength={20}
                {...register("firstName")}
              />
            </div>
            <FormError message={errors.firstName?.message} />
          </div>
          <div>
            <label className="block text-[0.78rem] font-medium text-slate-600 mb-1">
              Last name <span className="text-red-400">*</span>
            </label>
            <div className="sr-input-wrap relative">
              <User
                size={16}
                className="sr-input-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors duration-200 pointer-events-none"
              />
              <input
                className={`sr-input w-full h-[44px] pl-10 pr-3 rounded-xl border bg-white text-[0.875rem] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#125fe2]/20 focus:border-[#125fe2] transition-all duration-200 ${
                  errors.lastName ? "border-red-300" : "border-slate-200"
                }`}
                type="text"
                placeholder="Lastname"
                maxLength={20}
                {...register("lastName")}
              />
            </div>
            <FormError message={errors.lastName?.message} />
          </div>
        </div>

        {/* ── Username ── */}
        <div>
          <label className="block text-[0.78rem] font-medium text-slate-600 mb-1">
            Username <span className="text-red-400">*</span>
          </label>
          <div className="sr-input-wrap relative">
            <AtSign
              size={16}
              className="sr-input-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors duration-200 pointer-events-none"
            />
            <input
              className={`sr-input w-full h-[44px] pl-10 pr-10 rounded-xl border bg-white text-[0.875rem] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#125fe2]/20 focus:border-[#125fe2] transition-all duration-200 ${
                errors.username ? "border-red-300" : "border-slate-200"
              }`}
              type="text"
              placeholder="@user_name"
              maxLength={20}
              {...register("username")}
            />
            {usernameStatus && (
              <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                {usernameStatus === "checking" && (
                  <Loader2 size={15} className="animate-spin text-slate-300" />
                )}
                {usernameStatus === "available" && (
                  <Check size={15} className="text-emerald-500" />
                )}
                {usernameStatus === "taken" && (
                  <X size={15} className="text-red-400" />
                )}
              </span>
            )}
          </div>
          <FormError message={errors.username?.message} />

          {usernameStatus === "taken" && (
            <p className="mt-1 text-[0.72rem] text-red-500 font-medium">
              Username already taken. Try one of these:
            </p>
          )}

          {/* ── Suggestion chips ── */}
          {suggestions.length > 0 && (
            <div className="mt-2 sr-animate-fade-in-slide">
              {usernameStatus !== "taken" && (
                <p className="flex items-center gap-1 text-[0.7rem] text-slate-400 mb-1.5">
                  <Sparkles size={11} className="text-amber-400" />
                  Generated for you
                  {suggestionsLoading && (
                    <Loader2 size={11} className="animate-spin ml-0.5" />
                  )}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setValue("username", s, { shouldValidate: true })
                    }
                    className={`px-2.5 py-1 text-[0.72rem] font-medium rounded-full border transition-all duration-150 ${
                      username === s
                        ? "border-[#125fe2] bg-[#125fe2] text-white shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-[#125fe2]/5 hover:text-[#125fe2] hover:border-[#125fe2]/30"
                    }`}
                  >
                    @{s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <div className="flex gap-2.5 mt-1">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 h-[44px] rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2 text-[0.84rem] font-medium text-slate-600 transition-all duration-150"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="sr-btn-primary-gradient flex-1 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                Continue <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}
