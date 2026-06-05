import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordTenant } from "../../services/auth.service";
import { CheckCircle2, RefreshCw } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [roleType, setRoleType] = useState("TENANT"); // User resets need to toggle this (TENANT or USER)
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

    const result = await resetPasswordTenant(token, password, confirmPassword, roleType);
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
            Please enter your new credentials below.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-650 font-medium">
            {error}
          </div>
        )}

        {success ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-100">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-sm font-medium text-slate-800">
              Password reset successfully! Redirecting you to login...
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>

            {/* Role Switcher
            <div>
              <label className="label text-xs">Role Type</label>
              <select
                className="input text-xs"
                value={roleType}
                onChange={(e) => setRoleType(e.target.value)}
              >
                <option value="TENANT">Tenant Admin</option>
                <option value="USER">Agent / Team Member</option>
              </select>
            </div> */}

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
