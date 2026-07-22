import React from "react";

/**
 * Milo — the Cognify mascot face.
 * Renders as an SVG so it scales cleanly and is ready for cosmetic customization.
 * `config` (from MascotProfile.mascot_config) controls appearance; defaults to the classic look.
 * Future: placed_items render as overlaid SVG fragments at their x/y/scale/rotation.
 */
export default function MascotFace({ config = {}, size = 64, animate = false }) {
  const baseColor = config.base_color || "#3b82f6";
  const eyeStyle = config.eye_style || "round";
  const mouthStyle = config.mouth_style || "smile";

  // Eye variants
  const renderEyes = () => {
    const lx = 37, rx = 63, ey = 50;
    if (eyeStyle === "happy") {
      return (
        <>
          <path d={`M ${lx - 6} ${ey} Q ${lx} ${ey - 6} ${lx + 6} ${ey}`} stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d={`M ${rx - 6} ${ey} Q ${rx} ${ey - 6} ${rx + 6} ${ey}`} stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      );
    }
    if (eyeStyle === "wink") {
      return (
        <>
          <circle cx={lx} cy={ey} r="6.5" fill="white" />
          <circle cx={lx} cy={ey} r="3" fill="#1e293b" />
          <circle cx={lx + 1} cy={ey - 1} r="1" fill="white" />
          <path d={`M ${rx - 6} ${ey} Q ${rx} ${ey + 5} ${rx + 6} ${ey}`} stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      );
    }
    // round (default)
    return (
      <>
        <circle cx={lx} cy={ey} r="7" fill="white" />
        <circle cx={rx} cy={ey} r="7" fill="white" />
        <circle cx={lx} cy={ey} r="3.5" fill="#1e293b" />
        <circle cx={rx} cy={ey} r="3.5" fill="#1e293b" />
        <circle cx={lx + 1} cy={ey - 1.5} r="1.3" fill="white" />
        <circle cx={rx + 1} cy={ey - 1.5} r="1.3" fill="white" />
      </>
    );
  };

  // Mouth variants
  const renderMouth = () => {
    if (mouthStyle === "grin") {
      return <path d="M 36 70 Q 50 84 64 70 Q 50 74 36 70 Z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />;
    }
    if (mouthStyle === "ooh") {
      return <ellipse cx="50" cy="73" rx="5" ry="6" fill="#1e293b" />;
    }
    // smile (default)
    return <path d="M 38 72 Q 50 82 62 72" stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none" />;
  };

  const gradId = React.useId();

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="select-none pointer-events-none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={baseColor} stopOpacity="0.95" />
          <stop offset="100%" stopColor={baseColor} />
        </linearGradient>
        <filter id="mascotShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Antenna */}
      <line x1="50" y1="16" x2="50" y2="6" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="50" cy="5" r="4.5" fill="#fbbf24">
        {animate && <animate attributeName="opacity" values="1;0.5;1" dur="1.8s" repeatCount="indefinite" />}
      </circle>

      {/* Head */}
      <g filter={`url(#mascotShadow)`}>
        <rect x="14" y="17" width="72" height="74" rx="26" fill={`url(#${gradId})`} />
      </g>

      {/* Highlight */}
      <ellipse cx="38" cy="32" rx="14" ry="8" fill="white" opacity="0.12" />

      {/* Cheeks */}
      <circle cx="26" cy="64" r="6" fill="#f472b6" opacity="0.35" />
      <circle cx="74" cy="64" r="6" fill="#f472b6" opacity="0.35" />

      {renderEyes()}
      {renderMouth()}
    </svg>
  );
}