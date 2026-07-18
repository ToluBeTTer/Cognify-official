import { CognifyLogo } from '@/components/ui/cognify-logo';
import { CheckCircle2 } from 'lucide-react';

const FEATURES = [
  'Instant AI explanations from Milo',
  'Real tutors when you need more depth',
  'A growing bank of real SAT questions',
];

interface AuthShellProps {
  children: React.ReactNode;
}

/**
 * Split-screen shell for login/signup. The branded panel carries the logo
 * and the value proposition once, so individual auth screens (login,
 * signup, forgot-password, etc.) don't each need to repeat their own logo
 * lockup and can just focus on the form itself.
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Branded panel — hidden on small screens to keep mobile simple */}
      <div className="hidden lg:flex relative flex-col justify-between bg-gradient-primary text-white p-12 overflow-hidden">
        {/* Subtle answer-bubble motif in the background, tying back to the
            actual subject rather than being generic decoration */}
        <svg
          className="absolute -right-24 -top-24 opacity-[0.08]"
          width="500" height="500" viewBox="0 0 500 500" fill="none"
          aria-hidden="true"
        >
          <circle cx="250" cy="250" r="240" stroke="white" strokeWidth="24" />
          <circle cx="250" cy="250" r="160" stroke="white" strokeWidth="24" />
        </svg>
        <svg
          className="absolute -left-16 bottom-12 opacity-[0.08]"
          width="300" height="300" viewBox="0 0 300 300" fill="none"
          aria-hidden="true"
        >
          <circle cx="150" cy="150" r="140" stroke="white" strokeWidth="18" />
        </svg>

        <CognifyLogo variant="compact" size="md" href="/" textClassName="text-white" />

        <div className="relative space-y-6 max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Every question has an answer.
          </h1>
          <p className="text-white/80 text-lg leading-relaxed">
            Upload the exact question you're stuck on. Get help immediately, then keep practicing smarter.
          </p>
          <ul className="space-y-3 pt-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-white/90">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-white/70" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/50">© {new Date().getFullYear()} Cognify</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Logo shown here too, only on small screens where the branded panel is hidden */}
          <div className="flex justify-center mb-6 lg:hidden">
            <CognifyLogo variant="fullLogo" size="lg" href="/" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
