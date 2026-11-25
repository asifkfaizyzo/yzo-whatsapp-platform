// tenant-web/src/pages/auth/Signup/comps/CompanyDetails.jsx (do not remove this comment)
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Globe,
  Loader2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import FormError from "../../../../components/FormError";
import { updateOnboardingStep } from "../../../../api/auth";

const schema = z.object({
  tenantName: z.string().min(2, "Company name must be at least 2 characters").max(40, "Company name must be under 40 characters"),
  websiteUrl: z
    .string()
    .max(255, "URL must be under 255 characters")
    .optional()
    .or(z.literal(""))
    .refine((val) => {
      if (!val) return true;
      try {
        new URL(val.startsWith("http") ? val : `https://${val}`);
        return true;
      } catch {
        return false;
      }
    }, "Please enter a valid URL"),
});

export default function CompanyDetails({
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
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantName: userData.tenantName || "",
      websiteUrl: userData.websiteUrl || "",
    },
  });

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
      const result = await updateOnboardingStep(4, data);
      if (result.success) {
        onContinue(data);
      } else {
        setError(result.message || "Failed to save company details.");
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

        {/* ── Company name ── */}
        <div>
          <label className="block text-[0.78rem] font-medium text-slate-600 mb-1">
            Company name <span className="text-red-400">*</span>
          </label>
          <div className="sr-input-wrap relative">
            <Building2 size={16} className="sr-input-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors duration-200 pointer-events-none" />
            <input
              className={`sr-input w-full h-[44px] pl-10 pr-3.5 rounded-xl border bg-white text-[0.875rem] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#125fe2]/20 focus:border-[#125fe2] transition-all duration-200 ${
                errors.tenantName ? "border-red-300" : "border-slate-200"
              }`}
              type="text"
              placeholder="Company Ltd"
              maxLength={40}
              {...register("tenantName")}
            />
          </div>
          <FormError message={errors.tenantName?.message} />
        </div>

        {/* ── Website URL ── */}
        <div>
          <label className="block text-[0.78rem] font-medium text-slate-600 mb-1">
            Website URL
          </label>
          <div className="sr-input-wrap relative">
            <Globe size={16} className="sr-input-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 transition-colors duration-200 pointer-events-none" />
            <input
              className={`sr-input w-full h-[44px] pl-10 pr-3.5 rounded-xl border bg-white text-[0.875rem] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#125fe2]/20 focus:border-[#125fe2] transition-all duration-200 ${
                errors.websiteUrl ? "border-red-300" : "border-slate-200"
              }`}
              type="text"
              placeholder="https://company.com"
              maxLength={255}
              {...register("websiteUrl")}
            />
          </div>
          <FormError message={errors.websiteUrl?.message} />
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