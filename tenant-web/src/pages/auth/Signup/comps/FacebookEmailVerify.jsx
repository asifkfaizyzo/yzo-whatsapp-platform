// tenant-web/src/pages/auth/Signup/comps/FacebookEmailVerify.jsx (do not remove this comment)
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mail,
  Loader2,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  facebookSendSignupOtp,
  facebookVerifySignupOtp,
} from "../../../../api/auth";

const OTP_LENGTH = 4;

function maskEmail(email) {
  if (!email || !email.includes("@")) return email || "your email";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${"*".repeat(Math.max(1, local.length - 2))}${local[local.length - 1]}@${domain}`;
}

export default function FacebookEmailVerify({
  mockMode,
  meta,
  userData,
  onContinue,
  onBack,
}) {
  // ── Phase: "email" → "otp" ──
  const [phase, setPhase] = useState("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [digits, setDigits] = useState(() => Array(OTP_LENGTH).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState(null);
  const [shake, setShake] = useState(false);
  const inputRefs = useRef([]);
  const hasSubmitted = useRef(false);

  const fbToken = userData?.fbAccessToken || "";

  // ── Cooldown tick ──
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ── Phase 1: Send OTP ──
  const handleSendOtp = async (e) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError("");
    setError("");
    setIsLoading(true);

    if (mockMode) {
      setTimeout(() => {
        setIsLoading(false);
        setPendingToken("mock-pending-token");
        setPhase("otp");
        setCooldown(60);
      }, 500);
      return;
    }

    try {
      const result = await facebookSendSignupOtp(fbToken, trimmed);
      setIsLoading(false);
      if (result.success) {
        setPendingToken(result.data?.data?.pendingToken || "");
        setPhase("otp");
        setCooldown(60);
      } else {
        setError(result.message || "Failed to send code.");
      }
    } catch {
      setIsLoading(false);
      setError("Something went wrong. Please try again.");
    }
  };

  // ── Phase 2: Verify OTP ──
  const code = digits.join("");
  const isComplete = code.length === OTP_LENGTH;

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
          setTimeout(
            () =>
              onContinue({
                provider: "facebook",
                email: email.trim().toLowerCase(),
                firstName: userData?.firstName || "",
                lastName: userData?.lastName || "",
              }),
            700,
          );
        }, 600);
        return;
      }

      try {
        const result = await facebookVerifySignupOtp(
          pendingToken,
          fullCode,
          fbToken,
        );
        setIsLoading(false);
        if (result.success) {
          setStatus("success");
          const t = result.data?.data?.tenant || {};
          setTimeout(
            () =>
              onContinue({
                provider: "facebook",
                email: t.email || email.trim().toLowerCase(),
                firstName: t.firstName || userData?.firstName || "",
                lastName: t.lastName || userData?.lastName || "",
              }),
            700,
          );
        } else {
          setStatus("error");
          setError(result.message || "Invalid code.");
          setShake(true);
          setTimeout(() => setShake(false), 450);
          hasSubmitted.current = false;
          setDigits(Array(OTP_LENGTH).fill(""));
          setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
      } catch {
        setIsLoading(false);
        setStatus("error");
        setError("Verification failed.");
        setShake(true);
        setTimeout(() => setShake(false), 450);
        hasSubmitted.current = false;
        setDigits(Array(OTP_LENGTH).fill(""));
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    },
    [pendingToken, fbToken, email, userData, mockMode, onContinue],
  );

  // ── Auto-submit OTP ──
  useEffect(() => {
    if (phase === "otp" && isComplete && !hasSubmitted.current && status !== "success") {
      submitCode(code);
    }
  }, [phase, isComplete, code, submitCode, status]);

  // ── Autofocus OTP first input ──
  useEffect(() => {
    if (phase === "otp") {
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    }
  }, [phase]);

  // ── OTP box handlers ──
  const handleChange = (index, value) => {
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      if (status === "error") { setStatus(null); setError(""); }
      return;
    }
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, OTP_LENGTH - index).split("");
      const next = [...digits];
      chars.forEach((c, i) => { if (index + i < OTP_LENGTH) next[index + i] = c; });
      setDigits(next);
      inputRefs.current[Math.min(index + chars.length, OTP_LENGTH - 1)]?.focus();
      if (status === "error") { setStatus(null); setError(""); }
      return;
    }
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (status === "error") { setStatus(null); setError(""); }
    if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      e.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
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
    pasted.split("").forEach((c, i) => { next[i] = c; });
    setDigits(next);
    if (status === "error") { setStatus(null); setError(""); }
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setCooldown(60);
    setStatus(null);
    setError("");
    hasSubmitted.current = false;
    setDigits(Array(OTP_LENGTH).fill(""));
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
    if (mockMode) return;
    const result = await facebookSendSignupOtp(fbToken, email.trim().toLowerCase());
    if (result.success) {
      setPendingToken(result.data?.data?.pendingToken || pendingToken);
    } else {
      setError(result.message || "Failed to resend.");
    }
  };

  const boxClass = (idx) => {
    const base =
      "w-[52px] h-[56px] rounded-xl border-[1.5px] bg-white text-center text-[1.4rem] font-semibold text-slate-900 tabular-nums transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#125fe2]/20";
    if (status === "success") return `${base} border-emerald-400 bg-emerald-50/50 text-emerald-700`;
    if (status === "error") return `${base} border-red-400 bg-red-50/40`;
    if (digits[idx]) return `${base} border-[#125fe2]`;
    return `${base} border-slate-200 focus:border-[#125fe2]`;
  };

  // ═══════════════════════════════════════════════
  //  PHASE 1: Email entry
  // ═══════════════════════════════════════════════
  if (phase === "email") {
    return (
      <>
        <div className="text-center mb-4">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-[#1877F2]/10 flex items-center justify-center">
            <Mail size={22} className="text-[#1877F2]" />
          </div>
          <h2 className="text-[1.3rem] font-bold text-slate-900 tracking-tight">
            {meta.title}
          </h2>
          <p className="text-[0.78rem] text-slate-400 mt-1">
            {meta.subtitle}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[0.78rem]">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSendOtp} className="space-y-3">
          <div>
            <label className="block text-[0.78rem] font-medium text-slate-600 mb-1">
              Your email address <span className="text-red-400">*</span>
            </label>
            <div className="sr-input-wrap relative">
              <Mail
                size={16}
                className="sr-input-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                placeholder="you@company.com"
                className={`sr-input w-full h-[44px] pl-10 pr-4 rounded-xl border bg-white text-[0.875rem] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#125fe2]/20 focus:border-[#125fe2] transition-all duration-200 ${
                  emailError ? "border-red-300" : "border-slate-200"
                }`}
                disabled={isLoading}
                autoFocus
              />
            </div>
            {emailError && (
              <p className="mt-1 text-[0.72rem] text-red-500 font-medium">{emailError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="sr-btn-primary-gradient w-full mt-1.5 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><Loader2 size={16} className="animate-spin" /> Sending…</>
            ) : (
              <>Send verification code <ArrowRight size={15} /></>
            )}
          </button>
        </form>

        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="w-full h-[44px] mt-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2 text-[0.84rem] font-medium text-slate-600 transition-all duration-150 disabled:opacity-50"
        >
          <ArrowLeft size={16} /> Back
        </button>
      </>
    );
  }

  // ═══════════════════════════════════════════════
  //  PHASE 2: OTP entry
  // ═══════════════════════════════════════════════
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] py-2">
      <div className="text-center mb-5">
        <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-[#125fe2]/10 flex items-center justify-center">
          <Mail size={22} className="text-[#125fe2]" />
        </div>
        <h2 className="text-[1.3rem] font-bold text-slate-900 tracking-tight">
          Verify your email
        </h2>
        <p className="text-[0.78rem] text-slate-400 mt-1">
          Enter the 4-digit code sent to
          <br />
          <span className="font-medium text-slate-600">{maskEmail(email)}</span>
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[0.78rem]">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {status === "success" && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[0.78rem]">
          <CheckCircle2 size={14} className="shrink-0" />
          <span>Verified! Setting up your account…</span>
        </div>
      )}

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

      {status === "verifying" && (
        <div className="flex items-center justify-center gap-2 mb-4 text-[0.78rem] text-slate-500">
          <Loader2 size={14} className="animate-spin text-[#125fe2]" />
          <span>Verifying…</span>
        </div>
      )}

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

      <button
        type="button"
        onClick={() => {
          setPhase("email");
          setDigits(Array(OTP_LENGTH).fill(""));
          setStatus(null);
          setError("");
          hasSubmitted.current = false;
        }}
        disabled={status === "verifying" || status === "success"}
        className="w-full h-[44px] rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2 text-[0.84rem] font-medium text-slate-600 transition-all duration-150 disabled:opacity-50"
      >
        <ArrowLeft size={16} /> Change email
      </button>
    </div>
  );
}