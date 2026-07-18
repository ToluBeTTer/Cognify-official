'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  HelpCircle,
  Loader2,
  Clock,
  CheckCircle2,
  Bot,
  Users,
  ArrowRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Question = Database['public']['Tables']['questions']['Row'];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'ai_ready', label: 'AI Ready' },
  { value: 'human_requested', label: 'Human Requested' },
  { value: 'human_ready', label: 'Human Ready' },
  { value: 'completed', label: 'Completed' },
];

const statusConfig: Record<Question['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  pending: { label: 'Pending', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  processing: { label: 'Processing', variant: 'default', icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  ai_ready: { label: 'AI Ready', variant: 'default', icon: <Bot className="h-3 w-3" /> },
  human_requested: { label: 'Human Requested', variant: 'outline', icon: <Users className="h-3 w-3" /> },
  claimed: { label: 'Claimed', variant: 'outline', icon: <Users className="h-3 w-3" /> },
  human_ready: { label: 'Ready', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  completed: { label: 'Completed', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  archived: { label: 'Archived', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
};

export default function QuestionsPage() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');

  const fetchQuestions = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      let query = supabase
        .from('questions')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (subjectFilter !== 'all') query = query.eq('subject_id', subjectFilter);
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery.trim()}%,content.ilike.%${searchQuery.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setQuestions(data || []);
    } catch (err) {
      console.error('Error fetching questions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, statusFilter, subjectFilter, searchQuery]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  const hasFilters = statusFilter !== 'all' || subjectFilter !== 'all' || searchQuery;
  const clearFilters = () => { setStatusFilter('all'); setSubjectFilter('all'); setSearchQuery(''); };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Questions</h1>
          <p className="text-muted-foreground">
            {questions.length} question{questions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button asChild>
          <Link href="/questions/new">
            <HelpCircle className="mr-2 h-4 w-4" />Ask Question
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search questions…"
          className="pl-9 pr-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground font-medium">Status:</span>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={cn(
              'px-3 py-1 rounded-full text-sm border transition-all',
              statusFilter === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:border-primary/40 hover:bg-muted/50'
            )}
          >
            {opt.label}
          </button>
        ))}
        <span className="text-sm text-muted-foreground font-medium ml-2">Subject:</span>
        {(['all', 'math', 'reading-writing'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSubjectFilter(s)}
            className={cn(
              'px-3 py-1 rounded-full text-sm border transition-all capitalize',
              subjectFilter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:border-primary/40 hover:bg-muted/50'
            )}
          >
            {s === 'all' ? 'All' : s === 'reading-writing' ? 'Reading & Writing' : 'Math'}
          </button>
        ))}
        {hasFilters && (
          <button onClick={clearFilters} className="px-3 py-1 rounded-full text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 border border-dashed border-border">
            <X className="h-3 w-3" />Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : questions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No questions found</p>
            <p className="text-muted-foreground mb-4">
              {hasFilters ? 'Try adjusting your filters' : 'Submit your first question to get started'}
            </p>
            {hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
            ) : (
              <Button asChild><Link href="/questions/new">Ask a Question</Link></Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((question) => {
            const config = statusConfig[question.status];
            return (
              <Link key={question.id} href={`/questions/${question.id}`} className="block">
                <Card className="card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <Badge variant={config.variant} className="flex items-center gap-1">
                            {config.icon}{config.label}
                          </Badge>
                          {question.human_requested && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Users className="h-3 w-3" />Human
                            </Badge>
                          )}
                          {question.subject_id && (
                            <Badge variant="secondary" className="capitalize">{question.subject_id}</Badge>
                          )}
                        </div>
                        <h3 className="font-medium mb-1">
                          {question.title || 'Untitled Question'}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{question.content}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {new Date(question.created_at).toLocaleDateString()}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
