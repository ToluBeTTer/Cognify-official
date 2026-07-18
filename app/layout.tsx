import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/supabase';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';

// Display face — headlines only. A serif with real character (Fraunces has
// genuine "wonky" optical-size personality), evoking an official document
// or score report rather than another rounded startup sans.
const displayFont = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
});

// Body/UI face — legible and slightly technical, fitting "academic testing"
// without being cold.
const bodyFont = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

// Reserved specifically for scores, timers, and question counters — SAT is
// a numbers-driven experience (the 1600 scale, countdowns), so numbers get
// their own typographic voice instead of blending into body text.
const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Cognify - SAT Help On Demand',
  description: 'Upload any SAT question. Get instant AI explanations plus personalized help from expert tutors.',
  icons: {
    icon: '/Final_Cognify_logo-removebg_imgupscaler.ai_Sharpener_2K.png',
    shortcut: '/Final_Cognify_logo-removebg_imgupscaler.ai_Sharpener_2K.png',
    apple: '/Final_Cognify_logo-removebg_imgupscaler.ai_Sharpener_2K.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${bodyFont.className} ${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
