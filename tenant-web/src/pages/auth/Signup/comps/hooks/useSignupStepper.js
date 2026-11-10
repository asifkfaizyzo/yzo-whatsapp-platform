// tenant-web/src/pages/auth/Signup/comps/hooks/useSignupStepper.js
import { useState, useEffect, useCallback } from "react";
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
    subtitle: "We've sent a 6-digit code to your inbox.",
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

export function useSignupStepper({ mockMode }) {
  const navigate = useNavigate();
  const { login, user, isAuthenticated, isHydrated } = useAuthStore();

  const [step, setStep] = useState(1);
  const [isOAuth, setIsOAuth] = useState(false);
  const [userData, setUserData] = useState({});

  const steps = isOAuth ? OAUTH_STEPS : EMAIL_STEPS;
  const totalSteps = steps.length;
  const currentMeta = steps[step - 1] || steps[0];

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

  // ── Real mode: resume onboarding from stored user ──
  useEffect(() => {
    if (!mockMode && isHydrated && isAuthenticated && user) {
      if (user.onboardingCompleted) {
        navigate("/dashboard", { replace: true });
      } else if (user.onboardingStep) {
        setStep(user.onboardingStep);
      }
    }
  }, [mockMode, isHydrated, isAuthenticated, user, navigate]);

  const nextStep = useCallback(
    (data = {}) => {
      setUserData((prev) => ({ ...prev, ...data }));
      if (step < totalSteps) {
        setStep((s) => s + 1);
      } else {
        // ── Last step done ──
        if (mockMode) {
          // Mark mock user as onboarded so ProtectedRoute
          // doesn't redirect /select-plan back to /signup
          const currentUser = useAuthStore.getState().user;
          useAuthStore.getState().login(
            { ...currentUser, onboardingCompleted: true, onboardingStep: totalSteps },
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
    userData,
    nextStep,
    goBack,
    handleOAuthStart,
    setStep,
    setUserData,
  };
}