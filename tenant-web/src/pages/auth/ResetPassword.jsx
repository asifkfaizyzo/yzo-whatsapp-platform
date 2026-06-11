// tenant-web/src/pages/auth/ResetPassword.jsx
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordTenant } from "../../services/auth.service";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useFormHandler } from "../../hooks/useFormHandler";
import { resetPasswordSchema } from "../../validations/auth.validation";
import FormError from "../../components/FormError";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [roleType] = useState("TENANT");
  const [success, setSuccess] = useState(false);

  // 1. Setup Reset Password Hook with URL token
  const {
    register,
    onSubmit,
    generalError,
    formState: { errors, isSubmitting }
  } = useFormHandler({
    schema: resetPasswordSchema,
    defaultValues: {
      token: token || "", // Auto-populate token from URL
      newPassword: "",
      confirmPassword: ""
    },
    onSubmitService: (data) =>
      resetPasswordTenant(data.token, data.newPassword, data.confirmPassword, roleType),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    },
  });

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

        {/* URL missing token error banner */}
        {!token && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 font-medium">
            Reset token is missing from the link URL.
          </div>
        )}

        {/* Server errors */}
        {generalError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-655 font-medium">
            {generalError}
          </div>
        )}

        {success ? (
          <div className="text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-100">
              <CheckCircle2 size={24} />
            </div>
            <p className="text-sm font-medium text-slate-800">
              Password reset successfully! Redirecting you to login...
            </p>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={onSubmit}>
            {/* Hidden field containing the url token */}
            <input type="hidden" {...register("token")} />

            <div className="space-y-4">
              <div>
                <label className="label text-xs">New Password</label>
                <input
                  type="password"
                  className={`input ${errors.newPassword ? "border-red-500 focus:ring-red-200" : ""}`}
                  placeholder="••••••••"
                  {...register("newPassword")}
                  disabled={isSubmitting}
                />
                <FormError message={errors.newPassword?.message} />
              </div>

              <div>
                <label className="label text-xs">Confirm New Password</label>
                <input
                  type="password"
                  className={`input ${errors.confirmPassword ? "border-red-500 focus:ring-red-200" : ""}`}
                  placeholder="••••••••"
                  {...register("confirmPassword")}
                  disabled={isSubmitting}
                />
                <FormError message={errors.confirmPassword?.message} />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 font-bold"
            >
              {isSubmitting ? (
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
