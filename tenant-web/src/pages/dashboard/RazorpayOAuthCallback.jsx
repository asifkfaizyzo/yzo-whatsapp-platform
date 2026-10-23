import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import RazorpayLogo from "../../components/settings/RazorpayLogo";

export default function RazorpayOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (error) {
      const msg = errorDescription || error || "Authorization was denied";
      setErrorMessage(msg);
      // Auto-redirect back to integrations with error
      setTimeout(() => {
        navigate(`/dashboard/integrations?app=razorpay&error=${encodeURIComponent(msg)}`, {
          replace: true,
        });
      }, 3000);
      return;
    }

    if (code && state) {
      // Browser landed on frontend port (e.g. 5174)
      // Forward the authorization code and state to backend port 5000 to complete token exchange
      const backendUrl =
        import.meta.env.VITE_BACKEND_URL ||
        import.meta.env.VITE_API_URL?.replace(/\/api2?$/, "") ||
        "http://localhost:5000";

      const forwardUrl = `${backendUrl}/api/auth/razorpay/callback${window.location.search}`;
      console.log("🔀 [RazorpayOAuthCallback] Forwarding code to backend:", forwardUrl);
      window.location.href = forwardUrl;
      return;
    }

    // If neither code nor error is present, navigate back to Integrations
    navigate("/dashboard/integrations?app=razorpay", { replace: true });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] px-4 py-12">
      <div className="max-w-md w-full rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-xl backdrop-blur-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-[#125EF2] shadow-inner">
          {errorMessage ? (
            <AlertCircle className="h-8 w-8 text-rose-500" />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-[#125EF2]" />
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mb-2">
          <RazorpayLogo className="w-5 h-5" />
          <h2 className="text-xl font-bold tracking-tight text-slate-800">
            {errorMessage ? "Authorization Denied" : "Connecting Razorpay..."}
          </h2>
        </div>

        <p className="text-slate-500 text-xs leading-relaxed max-w-sm mx-auto">
          {errorMessage ? (
            <span className="text-rose-600 font-medium">{errorMessage}</span>
          ) : (
            "Exchanging authorization tokens and securing your merchant connection. You will be redirected back in a moment."
          )}
        </p>

        {errorMessage && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => navigate("/dashboard/integrations?app=razorpay", { replace: true })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              <ArrowLeft size={14} />
              <span>Return to Integrations</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
