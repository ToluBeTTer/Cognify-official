'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock,
  Loader2,
  CheckCircle2,
  ArrowRight,
  FileQuestion,
} from 'lucide-react';

type Question = Database['public']['Tables']['questions']['Row'];
type QuestionClaim = Database['public']['Tables']['question_claims']['Row'];

interface ClaimWithQuestion {
  claim: QuestionClaim;
  question: Question;
}

export default function MyClaimsPage() {
  const { user } = useAuth();
  const [claims, setClaims] = useState<ClaimWithQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchClaims = async () => {
      if (!user) return;

      try {
        const { data: claimsData, error } = await supabase
          .from('question_claims')
          .select('*')
          .eq('creator_id', user.id)
          .order('claimed_at', { ascending: false })
          .limit(200);

        if (error) throw error;

        if (!claimsData || claimsData.length === 0) {
          setClaims([]);
          setIsLoading(false);
          return;
        }

        // Fetch questions
        const questionIds = claimsData.map((c) => c.question_id);
        const { data: questionsData } = await supabase
          .from('questions')
          .select('*')
          .in('id', questionIds);

        const questionsMap = new Map((questionsData || []).map((q) => [q.id, q]));

        const claimsWithQuestions: ClaimWithQuestion[] = claimsData.map((claim) => ({
          claim,
          question: questionsMap.get(claim.question_id)!,
        })).filter((c) => c.question);

        setClaims(claimsWithQuestions);
      } catch (error) {
        console.error('Error fetching claims:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchClaims();
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeClaims = claims.filter(
    (c) => c.claim.status === 'claimed' || c.claim.status === 'in_progress'
  );
  const completedClaims = claims.filter((c) => c.claim.status === 'completed');

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Claims</h1>
        <p className="text-muted-foreground mt-2">
          Questions you've claimed for response
        </p>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({activeClaims.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedClaims.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4 mt-6">
          {activeClaims.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No active claims</p>
                <p className="text-muted-foreground mb-4">
                  Claim questions from the queue to get started
                </p>
                <Button asChild>
                  <Link href="/admin/queue">View Queue</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            activeClaims.map(({ claim, question }) => (
              <Card key={claim.id} className="border-primary/30">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Badge className="mb-2 flex items-center gap-1 w-fit">
                        <Clock className="h-3 w-3" />
                        {claim.status === 'in_progress' ? 'In Progress' : 'Claimed'}
                      </Badge>
                      <h3 className="font-medium">
                        {question.title || 'Untitled Question'}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {question.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Claimed {new Date(claim.claimed_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button asChild>
                      <Link href={`/admin/respond/${question.id}`}>
                        {claim.status === 'in_progress' ? 'Continue' : 'Start Response'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-6">
          {completedClaims.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-success mb-4" />
                <p className="text-lg font-medium">No completed responses</p>
                <p className="text-muted-foreground">
                  Your completed responses will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            completedClaims.map(({ claim, question }) => (
              <Card key={claim.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Badge variant="secondary" className="mb-2 flex items-center gap-1 w-fit">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed
                      </Badge>
                      <h3 className="font-medium">
                        {question.title || 'Untitled Question'}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Completed {new Date(claim.completed_at || claim.claimed_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="outline" asChild>
                      <Link href={`/questions/${question.id}`}>
                        View Response
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
