import React from 'react';

export const SoshaLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg" 
    className={className}
  >
    <circle cx="50" cy="50" r="45" stroke="#FFB039" strokeWidth="6" />
    <path 
      d="M50 5C25.1472 5 5 25.1472 5 50C5 74.8528 25.1472 95 50 95C74.8528 95 95 74.8528 95 50" 
      stroke="#FFB039" 
      strokeWidth="2" 
      strokeLinecap="round"
      opacity="0.5"
    />
    <text 
      x="50" 
      y="58" 
      textAnchor="middle" 
      fill="#FFB039" 
      fontFamily="'Work Sans', sans-serif" 
      fontWeight="700" 
      fontSize="24"
      letterSpacing="-1"
    >
      sosha
    </text>
  </svg>
);
