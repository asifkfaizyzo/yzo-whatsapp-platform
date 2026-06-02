import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { siteConfig } from "../../config/site";
import { registerSuperAdmin } from "../../lib/authApi";

const benefits = [
  {
    title: "Global styles",
    text: "Update colors and base styles from one place.",
  },
  {
    title: "Reusable UI",
    text: "Buttons, cards, and inputs are shared across pages.",
  },
  {
    title: "Clean auth flow",
    text: "Dedicated login and registration screens.",
  },
];

export default function RegisterPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    companyName: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(""); // clear error on typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!formData.name || !formData.email || !formData.password) {
      setError("Name, email, and password are required.");
      setLoading(false);
      return;
    }

    const result = await registerSuperAdmin(formData);

    if (result.success) {
      setSuccess("Account created successfully! Redirecting to dashboard...");
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen">
      <div className="container-shell grid min-h-screen items-center gap-8 py-8 lg:grid-cols-2">
        {/* ── Left Panel ── */}
        <div
          className="hidden min-h-[700px] rounded-[32px] p-8 text-white lg:flex lg:flex-col lg:justify-between"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), var(--primary-dark))",
          }}
        >
          <Link to="/" className="text-2xl font-semibold">
            {siteConfig.brand}
          </Link>

          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/70">
              Frontend UI
            </p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight">
              Create your Tenant account
            </h1>
            <p className="mt-4 max-w-md text-base text-white/80">
              A minimal registration UI that matches the landing page and stays easy to
              edit globally.
            </p>
          </div>

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

        {/* ── Right Panel (Form) ── */}
        <div className="mx-auto w-full max-w-md">
          <Link
            to="/"
            className="mb-6 inline-flex text-xl font-semibold lg:hidden"
          >
            {siteConfig.brand}
          </Link>

          <div className="card p-6 sm:p-8">
            {/* Heading */}
            <div>
              <h2 className="text-2xl font-semibold">Create account</h2>
              <p className="mt-2 text-sm text-[color:var(--muted)]">
                Start with a simple admin account.
              </p>
            </div>

            {/* ✅ Error Message */}
            {error && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* ✅ Success Message */}
            {success && (
              <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-600">
                {success}
              </div>
            )}

            {/* Form */}
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              {/* Full Name */}
              <div>
                <label className="label">Full name</label>
                <input
                  className="input"
                  type="text"
                  name="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  name="email"
                  placeholder="admin@company.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Company Name */}
              <div>
                <label className="label">Company name</label>
                <input
                  className="input"
                  type="text"
                  name="companyName"
                  placeholder="Your Company"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                />
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
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Create Account"}
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
        </div>
      </div>
    </div>
  );
}
