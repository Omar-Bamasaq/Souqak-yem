import React from "react";

export default function Logo({ 
  showText = true, 
  iconSize = "w-8 h-8 sm:w-10 sm:h-10", 
  textSize = "text-lg sm:text-xl", 
  showTagline = true,
  variant = "default" // "default", "white", "monochrome"
}) {
  const isWhite = variant === "white";
  const isMono = variant === "monochrome";

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {/* Enhanced Brand Icon */}
      <div className={`${iconSize} relative flex-shrink-0 group`}>
        <div className={`absolute inset-0 rounded-[28%] shadow-lg transition-transform duration-300 group-hover:scale-105 ${
          isWhite ? "bg-white" : isMono ? "bg-gray-900" : "bg-gradient-to-br from-[#0088FF] to-[#0044CC] shadow-blue-200/50"
        }`}>
          {!isWhite && !isMono && (
            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent rounded-[28%]"></div>
          )}
        </div>
        <svg className={`absolute inset-0 w-full h-full p-[18%] ${
          isWhite ? "text-[#0066FF]" : "text-white"
        }`} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Bag Body */}
          <path d="M140 220C140 190 160 175 190 175H322C352 175 372 190 372 220V370C372 405 345 425 310 425H202C167 425 140 405 140 370V220Z" stroke="currentColor" strokeWidth="36" strokeLinejoin="round"/>
          {/* Bag Handle */}
          <path d="M205 175V150C205 120 225 100 256 100C287 100 307 120 307 150V175" stroke="currentColor" strokeWidth="36" strokeLinecap="round"/>
          {/* The "س" (Seen) Character inside */}
          <path d="M210 320C210 320 225 355 256 355C287 355 302 320 302 320" stroke="currentColor" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M235 285C235 285 245 305 256 305C267 305 277 285 277 285" stroke="currentColor" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round"/>
          {/* Shadow detail for "س" */}
          <path d="M302 320L315 335" stroke="currentColor" strokeWidth="12" strokeLinecap="round" opacity="0.3"/>
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col justify-center -space-y-1">
          <div className="flex items-baseline gap-1">
            <span className={`${textSize} font-black tracking-tighter leading-none ${
              isWhite ? "text-white" : isMono ? "text-gray-900" : "text-[#0055FF] dark:text-blue-400"
            }`}>
              سوقك
            </span>
          </div>
          {showTagline && (
            <div className="flex items-center gap-1 opacity-90">
              <div className={`h-[1px] w-4 ${isWhite ? "bg-white/40" : isMono ? "bg-gray-300" : "bg-[#0055FF]/30"}`}></div>
              <span className={`text-[8px] sm:text-[9px] font-bold whitespace-nowrap tracking-tight ${
                isWhite ? "text-white/80" : isMono ? "text-gray-500" : "text-gray-500 dark:text-gray-400"
              }`}>
                حراج اليمن للإعلانات المبوبة
              </span>
              <div className={`h-[1px] w-4 ${isWhite ? "bg-white/40" : isMono ? "bg-gray-300" : "bg-[#0055FF]/30"}`}></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
