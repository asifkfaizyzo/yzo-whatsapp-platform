// tenant-web/src/pages/auth/Signup/comps/BusinessDetails.jsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Phone,
  Users,
  MessageSquare,
  Loader2,
  Check,
  ArrowLeft,
} from "lucide-react";
import FormError from "../../../../components/FormError";
import StyledSelect from "../../../../components/common/StyledSelect";

const schema = z.object({
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  companySize: z.string().min(1, "Team size selection is required"),
  useCase: z.string().optional().or(z.literal("")),
});

const SIZES = [
  { value: "1-10", label: "1–10 employees" },
  { value: "11-50", label: "11–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "201-500", label: "201–500 employees" },
  { value: "500+", label: "500+ employees" },
];

export default function BusinessDetails({
  mockMode,
  meta,
  userData,
  onContinue,
  onBack,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: userData.phone || "",
      companySize: userData.companySize || "",
      useCase: userData.useCase || "",
    },
  });

  const companySize = watch("companySize");

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
    // TODO: await updateOnboardingStep(5, data);
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

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Business phone <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <Phone className="h-4 w-4" />
            </span>
            <input
              className={`sr-input pl-10 pr-3.5 ${errors.phone ? "sr-input-error" : ""}`}
              type="tel"
              placeholder="+1 (555) 019-2834"
              {...register("phone")}
            />
          </div>
          <FormError message={errors.phone?.message} />
        </div>

        {/* ── Team Size — StyledSelect replaces native <select> ── */}
        <div className="relative">
          <StyledSelect
            label={
              <>
                Team size <span className="text-red-500">*</span>
              </>
            }
            value={companySize}
            onChange={(val) =>
              setValue("companySize", val, { shouldValidate: true })
            }
            options={SIZES}
            placeholder="Select team size"
            icon={<Users className="h-4 w-4" />}
            error={errors.companySize?.message}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Primary use case{" "}
            <span className="text-xs text-slate-400 font-normal">
              (Optional)
            </span>
          </label>
          <div className="relative">
            <span className="absolute left-0 pl-3.5 pt-3.5 flex items-start text-slate-400 pointer-events-none">
              <MessageSquare className="h-4 w-4" />
            </span>
            <textarea
              className={`sr-input sr-textarea pl-10 pr-3.5 h-28 ${errors.useCase ? "sr-input-error" : ""}`}
              placeholder="e.g., Customer service automation and bulk campaign messages."
              {...register("useCase")}
            />
          </div>
          <FormError message={errors.useCase?.message} />
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
                Finish onboarding <Check className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}