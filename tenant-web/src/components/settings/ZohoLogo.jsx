import React from "react";

export default function ZohoOutlineLogo({ className = "w-64 h-auto" }) {
  return (
    <svg
      viewBox="0 0 400 200"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
        {/* Red Square (Back left, slightly tilted) */}
        <rect 
          x="30" y="40" width="100" height="100" rx="20" 
          stroke="#E2231A" 
          transform="rotate(-10 80 90)" 
        />

        {/* Green Square (Overlaps Red, tilted right) */}
        <rect 
          x="110" y="30" width="100" height="100" rx="20" 
          stroke="#009A44" 
          transform="rotate(15 160 80)" 
        />

        {/* Blue Square (Overlaps Green, tilted left) */}
        <rect 
          x="190" y="40" width="100" height="100" rx="20" 
          stroke="#0072C6" 
          transform="rotate(-8 240 90)" 
        />

        {/* Yellow Square (Overlaps Blue, straight) */}
        <rect 
          x="270" y="40" width="100" height="100" rx="20" 
          stroke="#F8B100" 
        />
      </g>
 
      {/* Text positioned below the shapes */}
      <text 
        x="200" 
        y="180" 
        textAnchor="middle" 
        fill="#000000" 
        fontFamily="Arial, Helvetica, sans-serif" 
        fontWeight="bold" 
        fontSize="28" 
        letterSpacing="12"
      >
        ZOHO
      </text>
    </svg>
  );
}

// import React from "react";

// export default function Zoho3DLogo({ className = "w-64 h-auto" }) {
//   return (
//     <svg
//       viewBox="0 0 400 200"
//       className={className}
//       xmlns="http://www.w3.org/2000/svg"
//     >
//       <defs>
//         {/* Define the block shapes to reuse them easily */}
//         <g id="block-red">
//           <polygon points="10,60 40,30 90,30 60,60" fill="#FF5A5A" />
//           <polygon points="10,60 60,60 60,120 10,120" fill="#D32F2F" />
//           <polygon points="60,60 90,30 90,90 60,120" fill="#B71C1C" />
//         </g>
//         <g id="block-green" transform="rotate(-15 130 80)">
//           <polygon points="100,60 130,30 180,30 150,60" fill="#81C784" />
//           <polygon points="100,60 150,60 150,120 100,120" fill="#388E3C" />
//           <polygon points="150,60 180,30 180,90 150,120" fill="#1B5E20" />
//         </g>
//         <g id="block-blue">
//           <polygon points="190,60 220,30 270,30 240,60" fill="#64B5F6" />
//           <polygon points="190,60 240,60 240,120 190,120" fill="#1976D2" />
//           <polygon points="240,60 270,30 270,90 240,120" fill="#0D47A1" />
//         </g>
//         <g id="block-yellow">
//           <polygon points="280,60 310,30 360,30 330,60" fill="#FFD54F" />
//           <polygon points="280,60 330,60 330,120 280,120" fill="#FBC02D" />
//           <polygon points="330,60 360,30 360,90 330,120" fill="#F57F17" />
//         </g>
//       </defs>

//       {/* Render Blocks */}
//       <use href="#block-red" />
//       <use href="#block-green" />
//       <use href="#block-blue" />
//       <use href="#block-yellow" />

//       {/* Letters */}
//       <g fill="#FFFFFF" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="46" textAnchor="middle">
//         <text x="35" y="105">Z</text>
//         <text x="125" y="105">O</text>
//         <text x="215" y="105">H</text>
//         <text x="305" y="105">O</text>
//       </g>
//     </svg>
//   );
// }