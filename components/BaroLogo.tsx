import React from 'react';
import { cn } from './ui';

export const BaroLogo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      viewBox="0 0 512 200"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full", className)}
      fill="none"
    >
      <defs>
        {/* Gradients for the Wave and Pulse */}
        <linearGradient id="baroWave" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4d7c0f" /> {/* Forest Green */}
          <stop offset="30%" stopColor="#84cc16" /> {/* Lime */}
          <stop offset="60%" stopColor="#facc15" /> {/* Yellow */}
          <stop offset="100%" stopColor="#eab308" /> {/* Gold */}
        </linearGradient>

        {/* Glow for the energy hub */}
        <filter id="energyGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 1. THE ENERGY SIGNATURE (Upper Section) */}
      <g transform="translate(40, 40)">
        {/* The Wave / Leaves Base */}
        <path
          d="M0 60 C30 50, 60 70, 100 60 C140 50, 180 80, 220 60"
          stroke="url(#baroWave)"
          strokeWidth="6"
          strokeLinecap="round"
          filter="url(#energyGlow)"
        />

        {/* Leaf Accents */}
        <path d="M20 58 Q35 40, 50 55" stroke="#4d7c0f" strokeWidth="3" strokeLinecap="round" />
        <path d="M60 62 Q75 45, 90 60" stroke="#84cc16" strokeWidth="3" strokeLinecap="round" />
        <path d="M100 65 Q115 48, 130 63" stroke="#a3e635" strokeWidth="3" strokeLinecap="round" />

        {/* The Pulse Spike (The central "Heat") */}
        <path
          d="M220 60 L240 100 L260 20 L285 140 L310 60 L350 60"
          stroke="#facc15"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#energyGlow)"
        />

        {/* Tail Signature (Dots) */}
        <g stroke="#eab308" strokeWidth="2" strokeLinecap="round">
          <line x1="360" y1="60" x2="410" y2="60" opacity="0.8" />
          <circle cx="420" cy="60" r="2" fill="#eab308" />
          <circle cx="435" cy="60" r="1.5" fill="#eab308" opacity="0.6" />
        </g>

        {/* Energy Debris */}
        <circle cx="210" cy="40" r="2" fill="#a3e635" opacity="0.8" />
        <circle cx="230" cy="30" r="2.5" fill="#facc15" />
      </g>

      {/* 2. BARO OS TYPOGRAPHY (Lower Section) */}
      <g transform="translate(110, 160)">
        <text
          x="0"
          y="0"
          className="italic uppercase font-black"
          style={{
            fontSize: '56px',
            fontFamily: 'Inter, system-ui, sans-serif',
            letterSpacing: '-0.04em'
          }}
        >
          <tspan fill="#84cc16">BARO</tspan>
          <tspan fill="currentColor" dx="20" opacity="1" className="text-foreground">OS</tspan>
        </text>

        {/* Speed Slash on the B */}
        <path d="M-15 -35 L10 -35" stroke="#84cc16" strokeWidth="2" />
      </g>
    </svg>
  );
};