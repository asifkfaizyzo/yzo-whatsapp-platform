// src/components/settings/RazorpayLogo.jsx
import React from "react";

/**
 * Official Razorpay Dual-Tone Blade Icon
 */
export default function RazorpayLogo({ className = "w-10 h-10" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Lower navy blade */}
      <path
        d="M14.26 10.098L3.389 17.166 1.564 24h9.008l3.688-13.902Z"
        fill="#0C2340"
      />
      {/* Upper electric blue blade */}
      <path
        d="M22.436 0l-11.91 7.773-1.174 4.276 6.625-4.297L11.65 24h4.391l6.395-24z"
        fill="#0C83FD"
      />
    </svg>
  );
}
