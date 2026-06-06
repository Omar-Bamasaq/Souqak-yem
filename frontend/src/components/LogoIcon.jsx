import React from "react";

export default function LogoIcon({ className = "w-full h-full" }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="suqaq_grad_v4" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00ADFF"/>
          <stop offset="1" stopColor="#0047FF"/>
        </linearGradient>
      </defs>
      
      {/* Icon Background - Rounded Square */}
      <rect width="512" height="512" rx="140" fill="url(#suqaq_grad_v4)"/>
      
      {/* Shopping Bag Group */}
      <g transform="translate(106, 90)">
        {/* Handle - Clean semi-circle */}
        <path 
          d="M75 110 C75 30, 225 30, 225 110" 
          stroke="white" 
          strokeWidth="45" 
          strokeLinecap="round" 
          fill="none"
        />
        
        {/* Bag Body - Trapezoidal with very rounded bottom */}
        <path 
          d="M10 110 H290 
             C330 110, 350 140, 350 180 
             V250 
             C350 310, 280 355, 150 355 
             C20 355, -50 310, -50 250 
             V180 
             C-50 140, -30 110, 10 110 Z" 
          fill="white"
        />
        
        {/* The "س" (Seen) - Precisely matching the reference curves */}
        <g transform="translate(45, 185)">
          <path 
            d="M200 0 
               V45 
               C200 85, 155 85, 155 45 
               C155 85, 110 85, 110 45 
               V0" 
            stroke="#0066FF" 
            strokeWidth="42" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            fill="none"
          />
          <path 
            d="M110 45 
               V85 
               C110 135, 10 135, 10 85 
               C10 55, 30 40, 50 40" 
            stroke="#0066FF" 
            strokeWidth="42" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            fill="none"
          />
        </g>
      </g>
    </svg>
  );
}
