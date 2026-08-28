import React from "react";

export default function Logo({ iconSize = "h-8 sm:h-10" }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <img 
        src="/logo-full.svg" 
        alt="سوقك" 
        className={`${iconSize} w-auto object-contain`}
      />
    </div>
  );
}

