import React from "react";
import LogoIcon from "./LogoIcon.jsx";

export default function Logo({ showText = true, iconSize = "h-10 sm:h-14", textSize = "text-3xl sm:text-4xl" }) {
  if (showText) {
    return (
      <img 
        src="/assets/logo/logo-full.png" 
        alt="سوقك - حراج اليمن" 
        className={`${iconSize} w-auto object-contain drop-shadow-sm`}
      />
    );
  }

  return (
    <div className={`${iconSize} w-auto aspect-square relative flex-shrink-0 drop-shadow-xl`}>
      <LogoIcon />
    </div>
  );
}
