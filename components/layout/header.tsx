'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Search, HelpCircle, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationDropdown } from '@/components/notifications/notification-dropdown';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  title: string | null;
  content: string;
  status: string;
  created_at: string;
}

export function AppHeader() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase()
    : profile?.email?.[0]?.toUpperCase() || 'U';

  const handleSearch = useCallback(async (value: string) => {
    if (!value.trim() || value.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);
    try {
      const { data } = await supabase
        .from('questions')
        .select('id, title, content, status, created_at')
        .or(`title.ilike.%${value}%,content.ilike.%${value}%`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(6);

      setResults(data || []);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(val), 300);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const handleResultClick = (id: string) => {
    setShowResults(false);
    setQuery('');
    router.push(`/questions/${id}`);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setShowResults(false); setQuery(''); }
    if (e.key === 'Enter' && results.length === 0 && query.trim()) {
      router.push(`/questions?search=${encodeURIComponent(query)}`);
      setShowResults(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-6 lg:px-8">
      <div className="flex-1 relative" ref={searchRef}>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search questions…"
            className="pl-9 pr-8 bg-muted/50"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (query.length >= 2) setShowResults(true); }}
            autoComplete="off"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {showResults && (
          <div className="absolute top-full left-0 mt-1 w-full max-w-md bg-popover border rounded-lg shadow-lg overflow-hidden z-50 animate-fade-up">
            {results.length === 0 && !isSearching ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No questions found for &ldquo;{query}&rdquo;
                <div className="mt-2">
                  <Link
                    href="/questions/new"
                    className="text-primary hover:underline font-medium"
                    onClick={() => setShowResults(false)}
                  >
                    Ask this question instead →
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </div>
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleResultClick(r.id)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors border-b last:border-0"
                  >
                    <p className="text-sm font-medium truncate">
                      {r.title || r.content.substring(0, 60)}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full',
                        r.status === 'completed' || r.status === 'human_ready' || r.status === 'ai_ready'
                          ? 'bg-success/10 text-success'
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {r.status.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <NotificationDropdown />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src={profile?.avatar_url || ''} alt={profile?.full_name || ''} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{profile?.full_name || 'User'}</p>
                <p className="text-xs leading-none text-muted-foreground">{profile?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => signOut()}
            >
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
