import React from "react";

export default function Logo({ showText = true, iconSize = "h-8 sm:h-10", textSize = "text-lg sm:text-xl" }) {
  // Using the new SVG logo as the official brand identity
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <img 
        src="/assets/logo/logo.svg" 
        alt="سوقك" 
        className={`${iconSize} w-auto object-contain`}
      />
      {/* 
        The new logo already contains the text "سوقك". 
        If showText is true, we rely on the logo's internal text.
        If we need additional text or versioning, we can add it here.
      */}
      {showText && (
        <div className="flex flex-col -gap-1">
          <span className="text-[9px] font-bold text-brand-500 uppercase tracking-tighter -mt-1 opacity-80">
            نسخة تجريبية
          </span>
        </div>
      )}
    </div>
  );
}

