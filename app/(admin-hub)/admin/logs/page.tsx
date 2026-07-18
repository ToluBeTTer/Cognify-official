'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  Loader2,
  Search,
  User,
  Shield,
  FileText,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { usePagination } from '@/lib/hooks/use-pagination';
import { PaginationControls } from '@/components/shared/pagination-controls';

type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

const ACTION_ICONS: Record<string, React.ReactNode> = {
  role_changed: <Shield className="h-4 w-4" />,
  role_request_approved: <CheckCircle2 className="h-4 w-4 text-success" />,
  role_request_rejected: <XCircle className="h-4 w-4 text-destructive" />,
  question_created: <FileText className="h-4 w-4" />,
  question_updated: <FileText className="h-4 w-4" />,
  settings_changed: <Settings className="h-4 w-4" />,
  default: <Activity className="h-4 w-4" />,
};

function CheckCircle2({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}

function XCircle({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>;
}

export default function AdminLogsPage() {
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const pagination = usePagination(50);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(...pagination.range);

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      setLogs(data || []);
      pagination.setTotalCount(count ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, pagination.page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    pagination.resetPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter]);

  // Free-text search is intentionally scoped to the currently-loaded page —
  // it checks old_value/new_value JSON content, which Postgres can't cheaply
  // full-text-search without a dedicated function. Use the action dropdown
  // to narrow at the database level across the full history; use search to
  // refine within what's currently on screen.
  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    return (
      log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.old_value).toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.new_value).toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground mt-1">System activity and changes</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search this page..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="role_changed">Role Changes</SelectItem>
                <SelectItem value="role_request_approved">Approvals</SelectItem>
                <SelectItem value="role_request_rejected">Rejections</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="divide-y">
                {filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No logs found</p>
                  </div>
                ) : (
                  filteredLogs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          {ACTION_ICONS[log.action] || ACTION_ICONS.default}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium capitalize">{log.action?.replace(/_/g, ' ')}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {log.old_value && (
                              <span className="mr-2">From: {JSON.stringify(log.old_value)}</span>
                            )}
                            {log.new_value && (
                              <span>To: {JSON.stringify(log.new_value)}</span>
                            )}
                          </div>
                          {log.target_user_id && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Target: {log.target_user_id}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <PaginationControls
        page={pagination.page}
        totalPages={pagination.totalPages}
        totalCount={pagination.totalCount}
        pageSize={pagination.pageSize}
        hasPrev={pagination.hasPrev}
        hasNext={pagination.hasNext}
        onPrev={pagination.prevPage}
        onNext={pagination.nextPage}
        itemLabel="log entries"
      />
    </div>
  );
}
