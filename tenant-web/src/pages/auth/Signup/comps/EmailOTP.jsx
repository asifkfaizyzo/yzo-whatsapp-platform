// tenant-web/src/pages/auth/Signup/comps/EmailOTP.jsx
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Lock,
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import FormError from "../../../../components/FormError";
import { verifyEmailOtpNew, resendOtp } from "../../../../api/auth";

const schema = z.object({
  otpCode: z
    .string()
    .length(4, "Code must be exactly 4 digits")
    .regex(/^\d+$/, "Numbers only"),
});

export default function EmailOTP({
  mockMode,
  meta,
  userData,
  onContinue,
  onBack,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState(null);
  const hasSubmitted = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { otpCode: "" },
  });

  const otp = watch("otpCode");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ── Auto-validate when 4 digits entered ──
  useEffect(() => {
    if (!otp || otp.length !== 4 || hasSubmitted.current) return;
    if (!/^\d{4}$/.test(otp)) return;

    hasSubmitted.current = true;
    setStatus("verifying");
    setError("");
    setIsLoading(true);

    if (mockMode) {
      setTimeout(() => {
        setIsLoading(false);
        setStatus("success");
        setTimeout(() => {
          onContinue({ otpCode: otp });
        }, 800);
      }, 600);
      return;
    }

    verifyEmailOtpNew(otp)
      .then((result) => {
        setIsLoading(false);
        if (result.success) {
          setStatus("success");
          setTimeout(() => onContinue({ otpCode: otp }), 800);
        } else {
          setStatus("error");
          setError(result.message || "Invalid code.");
          hasSubmitted.current = false;
        }
      })
      .catch(() => {
        setIsLoading(false);
        setStatus("error");
        setError("Verification failed. Please try again.");
        hasSubmitted.current = false;
      });
    return;
  }, [otp, mockMode, onContinue]);

  useEffect(() => {
    if (status === "error" && otp.length < 4) {
      setStatus(null);
      hasSubmitted.current = false;
    }
  }, [otp, status]);

  const onSubmit = async (data) => {
    if (hasSubmitted.current) return;
    setError("");
    setStatus("verifying");
    setIsLoading(true);
    hasSubmitted.current = true;

    if (mockMode) {
      setTimeout(() => {
        setIsLoading(false);
        setStatus("success");
        setTimeout(() => onContinue(data), 800);
      }, 600);
      return;
    }
    try {
      const result = await verifyEmailOtpNew(data.otpCode);
      setIsLoading(false);
      if (result.success) {
        setStatus("success");
        setTimeout(() => onContinue(data), 800);
      } else {
        setStatus("error");
        setError(result.message || "Invalid code.");
        hasSubmitted.current = false;
      }
    } catch (err) {
      setIsLoading(false);
      setStatus("error");
      setError("Verification failed. Please try again.");
      hasSubmitted.current = false;
    }
  };

  const handleResend = () => {
    if (cooldown > 0) return;
    setCooldown(60);
    setStatus(null);
    setError("");
    hasSubmitted.current = false;
    setValue("otpCode", "");
    if (mockMode) return;
    resendOtp().catch(() => {
      setError("Failed to resend code. Please try again.");
    });
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
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 font-medium flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {status === "success" && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium flex items-center gap-2 sr-animate-fade-in-slide">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Code verified! Redirecting...
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Verification Code <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              {status === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : status === "error" ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
            </span>
            <input
              className={`sr-input pl-10 pr-3.5 text-center font-mono tracking-[0.5em] ${
                errors.otpCode || status === "error"
                  ? "sr-input-error"
                  : status === "success"
                    ? "!border-emerald-400 !bg-emerald-50/30"
                    : ""
              }`}
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              autoFocus
              disabled={status === "success" || status === "verifying"}
              {...register("otpCode")}
            />
            {status === "verifying" && (
              <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center">
                <Loader2 className="h-4 w-4 animate-spin text-[#125fe2]" />
              </span>
            )}
          </div>
          <FormError message={errors.otpCode?.message} />
          <p className="mt-2 text-xs text-slate-500">
            We've sent a 4-digit code to{" "}
            <span className="font-medium text-slate-700">
              {userData.email || "your email"}
            </span>
            .
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || isLoading}
            className="text-xs text-slate-500 hover:text-slate-700 hover:underline font-medium disabled:opacity-50"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
          </button>
        </div>

        <div className="flex gap-4 mt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={status === "verifying" || status === "success"}
            className="sr-btn-secondary flex-1 justify-center items-center flex gap-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            type="submit"
            disabled={
              isLoading ||
              otp?.length !== 4 ||
              status === "success" ||
              status === "verifying"
            }
            className="sr-btn-primary flex-1 justify-center items-center flex gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Verify <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}