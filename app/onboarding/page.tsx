'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, getRoleDashboard } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowRight, ArrowLeft, GraduationCap, Target, BookOpen, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type UserRole = 'student';

const STEPS = [
  { id: 'welcome',  title: 'Welcome to Cognify',  description: "Let's personalize your experience" },
  { id: 'academic', title: 'Academic Info',        description: 'Help us understand your level' },
  { id: 'goals',    title: 'Your Goals',            description: 'What score are you targeting?' },
  { id: 'subjects', title: 'Focus Areas',           description: 'Which subjects need the most work?' },
];

const SAT_SUBJECTS = [
  { id: 'math',            label: 'Math',             description: 'Algebra, Geometry, Statistics' },
  { id: 'reading-writing', label: 'Reading & Writing', description: 'Comprehension, Grammar, Rhetoric' },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { user, profile, isLoading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();

  const [formData, setFormData] = useState({
    grade_level: '',
    target_sat_score: '',
    test_date: '',
    preferred_subjects: [] as string[],
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (profile?.onboarding_completed) { router.replace(getRoleDashboard(profile.role)); }
  }, [user, profile, authLoading, router]);

  const steps = STEPS;
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (!isLastStep) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleSubjectToggle = (subjectId: string) => {
    setFormData((prev) => ({
      ...prev,
      preferred_subjects: prev.preferred_subjects.includes(subjectId)
        ? prev.preferred_subjects.filter((s) => s !== subjectId)
        : [...prev.preferred_subjects, subjectId],
    }));
  };

  const handleComplete = async () => {
    if (!user) { setSaveError('You must be logged in. Please refresh and try again.'); return; }

    setIsSaving(true);
    setSaveError(null);

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          email: user.email ?? '',
          full_name: (user.user_metadata?.full_name as string) ?? null,
          role: 'student',
          grade_level: formData.grade_level ? parseInt(formData.grade_level) : null,
          target_sat_score: formData.target_sat_score ? parseInt(formData.target_sat_score) : null,
          test_date: formData.test_date || null,
          preferred_subjects: formData.preferred_subjects,
          onboarding_completed: true,
          onboarding_step: steps.length,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      console.error('[onboarding] upsert error:', upsertError);

      if (upsertError.code === '42501' || upsertError.message?.includes('policy')) {
        const { error: rpcError } = await supabase.rpc('ensure_profile_exists', {
          p_email: user.email ?? '',
          p_full_name: (user.user_metadata?.full_name as string) ?? null,
        });

        if (rpcError) {
          setSaveError('Could not create your profile. Please try again or contact support.');
          setIsSaving(false);
          return;
        }

        const { error: retryError } = await supabase
          .from('profiles')
          .update({
            grade_level: formData.grade_level ? parseInt(formData.grade_level) : null,
            target_sat_score: formData.target_sat_score ? parseInt(formData.target_sat_score) : null,
            test_date: formData.test_date || null,
            preferred_subjects: formData.preferred_subjects,
            onboarding_completed: true,
            onboarding_step: steps.length,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (retryError) {
          setSaveError(`Failed to save profile: ${retryError.message}`);
          setIsSaving(false);
          return;
        }
      } else {
        setSaveError(`Failed to save profile: ${upsertError.message}`);
        setIsSaving(false);
        return;
      }
    }

    const { data: saved, error: verifyError } = await supabase
      .from('profiles')
      .select('onboarding_completed')
      .eq('user_id', user.id)
      .maybeSingle();

    if (verifyError || !saved?.onboarding_completed) {
      setSaveError('Profile was saved but could not be verified. Please refresh the page.');
      setIsSaving(false);
      return;
    }

    // Refresh auth context's profile state so redirects work correctly
    await refreshProfile();

    // Redirect to the correct dashboard based on actual role from DB
    const { data: finalProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    router.push(getRoleDashboard(finalProfile?.role || 'student'));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderStepContent = () => {
    const stepId = steps[currentStep]?.id;
    switch (stepId) {
      case 'welcome':
        return (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
            </div>
            <p className="text-lg text-muted-foreground">
              Cognify connects students with personalized SAT help from AI and expert human tutors.
            </p>
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-primary">24/7</p>
                <p className="text-sm text-muted-foreground">AI Help</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-primary">Expert</p>
                <p className="text-sm text-muted-foreground">Tutors</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-primary">Personal</p>
                <p className="text-sm text-muted-foreground">Feedback</p>
              </div>
            </div>
          </div>
        );

      case 'academic':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Current Grade Level</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { v: '9',  l: '9th Grade',  sub: 'Freshman'  },
                  { v: '10', l: '10th Grade', sub: 'Sophomore' },
                  { v: '11', l: '11th Grade', sub: 'Junior'    },
                  { v: '12', l: '12th Grade', sub: 'Senior'    },
                ].map((g) => (
                  <button
                    key={g.v}
                    type="button"
                    onClick={() => setFormData({ ...formData, grade_level: g.v })}
                    className={cn(
                      'p-3 rounded-lg border-2 text-left transition-all',
                      formData.grade_level === g.v ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    )}
                  >
                    <p className="font-medium text-sm">{g.l}</p>
                    <p className="text-xs text-muted-foreground">{g.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'goals':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="target_score">Target SAT Score (optional)</Label>
              <Input
                id="target_score"
                type="number"
                placeholder="e.g., 1400"
                min="400"
                max="1600"
                value={formData.target_sat_score}
                onChange={(e) => setFormData({ ...formData, target_sat_score: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Average score is around 1050. Max is 1600.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="test_date">Test Date (optional)</Label>
              <Input
                id="test_date"
                type="date"
                value={formData.test_date}
                onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">We'll show a countdown on your dashboard.</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Score Ranges</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium">400–1050:</span> Building foundation<br />
                    <span className="font-medium">1050–1250:</span> Above average<br />
                    <span className="font-medium">1250–1450:</span> Competitive<br />
                    <span className="font-medium">1450–1600:</span> Top tier
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'subjects':
        return (
          <div className="space-y-6">
            <p className="text-muted-foreground">Select areas where you need the most help. You can change this later.</p>
            <div className="space-y-4">
              {SAT_SUBJECTS.map((subject) => (
                <div key={subject.id} className="flex items-center space-x-3">
                  <Checkbox
                    id={subject.id}
                    checked={formData.preferred_subjects.includes(subject.id)}
                    onCheckedChange={() => handleSubjectToggle(subject.id)}
                  />
                  <div>
                    <Label htmlFor={subject.id} className="font-medium cursor-pointer">{subject.label}</Label>
                    <p className="text-sm text-muted-foreground">{subject.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <BookOpen className="h-5 w-5 text-primary mt-0.5" />
              <p className="text-sm text-muted-foreground">
                You can request help with any SAT topic — we&apos;ll prioritize content for your selected focus areas.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <Progress value={progress} className="h-2" />
          <div className="mt-3 flex items-center justify-between gap-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-1.5 min-w-0">
                <div className={cn('h-2 w-2 rounded-full flex-shrink-0 transition-colors',
                  index < currentStep  ? 'bg-primary' :
                  index === currentStep ? 'bg-primary ring-2 ring-primary/30' :
                  'bg-muted-foreground/30'
                )} />
                <span className={cn('text-xs hidden sm:inline truncate',
                  index <= currentStep ? 'text-primary font-medium' : 'text-muted-foreground'
                )}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{steps[currentStep]?.title}</CardTitle>
            <CardDescription>{steps[currentStep]?.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {saveError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}
            {renderStepContent()}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" onClick={handleBack} disabled={currentStep === 0 || isSaving}>
              <ArrowLeft className="mr-2 h-4 w-4" />Back
            </Button>
            {isLastStep ? (
              <Button onClick={handleComplete} disabled={isSaving}>
                {isSaving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                ) : (
                  <>Complete <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
