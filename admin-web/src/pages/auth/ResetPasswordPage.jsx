import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { resetPasswordSuperAdmin } from "../../lib/authApi";
import { siteConfig } from "../../config/site";
import { ArrowLeft, CheckCircle2, Lock, RefreshCw } from "lucide-react";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!token) {
      setError("Reset token is missing from the link URL.");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    const result = await resetPasswordSuperAdmin(token, password, confirmPassword);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-md w-full space-y-8 card p-8 bg-white rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-center text-3xl font-bold text-slate-800">
            Reset Password
          </h2>
          <p className="mt-2 text-center text-sm text-[color:var(--muted)]">
            Please enter your new password below.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-650 font-medium">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-605 border border-emerald-100">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-sm font-medium text-slate-800">
              Password reset successfully! Redirecting you to login...
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="label text-xs">New Password</label>
                <input
                  type="password"
                  required
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">Confirm New Password</label>
                <input
                  type="password"
                  required
                  className="input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 font-bold"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                "Save Password"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
