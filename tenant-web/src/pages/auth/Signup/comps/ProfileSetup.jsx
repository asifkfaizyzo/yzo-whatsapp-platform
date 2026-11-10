// tenant-web/src/pages/auth/Signup/comps/ProfileSetup.jsx
import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import FormError from "../../../../components/FormError";
import { checkUsername } from "../../../../api/auth";

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  username: z
    .string()
    .min(4, "Username must be at least 4 characters")
    .max(30, "Username must be under 30 characters")
    .regex(
      /^[a-z0-9_]+$/,
      "Lowercase letters, numbers, and underscores only",
    ),
});

// ── Build username suggestions from first + last name ──
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

export default function ProfileSetup({
  mockMode,
  meta,
  userData,
  onContinue,
  onBack,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [usernameStatus, setUsernameStatus] = useState(null); // null | "checking" | "available" | "taken"
  const [backendSuggestions, setBackendSuggestions] = useState([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: userData.firstName || "",
      lastName: userData.lastName || "",
      username: "",
    },
  });

  const firstName = watch("firstName");
  const lastName = watch("lastName");
  const username = watch("username");

  // ── Live suggestions generated from firstName + lastName ──
  const nameSuggestions = useMemo(
    () => buildSuggestions(firstName, lastName),
    [firstName, lastName],
  );

  // ── Username duplication check ──
  useEffect(() => {
    if (!username || username.length < 4 || !/^[a-z0-9_]+$/.test(username)) {
      setUsernameStatus(null);
      setBackendSuggestions([]);
      return;
    }

    // Mock mode: skip backend check — treat as available immediately
    if (mockMode) {
      setUsernameStatus("available");
      return;
    }

    // Real mode: debounced backend duplication check
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
    // TODO: const result = await updateOnboardingProfile(data);
    setIsLoading(false);
  };

  // Show backend suggestions if username is taken, otherwise name-based suggestions
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

          {/* ── Suggestion chips (from first+last name, or backend alternatives) ── */}
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