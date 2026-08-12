import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import AdminLayout from "../layouts/AdminLayout";
import Dashboard from "../pages/dashboard/Dashboard";
import Tenants from "../pages/dashboard/Tenants";
import Reports from "../pages/dashboard/Reports";
import  SubscriptionPlans from "../pages/dashboard/SubscriptionPlans"
import Settings from "../pages/dashboard/Settings";
import NotFound from "../pages/NotFound";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";
import Revenue from "../pages/dashboard/Revenue";
import Tickets from "../pages/dashboard/Tickets";

// Enquiries & Enterprise Leads
import Enquiries from "../pages/dashboard/Enquiries";
import EnquiryDetail from "../pages/dashboard/EnquiryDetail";
import EnterpriseLeads from "../pages/dashboard/EnterpriseLeads";
import EnterpriseLeadDetail from "../pages/dashboard/EnterpriseLeadDetail";

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

import SubscriptionManagement from "../pages/admin/SubscriptionManagement";

import AuditLogs from "../pages/dashboard/AuditLogs";


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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth" element={<Navigate to="/login" replace />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected Admin Routes */}
      <Route element={<AdminLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/subscription-plans" element={<SubscriptionPlans />} />
        <Route path="/dashboard/tenants" element={<Tenants />} />
        <Route path="/dashboard/reports" element={<Reports />} />
        <Route path="/dashboard/settings" element={<Settings />} />
        <Route path="/dashboard/tickets" element={<Tickets />} />
        <Route path="/dashboard/revenue" element={<Revenue />} />
        <Route path="/dashboard/audit-logs" element={<AuditLogs />} />
        
        {/* Enquiry Routes */}
        <Route path="/dashboard/enquiries" element={<Enquiries />} />
        <Route path="/dashboard/enquiries/:id" element={<EnquiryDetail />} />

        {/* Enterprise Lead Routes */}
        <Route path="/dashboard/enterprise-leads" element={<EnterpriseLeads />} />
        <Route path="/dashboard/enterprise-leads/:id" element={<EnterpriseLeadDetail />} />

        <Route path="/dashboard/subscriptions" element={<SubscriptionManagement />} />

   
      </Route>

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
