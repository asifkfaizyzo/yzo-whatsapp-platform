import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import api from "../lib/axios";

export default function EnterpriseRequest() {
  const navigate = useNavigate();
  const { user, checkAuth, logout } = useAuthStore();

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [estimatedUsers, setEstimatedUsers] = useState("");
  const [requirements, setRequirements] = useState("");
  const [timeline, setTimeline] = useState("");
  const [preferredContact, setPreferredContact] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pre-fill fields from user store
  useEffect(() => {
    if (user) {
      setCompanyName(user.tenantName || "");
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
      setContactName(fullName || user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!companyName || !contactName || !companySize || !timeline || !preferredContact) {
      setError("Please fill in all required fields.");
      setLoading(false);
      return;
    }

    try {
      const response = await api.post("/register/enterprise-lead", {
        companyName,
        contactName,
        email,
        phone: phone || undefined,
        role: role || undefined,
        companySize,
        estimatedUsers: estimatedUsers ? parseInt(estimatedUsers) : undefined,
        requirements: requirements || undefined,
        timeline,
        preferredContact,
      });

      if (response.data.success) {
        // Reload auth store to sync planStatus = 'enterprise_pending'
        await checkAuth();
      } else {
        setError(response.data.message || "Failed to submit request.");
      }
    } catch (err) {
      console.error("Enterprise request error:", err);
      setError(err.response?.data?.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChooseDifferentPlan = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post("/register/enterprise-lead/reset");
      if (response.data.success) {
        await checkAuth();
        navigate("/select-plan");
      }
    } catch (err) {
      console.error("Error resetting onboarding plan:", err);
      setError("Failed to change plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // If already pending, show the beautiful thank you pending screen
  if (user?.planStatus === "enterprise_pending") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/sudo_bg.png" alt="SudoReply Logo" className="w-12 h-12 object-contain" />
          </div>
          <button
            onClick={() => logout().then(() => navigate("/login"))}
            className="text-sm font-semibold text-gray-500 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 shadow-[0_24px_48px_-16px_rgba(15,23,42,0.08)] p-10 text-center flex flex-col items-center justify-center animate-fade-in">
            <div className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 relative mb-6">
              <span className="text-3xl">🚀</span>
              <div className="absolute inset-0 h-20 w-20 rounded-full border-2 border-blue-500/20 animate-pulse pointer-events-none" />
            </div>

            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Request Received!</h2>
            <p className="mt-4 text-slate-600 text-sm leading-relaxed">
              Thank you <strong>{contactName}</strong>! We have received your enterprise request. Our team will review your details and contact you at <strong>{email}</strong> within 24 hours.
            </p>

            <div className="mt-8 pt-6 border-t border-gray-100 w-full">
              <button
                onClick={handleChooseDifferentPlan}
                disabled={loading}
                className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline transition disabled:opacity-50"
              >
                {loading ? "Please wait..." : "Choose a different plan instead"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="py-6 text-center border-t border-gray-100 bg-white">
          <p className="text-xs text-gray-400">SudoReply | Enterprise Sales Team</p>
        </div>
      </div>
    );
  }

  // Otherwise, show the form
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/select-plan">
            <img src="/sudo_bg.png" alt="SudoReply Logo" className="w-12 h-12 object-contain" />
          </Link>
        </div>
        <span className="text-sm text-gray-500">
          Logged in as <strong>{email}</strong>
        </span>
      </div>

      <div className="flex-1 max-w-2xl w-full mx-auto px-6 py-12">
        <div className="bg-white rounded-3xl border border-gray-150 shadow-xl p-8 md:p-10">
          <div className="mb-8">
            <span className="text-blue-600 font-semibold text-xs uppercase tracking-wider">Enterprise Plan</span>
            <h1 className="text-2xl font-extrabold text-gray-900 mt-1">Configure Enterprise Request</h1>
            <p className="text-gray-500 text-sm mt-1.5">
              Fill in this request form and our dedicated enterprise team will review your workspace limits and get back to you.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Company Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company Name *</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Contact Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contact Name *</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Email Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Work Email (Read-only)</label>
                <input
                  type="email"
                  readOnly
                  disabled
                  value={email}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 text-gray-500 cursor-not-allowed focus:outline-none"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (234) 567-8900"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Role */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Role</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. CTO, Founder, Product Head"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Estimated Users */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Estimated Users</label>
                <input
                  type="number"
                  min="1"
                  value={estimatedUsers}
                  onChange={(e) => setEstimatedUsers(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            {/* Company Size */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Company Size *</label>
              <div className="grid grid-cols-4 gap-4">
                {["1-10", "11-50", "51-200", "200+"].map((size) => (
                  <label
                    key={size}
                    className={`border rounded-xl p-3 text-center cursor-pointer text-sm font-medium transition-all ${
                      companySize === size
                        ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="companySize"
                      value={size}
                      checked={companySize === size}
                      onChange={() => setCompanySize(size)}
                      className="sr-only"
                    />
                    {size}
                  </label>
                ))}
              </div>
            </div>

            {/* What features are you interested in? */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">What features are you interested in?</label>
              <textarea
                rows={3}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="Mention specific automations, API limits, or CRM integrations you require..."
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
              />
            </div>

            {/* Timeline */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Expected Project Timeline *</label>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: "urgent", label: "Urgent" },
                  { value: "1-3months", label: "1-3 Months" },
                  { value: "exploring", label: "Just Exploring" },
                ].map((item) => (
                  <label
                    key={item.value}
                    className={`border rounded-xl p-3 text-center cursor-pointer text-sm font-medium transition-all ${
                      timeline === item.value
                        ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="timeline"
                      value={item.value}
                      checked={timeline === item.value}
                      onChange={() => setTimeline(item.value)}
                      className="sr-only"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Preferred Contact Method */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Preferred Contact Method *</label>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: "email", label: "Email" },
                  { value: "phone", label: "Phone Call" },
                  { value: "video_call", label: "Video Call" },
                ].map((item) => (
                  <label
                    key={item.value}
                    className={`border rounded-xl p-3 text-center cursor-pointer text-sm font-medium transition-all ${
                      preferredContact === item.value
                        ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="preferredContact"
                      value={item.value}
                      checked={preferredContact === item.value}
                      onChange={() => setPreferredContact(item.value)}
                      className="sr-only"
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Submit & Reset buttons */}
            <div className="pt-4 flex flex-col sm:flex-row gap-4 items-center justify-between border-t border-gray-100">
              <Link
                to="/select-plan"
                className="text-sm font-semibold text-gray-500 hover:text-gray-800 transition"
              >
                ← Back to Plans
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
