// src/components/settings/GoogleSheetsLogo.jsx
import React from "react";

export default function GoogleSheetsLogo({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <path fill="#0F9D58" d="M29 4H11a3 3 0 0 0-3 3v34a3 3 0 0 0 3 3h26a3 3 0 0 0 3-3V15L29 4z" />
      <path fill="#0A7C43" d="M29 4v8a3 3 0 0 0 3 3h8L29 4z" />
      <path
        fill="#FFFFFF"
        d="M16 22h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H16a1 1 0 0 1-1-1V23a1 1 0 0 1 1-1zm1.5 2.5v2.5h5.25v-2.5H17.5zm7.75 0v2.5h5.25v-2.5h-5.25zM17.5 29.5V32h5.25v-2.5H17.5zm7.75 0V32h5.25v-2.5h-5.25zM17.5 34v-0.5h5.25V34H17.5zm7.75 0v-0.5h5.25V34h-5.25z"
      />
    </svg>
  );
}