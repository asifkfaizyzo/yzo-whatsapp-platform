import { Navigate, Route, Routes } from "react-router-dom";
import Login from "../pages/auth/Login";
import RegisterPage from "../pages/auth/Register";
import ForgotPassword from "../pages/auth/ForgotPassword";
import MainLayout from "../layouts/MainLayout";
import LandingPage from "../pages/Home";
import NotFound from "../pages/NotFound";

import Dashboard from "../pages/dashboard/Dashboard";
import Inbox from "../pages/dashboard/Inbox";
import Broadcasts from "../pages/dashboard/Broadcasts";
import Templates from "../pages/dashboard/Templates";
import Contacts from "../pages/dashboard/Contacts";
import Team from "../pages/dashboard/Team";
import Reports from "../pages/dashboard/Reports";
import Settings from "../pages/dashboard/Settings";
import ResetPassword from "../pages/auth/ResetPassword";
import ProtectedRoute from "./ProtectedRoute";
import Billing from "../pages/dashboard/Billing";

// Landing Pages ✅
import Home from '../pages/Home'
import Features from '../pages/Features'
import Pricing from '../pages/Pricing'
import Testimonials from '../pages/Testimonials'
import Contact from '../pages/Contact'

// Support Pages ✅ ADD THESE
import HelpCenter from "../pages/HelpCenter";
import PrivacyPolicy from "../pages/PrivacyPolicy";
import Terms from "../pages/Terms";
// import Status from "../pages/Status";

import SelectPlan from "../pages/SelectPlan";
import Checkout from "../pages/checkout";
import Payment from "../pages/Payment";
import EnterpriseRequest from "../pages/EnterpriseRequest";

import Tickets from "../pages/dashboard/Tickets";
import Automation from "../pages/dashboard/Automation";
import FlowBuilder from "../pages/dashboard/FlowBuilder";

import ExpiredRouteGuard from "../components/guards/ExpiredRouteGuard";

import ScrollToTop from "../ScrollToTop";

function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>

        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/register"
          element={
            <ProtectedRoute>
              <RegisterPage />
            </ProtectedRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />



        {/* Landing Routes ✅ */}
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/testimonials" element={<Testimonials />} />
        <Route path="/contact" element={<Contact />} />


        {/* Support */}
        <Route path="/help" element={<HelpCenter />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<Terms />} />
        {/* <Route path="/status"        element={<Status />}       /> */}

        {/* ✅ Plan & Payment Routes */}
        <Route
          path="/select-plan"
          element={
            <ProtectedRoute>
              <SelectPlan />
            </ProtectedRoute>
          }
        />
        <Route
          path="/enterprise-request"
          element={
            <ProtectedRoute>
              <EnterpriseRequest />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment"
          element={
            <ProtectedRoute>
              <Payment />
            </ProtectedRoute>
          }
        />

        {/* Protected Tenant Dashboard Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <ExpiredRouteGuard>
                  <MainLayout />
                </ExpiredRouteGuard>
              </ProtectedRoute>
            }
          >
          <Route index element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="broadcasts" element={<Broadcasts />} />
          <Route path="templates" element={<Templates />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="team" element={<Team />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="billing" element={<Billing />} />
          <Route path="tickets" element={<Tickets />} />

          <Route path="automation" element={<Automation />} />
          <Route path="automation/builder/:flowId" element={<FlowBuilder />} />
        </Route>

        <Route
          path="/plans"
          element={
            <ProtectedRoute>
              <SelectPlan />
            </ProtectedRoute>
          }
        />
        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;
