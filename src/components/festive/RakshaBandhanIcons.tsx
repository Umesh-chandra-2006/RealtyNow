import React from 'react';

/**
 * Intricate Rakhi Motif Icon / Decorative Ring
 */
export function RakhiMandala({ className = 'w-64 h-64' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id="rakhiGoldGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#D8232A" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#D8232A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="goldRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="50%" stopColor="#D8232A" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id="threadGrad" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#D8232A" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D8232A" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Outer ambient glow */}
      <circle cx="100" cy="100" r="90" fill="url(#rakhiGoldGlow)" />

      {/* Decorative Outer Rings with Dashed Petals */}
      <circle
        cx="100"
        cy="100"
        r="75"
        stroke="#F59E0B"
        strokeWidth="1"
        strokeOpacity="0.35"
        strokeDasharray="4 6"
      />
      <circle
        cx="100"
        cy="100"
        r="68"
        stroke="#D8232A"
        strokeWidth="1.2"
        strokeOpacity="0.4"
      />

      {/* 12 Petal Lotus Mandala Geometric Ring */}
      <g stroke="url(#goldRedGrad)" strokeWidth="1.5" fill="none" opacity="0.85">
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 100 100)`}>
            <path
              d="M100 42 C94 52 94 62 100 70 C106 62 106 52 100 42 Z"
              fill="#D8232A"
              fillOpacity="0.15"
            />
            <circle cx="100" cy="40" r="2" fill="#FBBF24" />
          </g>
        ))}
      </g>

      {/* Mid Ring */}
      <circle cx="100" cy="100" r="46" fill="#FFFDF8" stroke="#F59E0B" strokeWidth="2" />
      <circle cx="100" cy="100" r="40" stroke="#D8232A" strokeWidth="1.5" strokeDasharray="3 3" />

      {/* 8-Point Star Diamond Pattern */}
      <g stroke="#D8232A" strokeWidth="1.2" fill="none" opacity="0.9">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <g key={angle} transform={`rotate(${angle} 100 100)`}>
            <polygon points="100,68 104,78 100,88 96,78" fill="#FBBF24" fillOpacity="0.3" />
          </g>
        ))}
      </g>

      {/* Inner Central Jewel / Rudraksha / Kundan Center */}
      <circle cx="100" cy="100" r="22" fill="#D8232A" />
      <circle cx="100" cy="100" r="16" fill="url(#goldRedGrad)" />
      <circle cx="100" cy="100" r="8" fill="#FFF9E6" />
      <circle cx="100" cy="100" r="4" fill="#D8232A" />

      {/* Subtle Thread Tendrils */}
      <path
        d="M20 100 Q60 95 78 100"
        stroke="url(#threadGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M122 100 Q140 105 180 100"
        stroke="url(#threadGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Rakhi Thread Divider / Accent Ribbon
 */
export function RakhiThreadAccent({ className = 'w-full h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="festiveThread" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#D8232A" stopOpacity="0" />
          <stop offset="20%" stopColor="#D8232A" stopOpacity="0.4" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="50%" stopColor="#D8232A" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="80%" stopColor="#D8232A" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#D8232A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 10 Q100 4 200 10 T400 10"
        stroke="url(#festiveThread)"
        strokeWidth="2"
        fill="none"
      />
      <circle cx="200" cy="10" r="4" fill="#D8232A" stroke="#FBBF24" strokeWidth="1.5" />
      <circle cx="185" cy="10" r="2" fill="#FBBF24" />
      <circle cx="215" cy="10" r="2" fill="#FBBF24" />
    </svg>
  );
}

/**
 * Architectural City Silhouette Subtle Lineart
 */
export function CitySilhouetteBackdrop({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      preserveAspectRatio="xMidYMax slice"
    >
      <g opacity="0.12" stroke="#D8232A" strokeWidth="1.2">
        {/* Modern Skyline Outlines */}
        <path d="M20 280 L20 180 L50 180 L50 280" />
        <path d="M50 280 L50 140 L90 140 L90 280" />
        <path d="M90 280 L90 200 L120 200 L120 280" />
        <path d="M120 280 L120 110 L150 70 L180 110 L180 280" />
        <path d="M180 280 L180 150 L220 150 L220 280" />
        <path d="M220 280 L220 90 L260 90 L260 280" />
        <path d="M260 280 L260 170 L300 170 L300 280" />
        <path d="M300 280 L300 120 L330 120 L350 80 L370 120 L370 280" />
        <path d="M370 280 L370 160 L410 160 L410 280" />
        <path d="M410 280 L410 100 L450 100 L450 280" />
        <path d="M450 280 L450 180 L490 180 L490 280" />
        <path d="M490 280 L490 130 L530 130 L530 280" />
        <path d="M530 280 L530 210 L580 210 L580 280" />

        {/* Villa Gable / Rooftop Details */}
        <polygon points="135,160 165,130 195,160" fill="#D8232A" fillOpacity="0.05" />
        <polygon points="340,170 370,140 400,170" fill="#F59E0B" fillOpacity="0.05" />

        {/* Architectural Grid Lines */}
        <line x1="0" y1="280" x2="600" y2="280" strokeWidth="2" />
      </g>
    </svg>
  );
}

/**
 * Tiny Rakhi Emblem for Header & Badges
 */
export function TinyRakhiIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="12" cy="12" r="9" stroke="#F59E0B" strokeWidth="1.2" strokeDasharray="2 2" />
      <circle cx="12" cy="12" r="6" fill="#D8232A" />
      <circle cx="12" cy="12" r="3" fill="#FBBF24" />
      <circle cx="12" cy="12" r="1.2" fill="#FFFFFF" />
      <path d="M3 12 Q7 10 9 12" stroke="#D8232A" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15 12 Q17 14 21 12" stroke="#D8232A" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
