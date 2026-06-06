import React from "react";
import LogoIcon from "./LogoIcon.jsx";

export default function Logo({ showText = true, iconSize = "w-10 h-10 sm:w-14 sm:h-14", textSize = "text-3xl sm:text-4xl" }) {
  return (
    <div className="flex items-center gap-4 sm:gap-6">
      <div className={`${iconSize} relative flex-shrink-0 drop-shadow-xl`}>
        <LogoIcon />
      </div>
      {showText && (
        <div className="flex flex-col items-center leading-none">
          <span className={`${textSize} font-black bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent whitespace-nowrap font-tajawal tracking-tight`}>
            سوقك
          </span>
          <div className="flex items-center gap-2 mt-2 w-full">
            <div className="h-[2px] flex-1 bg-blue-600 rounded-full"></div>
            <span className="text-[10px] sm:text-[12px] font-bold text-gray-800 whitespace-nowrap">
              حراج اليمن للإعلانات المبوبة
            </span>
            <div className="h-[2px] flex-1 bg-blue-600 rounded-full"></div>
          </div>
        </div>
      )}
    </div>
  );
}
