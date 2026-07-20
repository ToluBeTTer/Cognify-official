'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard,
  HelpCircle,
  FileQuestion,
  Bot,
  MessageSquare,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ArrowUpCircle,
  GraduationCap,
  ChevronDown,
  BookOpen,
  Video,
} from 'lucide-react';
import { useState } from 'react';
import { CognifyLogo } from '@/components/ui/cognify-logo';

const navItems = [
  { title: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
  { title: 'Ask Question', href: '/questions/new', icon: HelpCircle },
  { title: 'My Questions', href: '/questions', icon: FileQuestion },
  { title: 'AI Help', href: '/ai-help', icon: Bot },
  { title: 'Responses', href: '/human-responses', icon: MessageSquare },
];

const studySubItems = [
  { title: 'Practice Modes', href: '/study', icon: GraduationCap },
  { title: 'Question Bank', href: '/question-bank/browse', icon: BookOpen },
  { title: 'Video Library', href: '/videos', icon: Video },
];

const bottomItems = [
  { title: 'Profile', href: '/profile', icon: User },
  { title: 'Settings', href: '/settings', icon: Settings },
];

export function StudentSidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isStudyOpen, setIsStudyOpen] = useState(
    pathname.startsWith('/study') || pathname.startsWith('/practice') || pathname.startsWith('/question-bank')
  );

  const isStudyActive = pathname.startsWith('/study') || pathname.startsWith('/practice') || pathname.startsWith('/question-bank');

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden bg-card/80 backdrop-blur-sm border"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-200 lg:translate-x-0 overflow-hidden',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo header */}
          <div className="px-5 py-5 flex items-center justify-between">
            <CognifyLogo variant="compact" size="md" href="/student/dashboard" textClassName="text-sidebar-foreground" />
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              aria-label="Toggle theme"
            >
              {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>

          {/* Role label */}
          <div className="px-5 pb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Student</span>
          </div>

          <Separator className="mx-4 bg-sidebar-border" />

          {/* Main navigation */}
          <ScrollArea className="flex-1 px-3 py-4">
            <nav className="space-y-1">
              {/* Dashboard */}
              {navItems.slice(0, 1).map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-gradient-primary text-white shadow-md'
                        : 'text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                );
              })}

              {/* Study section with dropdown */}
              <div>
                <button
                  onClick={() => setIsStudyOpen(!isStudyOpen)}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    isStudyActive
                      ? 'bg-gradient-primary text-white shadow-md'
                      : 'text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-4 w-4" />
                    Study
                  </div>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isStudyOpen && 'rotate-180')} />
                </button>

                {isStudyOpen && (
                  <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-0.5">
                    {[
                      { href: '/study', label: 'Practice Modes', Icon: GraduationCap },
                      { href: '/question-bank/browse', label: 'Question Bank', Icon: BookOpen },
                      { href: '/videos', label: 'Video Library', Icon: Video },
                      { href: '/progress', label: 'My Progress', Icon: null },
                    ].map(({ href, label, Icon: ItemIcon }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setIsMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                          pathname === href || pathname.startsWith(href + '/')
                            ? 'text-accent font-medium bg-sidebar-accent'
                            : 'text-sidebar-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/60'
                        )}
                      >
                        {ItemIcon ? <ItemIcon className="h-3.5 w-3.5" /> : (
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        )}
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Remaining nav items */}
              {navItems.slice(1).map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'bg-gradient-primary text-white shadow-md'
                        : 'text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>

          <Separator className="mx-4 bg-sidebar-border" />

          {/* Request access section */}
          <div className="px-3 py-3">
            <Link
              href="/request-role"
              onClick={() => setIsMobileOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-warning hover:bg-sidebar-accent transition-colors"
            >
              <ArrowUpCircle className="h-4 w-4" />
              Request Access
            </Link>
          </div>

          <Separator className="mx-4 bg-sidebar-border" />

          {/* Bottom section */}
          <div className="px-3 py-3 space-y-1">
            {bottomItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
