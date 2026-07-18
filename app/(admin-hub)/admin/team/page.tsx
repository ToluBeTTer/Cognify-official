'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users, Loader2, Search, Star, CheckCircle2, XCircle, Mail,
  Clock, UserPlus, Shield, AlertTriangle, Trash2, ArrowUpRight, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { analyzeCreatorApplication, type ApplicationAnalysis } from '@/lib/ai/admin-ai-client';

type Profile = Database['public']['Tables']['profiles']['Row'];
type RoleRequest = Database['public']['Tables']['role_requests']['Row'];
type ApprovedEmail = Database['public']['Tables']['approved_team_emails']['Row'];

interface RequestWithProfile extends RoleRequest {
  profiles: Profile | null;
}

interface UserWithStats extends Profile {
  question_count: number;
  response_count: number;
}

export default function TeamManagementPage() {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests');

  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [approvedEmails, setApprovedEmails] = useState<ApprovedEmail[]>([]);

  const [userSearch, setUserSearch] = useState('');
  const [emailSearch, setEmailSearch] = useState('');

  const [isAddEmailOpen, setIsAddEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newEmailRole, setNewEmailRole] = useState<'creator' | 'admin'>('creator');
  const [newEmailNotes, setNewEmailNotes] = useState('');
  const [isAddingEmail, setIsAddingEmail] = useState(false);

  const [isChangeRoleOpen, setIsChangeRoleOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithStats | null>(null);
  const [newRole, setNewRole] = useState<'student' | 'creator' | 'admin'>('student');
  const [isChangingRole, setIsChangingRole] = useState(false);

  const loadData = useCallback(async () => {
    if (!profile || profile.role !== 'admin') return;
    setIsLoading(true);
    try {
      const [rawRequestsRes, profilesRes, emailsRes] = await Promise.all([
        supabase.from('role_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('approved_team_emails').select('*').order('created_at', { ascending: false }),
      ]);

      // role_requests.user_id is a FK to auth.users, not profiles — PostgREST
      // cannot join across schemas. Look up profiles separately and merge.
      const rawRequests = rawRequestsRes.data || [];
      const profileMap = Object.fromEntries(
        (profilesRes.data || []).map(p => [p.user_id, p])
      );
      const requestsData: RequestWithProfile[] = rawRequests.map(r => ({
        ...r,
        profiles: profileMap[r.user_id] ?? null,
      }));
      setRequests(requestsData);

      const profilesData = (profilesRes.data || []) as UserWithStats[];
      setUsers(profilesData);

      setApprovedEmails(emailsRes.data || []);
    } catch (error: any) {
      console.error('Error loading team data:', error);
      toast.error(`Failed to load team data: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [analysisDialog, setAnalysisDialog] = useState<RequestWithProfile | null>(null);
  const [analysis, setAnalysis] = useState<ApplicationAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeApplication = async (request: RequestWithProfile) => {
    setAnalysisDialog(request);
    setAnalysis(null);
    setIsAnalyzing(true);
    try {
      const [{ data: attempts }, { data: questions }] = await Promise.all([
        supabase
          .from('practice_attempts')
          .select('is_correct, domain')
          .eq('user_id', request.user_id)
          .order('attempted_at', { ascending: false })
          .limit(200),
        supabase.from('questions').select('subject_id').eq('user_id', request.user_id).limit(100),
      ]);

      const result = await analyzeCreatorApplication(
        {
          full_name: request.profiles?.full_name,
          requested_role: request.requested_role,
          reason: request.reason,
        },
        {
          practiceAttempts: (attempts ?? []).map((a: any) => ({ correct: a.is_correct, topic: a.domain })),
          questions: (questions ?? []).map((q: any) => ({ subject: q.subject_id })),
        }
      );
      setAnalysis(result);
    } catch (err: any) {
      toast.error(err?.message || 'Could not analyze this application right now');
      setAnalysisDialog(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const { error } = await supabase.rpc('approve_role_request', { p_request_id: requestId });
      if (error) throw error;
      toast.success('Role request approved');
      loadData();
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast.error(`Failed to approve request: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase.rpc('reject_role_request', { p_request_id: requestId });
      if (error) throw error;
      toast.success('Role request rejected');
      loadData();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast.error(`Failed to reject request: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleAddEmail = async () => {
    if (!newEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setIsAddingEmail(true);
    try {
      const { error } = await supabase.rpc('add_team_email', {
        p_email: newEmail.trim().toLowerCase(),
        p_intended_role: newEmailRole,
        p_notes: newEmailNotes || null,
      });
      if (error) throw error;
      toast.success('Team email added');
      setNewEmail('');
      setNewEmailRole('creator');
      setNewEmailNotes('');
      setIsAddEmailOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error adding email:', error);
      toast.error(`Failed to add email: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsAddingEmail(false);
    }
  };

  const handleRemoveEmail = async (email: string) => {
    try {
      const { error } = await supabase.rpc('remove_team_email', { p_email: email });
      if (error) throw error;
      toast.success('Team email removed');
      loadData();
    } catch (error: any) {
      console.error('Error removing email:', error);
      toast.error(`Failed to remove email: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedUser) return;

    setIsChangingRole(true);
    try {
      const { error } = await supabase.rpc('change_user_role', {
        p_target_user_id: selectedUser.user_id,
        p_new_role: newRole,
        p_reason: 'Changed via admin dashboard',
      });
      if (error) {
        console.error('RPC error:', error);
        throw new Error(error.message || 'Failed to change role');
      }
      toast.success(`Role changed to ${newRole}`);
      setIsChangeRoleOpen(false);
      setSelectedUser(null);
      loadData();
    } catch (error: any) {
      console.error('Error changing role:', error);
      toast.error(error?.message || 'Failed to change role');
    } finally {
      setIsChangingRole(false);
    }
  };

  const openChangeRoleDialog = (user: UserWithStats) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setIsChangeRoleOpen(true);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredEmails = approvedEmails.filter((e) =>
    e.email.toLowerCase().includes(emailSearch.toLowerCase())
  );

  const roleColors: Record<string, string> = {
    admin:   'bg-destructive/10 text-destructive',
    creator: 'bg-warning/10 text-warning',
    student: 'bg-info/10 text-info',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team Management</h1>
        <p className="text-muted-foreground mt-1">Manage roles, approvals, and team invites.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="requests" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Role Requests
            {requests.length > 0 && (
              <Badge variant="secondary" className="ml-1">{requests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="invites" className="gap-2">
            <Mail className="h-4 w-4" />
            Team Emails
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4 mt-6">
          {requests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-lg font-medium">No pending requests</p>
                <p className="text-sm text-muted-foreground">Role change requests will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarFallback>
                          {request.profiles?.full_name?.[0]?.toUpperCase() || request.profiles?.email?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{request.profiles?.full_name || 'Unnamed'}</p>
                        <p className="text-sm text-muted-foreground">{request.profiles?.email}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge className={roleColors[request.existing_role] || ''}>{request.existing_role}</Badge>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                        <Badge className={roleColors[request.requested_role] || ''}>{request.requested_role}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-4">
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString()}
                        </p>
                        {request.reason && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-xs truncate">{request.reason}</p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleAnalyzeApplication(request)}>
                        <Sparkles className="h-4 w-4 mr-1" />Analyze
                      </Button>
                      <Button size="sm" variant="default" onClick={() => handleApproveRequest(request.id)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleRejectRequest(request.id)}>
                        <XCircle className="h-4 w-4 mr-1" />Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-4 mt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Onboarded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{user.full_name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.full_name || 'Unnamed'}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={roleColors[user.role] || ''}>{user.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        {user.onboarding_completed ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openChangeRoleDialog(user)}>
                          <Shield className="h-4 w-4 mr-1" />Change Role
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invites" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search emails..."
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Dialog open={isAddEmailOpen} onOpenChange={setIsAddEmailOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Mail className="h-4 w-4 mr-2" />Add Team Email
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Email</DialogTitle>
                  <DialogDescription>Whitelist an email address for creator or admin access.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" placeholder="name@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Intended Role</Label>
                    <Select value={newEmailRole} onValueChange={(v: 'creator' | 'admin') => setNewEmailRole(v)}>
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="creator">Creator / Tutor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Input id="notes" placeholder="e.g., New tutor joining July 2026" value={newEmailNotes} onChange={(e) => setNewEmailNotes(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddEmailOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddEmail} disabled={isAddingEmail}>
                    {isAddingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Add Email
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Approved Team Emails</CardTitle>
              <CardDescription>
                These email addresses are pre-approved for creator or admin roles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Mail className="h-12 w-12 text-muted-foreground/40 mb-4" />
                  <p className="text-lg font-medium">No approved emails</p>
                  <p className="text-sm text-muted-foreground">Add emails to whitelist users for team access.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Intended Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmails.map((email) => (
                      <TableRow key={email.id}>
                        <TableCell className="font-medium">{email.email}</TableCell>
                        <TableCell>
                          <Badge className={roleColors[email.intended_role] || ''}>{email.intended_role}</Badge>
                        </TableCell>
                        <TableCell>
                          {email.is_used ? (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />Used
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {new Date(email.created_at).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleRemoveEmail(email.email)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isChangeRoleOpen} onOpenChange={setIsChangeRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Change the role for {selectedUser?.full_name || selectedUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select value={newRole} onValueChange={(v: 'student' | 'creator' | 'admin') => setNewRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="creator">Creator / Tutor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedUser && newRole !== 'student' && selectedUser.role === 'student' && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/25">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                <p className="text-sm text-warning">
                  This will grant elevated privileges to this user. Make sure you trust them.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangeRoleOpen(false)}>Cancel</Button>
            <Button onClick={handleChangeRole} disabled={isChangingRole}>
              {isChangingRole ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Change Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!analysisDialog} onOpenChange={(open) => !open && setAnalysisDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> AI Application Analysis
            </DialogTitle>
            <DialogDescription>
              Advisory only — based on the application and the applicant's own activity on the platform. You make the final call.
            </DialogDescription>
          </DialogHeader>
          {isAnalyzing && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isAnalyzing && analysis && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    analysis.recommendation === 'approve'
                      ? 'bg-success/15 text-success'
                      : analysis.recommendation === 'reject'
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-warning/15 text-warning'
                  }
                >
                  {analysis.recommendation.replace('_', ' ')}
                </Badge>
                <Badge variant="outline">{analysis.confidence} confidence</Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Reasoning</p>
                <p className="text-sm text-muted-foreground">{analysis.reasoning}</p>
              </div>
              {analysis.strengths && (
                <div>
                  <p className="text-sm font-medium mb-1">Strengths</p>
                  <p className="text-sm text-muted-foreground">{analysis.strengths}</p>
                </div>
              )}
              {analysis.concerns && (
                <div>
                  <p className="text-sm font-medium mb-1">Concerns</p>
                  <p className="text-sm text-muted-foreground">{analysis.concerns}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalysisDialog(null)}>Close</Button>
            {analysisDialog && (
              <>
                <Button variant="outline" onClick={() => { handleRejectRequest(analysisDialog.id); setAnalysisDialog(null); }}>
                  Reject
                </Button>
                <Button onClick={() => { handleApproveRequest(analysisDialog.id); setAnalysisDialog(null); }}>
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}