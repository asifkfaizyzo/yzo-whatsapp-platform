// tenant-web/src/pages/auth/Signup/comps/hooks/useSignupStepper.js (do not remove this comment)
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../../../../store/useAuthStore";

const EMAIL_STEPS = [
  {
    label: "Account",
    title: "Create your account",
    subtitle: "Enter your email and choose a secure password.",
  },
  {
    label: "Verify email",
    title: "Verify your email",
    subtitle: "We've sent a 4-digit code to your inbox.",
  },
  {
    label: "Profile",
    title: "Set up your profile",
    subtitle: "Tell us your name and pick a unique username.",
  },
  {
    label: "Company",
    title: "Tell us about your company",
    subtitle: "Please provide your company name and website.",
  },
  {
    label: "Workspace",
    title: "Finish setting up your workspace",
    subtitle: "Provide your business contact details and target use case.",
  },
];

const OAUTH_STEPS = [
  {
    label: "Account",
    title: "Create your account",
    subtitle: "Sign up with your preferred provider.",
  },
  {
    label: "Credentials",
    title: "Set your credentials",
    subtitle: "Choose a username and secure password.",
  },
  {
    label: "Company",
    title: "Tell us about your company",
    subtitle: "Please provide your company name and website.",
  },
  {
    label: "Workspace",
    title: "Finish setting up your workspace",
    subtitle: "Provide your business contact details and target use case.",
  },
];

// Both flows have exactly 2 pre-onboarding steps (account creation + verification/credentials)
const PRE_ONBOARDING_COUNT = 2;

export function useSignupStepper({ mockMode }) {
  const navigate = useNavigate();
  const { login, user, isAuthenticated, isHydrated } = useAuthStore();

  const [step, setStep] = useState(1);
  const [isOAuth, setIsOAuth] = useState(false);
  const [userData, setUserData] = useState({});

  const steps = isOAuth ? OAUTH_STEPS : EMAIL_STEPS;
  const totalSteps = steps.length;
  const currentMeta = steps[step - 1] || steps[0];

  // ── Pre-onboarding visibility flags ──
  const isPreOnboarding = step <= PRE_ONBOARDING_COUNT;
  const visibleStep = isPreOnboarding ? 0 : step - PRE_ONBOARDING_COUNT;
  const visibleTotalSteps = totalSteps - PRE_ONBOARDING_COUNT;

  // ── Mock mode: seed auth store so ProtectedRoute lets us through ──
  useEffect(() => {
    if (mockMode && !isAuthenticated) {
      const mockUser = {
        id: "mock-user-001",
        email: "jane@company.com",
        firstName: "Jane",
        lastName: "Doe",
        type: "TENANT",
        onboardingStep: 1,
        onboardingCompleted: false,
      };
      login(mockUser, "mock-access-token");
    }
  }, [mockMode, isAuthenticated, login]);

  // ── Real mode: resume onboarding from stored user (once, on hydration) ──
  const hasResumed = useRef(false);
  useEffect(() => {
    if (hasResumed.current) return;
    if (!mockMode && isHydrated && isAuthenticated && user) {
      hasResumed.current = true;
      if (user.onboardingCompleted) {
        navigate("/dashboard", { replace: true });
        return;
      }

      // Detect OAuth users from persisted authProvider
      const oauthProviders = ["GOOGLE", "FACEBOOK"];
      if (oauthProviders.includes(user.authProvider)) {
        setIsOAuth(true);
      }

      if (user.onboardingStep) {
        setStep(user.onboardingStep);
      }
    }
  }, [mockMode, isHydrated, isAuthenticated, user, navigate]);

  const nextStep = useCallback(
    (data = {}) => {
      setUserData((prev) => ({ ...prev, ...data }));
      if (data.resumeStep) {
        const target = Math.min(Math.max(data.resumeStep, 2), totalSteps);
        setStep(target);
      } else if (step < totalSteps) {
        setStep((s) => s + 1);
      } else {
        // ── Last step done ──
        if (mockMode) {
          const currentUser = useAuthStore.getState().user;
          useAuthStore
            .getState()
            .login(
              {
                ...currentUser,
                onboardingCompleted: true,
                onboardingStep: totalSteps,
              },
              useAuthStore.getState().accessToken,
            );
        }
        navigate("/select-plan");
      }
    },
    [step, totalSteps, navigate, mockMode],
  );

  const goBack = useCallback(() => {
    if (step <= 1) return;
    if (step === 2 && isOAuth) {
      setIsOAuth(false);
    }
    setStep((s) => s - 1);
  }, [step, isOAuth]);

  const handleOAuthStart = useCallback((providerData) => {
    setIsOAuth(true);
    setUserData((prev) => ({ ...prev, ...providerData }));
    setStep(2);
  }, []);

  return {
    step,
    totalSteps,
    currentMeta,
    isOAuth,
    isPreOnboarding,
    visibleStep,
    visibleTotalSteps,
    userData,
    nextStep,
    goBack,
    handleOAuthStart,
    setStep,
    setUserData,
  };
}