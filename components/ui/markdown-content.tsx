import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Real markdown rendering for AI-authored explanations. Our own AI prompts
 * already say "markdown allowed" — this is what actually makes that true.
 * Replaces both the hand-rolled bold-only renderer in the Milo widget and
 * the plain whitespace-pre-wrap text on the question detail page.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none dark:prose-invert',
        'prose-headings:font-display prose-headings:font-semibold',
        'prose-p:leading-relaxed prose-p:my-2',
        'prose-strong:text-foreground prose-strong:font-semibold',
        'prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5',
        'prose-code:text-primary prose-code:before:content-none prose-code:after:content-none',
        className
      )}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
