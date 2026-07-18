'use client';

import { itemById } from '@/lib/mascot/catalog';
import type { ItemCategory } from '@/lib/mascot/catalog';

interface MiloFaceProps {
  equipped: Record<ItemCategory, string>;
  expression?: 'idle' | 'happy' | 'talking' | 'squish';
  size?: number;
}

/** Pure SVG, no external images — themeable, and safe to drop anywhere. */
export function MiloFace({ equipped, expression = 'idle', size = 64 }: MiloFaceProps) {
  const eyes = itemById(equipped.eyes) ?? itemById('eyes-default')!;
  const mouth = itemById(equipped.mouth) ?? itemById('mouth-default')!;
  const nose = itemById(equipped.nose);
  const hair = itemById(equipped.hair);
  const accessory = itemById(equipped.accessory);
  const clothing = itemById(equipped.clothing);
  const bg = itemById(equipped.bg) ?? itemById('bg-default')!;

  const bodyColor = 'hsl(var(--milo))';
  const eyeColor = eyes.color || '#1e293b';

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible select-none">
      <defs>
        <radialGradient id="milo-bg-grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={bg.color || '#eef2ff'} />
          <stop offset="100%" stopColor={bg.color2 || bg.color || '#e0e7ff'} />
        </radialGradient>
        <radialGradient id="milo-body-grad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="hsl(var(--milo) / 0.85)" />
          <stop offset="100%" stopColor={bodyColor} />
        </radialGradient>
      </defs>

      {/* backdrop */}
      <circle cx="50" cy="50" r="48" fill="url(#milo-bg-grad)" />

      {/* clothing (behind body edge, peeking at bottom) */}
      {clothing && clothing.id !== 'cloth-none' && (
        <path d="M 25 78 Q 50 92 75 78 L 75 88 Q 50 98 25 88 Z" fill={clothing.color || '#3b82f6'} />
      )}

      {/* body — blob shape, squishes on the `squish` expression */}
      <path
        d={
          expression === 'squish'
            ? 'M 50 22 C 72 22 84 40 84 58 C 84 78 68 84 50 84 C 32 84 16 78 16 58 C 16 40 28 22 50 22 Z'
            : 'M 50 14 C 76 14 88 34 88 56 C 88 78 70 88 50 88 C 30 88 12 78 12 56 C 12 34 24 14 50 14 Z'
        }
        fill="url(#milo-body-grad)"
        className="transition-all duration-200"
      />

      {/* hair */}
      {hair && hair.id !== 'hair-none' && (
        <>
          {hair.id === 'hair-tuft' && <path d="M 42 16 Q 50 4 58 16 Q 54 12 50 14 Q 46 12 42 16 Z" fill={hair.color} />}
          {hair.id === 'hair-spiky' && (
            <path d="M 35 18 L 40 5 L 46 16 L 50 3 L 54 16 L 60 5 L 65 18 Z" fill={hair.color} />
          )}
          {hair.id === 'hair-bow' && (
            <g transform="translate(65,20)">
              <circle r="6" fill={hair.color} />
              <path d="M -10 0 L -2 -5 L -2 5 Z M 10 0 L 2 -5 L 2 5 Z" fill={hair.color} />
            </g>
          )}
          {hair.id === 'hair-crown' && (
            <path d="M 36 20 L 40 8 L 46 16 L 50 6 L 54 16 L 60 8 L 64 20 Z" fill={hair.color} stroke="#b45309" strokeWidth="1" />
          )}
        </>
      )}

      {/* eyes */}
      <g>
        {eyes.id === 'eyes-happy' ? (
          <>
            <path d="M 32 50 Q 38 42 44 50" stroke={eyeColor} strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M 56 50 Q 62 42 68 50" stroke={eyeColor} strokeWidth="4" fill="none" strokeLinecap="round" />
          </>
        ) : eyes.id === 'eyes-sleepy' ? (
          <>
            <path d="M 30 50 L 42 50" stroke={eyeColor} strokeWidth="3.5" strokeLinecap="round" />
            <path d="M 58 50 L 70 50" stroke={eyeColor} strokeWidth="3.5" strokeLinecap="round" />
          </>
        ) : eyes.id === 'eyes-star' ? (
          <>
            <text x="30" y="58" fontSize="16">⭐</text>
            <text x="58" y="58" fontSize="16">⭐</text>
          </>
        ) : (
          <>
            <circle cx="38" cy="50" r={expression === 'talking' ? 5 : 6} fill={eyeColor} />
            <circle cx="62" cy="50" r={expression === 'talking' ? 5 : 6} fill={eyeColor} />
            {eyes.id === 'eyes-sparkle' && (
              <>
                <circle cx="40" cy="47" r="1.5" fill="white" />
                <circle cx="64" cy="47" r="1.5" fill="white" />
              </>
            )}
          </>
        )}
      </g>

      {/* nose */}
      {nose && nose.id !== 'nose-none' && <circle cx="50" cy="58" r={nose.id === 'nose-round' ? 4 : 2.5} fill="#0f172a" opacity={0.5} />}

      {/* mouth */}
      {mouth.id === 'mouth-grin' ? (
        <path d="M 38 64 Q 50 76 62 64 Q 50 70 38 64 Z" fill="#0f172a" opacity={0.85} />
      ) : mouth.id === 'mouth-smirk' ? (
        <path d="M 40 66 Q 52 70 60 62" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" opacity={0.85} />
      ) : mouth.id === 'mouth-open' || expression === 'talking' ? (
        <ellipse cx="50" cy="66" rx="7" ry="5" fill="#0f172a" opacity={0.85} />
      ) : mouth.id === 'mouth-fangs' ? (
        <path d="M 40 64 Q 50 74 60 64 L 56 64 L 54 70 L 50 64 L 46 70 L 44 64 Z" fill="#0f172a" opacity={0.85} />
      ) : (
        <path d="M 40 64 Q 50 72 60 64" stroke="#0f172a" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity={0.85} />
      )}

      {/* accessory (overlay) */}
      {accessory && accessory.id !== 'acc-none' && (
        <>
          {accessory.id === 'acc-glasses' && (
            <g stroke="#0f172a" strokeWidth="2.5" fill="none" opacity={0.8}>
              <circle cx="38" cy="50" r="9" />
              <circle cx="62" cy="50" r="9" />
              <path d="M 47 50 L 53 50" />
            </g>
          )}
          {accessory.id === 'acc-graduation-cap' && (
            <g transform="translate(50, 10)">
              <path d="M -20 4 L 0 -6 L 20 4 L 0 14 Z" fill="#1e293b" />
              <rect x="-2" y="4" width="4" height="10" fill="#1e293b" />
              <circle cx="0" cy="16" r="2.5" fill="#facc15" />
            </g>
          )}
          {accessory.id === 'acc-headphones' && (
            <g stroke="#334155" strokeWidth="4" fill="none">
              <path d="M 28 46 Q 50 20 72 46" />
              <circle cx="27" cy="52" r="6" fill="#334155" stroke="none" />
              <circle cx="73" cy="52" r="6" fill="#334155" stroke="none" />
            </g>
          )}
          {accessory.id === 'acc-bowtie' && (
            <g transform="translate(50, 82)">
              <path d="M -10 0 L -2 -5 L -2 5 Z M 10 0 L 2 -5 L 2 5 Z" fill={accessory.color || '#ef4444'} />
              <circle r="2" fill={accessory.color || '#ef4444'} />
            </g>
          )}
          {accessory.id === 'acc-halo' && (
            <ellipse cx="50" cy="8" rx="14" ry="4" fill="none" stroke={accessory.color || '#facc15'} strokeWidth="3" />
          )}
        </>
      )}
    </svg>
  );
}
