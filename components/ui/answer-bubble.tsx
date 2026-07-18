import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AnswerBubbleState = 'empty' | 'active' | 'filled' | 'correct' | 'incorrect';

interface AnswerBubbleProps {
  /** A single letter (A/B/C/D) for an actual multiple-choice option, or a
   *  question number for a navigator dot. Omit for a plain status dot. */
  label?: string;
  state?: AnswerBubbleState;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

const SIZE_CLASSES: Record<NonNullable<AnswerBubbleProps['size']>, string> = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
};

/**
 * The scantron answer bubble, reimagined as a real status primitive rather
 * than a decorative logo mark. Used for: multiple-choice option selection,
 * the practice-session question navigator (answered/unanswered/current),
 * and correct/incorrect feedback — anywhere the app needs to show "has this
 * been marked, and how" in a way that's specific to what an SAT bubble sheet
 * actually looks like.
 */
export function AnswerBubble({ label, state = 'empty', size = 'md', className, onClick }: AnswerBubbleProps) {
  const isInteractive = !!onClick;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isInteractive}
      aria-pressed={state === 'filled' || state === 'correct' || state === 'incorrect'}
      className={cn(
        'relative inline-flex items-center justify-center rounded-full border-2 font-medium transition-all duration-200',
        SIZE_CLASSES[size],
        state === 'empty' && 'border-muted-foreground/30 bg-transparent text-muted-foreground',
        state === 'active' && 'border-primary bg-transparent text-primary ring-2 ring-primary/20 scale-105',
        state === 'filled' && 'border-foreground bg-foreground text-background',
        state === 'correct' && 'border-success bg-success text-success-foreground',
        state === 'incorrect' && 'border-destructive bg-destructive text-destructive-foreground',
        !isInteractive && 'cursor-default',
        isInteractive && 'cursor-pointer hover:scale-105 active:scale-95',
        className
      )}
    >
      {state === 'correct' ? (
        <Check className="h-[55%] w-[55%]" strokeWidth={3} />
      ) : state === 'incorrect' ? (
        <X className="h-[55%] w-[55%]" strokeWidth={3} />
      ) : (
        label
      )}
    </button>
  );
}
