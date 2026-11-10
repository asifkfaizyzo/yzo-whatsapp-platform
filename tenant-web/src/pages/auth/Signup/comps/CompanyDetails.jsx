// tenant-web/src/pages/auth/Signup/comps/CompanyDetails.jsx
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
} from "lucide-react";
import FormError from "../../../../components/FormError";
import { updateOnboardingStep } from "../../../../api/auth";

const schema = z.object({
  tenantName: z.string().min(2, "Company name must be at least 2 characters"),
  websiteUrl: z
    .string()
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
            Company name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <Building2 className="h-4 w-4" />
            </span>
            <input
              className={`sr-input pl-10 pr-3.5 ${errors.tenantName ? "sr-input-error" : ""}`}
              type="text"
              placeholder="Acme Corp"
              {...register("tenantName")}
            />
          </div>
          <FormError message={errors.tenantName?.message} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Website URL
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <Globe className="h-4 w-4" />
            </span>
            <input
              className={`sr-input pl-10 pr-3.5 ${errors.websiteUrl ? "sr-input-error" : ""}`}
              type="text"
              placeholder="https://company.com"
              {...register("websiteUrl")}
            />
          </div>
          <FormError message={errors.websiteUrl?.message} />
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