// import React from 'react';
// import logoImg from '../../assets/wooCommerce.webp'; // 👈 Adjust relative path to assets

// export default function WooCommerceLogo({ className = "w-8 h-8" }) {
//   return (
//     <img
//       src={logoImg}
//       alt="WooCommerce Logo"
//       className={`${className} object-contain`}
//     />
//   );
// }


import React from "react";

export default function WooCommerceLogo({ className = "w-10 h-10" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Official WooCommerce Brand Purple Box */}
      <rect width="100" height="100" rx="22" fill="#96588A" />

      {/* Crisp White "Woo" Emblem */}
      <path
        fill="#FFFFFF"
        d="M13 36h8.5l6.2 24 6.2-24h7.2l6.2 24 6.2-24h8.5l-9.8 36h-8.8L38 48l-5.8 24h-8.8L13 36zm46.5 18c0-10 6.8-18 15.5-18s15.5 8 15.5 18-6.8 18-15.5 18-15.5-8-15.5-18zm22.5 0c0-6-3-11-7-11s-7 5-7 11 3 11 7 11 7-5 7-11zm-8-18c8.7 0 15.5 8 15.5 18s-6.8 18-15.5 18c-2.2 0-4.3-.5-6.2-1.3 3.8-3.8 6.2-9.2 6.2-16.7s-2.4-12.9-6.2-16.7c1.9-.8 4-1.3 6.2-1.3z"
      />
    </svg>
  );
}