import React from "react";

export default function LogoIcon({ className = "w-full h-full" }) {
  return (
    <img 
      src="/assets/logo/app-icon.png" 
      alt="سوقك" 
      className={`${className} object-contain`}
      onError={(e) => {
        // Fallback to SVG if PNG is missing
        e.target.onerror = null;
        e.target.src = "/favicon.svg";
      }}
    />
  );
}
