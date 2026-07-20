'use client';

import { itemById } from '@/lib/mascot/catalog';
import type { ItemCategory } from '@/lib/mascot/catalog';

export type MiloExpression = 'idle' | 'happy' | 'talking' | 'squish' | 'dragged' | 'hurt' | 'dizzy' | 'worried';

interface MiloFaceProps {
  equipped: Record<ItemCategory, string>;
  expression?: MiloExpression;
  size?: number;
  /** 'widget' = just the blob, no background disc — used for the floating companion.
   *  'full' = includes the background disc — used in the wardrobe preview / profile. */
  variant?: 'widget' | 'full';
  /** Overrides the body color (used by the color-customization swatches). */
  bodyColorOverride?: string;
  /** Per-category position nudges (hair/accessory/clothing), from the wardrobe's arrow-key repositioning. */
  itemOffsets?: Record<string, { dx: number; dy: number }>;
}

/** Pure SVG, no external images — themeable, and safe to drop anywhere. */
export function MiloFace({
  equipped,
  expression = 'idle',
  size = 64,
  variant = 'full',
  bodyColorOverride,
  itemOffsets = {},
}: MiloFaceProps) {
  const eyes = itemById(equipped.eyes) ?? itemById('eyes-default')!;
  const mouth = itemById(equipped.mouth) ?? itemById('mouth-default')!;
  const nose = itemById(equipped.nose);
  const hair = itemById(equipped.hair);
  const accessory = itemById(equipped.accessory);
  const clothing = itemById(equipped.clothing);
  const bg = itemById(equipped.bg) ?? itemById('bg-default')!;
  const colorItem = itemById(equipped.color);

  const bodyColor = bodyColorOverride || (colorItem?.color ? `hsl(${colorItem.color})` : 'hsl(var(--milo))');
  const eyeColor = eyes.color || '#1e293b';
  const isDazed = expression === 'hurt' || expression === 'dizzy';
  const isWide = expression === 'dragged' || expression === 'worried' || expression === 'squish';

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="overflow-visible select-none">
      <defs>
        <radialGradient id="milo-bg-grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={bg.color || '#eef2ff'} />
          <stop offset="100%" stopColor={bg.color2 || bg.color || '#e0e7ff'} />
        </radialGradient>
        <radialGradient id="milo-body-grad" cx="35%" cy="28%" r="75%">
          <stop offset="0%" stopColor={bodyColor} stopOpacity={0.75} />
          <stop offset="100%" stopColor={bodyColor} />
        </radialGradient>
      </defs>

      {/* backdrop — only for the 'full' variant (wardrobe/profile), never for
          the small floating widget, where a second circle-behind-a-circle
          is exactly what made it look squished/off at a glance. */}
      {variant === 'full' && <circle cx="50" cy="50" r="48" fill="url(#milo-bg-grad)" />}

      {/* clothing (behind body edge, peeking at bottom) */}
      {clothing && clothing.id !== 'cloth-none' && (
        <g transform={`translate(${itemOffsets.clothing?.dx ?? 0}, ${itemOffsets.clothing?.dy ?? 0})`}>
          <path d="M 25 78 Q 50 92 75 78 L 75 88 Q 50 98 25 88 Z" fill={clothing.color || '#3b82f6'} />
        </g>
      )}

      {/* body — a single, symmetric, centered blob. Squishes on `squish`,
          widens on `dragged` (startled-grab), matching the reference
          sprite sheet's Idle/Hurt/Pop-out states in spirit. */}
      <path
        d={
          expression === 'squish'
            ? 'M 50 20 C 74 20 86 39 86 58 C 86 79 69 87 50 87 C 31 87 14 79 14 58 C 14 39 26 20 50 20 Z'
            : isWide
              ? 'M 50 16 C 80 16 90 36 90 56 C 90 76 72 85 50 85 C 28 85 10 76 10 56 C 10 36 20 16 50 16 Z'
              : 'M 50 12 C 77 12 89 33 89 55 C 89 78 70 89 50 89 C 30 89 11 78 11 55 C 11 33 23 12 50 12 Z'
        }
        fill="url(#milo-body-grad)"
        stroke={bodyColor}
        strokeOpacity={0.25}
        strokeWidth={1}
        className="transition-all duration-150"
      />

      {/* hair */}
      {hair && hair.id !== 'hair-none' && (
        <g transform={`translate(${itemOffsets.hair?.dx ?? 0}, ${itemOffsets.hair?.dy ?? 0})`}>
          {hair.id === 'hair-tuft' && <path d="M 42 14 Q 50 2 58 14 Q 54 10 50 12 Q 46 10 42 14 Z" fill={hair.color} />}
          {hair.id === 'hair-spiky' && (
            <path d="M 35 16 L 40 3 L 46 14 L 50 1 L 54 14 L 60 3 L 65 16 Z" fill={hair.color} />
          )}
          {hair.id === 'hair-bow' && (
            <g transform="translate(65,18)">
              <circle r="6" fill={hair.color} />
              <path d="M -10 0 L -2 -5 L -2 5 Z M 10 0 L 2 -5 L 2 5 Z" fill={hair.color} />
            </g>
          )}
          {hair.id === 'hair-crown' && (
            <path d="M 36 18 L 40 6 L 46 14 L 50 4 L 54 14 L 60 6 L 64 18 Z" fill={hair.color} stroke="#b45309" strokeWidth="1" />
          )}
        </g>
      )}

      {/* eyes — dazed/dizzy get spiral swirl eyes, otherwise normal variants */}
      <g>
        {isDazed ? (
          <>
            <g stroke={eyeColor} strokeWidth="2" fill="none" strokeLinecap="round">
              <path d="M 38 50 m -5 0 a 5 5 0 1 1 8 3" />
              <path d="M 62 50 m -5 0 a 5 5 0 1 1 8 3" />
            </g>
          </>
        ) : eyes.id === 'eyes-happy' ? (
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
        ) : eyes.id === 'eyes-wink' ? (
          <>
            <path d="M 32 50 L 44 50" stroke={eyeColor} strokeWidth="4" strokeLinecap="round" />
            <circle cx="62" cy="50" r={6} fill={eyeColor} />
          </>
        ) : eyes.id === 'eyes-heart' ? (
          <>
            <text x="30" y="58" fontSize="15">💗</text>
            <text x="56" y="58" fontSize="15">💗</text>
          </>
        ) : eyes.id === 'eyes-anime' ? (
          <>
            <ellipse cx="38" cy="50" rx="7" ry="9" fill={eyeColor} />
            <ellipse cx="62" cy="50" rx="7" ry="9" fill={eyeColor} />
            <circle cx="40" cy="46" r="2" fill="white" />
            <circle cx="64" cy="46" r="2" fill="white" />
          </>
        ) : eyes.id === 'eyes-focused' ? (
          <>
            <rect x="32" y="48" width="12" height="4" rx="2" fill={eyeColor} />
            <rect x="56" y="48" width="12" height="4" rx="2" fill={eyeColor} />
          </>
        ) : (
          <>
            <circle cx="38" cy="50" r={expression === 'talking' ? 5 : isWide ? 7.5 : 6} fill={eyeColor} />
            <circle cx="62" cy="50" r={expression === 'talking' ? 5 : isWide ? 7.5 : 6} fill={eyeColor} />
            {eyes.id === 'eyes-sparkle' && (
              <>
                <circle cx="40" cy="47" r="1.5" fill="white" />
                <circle cx="64" cy="47" r="1.5" fill="white" />
              </>
            )}
            {isWide && (
              <>
                <circle cx="40" cy="47" r="1.8" fill="white" />
                <circle cx="64" cy="47" r="1.8" fill="white" />
              </>
            )}
          </>
        )}
      </g>

      {/* nose */}
      {nose && nose.id !== 'nose-none' && <circle cx="50" cy="58" r={nose.id === 'nose-round' ? 4 : 2.5} fill="#0f172a" opacity={0.5} />}

      {/* mouth */}
      {expression === 'hurt' ? (
        <path d="M 40 68 Q 50 60 60 68" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" opacity={0.85} />
      ) : expression === 'worried' ? (
        <ellipse cx="50" cy="67" rx="4" ry="3" fill="#0f172a" opacity={0.85} />
      ) : mouth.id === 'mouth-grin' ? (
        <path d="M 38 64 Q 50 76 62 64 Q 50 70 38 64 Z" fill="#0f172a" opacity={0.85} />
      ) : mouth.id === 'mouth-smirk' ? (
        <path d="M 40 66 Q 52 70 60 62" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" opacity={0.85} />
      ) : mouth.id === 'mouth-open' || expression === 'talking' ? (
        <ellipse cx="50" cy="66" rx="7" ry="5" fill="#0f172a" opacity={0.85} />
      ) : mouth.id === 'mouth-fangs' ? (
        <path d="M 40 64 Q 50 74 60 64 L 56 64 L 54 70 L 50 64 L 46 70 L 44 64 Z" fill="#0f172a" opacity={0.85} />
      ) : mouth.id === 'mouth-tongue' ? (
        <>
          <path d="M 38 63 Q 50 71 62 63 Z" fill="#0f172a" opacity={0.85} />
          <path d="M 45 65 Q 50 74 55 65 Z" fill="#f87171" />
        </>
      ) : mouth.id === 'mouth-smug' || mouth.id === 'mouth-cool' ? (
        <path d="M 41 65 Q 50 62 59 65" stroke="#0f172a" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity={0.85} />
      ) : (
        <path d="M 40 64 Q 50 72 60 64" stroke="#0f172a" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity={0.85} />
      )}

      {/* accessory (overlay) */}
      {accessory && accessory.id !== 'acc-none' && (
        <g transform={`translate(${itemOffsets.accessory?.dx ?? 0}, ${itemOffsets.accessory?.dy ?? 0})`}>
          {accessory.id === 'acc-glasses' && (
            <g stroke="#0f172a" strokeWidth="2.5" fill="none" opacity={0.8}>
              <circle cx="38" cy="50" r="9" />
              <circle cx="62" cy="50" r="9" />
              <path d="M 47 50 L 53 50" />
            </g>
          )}
          {accessory.id === 'acc-graduation-cap' && (
            <g transform="translate(50, 8)">
              <path d="M -20 4 L 0 -6 L 20 4 L 0 14 Z" fill="#1e293b" />
              <rect x="-2" y="4" width="4" height="10" fill="#1e293b" />
              <circle cx="0" cy="16" r="2.5" fill="#facc15" />
            </g>
          )}
          {accessory.id === 'acc-headphones' && (
            <g stroke="#334155" strokeWidth="4" fill="none">
              <path d="M 28 44 Q 50 16 72 44" />
              <circle cx="27" cy="51" r="6" fill="#334155" stroke="none" />
              <circle cx="73" cy="51" r="6" fill="#334155" stroke="none" />
            </g>
          )}
          {accessory.id === 'acc-bowtie' && (
            <g transform="translate(50, 83)">
              <path d="M -10 0 L -2 -5 L -2 5 Z M 10 0 L 2 -5 L 2 5 Z" fill={accessory.color || '#ef4444'} />
              <circle r="2" fill={accessory.color || '#ef4444'} />
            </g>
          )}
          {accessory.id === 'acc-halo' && (
            <ellipse cx="50" cy="4" rx="14" ry="4" fill="none" stroke={accessory.color || '#facc15'} strokeWidth="3" />
          )}
        </g>
      )}
    </svg>
  );
}
