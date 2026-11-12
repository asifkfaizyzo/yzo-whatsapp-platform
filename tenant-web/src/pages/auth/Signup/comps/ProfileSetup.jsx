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
} from "lucide-react";
import FormError from "../../../../components/FormError";
import {
  checkUsername,
  updateOnboardingProfile,
  getUsernameSuggestions,
} from "../../../../api/auth";
import { useAuthStore } from "../../../../store/useAuthStore";

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
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

        {/* ── First + Last Name ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              First name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <User className="h-4 w-4" />
              </span>
              <input
                className={`sr-input pl-10 pr-3.5 ${errors.firstName ? "sr-input-error" : ""}`}
                type="text"
                placeholder="Jane"
                {...register("firstName")}
              />
            </div>
            <FormError message={errors.firstName?.message} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">
              Last name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <User className="h-4 w-4" />
              </span>
              <input
                className={`sr-input pl-10 pr-3.5 ${errors.lastName ? "sr-input-error" : ""}`}
                type="text"
                placeholder="Doe"
                {...register("lastName")}
              />
            </div>
            <FormError message={errors.lastName?.message} />
          </div>
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

          {/* ── Suggestion chips ── */}
          {suggestions.length > 0 && (
            <div className="mt-2.5 sr-animate-fade-in-slide">
              {usernameStatus !== "taken" && (
                <p className="flex items-center gap-1 text-xs text-slate-500 mb-1.5">
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  Generated for you
                  {suggestionsLoading && (
                    <Loader2 className="h-3 w-3 animate-spin ml-1" />
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

        {/* ── Navigation ── */}
        <div className="flex gap-4 mt-2">
          <button
            type="button"
            onClick={onBack}
            className="sr-btn-secondary flex-1 justify-center items-center flex gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="sr-btn-primary flex-1 justify-center items-center flex gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Continue <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}
