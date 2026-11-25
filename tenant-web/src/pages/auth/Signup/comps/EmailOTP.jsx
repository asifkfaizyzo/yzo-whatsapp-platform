// tenant-web/src/pages/auth/Signup/comps/EmailOTP.jsx (do not remove this comment)
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Mail,
} from "lucide-react";
import { verifyEmailOtpNew, resendOtp } from "../../../../api/auth";

const OTP_LENGTH = 4;

// ── Mask email: jane.doe@company.com → j****e@company.com ──
function maskEmail(email) {
  if (!email || !email.includes("@")) return email || "your email";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

export default function EmailOTP({
  mockMode,
  meta,
  userData,
  onContinue,
  onBack,
}) {
  const [digits, setDigits] = useState(() => Array(OTP_LENGTH).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState(null); // null | 'verifying' | 'success' | 'error'
  const [shake, setShake] = useState(false);
  const inputRefs = useRef([]);
  const hasSubmitted = useRef(false);

  const code = digits.join("");
  const isComplete = code.length === OTP_LENGTH;

  // ── Autofocus first input on mount ──
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // ── Resend cooldown tick ──
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ── Submit OTP ──
  const submitCode = useCallback(
    async (fullCode) => {
      if (hasSubmitted.current) return;
      hasSubmitted.current = true;
      setStatus("verifying");
      setError("");
      setIsLoading(true);

      if (mockMode) {
        setTimeout(() => {
          setIsLoading(false);
          setStatus("success");
          setTimeout(() => onContinue({ otpCode: fullCode }), 700);
        }, 600);
        return;
      }

      try {
        const result = await verifyEmailOtpNew(fullCode);
        setIsLoading(false);
        if (result.success) {
          setStatus("success");
          setTimeout(() => onContinue({ otpCode: fullCode }), 700);
        } else {
          setStatus("error");
          setError(result.message || "Invalid code. Please try again.");
          setShake(true);
          setTimeout(() => setShake(false), 450);
          hasSubmitted.current = false;
          // Clear digits + refocus first
          setDigits(Array(OTP_LENGTH).fill(""));
          setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
      } catch {
        setIsLoading(false);
        setStatus("error");
        setError("Verification failed. Please try again.");
        setShake(true);
        setTimeout(() => setShake(false), 450);
        hasSubmitted.current = false;
        setDigits(Array(OTP_LENGTH).fill(""));
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    },
    [mockMode, onContinue]
  );

  // ── Auto-submit when all digits filled ──
  useEffect(() => {
    if (isComplete && !hasSubmitted.current && status !== "success") {
      submitCode(code);
    }
  }, [isComplete, code, submitCode, status]);

  // ── Per-box handlers ──
  const handleChange = (index, value) => {
    // Only digits
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      // Backspace cleared it
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      // Clear error state when user starts editing again
      if (status === "error") {
        setStatus(null);
        setError("");
      }
      return;
    }

    // If user typed multiple chars (e.g. mobile autofill), distribute
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, OTP_LENGTH - index).split("");
      const next = [...digits];
      chars.forEach((c, i) => {
        if (index + i < OTP_LENGTH) next[index + i] = c;
      });
      setDigits(next);
      const nextFocus = Math.min(index + chars.length, OTP_LENGTH - 1);
      inputRefs.current[nextFocus]?.focus();
      if (status === "error") {
        setStatus(null);
        setError("");
      }
      return;
    }

    // Single digit
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (status === "error") {
      setStatus(null);
      setError("");
    }
    // Auto-advance
    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // Jump to previous and clear it
        e.preventDefault();
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((c, i) => {
      next[i] = c;
    });
    setDigits(next);
    if (status === "error") {
      setStatus(null);
      setError("");
    }
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleResend = () => {
    if (cooldown > 0) return;
    setCooldown(60);
    setStatus(null);
    setError("");
    hasSubmitted.current = false;
    setDigits(Array(OTP_LENGTH).fill(""));
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
    if (mockMode) return;
    resendOtp().catch(() => {
      setError("Failed to resend code. Please try again.");
    });
  };

  // ── Visual state per box ──
  const boxClass = (idx) => {
    const base =
      "w-[52px] h-[56px] rounded-xl border-[1.5px] bg-white text-center text-[1.4rem] font-semibold text-slate-900 tabular-nums transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#125fe2]/20";
    if (status === "success") {
      return `${base} border-emerald-400 bg-emerald-50/50 text-emerald-700`;
    }
    if (status === "error") {
      return `${base} border-red-400 bg-red-50/40`;
    }
    if (digits[idx]) {
      return `${base} border-[#125fe2]`;
    }
    return `${base} border-slate-200 focus:border-[#125fe2]`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] py-2">
      {/* Header */}
      <div className="text-center mb-5">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-[#125fe2]/10 flex items-center justify-center">
          <Mail size={22} className="text-[#125fe2]" />
        </div>
        <h2 className="text-[1.3rem] font-bold text-slate-900 tracking-tight">
          {meta.title}
        </h2>
        <p className="text-[0.78rem] text-slate-400 mt-1">
          Enter the 4-digit code sent to
          <br />
          <span className="font-medium text-slate-600">
            {userData?.email}
          </span>
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[0.78rem] sr-animate-fade-in-slide">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success banner */}
      {status === "success" && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[0.78rem] sr-animate-fade-in-slide">
          <CheckCircle2 size={14} className="shrink-0" />
          <span>Verified! Redirecting…</span>
        </div>
      )}

      {/* OTP boxes */}
      <div
        className={`flex justify-center gap-2.5 mb-4 ${shake ? "sr-shake" : ""}`}
        onPaste={handlePaste}
      >
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => (inputRefs.current[idx] = el)}
            type="text"
            inputMode="numeric"
            autoComplete={idx === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            disabled={status === "success" || status === "verifying"}
            className={boxClass(idx)}
          />
        ))}
      </div>

      {/* Verifying state */}
      {status === "verifying" && (
        <div className="flex items-center justify-center gap-2 mb-4 text-[0.78rem] text-slate-500">
          <Loader2 size={14} className="animate-spin text-[#125fe2]" />
          <span>Verifying…</span>
        </div>
      )}

      {/* Resend */}
      <div className="text-center mb-5">
        <p className="text-[0.75rem] text-slate-400">
          Didn't receive the code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || isLoading || status === "success"}
            className="sr-link-underline font-semibold text-[#125fe2] hover:text-[#0e4bc0] disabled:text-slate-400 disabled:cursor-not-allowed disabled:no-underline"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </p>
      </div>

      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        disabled={status === "verifying" || status === "success"}
        className="w-full h-[44px] rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2 text-[0.84rem] font-medium text-slate-600 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ArrowLeft size={16} /> Back
      </button>
    </div>
  );
}