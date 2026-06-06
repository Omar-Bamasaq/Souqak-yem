import React from "react";

export default function LogoIcon({ className = "w-full h-full" }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="suqaq_grad_v3" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0085FF"/>
          <stop offset="1" stopColor="#0047FF"/>
        </linearGradient>
      </defs>
      
      {/* Icon Background */}
      <rect width="512" height="512" rx="128" fill="url(#suqaq_grad_v3)"/>
      
      {/* The Bag and "س" Integration */}
      <g transform="translate(86, 80)">
        {/* Bag Handle */}
        <path d="M120 120V100C120 55.8172 155.817 20 200 20C244.183 20 280 55.8172 280 100V120" stroke="white" strokeWidth="45" strokeLinecap="round"/>
        
        {/* Bag Body (Trapezoid with very rounded bottom) */}
        <path d="M40 120H360C382.091 120 400 137.909 400 160V280C400 330 360 365 310 365H90C40 365 0 330 0 280V160C0 137.909 17.9086 120 40 120Z" fill="white"/>
        
        {/* The stylized "س" (Seen) shape - Cutout style */}
        <path d="M110 205V240C110 265 130 275 145 260C160 275 180 265 180 240V205" stroke="#0066FF" strokeWidth="35" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M180 240V280C180 320 110 320 110 280" stroke="#0066FF" strokeWidth="35" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M220 205V280C220 315 250 315 280 290" stroke="#0066FF" strokeWidth="35" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </g>
    </svg>
  );
}
