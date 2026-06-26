import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { siteConfig } from "../../config/site";
// import { registerSuperAdmin } from "../../lib/authApi";
import { registerTenant } from "../../services/auth.service";
import { useFormHandler } from '../../hooks/useFormHandler';
import { registerTenantSchema } from '../../validations/tenant.validation';
import FormError from '../../components/FormError';

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

export default function RegisterPage() {
  const navigate = useNavigate();

  const {
    register,
    onSubmit,
    generalError,
    formState: { errors, isSubmitting },
  } = useFormHandler({
    schema: registerTenantSchema,
    defaultValues: {
      tenantName: "",
      email: "",
      password: "",
      phone: "",
      address: "",
    },
    onSubmitService: registerTenant,
    onSuccess: () => navigate("/dashboard"),
  });

  return (
    <div className="min-h-screen">
      <div className="container-shell grid min-h-screen items-center gap-8 py-8 lg:grid-cols-2">
        {/* ── Left Panel (Desktop only) ── */}
        <div
          className="hidden min-h-[700px] rounded-[32px] p-8 text-white lg:flex lg:flex-col lg:justify-between"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), var(--primary-dark))",
          }}
        >
          {/* Top: Logo */}
          <div>
            <Link to="/" className="inline-flex items-center">
              <img
                src="/sudo2.png"
                alt="SudoReply Logo"
                className="w-20 h-20 object-contain"
              />
            </Link>
          </div>

          {/* Middle: Headline */}
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/70">
              Welcome to SudoReply
            </p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight">
              Create your Tenant account
            </h1>
            <p className="mt-4 max-w-md text-base text-white/80">
              Get started with SudoReply to broadcast WhatsApp messages at scale, manage contacts, and grow customer engagement.
            </p>
          </div>

          {/* Bottom: Benefits */}
          <div className="space-y-4">
            {benefits.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm"
              >
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-white/75">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right Panel (Form & Mobile Branding) ── */}
        <div className="mx-auto w-full max-w-md sm:max-w-2xl lg:max-w-md">
          {/* Mobile/Tablet Header */}
          <div className="flex flex-col items-center text-center lg:hidden mb-8">
            <Link to="/" className="inline-flex items-center mb-4">
              <img
                src="/sudo2.png"
                alt="SudoReply Logo"
                className="w-16 h-16 object-contain"
              />
            </Link>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Welcome to SudoReply
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-slate-900">
              Create your Tenant account
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted)] max-w-md">
              Get started with SudoReply to broadcast WhatsApp messages at scale, manage contacts, and grow customer engagement.
            </p>
          </div>

          {/* Form Card */}
          <div className="card p-6 sm:p-8 max-w-md mx-auto w-full">
            {/* Heading */}
            <div className="hidden lg:block">
              <h2 className="text-2xl font-semibold">Create account</h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Start with a simple admin account.
              </p>
            </div>

            {/* ✅ Error Message */}
            {generalError && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {generalError}
              </div>
            )}

            {/* Form */}
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
              {/* Tenant / Company Name */}
              <div>
                <label className="label">Tenant / Company name</label>
                <input
                  className={`input ${errors.tenantName ? "border-red-500 focus:ring-red-200" : ""}`}
                  type="text"
                  placeholder="Your Company or Name"
                  {...register("tenantName")}
                />
                <FormError message={errors.tenantName?.message} />
              </div>

              {/* Email */}
              <div>
                <label className="label">Email</label>
                <input
                  className={`input ${errors.email ? "border-red-500 focus:ring-red-200" : ""}`}
                  type="email"
                  name="email"
                  placeholder="admin@company.com"
                  {...register("email")}
                />
                <FormError message={errors.email?.message} />
              </div>

              {/* Password */}
              <div>
                <label className="label">Password</label>
                <input
                  className={`input ${errors.password ? "border-red-500 focus:ring-red-200" : ""}`}
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  {...register("password")}
                />
                <FormError message={errors.password?.message} />
              </div>

              {/* Phone Number */}
              <div>
                <label className="label">Phone number</label>
                <input
                  className={`input ${errors.phone ? "border-red-500 focus:ring-red-200" : ""}`}
                  type="tel"
                  name="phone"
                  placeholder="+1 (555) 000-0000"
                  {...register("phone")}
                />
                <FormError message={errors.phone?.message} />
              </div>

              {/* Address */}
              <div>
                <label className="label">Address</label>
                <textarea
                  className={`input min-h-[80px] py-2 resize-none ${errors.address ? "border-red-500 focus:ring-red-200" : ""}`}
                  name="address"
                  placeholder="123 Main St, City, Country"
                  {...register("address")}
                />
                <FormError message={errors.address?.message} />
              </div>

              {/* Remember me */}
              <div className="flex items-center justify-between text-sm">
                <label className="inline-flex items-center gap-2 text-[color:var(--muted)]">
                  <input type="checkbox" className="h-4 w-4 rounded" />
                  Remember me
                </label>
              </div>

              {/* ✅ Submit Button with Loading */}
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating Account..." : "Create Account"}
              </button>
            </form>
            {/* Switch Mode */}
            <p className="mt-6 text-center text-sm text-[color:var(--muted)]">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-[color:var(--primary-dark)] hover:underline"
              >
                Login
              </Link>
            </p>
          </div>

          {/* Mobile/Tablet Benefits */}
          <div className="mt-8 lg:hidden max-w-md sm:max-w-2xl mx-auto w-full">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] text-center mb-4">
              Platform Benefits
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {benefits.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                >
                  <p className="font-semibold text-slate-800 text-sm">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
