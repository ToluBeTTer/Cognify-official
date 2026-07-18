'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  Lock,
  Palette,
  HelpCircle,
  Sun,
  Moon,
  Monitor,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  BookOpen,
  Clock,
  Shield,
  Settings as SettingsIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';

interface NotificationPrefs {
  email_question_answered: boolean;
  email_human_response: boolean;
  email_weekly_summary: boolean;
  push_enabled: boolean;
}

interface CreatorPrefs {
  receive_claim_notifications: boolean;
  response_deadline_reminders: boolean;
}

interface PlatformSettings {
  auto_approve_whitelisted_emails: boolean;
  require_creator_approval: boolean;
}

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const { theme, setTheme } = useTheme();

  const role = profile?.role || 'student';
  const isCreator = role === 'creator' || role === 'admin';
  const isAdmin = role === 'admin';

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    email_question_answered: true,
    email_human_response: true,
    email_weekly_summary: false,
    push_enabled: true,
  });
  const [isSavingNotif, setIsSavingNotif] = useState(false);

  const [creatorPrefs, setCreatorPrefs] = useState<CreatorPrefs>({
    receive_claim_notifications: true,
    response_deadline_reminders: true,
  });
  const [isSavingCreatorPrefs, setIsSavingCreatorPrefs] = useState(false);

  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    auto_approve_whitelisted_emails: true,
    require_creator_approval: true,
  });
  const [isSavingPlatformSettings, setIsSavingPlatformSettings] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);

  useEffect(() => {
    if (profile?.preferences) {
      const prefs = profile.preferences as Record<string, unknown>;
      if (prefs.notifications) {
        setNotifPrefs((prev) => ({ ...prev, ...(prefs.notifications as Partial<NotificationPrefs>) }));
      }
      if (prefs.creator) {
        setCreatorPrefs((prev) => ({ ...prev, ...(prefs.creator as Partial<CreatorPrefs>) }));
      }
    }
  }, [profile]);

  useEffect(() => {
    if (role !== 'admin') return;
    supabase
      .from('platform_settings')
      .select('auto_approve_whitelisted_emails, require_creator_approval')
      .eq('id', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPlatformSettings(data);
      });
  }, [role]);

  const saveCreatorPrefs = async () => {
    if (!user) return;
    setIsSavingCreatorPrefs(true);
    try {
      const currentPrefs = (profile?.preferences as Record<string, unknown>) || {};
      const { error } = await supabase
        .from('profiles')
        .update({ preferences: { ...currentPrefs, creator: creatorPrefs } })
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('Creator preferences saved');
    } catch (error: any) {
      toast.error(`Failed to save preferences: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSavingCreatorPrefs(false);
    }
  };

  const savePlatformSetting = async (patch: Partial<PlatformSettings>) => {
    if (!user) return;
    const next = { ...platformSettings, ...patch };
    setPlatformSettings(next); // optimistic
    setIsSavingPlatformSettings(true);
    try {
      const { error } = await supabase
        .from('platform_settings')
        .update({ ...patch, updated_at: new Date().toISOString(), updated_by: user.id })
        .eq('id', true);
      if (error) throw error;
      toast.success('Platform setting updated');
    } catch (error: any) {
      setPlatformSettings(platformSettings); // revert on failure
      toast.error(`Failed to update setting: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSavingPlatformSettings(false);
    }
  };

  const saveNotifPrefs = async () => {
    if (!user) return;
    setIsSavingNotif(true);
    try {
      const currentPrefs = (profile?.preferences as Record<string, unknown>) || {};
      const { error } = await supabase
        .from('profiles')
        .update({
          preferences: { ...currentPrefs, notifications: notifPrefs },
        })
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Notification preferences saved');
    } catch (error: any) {
      toast.error(`Failed to save preferences: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSavingNotif(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsChangingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update password';
      toast.error(message);
    } finally {
      setIsChangingPw(false);
    }
  };

  const themeOptions = [
    { value: 'light' as Theme, label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark' as Theme, label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { value: 'system' as Theme, label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ];

  const tabCount = isAdmin ? 4 : isCreator ? 3 : 2;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings and preferences</p>
      </div>

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className={cn('grid w-full', tabCount === 4 ? 'grid-cols-4' : tabCount === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
          <TabsTrigger value="account" className="gap-2">
            <SettingsIcon className="h-3.5 w-3.5" />
            Account
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="h-3.5 w-3.5" />
            Appearance
          </TabsTrigger>
          {isCreator && (
            <TabsTrigger value="creator" className="gap-2">
              <BookOpen className="h-3.5 w-3.5" />
              Creator
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="admin" className="gap-2">
              <Shield className="h-3.5 w-3.5" />
              Admin
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-info/10">
                  <Bell className="h-5 w-5 text-info" />
                </div>
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Configure how and when you get notified</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-4">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">AI explanation ready</p>
                    <p className="text-xs text-muted-foreground">When your AI explanation is generated</p>
                  </div>
                  <Switch
                    checked={notifPrefs.email_question_answered}
                    onCheckedChange={(v) => setNotifPrefs((p) => ({ ...p, email_question_answered: v }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Human tutor response</p>
                    <p className="text-xs text-muted-foreground">When an expert responds to your question</p>
                  </div>
                  <Switch
                    checked={notifPrefs.email_human_response}
                    onCheckedChange={(v) => setNotifPrefs((p) => ({ ...p, email_human_response: v }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Weekly progress summary</p>
                    <p className="text-xs text-muted-foreground">A weekly digest of your study activity</p>
                  </div>
                  <Switch
                    checked={notifPrefs.email_weekly_summary}
                    onCheckedChange={(v) => setNotifPrefs((p) => ({ ...p, email_weekly_summary: v }))}
                  />
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={saveNotifPrefs} disabled={isSavingNotif} size="sm">
                  {isSavingNotif ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />Save Preferences
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-success/10">
                  <Lock className="h-5 w-5 text-success" />
                </div>
                <div>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>Update your password</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg border text-xs text-muted-foreground">
                  Changing your password will sign you out of all other devices.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPw ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                {newPassword && <PasswordStrength password={newPassword} />}
                <Button type="submit" disabled={isChangingPw || !newPassword || !confirmPassword} size="sm">
                  {isChangingPw ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-muted">
                  <HelpCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle>Help & Support</CardTitle>
                  <CardDescription>Get help with Cognify</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Having trouble? Email us at{' '}
                <a href="mailto:support@cognify.com" className="text-primary hover:underline font-medium">
                  support@cognify.com
                </a>
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-warning/10">
                  <Palette className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <CardTitle>Theme</CardTitle>
                  <CardDescription>Customize how Cognify looks</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                      theme === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40 hover:bg-muted/50'
                    )}
                  >
                    <div className={cn(
                      'p-2 rounded-lg',
                      theme === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}>
                      {opt.icon}
                    </div>
                    <span className="text-sm font-medium">{opt.label}</span>
                    {theme === opt.value && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isCreator && (
          <TabsContent value="creator" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-warning/10">
                    <BookOpen className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <CardTitle>Creator Preferences</CardTitle>
                    <CardDescription>Settings for question responses and contributions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Receive claim notifications</p>
                    <p className="text-xs text-muted-foreground">Get notified when new questions are available</p>
                  </div>
                  <Switch
                    checked={creatorPrefs.receive_claim_notifications}
                    onCheckedChange={(checked) => setCreatorPrefs((p) => ({ ...p, receive_claim_notifications: checked }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Response deadline reminders</p>
                    <p className="text-xs text-muted-foreground">Remind me about pending responses</p>
                  </div>
                  <Switch
                    checked={creatorPrefs.response_deadline_reminders}
                    onCheckedChange={(checked) => setCreatorPrefs((p) => ({ ...p, response_deadline_reminders: checked }))}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2 opacity-60">
                  <div>
                    <p className="text-sm font-medium">Show in creator directory</p>
                    <p className="text-xs text-muted-foreground">Coming soon — there's no public creator directory yet</p>
                  </div>
                  <Switch disabled checked={false} />
                </div>
                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={saveCreatorPrefs} disabled={isSavingCreatorPrefs}>
                    {isSavingCreatorPrefs && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-muted">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle>Availability</CardTitle>
                    <CardDescription>Set your response availability</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  You&apos;re currently set as <span className="font-medium text-foreground">available</span> to accept new question claims.
                </p>
                <Button variant="outline" size="sm" className="mt-4">
                  Manage Availability
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="admin" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-destructive/10">
                    <Shield className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <CardTitle>Admin Controls</CardTitle>
                    <CardDescription>Platform-wide moderation settings</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Auto-approve whitelisted emails</p>
                    <p className="text-xs text-muted-foreground">Automatically promote pre-approved team members</p>
                  </div>
                  <Switch
                    checked={platformSettings.auto_approve_whitelisted_emails}
                    disabled={isSavingPlatformSettings}
                    onCheckedChange={(checked) => savePlatformSetting({ auto_approve_whitelisted_emails: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">Require approval for creator applications</p>
                    <p className="text-xs text-muted-foreground">Manually review creator access requests</p>
                  </div>
                  <Switch
                    checked={platformSettings.require_creator_approval}
                    disabled={isSavingPlatformSettings}
                    onCheckedChange={(checked) => savePlatformSetting({ require_creator_approval: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-2 opacity-60">
                  <div>
                    <p className="text-sm font-medium">Content moderation alerts</p>
                    <p className="text-xs text-muted-foreground">Coming soon — there's no content-flagging system yet to alert on</p>
                  </div>
                  <Switch disabled checked={false} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-muted">
                    <SettingsIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle>System Tools</CardTitle>
                    <CardDescription>Administrative actions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  View Audit Logs
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Manage Whitelist
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Export User Data
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /[0-9]/.test(password) },
    { label: 'Special character', ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const strength = checks.filter((c) => c.ok).length;
  const colors = ['bg-destructive', 'bg-warning', 'bg-warning', 'bg-success'];

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-all',
              i < strength ? colors[strength - 1] : 'bg-muted'
            )}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {checks.map((c) => (
          <span key={c.label} className={cn('text-xs flex items-center gap-1', c.ok ? 'text-success' : 'text-muted-foreground')}>
            <CheckCircle2 className={cn('h-3 w-3', c.ok ? 'text-success' : 'text-muted-foreground/30')} />
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
