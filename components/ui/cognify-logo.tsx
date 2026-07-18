'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Cognify Logo System
 *
 * A polished, startup-quality brand mark that works seamlessly in both light and dark modes.
 *
 * Variants:
 * - fullLogo: Full icon + wordmark. Used on auth pages (login/signup) and landing.
 * - compact: Icon + smaller wordmark. Used in sidebar header and mobile nav.
 * - iconOnly: Just the icon mark. Used in favicon, very tight spaces.
 *
 * Design: White background container for maximum contrast in all contexts.
 */

type LogoVariant = 'fullLogo' | 'iconOnly' | 'compact';
type LogoSize = 'sm' | 'md' | 'lg';

interface CognifyLogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  asLink?: boolean;
  href?: string;
  className?: string;
  /** Overrides the wordmark's text color — for placing the logo on a fixed
   *  dark panel (like the sidebar) where the default text-foreground
   *  wouldn't have enough contrast. */
  textClassName?: string;
}

const dimensions = {
  fullLogo: {
    sm: { imgW: 140, imgH: 44, iconSize: 32, textClass: 'text-lg font-extrabold tracking-tight' },
    md: { imgW: 176, imgH: 56, iconSize: 40, textClass: 'text-xl font-extrabold tracking-tight' },
    lg: { imgW: 212, imgH: 68, iconSize: 48, textClass: 'text-2xl font-extrabold tracking-tight' },
  },
  iconOnly: {
    sm: { iconSize: 28, containerClass: 'w-7 h-7' },
    md: { iconSize: 36, containerClass: 'w-9 h-9' },
    lg: { iconSize: 48, containerClass: 'w-12 h-12' },
  },
  compact: {
    sm: { iconSize: 22, containerClass: 'w-6 h-6', textClass: 'text-sm font-bold tracking-tight' },
    md: { iconSize: 28, containerClass: 'w-7 h-7', textClass: 'text-base font-bold tracking-tight' },
    lg: { iconSize: 36, containerClass: 'w-9 h-9', textClass: 'text-lg font-bold tracking-tight' },
  },
};

export function CognifyLogo({
  variant = 'fullLogo',
  size = 'md',
  asLink = true,
  href = '/dashboard',
  className,
  textClassName,
}: CognifyLogoProps) {
  const renderLogo = () => {
    // Icon-only variant - white background for contrast
    if (variant === 'iconOnly') {
      const { iconSize, containerClass } = dimensions.iconOnly[size];
      return (
        <span className={cn('relative inline-flex items-center justify-center', containerClass, className)}>
          <span className="inline-flex items-center justify-center w-full h-full rounded-lg bg-white border border-slate-200/50 shadow-sm">
            <Image
              src="/Final_Cognify_logo-removebg_imgupscaler.ai_Sharpener_2K.png"
              alt="Cognify"
              width={iconSize - 6}
              height={iconSize - 6}
              className="object-contain"
              priority
            />
          </span>
        </span>
      );
    }

    // Compact variant - white background icon + wordmark
    if (variant === 'compact') {
      const { iconSize, containerClass, textClass } = dimensions.compact[size];
      return (
        <span className={cn('inline-flex items-center gap-2', className)}>
          <span className={cn('inline-flex items-center justify-center rounded-lg bg-white border border-slate-200/50 shadow-sm', containerClass)}>
            <Image
              src="/Final_Cognify_logo-removebg_imgupscaler.ai_Sharpener_2K.png"
              alt=""
              width={iconSize - 4}
              height={iconSize - 4}
              className="object-contain flex-shrink-0"
              priority
            />
          </span>
          <span className={cn(textClass, textClassName || 'text-foreground')}>
            Cognify
          </span>
        </span>
      );
    }

    // Full logo variant - white container for maximum pop
    const { iconSize, textClass } = dimensions.fullLogo[size];
    const containerSize = size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10';

    return (
      <span className={cn('inline-flex items-center gap-3', className)}>
        <span className={cn('inline-flex items-center justify-center rounded-xl bg-white border border-slate-200/50 shadow-lg', containerSize)}>
          <Image
            src="/Final_Cognify_logo-removebg_imgupscaler.ai_Sharpener_2K.png"
            alt=""
            width={iconSize - 8}
            height={iconSize - 8}
            className="object-contain flex-shrink-0"
            priority
          />
        </span>
        <span className={cn(textClass, textClassName || 'text-foreground')}>
          Cognify
        </span>
      </span>
    );
  };

  if (asLink) {
    return (
      <Link
        href={href}
        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
      >
        {renderLogo()}
      </Link>
    );
  }

  return renderLogo();
}
