import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, Home } from "lucide-react";
import { siteConfig } from "../config/site";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f8fafc] px-4 py-12">
      {/* Decorative background blobs */}
<div className="absolute -left-20 -top-20 -z-10 h-72 w-72 rounded-full bg-[#EAF2FE]/50 blur-3xl" />
    <div className="absolute -right-20 -bottom-20 -z-10 h-80 w-80 rounded-full bg-[#CFE0FD]/50 blur-3xl" />

      {/* Main card */}
      <div className="card max-w-md w-full p-8 text-center shadow-xl backdrop-blur-sm bg-white/90 border-slate-200/50 transform transition-all duration-500 hover:scale-[1.01]">
        {/* Animated Icon */}
       <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#EAF2FE] text-[#125EF2] shadow-inner animate-pulse">
          <AlertCircle className="h-10 w-10" />
        </div>

        {/* 404 Text */}
<h1 className="bg-gradient-to-r from-[#125EF2] to-[#0F4FCC] bg-clip-text text-8xl font-black tracking-tight text-transparent">
          404
        </h1>

        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-800">
          Page Not Found
        </h2>

        <p className="mt-3 text-slate-500 text-sm leading-relaxed">
          The page you are looking for doesn't exist or has been moved. Check the URL or navigate back to safety.
        </p>

        {/* Buttons */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <Link
            to="/"
            className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
        </div>
      </div>

      {/* Footer / Branding */}
      <div className="mt-8 text-center text-xs text-slate-400">
        <p>© 2026 {siteConfig.brand || "WatiLite"}. All rights reserved.</p>
      </div>
    </div>
  );
}
