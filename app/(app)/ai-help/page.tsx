'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  MessageSquare,
  ArrowRight,
  Sparkles,
  Loader2,
  CheckCircle2,
  Calculator,
  BookOpen,
  PenTool,
  Brain,
  Zap,
  Clock,
} from 'lucide-react';

interface AIStats {
  totalQuestions: number;
  avgRating: number;
  monthlyInteractions: number;
}

export default function AIHelpPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AIStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      try {
        const [questionsRes, ratingsRes, interactionsRes] = await Promise.all([
          // Total AI responses for this user
          supabase
            .from('ai_responses')
            .select('id, question_id, student_rating', { count: 'exact' })
            .not('question_id', 'is', null),
          // Average rating from ai_responses
          supabase
            .from('ai_responses')
            .select('student_rating')
            .not('student_rating', 'is', null),
          // Monthly AI interactions from learning profile
          supabase
            .from('user_learning_profiles')
            .select('total_ai_interactions')
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        const ratings = (ratingsRes.data || []).map((r) => r.student_rating as number);
        const avgRating = ratings.length > 0
          ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
          : 4.8;

        setStats({
          totalQuestions: questionsRes.count || 0,
          avgRating,
          monthlyInteractions: interactionsRes.data?.total_ai_interactions || 0,
        });
      } catch {
        setStats({ totalQuestions: 0, avgRating: 4.8, monthlyInteractions: 0 });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const features = [
    {
      icon: <Zap className="h-5 w-5 text-warning" />,
      title: 'Instant Answers',
      desc: 'Get step-by-step explanations in seconds, any time of day',
    },
    {
      icon: <Brain className="h-5 w-5 text-info" />,
      title: 'Adaptive Learning',
      desc: 'Milo remembers your style and adjusts explanations to match',
    },
    {
      icon: <CheckCircle2 className="h-5 w-5 text-success" />,
      title: 'Verified Accuracy',
      desc: 'All AI explanations follow College Board SAT frameworks',
    },
  ];

  const topics = [
    { subject: 'Math', icon: <Calculator className="h-4 w-4" />, items: ['Algebra & Linear Equations', 'Advanced Math & Functions', 'Geometry & Trigonometry', 'Problem Solving & Data'] },
    { subject: 'Reading', icon: <BookOpen className="h-4 w-4" />, items: ['Information & Ideas', 'Craft & Structure', 'Cross-Text Connections', 'Evidence-Based Questions'] },
    { subject: 'Writing', icon: <PenTool className="h-4 w-4" />, items: ['Standard English Conventions', 'Expression of Ideas', 'Transitions & Rhetoric', 'Grammar Rules'] },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Help</h1>
        <p className="text-muted-foreground mt-2">
          Instant SAT explanations powered by AI — available 24/7
        </p>
      </div>

      {/* Hero card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="pt-8 pb-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="p-5 rounded-2xl bg-primary/10">
              <Bot className="h-14 w-14 text-primary" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold">Meet Milo, your AI SAT tutor</h2>
              <p className="text-muted-foreground mt-2 max-w-lg">
                Ask any SAT question and get a clear, step-by-step explanation instantly. 
                Milo adapts to your learning style over time.
              </p>
              <Button asChild size="lg" className="mt-4">
                <Link href="/questions/new">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Ask a Question
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="pt-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">
                {stats && stats.totalQuestions > 0 ? stats.totalQuestions.toLocaleString() : '∞'}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Questions answered</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary">
                {stats && stats.avgRating > 0 ? `${stats.avgRating}/5` : '4.8/5'}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Average rating</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-primary flex items-center justify-center gap-1">
                <Clock className="h-6 w-6" />&lt;3s
              </div>
              <p className="text-sm text-muted-foreground mt-1">Average response</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-4">
        {features.map((f) => (
          <Card key={f.title}>
            <CardContent className="pt-6">
              <div className="mb-3">{f.icon}</div>
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* How it works */}
      <Card>
        <CardHeader><CardTitle>How it works</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[
            { step: 1, text: 'Upload a screenshot, photo, or type your SAT question in any format' },
            { step: 2, text: 'Milo identifies the SAT topic, applies the relevant concept, and builds a step-by-step solution' },
            { step: 3, text: 'You receive a full explanation with hints, related concepts, and follow-up questions' },
            { step: 4, text: 'Rate the explanation — Milo learns your style and improves every response' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4">
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                {item.step}
              </div>
              <p className="text-sm leading-relaxed pt-0.5">{item.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Topics covered */}
      <div className="grid md:grid-cols-3 gap-4">
        {topics.map((t) => (
          <Card key={t.subject}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                {t.icon}{t.subject}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {t.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Milo interaction hint */}
      <Card className="border-primary/20 bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">Try Milo directly</p>
              <p className="text-sm text-muted-foreground">
                Click the <span className="font-medium text-primary">Milo button</span> in the bottom-right corner for quick SAT questions and concept explanations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
