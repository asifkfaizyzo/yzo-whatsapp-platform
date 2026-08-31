import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  Globe,
  Phone,
  Users,
  MessageSquare,
  Check,
} from "lucide-react";

import {
  registerStep1,
  registerStep2,
  registerStep3,
  registerStep4,
  registerStep5,
  verifyEmailOtp,
  loginWithGoogle,
} from "../../services/auth.service";
import { useAuthStore } from "../../store/useAuthStore";
import { useToast } from "../../context/ToastContext";
import FormError from "../../components/FormError";
import { GoogleLogin } from "@react-oauth/google";

// Validation Schemas for each step
const step1Schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

const step2Schema = z.object({
  email: z.string().email("Invalid work email address"),
});

const otpSchema = z.object({
  otpCode: z.string().length(6, "Code must be exactly 6 digits").regex(/^\d+$/, "Code must be numbers only"),
});

const step3Schema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[!@#$%^&*]/, "Password must contain at least one special character"),
    confirmPassword: z.string().min(8, "Confirm password is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const step4Schema = z.object({
  tenantName: z.string().min(2, "Company name must be at least 2 characters"),
  websiteUrl: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((val) => {
      if (!val) return true;
      try {
        const urlStr = val.startsWith("http") ? val : `https://${val}`;
        new URL(urlStr);
        return true;
      } catch {
        return false;
      }
    }, "Please enter a valid website URL"),
});

const step5Schema = z.object({
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  companySize: z.string().min(1, "Company size selection is required"),
  useCase: z.string().optional().or(z.literal("")),
});

const companySizes = [
  "1-10 employees",
  "11-50 employees",
  "51-200 employees",
  "201-500 employees",
  "500+ employees",
];

const benefits = [
  {
    title: "Official WhatsApp Cloud API",
    text: "Direct integration with Meta's official API for maximum reliability and green-tick eligibility.",
  },
  {
    title: "Bulk WhatsApp Broadcasting",
    text: "Send personalized campaign messages to thousands of contacts with a single click.",
  },
  {
    title: "Multi-Agent Shared Inbox",
    text: "Collaborate seamlessly. Assign chats, label contacts, and support customers together.",
  },
];

// Visual-only strength score — does not affect validation, the zod schema above remains the source of truth.
function scorePassword(password = "") {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*]/.test(password)) score++;
  return score;
}
const STRENGTH_LEVELS = [
  { label: "Too weak", color: "#dc2626" },
  { label: "Weak", color: "#d97706" },
  { label: "Fair", color: "#d97706" },
  { label: "Good", color: "#16a34a" },
  { label: "Strong", color: "#16a34a" },
];

export default function Register() {
  const navigate = useNavigate();
  const { logout, user, isAuthenticated, isHydrated } = useAuthStore();

  const toast = useToast();
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [step, setStep] = useState(1);
  const [generalError, setGeneralError] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successTimer, setSuccessTimer] = useState(3);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleGoogleSuccess = async (credentialResponse) => {
    setGeneralError("");
    setGoogleError("");
    setIsLoading(true);
    const result = await loginWithGoogle(credentialResponse.credential);
    setIsLoading(false);
    if (result.success) {
      const tenantUser = result.data?.data?.user;
      if (tenantUser?.type === "TENANT" && !tenantUser?.onboardingCompleted) {
        setStep(tenantUser.onboardingStep || 4);
      } else {
        navigate("/dashboard");
      }
    } else {
      setGoogleError(result.message || "Google registration failed.");
    }
  };

  const handleGoogleError = () => {
    setGoogleError("Google Sign-In was unsuccessful. Please try again.");
  };

  // Sync step state with user onboarding stage from Zustand store
  useEffect(() => {
    if (isHydrated && isAuthenticated && user) {
      if (user.onboardingCompleted) {
        navigate("/dashboard", { replace: true });
      } else if (user.onboardingStep) {
        setStep(user.onboardingStep);
      }
    }
  }, [isHydrated, isAuthenticated, user, navigate]);

  // Success timer redirect
  useEffect(() => {
    if (isSuccess && successTimer > 0) {
      const t = setTimeout(() => setSuccessTimer(successTimer - 1), 1000);
      return () => clearTimeout(t);
    } else if (isSuccess && successTimer === 0) {
      navigate("/select-plan");
    }
  }, [isSuccess, successTimer, navigate]);

  // Form hooks for each step
  const {
    register: reg1,
    handleSubmit: handleSub1,
    formState: { errors: err1 },
  } = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: { firstName: user?.firstName || "", lastName: user?.lastName || "" },
  });

  const {
    register: reg2,
    handleSubmit: handleSub2,
    setValue: setVal2,
    getValues: getVal2,
    formState: { errors: err2 },
  } = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: { email: user?.email || "" },
  });

  const {
    register: regOtp,
    handleSubmit: handleSubOtp,
    watch: watchOtp,
    formState: { errors: errOtp },
    reset: resetOtpForm,
  } = useForm({
    resolver: zodResolver(otpSchema),
    defaultValues: { otpCode: "" },
  });
  const watchedOtp = watchOtp("otpCode");

  const {
    register: reg3,
    handleSubmit: handleSub3,
    watch: watch3,
    formState: { errors: err3 },
  } = useForm({
    resolver: zodResolver(step3Schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const {
    register: reg4,
    handleSubmit: handleSub4,
    setValue: setVal4,
    formState: { errors: err4 },
  } = useForm({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      tenantName: user?.tenantName && !user.tenantName.endsWith("'s Workspace") ? user.tenantName : "",
      websiteUrl: user?.websiteUrl || "",
    },
  });

  const {
    register: reg5,
    handleSubmit: handleSub5,
    setValue: setVal5,
    formState: { errors: err5 },
  } = useForm({
    resolver: zodResolver(step5Schema),
    defaultValues: { phone: user?.phone || "", companySize: user?.companySize || "", useCase: user?.useCase || "" },
  });

  // Keep step forms populated when user profile finishes loading
  useEffect(() => {
    if (user) {
      if (user.email) setVal2("email", user.email);
      if (user.tenantName && !user.tenantName.endsWith("'s Workspace")) {
        setVal4("tenantName", user.tenantName);
      }
      if (user.websiteUrl) setVal4("websiteUrl", user.websiteUrl);
      if (user.phone) setVal5("phone", user.phone);
      if (user.companySize) setVal5("companySize", user.companySize);
      if (user.useCase) setVal5("useCase", user.useCase);
    }
  }, [user, setVal2, setVal4, setVal5]);

  // Form Submission Handlers
  const onStep1Submit = async (data) => {
    setGeneralError("");
    setIsLoading(true);
    const result = await registerStep1(data);
    setIsLoading(false);
    if (result.success) {
      setStep(2);
    } else {
      setGeneralError(result.message || "Step 1 failed.");
    }
  };

  const onStep2Submit = async (data, isResend = false) => {
    setGeneralError("");
    setIsLoading(true);
    const result = await registerStep2(data);
    setIsLoading(false);
    if (result.success) {
      setShowOtpInput(true); // <-- Show the OTP input container
      if (isResend) {
        toast.success("A new verification code has been sent to your email.");
      }
    } else {
      setGeneralError(result.message || "Step 2 failed.");
      if (isResend) {
        toast.error(result.message || "Failed to resend verification code.");
      }
    }
  };

  const onOtpSubmit = async (data) => {
    setGeneralError("");
    setIsLoading(true);
    const result = await verifyEmailOtp(data.otpCode);
    setIsLoading(false);
    if (result.success) {
      setShowOtpInput(false);
      setStep(3); // Now proceed to step 3 (Password)
    } else {
      setGeneralError(result.message || "OTP verification failed.");
    }
  };

  const onStep3Submit = async (data) => {
    setGeneralError("");
    setIsLoading(true);
    const result = await registerStep3({ password: data.password });
    setIsLoading(false);
    if (result.success) {
      setStep(4);
    } else {
      setGeneralError(result.message || "Step 3 failed.");
    }
  };

  const onStep4Submit = async (data) => {
    setGeneralError("");
    setIsLoading(true);
    const result = await registerStep4(data);
    setIsLoading(false);
    if (result.success) {
      setStep(5);
    } else {
      setGeneralError(result.message || "Step 4 failed.");
    }
  };

  const onStep5Submit = async (data) => {
    if (isLoading || isSuccess) return;
    setGeneralError("");
    setIsLoading(true);
    try {
      const result = await registerStep5(data);
      if (result.success) {
        setIsSuccess(true);
      } else {
        setGeneralError(result.message || "Step 5 failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setStep(1);
    navigate("/login");
  };

  // Step Meta Configuration
  const stepsMeta = {
    1: { title: "What is your name?", subtitle: "Let's start with your first and last name.", label: "Personal info" },
    2: { title: "What is your work email?", subtitle: "We will use this email for account verification.", label: "Enter email" },
    3: { title: "Set your password", subtitle: "Make sure it is secure and contains numbers, symbols, and capitals.", label: "Secure account" },
    4: { title: "Tell us about your company", subtitle: "Please provide your company name and website.", label: "Company details" },
    5: { title: "Finish setting up your workspace", subtitle: "Please provide your business contact details and target use case.", label: "Workspace launch" },
  };

  const watchedPassword = watch3("password");
  const strengthScore = scorePassword(watchedPassword);
  const strengthLevel = STRENGTH_LEVELS[strengthScore];

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-4 font-sans">
        <style>{AUTH_STYLES}</style>
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 shadow-[0_24px_48px_-16px_rgba(15,23,42,0.1)] p-10 text-center flex flex-col items-center justify-center sr-animate-fade-in-slide">
          <div className="relative mb-6 flex items-center justify-center">
            <div className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 relative">
              <Check className="h-10 w-10 text-emerald-500 stroke-[3px]" />
            </div>
            <div className="absolute inset-0 h-20 w-20 rounded-full border-2 border-emerald-500/20 sr-pulse-dot pointer-events-none" />
          </div>

          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Onboarding complete!</h2>
          <p className="mt-3 text-slate-500 text-sm max-w-sm leading-relaxed">
            Your workspace has been successfully set up. We are redirecting you to select a subscription plan to activate full platform features.
          </p>

          <div className="mt-8 flex items-center gap-2 text-sm text-[#125fe2] font-medium bg-[rgba(18,95,226,0.08)] px-4 py-2 rounded-full">
            <Loader2 className="h-4 w-4 animate-spin" />
            Redirecting in {successTimer}s...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row font-sans">
      <style>{AUTH_STYLES}</style>

      {/* Left panel */}
      <div
        className="hidden lg:flex w-5/12 min-h-screen p-12 text-white flex-col justify-between relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0c3aa6 0%, #125fe2 46%, #1547a8 100%)" }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5 blur-[110px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-24 w-96 h-96 rounded-full bg-[#0c3aa6]/40 blur-[110px] pointer-events-none" />

        {/* Message constellation — signature illustration */}
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
          <div className="absolute sr-bubble-a" style={{ top: "14%", left: "8%", width: 92, height: 34, background: "rgba(255,255,255,0.07)", borderRadius: "16px 16px 16px 4px" }} />
          <div className="absolute sr-bubble-b" style={{ top: "22%", left: "62%", width: 70, height: 28, background: "rgba(255,255,255,0.10)", borderRadius: "16px 16px 4px 16px" }} />
          <div className="absolute sr-bubble-c" style={{ top: "38%", left: "18%", width: 56, height: 24, background: "rgba(255,255,255,0.06)", borderRadius: "16px 16px 16px 4px" }} />
          <div className="absolute sr-bubble-a" style={{ top: "46%", left: "70%", width: 84, height: 30, background: "rgba(255,255,255,0.08)", borderRadius: "16px 16px 4px 16px" }} />
          <div className="absolute sr-bubble-b" style={{ top: "62%", left: "6%", width: 64, height: 26, background: "rgba(255,255,255,0.06)", borderRadius: "16px 16px 16px 4px" }} />
          <div className="absolute rounded-full bg-emerald-400 sr-pulse-dot" style={{ top: "31%", left: "56%", width: 8, height: 8 }} />
          <div className="absolute rounded-full bg-white/40 sr-pulse-dot" style={{ top: "57%", left: "24%", width: 6, height: 6, animationDelay: "0.8s" }} />
        </div>

        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center">
            <img src="/sudo2.png" alt="SudoReply Logo" className="w-14 h-14 object-contain filter drop-shadow-md brightness-110" />
          </Link>
        </div>

        <div className="relative z-10 my-auto py-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-200/80">
            SudoReply Workspace
          </p>
          <h1 className="mt-4 text-4xl xl:text-[2.75rem] font-bold tracking-tight leading-[1.15]">
            Scale your customer relationships on WhatsApp.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-blue-100/70">
            Enterprises rely on SudoReply to orchestrate bulk campaigns, maintain shared team inboxes, and process customer interactions on Meta's official WhatsApp Cloud API.
          </p>
        </div>

        <div className="relative z-10 space-y-3">
          {benefits.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md transition-colors duration-200 hover:bg-white/[0.09]">
              <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                <CheckIcon />
                {item.title}
              </h3>
              <p className="mt-1 text-[13px] text-blue-100/60 leading-relaxed pl-6">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
        {/* Mobile Branding */}
        <div className="flex flex-col items-center text-center lg:hidden mb-8">
          <Link to="/" className="inline-flex items-center mb-4">
            <img src="/sudo2.png" alt="SudoReply Logo" className="w-14 h-14 object-contain" />
          </Link>
          <h1 className="text-[1.75rem] font-bold text-slate-900 tracking-tight">Create your account</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-sm">
            Launch your company WhatsApp platform and start interacting at scale.
          </p>
        </div>

        <div className="w-full max-w-[440px]">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-16px_rgba(15,23,42,0.08)] p-8 sm:p-10">
            {/* Stepper Progress bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                <span>Step {step} of 5</span>
                <span>{stepsMeta[step]?.label}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#125fe2] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${step * 20}%` }}
                />
              </div>
            </div>

            {generalError && (
              <div className="mb-6 rounded-xl bg-red-50 border border-red-100 px-4 py-3.5 text-sm text-red-600 font-medium">
                {generalError}
              </div>
            )}

            <div className="space-y-4 sr-animate-fade-in-slide" key={step}>
              <div>
                <h2 className="text-[1.6rem] font-bold text-slate-900 tracking-tight">{stepsMeta[step]?.title}</h2>
                <p className="text-sm text-slate-500 mt-1.5">{stepsMeta[step]?.subtitle}</p>
              </div>

              {step === 1 && (
                <>
                  <form onSubmit={handleSub1(onStep1Submit)} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1.5">First name <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                            <User className="h-4 w-4" />
                          </span>
                          <input
                            className={`sr-input pl-10 pr-3.5 ${err1.firstName ? "sr-input-error" : ""}`}
                            type="text"
                            placeholder="Jane"
                            {...reg1("firstName")}
                          />
                        </div>
                        <FormError message={err1.firstName?.message} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1.5">Last name <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                            <User className="h-4 w-4" />
                          </span>
                          <input
                            className={`sr-input pl-10 pr-3.5 ${err1.lastName ? "sr-input-error" : ""}`}
                            type="text"
                            placeholder="Doe"
                            {...reg1("lastName")}
                          />
                        </div>
                        <FormError message={err1.lastName?.message} />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="sr-btn-primary w-full mt-2 flex gap-2 items-center justify-center"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          Continue to email
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-3 text-xs font-medium text-slate-400 tracking-wide">Or continue with</span>
                    </div>
                  </div>

                  {googleError && (
                    <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                      {googleError}
                    </div>
                  )}

                  <div className="flex justify-center w-full">
                    <GoogleLogin
                      onSuccess={handleGoogleSuccess}
                      onError={handleGoogleError}
                      shape="pill"
                      theme="outline"
                      width="340px"
                    />
                  </div>
                </>
              )}

                {step === 2 && (
                  <>
                    {!showOtpInput ? (
                      <form onSubmit={handleSub2(onStep2Submit)} className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-slate-600 mb-1.5">Work email <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                              <Mail className="h-4 w-4" />
                            </span>
                            <input
                              className={`sr-input pl-10 pr-3.5 ${err2.email ? "sr-input-error" : ""}`}
                              type="email"
                              placeholder="jane.doe@company.com"
                              {...reg2("email")}
                            />
                          </div>
                          <FormError message={err2.email?.message} />
                        </div>

                        <div className="flex gap-4 mt-2">
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="sr-btn-secondary flex-1 justify-center items-center flex gap-2"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Logout
                          </button>
                          <button
                            type="submit"
                            disabled={isLoading}
                            className="sr-btn-primary flex-1 justify-center items-center flex gap-2"
                          >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleSubOtp(onOtpSubmit)} className="space-y-5">
                        <div>
                          <label className="block text-sm font-medium text-slate-600 mb-1.5">Verification Code <span className="text-red-500">*</span></label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                              <Lock className="h-4 w-4" />
                            </span>
                            <input
                              className={`sr-input pl-10 pr-3.5 text-center font-mono letter-spacing-10 ${errOtp.otpCode ? "sr-input-error" : ""}`}
                              type="text"
                              maxLength={6}
                              placeholder="000000"
                              {...regOtp("otpCode")}
                            />
                          </div>
                          <FormError message={errOtp.otpCode?.message} />
                          <p className="mt-2 text-xs text-slate-500">We've sent a 6-digit verification code to your email.</p>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <button
                            type="button"
                            onClick={() => setShowOtpInput(false)}
                            className="text-[#125fe2] hover:underline font-medium"
                          >
                            Change Email
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const emailToResend = getVal2("email") || user?.email;
                              if (!emailToResend) {
                                setGeneralError("Please enter your email address first.");
                                return;
                              }
                              onStep2Submit({ email: emailToResend }, true);
                            }}
                            disabled={isLoading}
                            className="text-slate-500 hover:text-slate-700 hover:underline font-medium disabled:opacity-50"
                          >
                            Resend Code
                          </button>
                        </div>

                        <div className="flex gap-4 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowOtpInput(false);
                              resetOtpForm();
                            }}
                            className="sr-btn-secondary flex-1 justify-center items-center flex gap-2"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                          </button>
                          <button
                            type="submit"
                            disabled={isLoading || watchedOtp?.length !== 6}
                            className="sr-btn-primary flex-1 justify-center items-center flex gap-2"
                          >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Verify Code <ArrowRight className="h-4 w-4" /></>}
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}

              {step === 3 && (
                <form onSubmit={handleSub3(onStep3Submit)} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                        <Lock className="h-4 w-4" />
                      </span>
                      <input
                        className={`sr-input pl-10 pr-11 ${err3.password ? "sr-input-error" : ""}`}
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...reg3("password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <FormError message={err3.password?.message} />

                    {watchedPassword && (
                      <div className="mt-2 sr-animate-fade-in-slide">
                        <div className="flex gap-1.5">
                          {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full sr-strength-bar"
                                style={{ width: i < strengthScore ? "100%" : "0%", backgroundColor: strengthLevel.color }}
                              />
                            </div>
                          ))}
                        </div>
                        <p className="mt-1.5 text-xs font-medium" style={{ color: strengthLevel.color }}>
                          {strengthLevel.label}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Confirm password <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                        <Lock className="h-4 w-4" />
                      </span>
                      <input
                        className={`sr-input pl-10 pr-11 ${err3.confirmPassword ? "sr-input-error" : ""}`}
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...reg3("confirmPassword")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        tabIndex={-1}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <FormError message={err3.confirmPassword?.message} />
                  </div>

                  <div className="flex gap-4 mt-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="sr-btn-secondary flex-1 justify-center items-center flex gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Logout
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="sr-btn-primary flex-1 justify-center items-center flex gap-2"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
                    </button>
                  </div>
                </form>
              )}

              {step === 4 && (
                <form onSubmit={handleSub4(onStep4Submit)} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Company name <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <input
                        className={`sr-input pl-10 pr-3.5 ${err4.tenantName ? "sr-input-error" : ""}`}
                        type="text"
                        placeholder="Acme Corp"
                        {...reg4("tenantName")}
                      />
                    </div>
                    <FormError message={err4.tenantName?.message} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Website URL</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                        <Globe className="h-4 w-4" />
                      </span>
                      <input
                        className={`sr-input pl-10 pr-3.5 ${err4.websiteUrl ? "sr-input-error" : ""}`}
                        type="text"
                        placeholder="https://company.com"
                        {...reg4("websiteUrl")}
                      />
                    </div>
                    <FormError message={err4.websiteUrl?.message} />
                  </div>

                  <div className="flex gap-4 mt-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="sr-btn-secondary flex-1 justify-center items-center flex gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Logout
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="sr-btn-primary flex-1 justify-center items-center flex gap-2"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
                    </button>
                  </div>
                </form>
              )}

              {step === 5 && (
                <form onSubmit={handleSub5(onStep5Submit)} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Business phone <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                        <Phone className="h-4 w-4" />
                      </span>
                      <input
                        className={`sr-input pl-10 pr-3.5 ${err5.phone ? "sr-input-error" : ""}`}
                        type="tel"
                        placeholder="+1 (555) 019-2834"
                        {...reg5("phone")}
                      />
                    </div>
                    <FormError message={err5.phone?.message} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Team size <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                        <Users className="h-4 w-4" />
                      </span>
                      <select
                        className={`sr-input pl-10 pr-8 bg-white ${err5.companySize ? "sr-input-error" : ""}`}
                        {...reg5("companySize")}
                      >
                        <option value="">Select team size</option>
                        {companySizes.map((size) => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                    <FormError message={err5.companySize?.message} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5">Primary use case <span className="text-xs text-slate-400 font-normal">(Optional)</span></label>
                    <div className="relative">
                      <span className="absolute left-0 pl-3.5 pt-3.5 flex items-start text-slate-400 pointer-events-none">
                        <MessageSquare className="h-4 w-4" />
                      </span>
                      <textarea
                        className={`sr-input sr-textarea pl-10 pr-3.5 h-28 ${err5.useCase ? "sr-input-error" : ""}`}
                        placeholder="e.g., Customer service automation and bulk campaign messages."
                        {...reg5("useCase")}
                      />
                    </div>
                    <FormError message={err5.useCase?.message} />
                  </div>

                  <div className="flex gap-4 mt-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="sr-btn-secondary flex-1 justify-center items-center flex gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Logout
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="sr-btn-primary flex-1 justify-center items-center flex gap-2"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Finish onboarding <Check className="h-4 w-4" /></>}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {step === 1 && (
              <p className="mt-8 text-center text-sm text-slate-500 sr-animate-fade-in-slide">
                Already have an account?{" "}
                <Link to="/login" className="font-semibold text-[#125fe2] hover:text-[#0e4bc0] hover:underline underline-offset-2">
                  Login
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-300 stroke-[3px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}

// Shared inline styles for inputs, buttons, and motion — kept in this file so
// there's nothing extra to import. Identical block (plus the strength-bar
// rule) is duplicated in LoginPage.jsx so each file stays fully self-contained.
const AUTH_STYLES = `
@keyframes sr-fade-in-slide { from { opacity: 0; transform: translateY(14px);} to { opacity: 1; transform: translateY(0);} }
@keyframes sr-drift-a { 0%,100% { transform: translate(0,0) rotate(0deg);} 50% { transform: translate(6px,-10px) rotate(1.5deg);} }
@keyframes sr-drift-b { 0%,100% { transform: translate(0,0) rotate(0deg);} 50% { transform: translate(-8px,8px) rotate(-1.5deg);} }
@keyframes sr-drift-c { 0%,100% { transform: translate(0,0);} 50% { transform: translate(4px,10px);} }
@keyframes sr-pulse-dot { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }

.sr-animate-fade-in-slide { animation: sr-fade-in-slide 0.55s cubic-bezier(0.16,1,0.3,1) both; }
.sr-bubble-a { animation: sr-drift-a 7s ease-in-out infinite; }
.sr-bubble-b { animation: sr-drift-b 8.5s ease-in-out infinite; }
.sr-bubble-c { animation: sr-drift-c 6.5s ease-in-out infinite; }
.sr-pulse-dot { animation: sr-pulse-dot 2.4s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .sr-animate-fade-in-slide, .sr-bubble-a, .sr-bubble-b, .sr-bubble-c, .sr-pulse-dot { animation: none !important; }
}

.sr-input {
  width: 100%; height: 46px; border-radius: 12px;
  border: 1.5px solid #e6eaf1; background: #fff; color: #0f172a;
  font-size: 0.9375rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
/* Horizontal padding is handled by Tailwind (pl-10 / pr-3.5 / pr-11 / pr-8) on
   each input below — kept out of this rule so it can never win a specificity
   tie against those utility classes and swallow the icon spacing. */
.sr-input::placeholder { color: #94a3b8; }
.sr-input:hover { border-color: #cbd5e1; }
.sr-input:focus { outline: none; border-color: #125fe2; box-shadow: 0 0 0 4px rgba(18,95,226,0.16); }
.sr-input.sr-input-error { border-color: #dc2626; }
.sr-input.sr-input-error:focus { box-shadow: 0 0 0 4px rgba(220,38,38,0.1); }
.sr-input.sr-textarea { height: auto; padding-top: 12px; padding-bottom: 12px; resize: none; }

.sr-strength-bar { transition: width 0.35s cubic-bezier(0.16,1,0.3,1), background-color 0.35s ease; }

.sr-btn-primary {
  background: #125fe2; color: #fff; border-radius: 12px; height: 46px;
  font-weight: 600; font-size: 0.9375rem; letter-spacing: -0.01em;
  transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
}
.sr-btn-primary:hover:not(:disabled) { background: #0e4bc0; box-shadow: 0 8px 20px -6px rgba(18,95,226,0.45); }
.sr-btn-primary:active:not(:disabled) { background: #0b3d9e; transform: scale(0.98); }
.sr-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.sr-btn-secondary {
  background: #fff; color: #475569; border: 1.5px solid #e6eaf1; border-radius: 12px;
  height: 46px; font-weight: 600; font-size: 0.9375rem;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}
.sr-btn-secondary:hover { border-color: #cbd5e1; color: #0f172a; background: #f8fafc; }
`;