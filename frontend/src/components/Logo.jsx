import React from "react";
import LogoIcon from "./LogoIcon.jsx";

export default function Logo({ showText = true, iconSize = "w-8 h-8 sm:w-10 sm:h-10", textSize = "text-lg sm:text-xl" }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className={`${iconSize} relative flex-shrink-0`}>
        <LogoIcon />
      </div>
      {showText && (
        <div className="flex flex-col -gap-1 leading-tight">
          <span className={`${textSize} font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent whitespace-nowrap font-tajawal`}>
            سوقك
          </span>
          <span className="text-[8px] sm:text-[9px] font-medium text-gray-500 whitespace-nowrap">
            حراج اليمن للإعلانات المبوبة
          </span>
        </div>
      )}
    </div>
  );
}
