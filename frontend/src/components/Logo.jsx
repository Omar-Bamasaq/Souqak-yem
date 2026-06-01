import React from "react";

export default function Logo({ showText = true, iconSize = "w-8 h-8 sm:w-10 sm:h-10", textSize = "text-lg sm:text-xl" }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className={`${iconSize} bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
      {showText && (
        <div className="flex flex-col -gap-1">
          <span className={`${textSize} font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent whitespace-nowrap`}>
            سوقك
          </span>
          <span className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter -mt-1 opacity-80">
            نسخة تجريبية
          </span>
        </div>
      )}
    </div>
  );
}
