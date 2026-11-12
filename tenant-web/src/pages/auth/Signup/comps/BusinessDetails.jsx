// tenant-web/src/pages/auth/Signup/comps/BusinessDetails.jsx (do not remove this comment)
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
  AlertCircle,
} from "lucide-react";
import FormError from "../../../../components/FormError";
import { updateOnboardingStep } from "../../../../api/auth";
import StyledSelect from "../../../../components/common/StyledSelect";

const schema = z.object({
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(15, "Phone number must be under 15 characters"),
  companySize: z.string().min(1, "Team size selection is required"),
  useCase: z.string().max(500, "Use case must be under 500 characters").optional().or(z.literal("")),
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
    try {
      const result = await updateOnboardingStep(5, data);
      if (result.success) {
        onContinue(data);
      } else {
        setError(result.message || "Failed to save business details.");
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
        <p className="text-[0.78rem] text-slate-400 mt-0.5">
          {meta.subtitle}
        </p>
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

        {/* ── Business phone ── */}
        <div>
          <label className="block text-[0.78rem] font-medium text-slate-600 mb-1">
            Business phone <span className="text-red-400">*</span>
          </label>
          <div className="sr-input-wrap relative">
            <Phone size={16} className="sr-input-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors duration-200 pointer-events-none" />
            <input
              className={`sr-input w-full h-[44px] pl-10 pr-3.5 rounded-xl border bg-white text-[0.875rem] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#125fe2]/20 focus:border-[#125fe2] transition-all duration-200 ${
                errors.phone ? "border-red-300" : "border-slate-200"
              }`}
              type="tel"
              placeholder="+1 (234) 567-8970"
              maxLength={15}
              {...register("phone")}
            />
          </div>
          <FormError message={errors.phone?.message} />
        </div>

        {/* ── Team Size — StyledSelect replaces native <select> ── */}
        <div>
          <StyledSelect
            label={
              <>
                Team size <span className="text-red-400">*</span>
              </>
            }
            value={companySize}
            onChange={(val) =>
              setValue("companySize", val, { shouldValidate: true })
            }
            options={SIZES}
            placeholder="Select team size"
            icon={<Users size={16} />}
            error={errors.companySize?.message}
          />
        </div>

        {/* ── Primary use case ── */}
        <div>
          <label className="block text-[0.78rem] font-medium text-slate-600 mb-1">
            Primary use case{" "}
            <span className="text-[0.68rem] text-slate-400 font-normal">
              (Optional)
            </span>
          </label>
          <div className="sr-input-wrap relative">
            <MessageSquare size={16} className="sr-input-icon absolute left-3.5 top-3.5 text-slate-300 transition-colors duration-200 pointer-events-none" />
            <textarea
              className={`sr-input sr-textarea w-full pl-10 pr-3.5 rounded-xl border bg-white text-[0.875rem] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#125fe2]/20 focus:border-[#125fe2] transition-all duration-200 resize-none ${
                errors.useCase ? "border-red-300" : "border-slate-200"
              }`}
              rows={3}
              maxLength={500}
              placeholder="e.g., Customer service automation and bulk campaign messages."
              {...register("useCase")}
            />
          </div>
          <FormError message={errors.useCase?.message} />
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
                Finish onboarding <Check size={15} />
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}