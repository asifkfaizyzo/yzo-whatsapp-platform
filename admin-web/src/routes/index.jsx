import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import AdminLayout from "../layouts/AdminLayout";
import Dashboard from "../pages/dashboard/Dashboard";
import Tenants from "../pages/dashboard/Tenants";
import Reports from "../pages/dashboard/Reports";
import Team from "../pages/dashboard/Team";
import  SubscriptionPlans from "../pages/dashboard/SubscriptionPlans"
import Settings from "../pages/dashboard/Settings";
import NotFound from "../pages/NotFound";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";

// Landing Layout
import LandingLayout from "../pages/landing/LandingLayout";

// Landing Pages
import Home          from "../pages/landing/Home";
import Features      from "../pages/landing/Features";
import Pricing       from "../pages/landing/Pricing";
import Testimonials  from "../pages/landing/Testimonials";
import Contact       from "../pages/landing/Contact";
import HelpCenter    from "../pages/landing/HelpCenter";
import PrivacyPolicy from "../pages/landing/PrivacyPolicy";
import Terms         from "../pages/landing/Terms";


function App() {
  return (
    <Routes>

       {/* Landing Pages */}
      <Route element={<LandingLayout />}>
        <Route path="/"             element={<Home />}          />
        <Route path="/features"     element={<Features />}      />
        <Route path="/pricing"      element={<Pricing />}       />
        <Route path="/testimonials" element={<Testimonials />}  />
        <Route path="/contact"      element={<Contact />}       />
        <Route path="/help"         element={<HelpCenter />}    />
        <Route path="/privacy"      element={<PrivacyPolicy />} />
        <Route path="/terms"        element={<Terms />}         />
     
      </Route>
      

      {/* Public Routes */}
      {/* <Route path="/" element={<LandingPage />} /> */}
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth" element={<Navigate to="/login" replace />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected Admin Routes */}
      <Route element={<AdminLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="//dashboard/subscription-plans" element={<SubscriptionPlans />} />
        <Route path="/dashboard/tenants" element={<Tenants />} />
        <Route path="/dashboard/reports" element={<Reports />} />
        <Route path="/dashboard/team" element={<Team />} />
        <Route path="/dashboard/settings" element={<Settings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
