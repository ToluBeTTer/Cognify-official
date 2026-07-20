'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  Loader2,
  BookOpen,
  Target,
  Brain,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SUBJECTS = [
  { id: 'math', label: 'Math', icon: '📐' },
  { id: 'reading', label: 'Reading', icon: '📖' },
  { id: 'writing', label: 'Writing', icon: '✍️' },
  { id: 'grammar', label: 'Grammar', icon: '🔤' },
];

const LEARNING_STYLES = [
  { id: 'visual', label: 'Visual', desc: 'Diagrams, charts, examples' },
  { id: 'verbal', label: 'Verbal', desc: 'Detailed written explanations' },
  { id: 'kinesthetic', label: 'Practice-first', desc: 'Learn by doing problems' },
];

const EXPLANATION_DEPTHS = [
  { id: 'concise', label: 'Concise', desc: 'Short, to the point' },
  { id: 'balanced', label: 'Balanced', desc: 'Key steps with context' },
  { id: 'thorough', label: 'Thorough', desc: 'Full detail every time' },
];

const HINT_FREQUENCIES = [
  { id: 'never', label: 'Never', desc: "Don't show hints" },
  { id: 'on_request', label: 'On Request', desc: 'Only when I ask' },
  { id: 'always', label: 'Always', desc: 'Show hints automatically' },
];

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    bio: profile?.bio || '',
    grade_level: profile?.grade_level?.toString() || '',
    target_sat_score: profile?.target_sat_score?.toString() || '',
    test_date: profile?.test_date || '',
    preferred_subjects: profile?.preferred_subjects || [] as string[],
  });

  const [prefs, setPrefs] = useState({
    learning_style: '',
    explanation_depth: 'balanced',
    hint_frequency: 'on_request',
  });

  // Sync profile -> form when it loads
  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        grade_level: profile.grade_level?.toString() || '',
        target_sat_score: profile.target_sat_score?.toString() || '',
        test_date: profile.test_date || '',
        preferred_subjects: profile.preferred_subjects || [],
      });
      // Load learning prefs from user_learning_profiles
      loadLearningProfile();
    }
  }, [profile?.user_id]);

  const loadLearningProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_learning_profiles')
      .select('preferred_learning_style, explanation_depth, hint_frequency')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setPrefs({
        learning_style: data.preferred_learning_style || '',
        explanation_depth: data.explanation_depth || 'balanced',
        hint_frequency: data.hint_frequency || 'on_request',
      });
    }
  };

  if (!profile) return null;

  const initials = profile.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase()
    : profile.email?.[0]?.toUpperCase() || 'U';

  const toggleSubject = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      preferred_subjects: prev.preferred_subjects.includes(id)
        ? prev.preferred_subjects.filter((s) => s !== id)
        : [...prev.preferred_subjects, id],
    }));
  };

  const handleSaveGeneral = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name || null,
          bio: formData.bio || null,
        })
        .eq('user_id', profile.user_id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile updated');
    } catch (error: any) {
      toast.error(`Failed to update profile: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAcademic = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('save_academic_profile', {
        p_user_id: profile.user_id,
        p_grade_level: formData.grade_level ? parseInt(formData.grade_level) : null,
        p_target_sat_score: formData.target_sat_score ? parseInt(formData.target_sat_score) : null,
        p_test_date: formData.test_date || null,
        p_preferred_subjects: formData.preferred_subjects,
      });
      if (error) throw error;
      await refreshProfile();
      toast.success('Academic info updated');
    } catch (error: any) {
      toast.error(`Failed to update: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrefs = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_learning_profiles')
        .upsert({
          user_id: user.id,
          preferred_learning_style: prefs.learning_style || null,
          explanation_depth: prefs.explanation_depth,
          hint_frequency: prefs.hint_frequency,
        }, { onConflict: 'user_id' });
      if (error) throw error;
      toast.success('Learning preferences saved');
    } catch (error: any) {
      toast.error(`Failed to save preferences: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-2">Manage your account and learning preferences</p>
      </div>

      {/* Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatar_url || ''} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold">{profile.full_name || 'User'}</h2>
              <p className="text-muted-foreground">{profile.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium capitalize">
                  {profile.role}
                </span>
                {profile.onboarding_completed && (
                  <span className="px-3 py-1 rounded-full bg-success/10 text-success text-sm font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />Onboarded
                  </span>
                )}
                {formData.preferred_subjects.map((s) => (
                  <Badge key={s} variant="secondary" className="capitalize">{s}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="preferences">Learning Prefs</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
              <CardDescription>Update your public profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile.email} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Tell us about yourself…"
                  rows={3}
                  maxLength={300}
                />
                <p className="text-xs text-muted-foreground text-right">{formData.bio.length}/300</p>
              </div>
              <Button onClick={handleSaveGeneral} disabled={isSaving}>
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Academic Tab */}
        <TabsContent value="academic">
          <Card>
            <CardHeader>
              <CardTitle>Academic Information</CardTitle>
              <CardDescription>Your study goals and subject focus</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade Level</Label>
                  <select
                    id="grade"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.grade_level}
                    onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                  >
                    <option value="">Select grade</option>
                    {['9', '10', '11', '12'].map((g) => (
                      <option key={g} value={g}>{g}th Grade</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">Target SAT Score</Label>
                  <Input
                    id="target"
                    type="number"
                    min="400"
                    max="1600"
                    step="10"
                    value={formData.target_sat_score}
                    onChange={(e) => setFormData({ ...formData, target_sat_score: e.target.value })}
                    placeholder="e.g. 1400"
                  />
                  <p className="text-xs text-muted-foreground">Score range: 400–1600</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test_date">Test Date</Label>
                  <Input
                    id="test_date"
                    type="date"
                    value={formData.test_date}
                    onChange={(e) => setFormData({ ...formData, test_date: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Powers the countdown on your dashboard</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Preferred Subjects
                </Label>
                <p className="text-sm text-muted-foreground">Select the areas you want to focus on</p>
                <div className="grid grid-cols-2 gap-3">
                  {SUBJECTS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSubject(s.id)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all',
                        formData.preferred_subjects.includes(s.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40'
                      )}
                    >
                      <span className="text-xl">{s.icon}</span>
                      <span className="font-medium text-sm">{s.label}</span>
                      {formData.preferred_subjects.includes(s.id) && (
                        <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleSaveAcademic} disabled={isSaving}>
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save Academic Info'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Learning Preferences Tab */}
        <TabsContent value="preferences">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />Learning Style
                </CardTitle>
                <CardDescription>How do you learn best? Milo adapts its explanations to you.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {LEARNING_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setPrefs({ ...prefs, learning_style: style.id })}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all',
                        prefs.learning_style === style.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      )}
                    >
                      <p className="font-medium text-sm">{style.label}</p>
                      <p className="text-xs text-muted-foreground">{style.desc}</p>
                      {prefs.learning_style === style.id && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />Explanation Depth
                </CardTitle>
                <CardDescription>How much detail do you want in AI explanations?</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {EXPLANATION_DEPTHS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setPrefs({ ...prefs, explanation_depth: d.id })}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all',
                        prefs.explanation_depth === d.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      )}
                    >
                      <p className="font-medium text-sm">{d.label}</p>
                      <p className="text-xs text-muted-foreground">{d.desc}</p>
                      {prefs.explanation_depth === d.id && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />Hint Frequency
                </CardTitle>
                <CardDescription>When should Milo show hints for practice questions?</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {HINT_FREQUENCIES.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setPrefs({ ...prefs, hint_frequency: h.id })}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all',
                        prefs.hint_frequency === h.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/30'
                      )}
                    >
                      <p className="font-medium text-sm">{h.label}</p>
                      <p className="text-xs text-muted-foreground">{h.desc}</p>
                      {prefs.hint_frequency === h.id && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSavePrefs} disabled={isSaving} className="w-full">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save Learning Preferences'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
