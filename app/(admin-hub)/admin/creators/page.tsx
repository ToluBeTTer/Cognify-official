'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Loader2,
  Search,
  Star,
  CheckCircle2,
  XCircle,
  UserCheck,
  Mail,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

type Profile = Database['public']['Tables']['profiles']['Row'];
type CreatorProfile = Database['public']['Tables']['creator_profiles']['Row'];

interface CreatorWithProfile {
  profile: Profile;
  creatorProfile: CreatorProfile;
}

export default function CreatorsManagementPage() {
  const { user, profile } = useAuth();
  const [creators, setCreators] = useState<CreatorWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user || profile?.role !== 'admin') return;

    const fetchCreators = async () => {
      try {
        const { data: creatorProfiles, error } = await supabase
          .from('creator_profiles')
          .select('*');

        if (error) throw error;

        if (!creatorProfiles || creatorProfiles.length === 0) {
          setCreators([]);
          setIsLoading(false);
          return;
        }

        // Fetch profiles
        const profileIds = creatorProfiles.map((c) => c.profile_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', profileIds);

        const profilesMap = new Map((profiles || []).map((p) => [p.id, p]));

        const creatorsWithProfiles: CreatorWithProfile[] = creatorProfiles
          .map((cp) => ({
            creatorProfile: cp,
            profile: profilesMap.get(cp.profile_id)!,
          }))
          .filter((c) => c.profile);

        setCreators(creatorsWithProfiles);
      } catch (error: any) {
        console.error('Error fetching creators:', error);
        toast.error(`Failed to load creators: ${error?.message || 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCreators();
  }, [user, profile]);

  const handleApproveCreator = async (creatorProfileId: string) => {
    try {
      await supabase
        .from('creator_profiles')
        .update({
          is_active: true,
          approved_at: new Date().toISOString(),
        })
        .eq('id', creatorProfileId);

      setCreators((prev) =>
        prev.map((c) =>
          c.creatorProfile.id === creatorProfileId
            ? {
                ...c,
                creatorProfile: { ...c.creatorProfile, is_active: true },
              }
            : c
        )
      );
      toast.success('Creator approved');
    } catch (error: any) {
      console.error('Error approving creator:', error);
      toast.error(`Failed to approve creator: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleDeactivateCreator = async (creatorProfileId: string) => {
    try {
      await supabase
        .from('creator_profiles')
        .update({ is_active: false })
        .eq('id', creatorProfileId);

      setCreators((prev) =>
        prev.map((c) =>
          c.creatorProfile.id === creatorProfileId
            ? {
                ...c,
                creatorProfile: { ...c.creatorProfile, is_active: false },
              }
            : c
        )
      );
      toast.success('Creator deactivated');
    } catch (error: any) {
      console.error('Error deactivating creator:', error);
      toast.error(`Failed to deactivate creator: ${error?.message || 'Unknown error'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredCreators = creators.filter(
    (c) =>
      c.profile.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.profile.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCreators = filteredCreators.filter((c) => c.creatorProfile.is_active);
  const pendingCreators = filteredCreators.filter(
    (c) => !c.creatorProfile.is_active && !c.creatorProfile.approved_at
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Creators Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage tutor accounts and permissions
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Creators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creators.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{activeCreators.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{pendingCreators.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              <Star className="h-5 w-5 fill-yellow-400 text-warning/70" />
              {creators.length > 0
                ? (
                    creators.reduce((sum, c) => sum + (c.creatorProfile.average_rating || 0), 0) /
                    creators.length
                  ).toFixed(1)
                : '0.0'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search creators..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Creators Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Creators</CardTitle>
          <CardDescription>
            {filteredCreators.length} creator{filteredCreators.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCreators.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No creators found</p>
              <p className="text-muted-foreground">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Creators will appear here when they sign up'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responses</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Claims</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCreators.map(({ profile, creatorProfile }) => (
                  <TableRow key={creatorProfile.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {profile.full_name?.[0]?.toUpperCase() || profile.email[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{profile.full_name || 'Unnamed'}</p>
                          <p className="text-sm text-muted-foreground">{profile.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {creatorProfile.is_active ? (
                        <Badge className="flex items-center gap-1 w-fit">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </Badge>
                      ) : creatorProfile.approved_at ? (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <XCircle className="h-3 w-3" />
                          Inactive
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Clock className="h-3 w-3" />
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{creatorProfile.total_responses}</TableCell>
                    <TableCell>
                      {creatorProfile.average_rating ? (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-warning/70" />
                          {creatorProfile.average_rating.toFixed(1)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {creatorProfile.active_claims}/{creatorProfile.max_active_claims}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!creatorProfile.is_active && !creatorProfile.approved_at && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveCreator(creatorProfile.id)}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        )}
                        {creatorProfile.is_active && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeactivateCreator(creatorProfile.id)}
                          >
                            Deactivate
                          </Button>
                        )}
                        {!creatorProfile.is_active && creatorProfile.approved_at && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveCreator(creatorProfile.id)}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
