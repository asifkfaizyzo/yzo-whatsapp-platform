import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/auth/Login";
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

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected Tenant Dashboard Routes */}
      <Route path="/dashboard" element={<MainLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="broadcasts" element={<Broadcasts />} />
        <Route path="templates" element={<Templates />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="team" element={<Team />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
