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
      {/* New Brand Icon */}
      <div className={`${iconSize} relative flex-shrink-0 group`}>
        <div className={`absolute inset-0 rounded-xl sm:rounded-2xl shadow-lg transition-transform duration-300 group-hover:scale-105 ${
          isWhite ? "bg-white" : isMono ? "bg-gray-900" : "bg-blue-600 shadow-blue-200/50"
        }`}>
          {!isWhite && !isMono && <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>}
        </div>
        <svg className={`absolute inset-0 w-full h-full p-[20%] ${
          isWhite ? "text-blue-600" : "text-white"
        }`} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M156 220C156 200 172 184 192 184H320C340 184 356 200 356 220V380C356 400 340 416 320 416H192C172 416 156 400 156 380V220Z" stroke="currentColor" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M200 184V152C200 121.072 225.072 96 256 96C286.928 96 312 121.072 312 152V184" stroke="currentColor" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M256 340C235 340 220 310 220 310" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M256 275C248 275 240 260 240 260" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M256 340C277 340 292 310 292 310" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M256 275C264 275 272 260 272 260" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col justify-center -space-y-1">
          <div className="flex items-baseline gap-1">
            <span className={`${textSize} font-black tracking-tight leading-none ${
              isWhite ? "text-white" : isMono ? "text-gray-900" : "text-blue-700 dark:text-blue-500"
            }`}>
              سوقك
            </span>
          </div>
          {showTagline && (
            <div className="flex items-center gap-1 opacity-90">
              <div className={`h-[1px] w-3 ${isWhite ? "bg-white/40" : isMono ? "bg-gray-300" : "bg-blue-400 dark:bg-blue-500/50"}`}></div>
              <span className={`text-[8px] sm:text-[9px] font-bold whitespace-nowrap ${
                isWhite ? "text-white/80" : isMono ? "text-gray-500" : "text-blue-600/80 dark:text-blue-400/80"
              }`}>
                حراج اليمن للإعلانات المبوبة
              </span>
              <div className={`h-[1px] w-3 ${isWhite ? "bg-white/40" : isMono ? "bg-gray-300" : "bg-blue-400 dark:bg-blue-500/50"}`}></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
