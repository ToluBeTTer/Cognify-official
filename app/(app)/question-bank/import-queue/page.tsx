'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Package,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  Loader2,
  Trash2,
  Send,
  ChevronDown,
  Clock,
  FileQuestion,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Database } from '@/lib/supabase/client';

type QuestionImport = Database['public']['Tables']['question_imports']['Row'] & {
  domains?: { name: string } | null;
  skills?: { name: string; code: string | null } | null;
  import_batches?: { batch_name: string | null } | null;
};

export default function ImportQueuePage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isCreator = profile?.role === 'creator' || isAdmin;

  const [imports, setImports] = useState<QuestionImport[]>([]);
  const [filteredImports, setFilteredImports] = useState<QuestionImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');

  // Review dialog
  const [reviewingItem, setReviewingItem] = useState<QuestionImport | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    duplicates: 0,
    published: 0,
  });

  const loadImports = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('question_imports')
        .select(`
          *,
          domains(name),
          skills(name, code),
          import_batches(batch_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        setImports(data as unknown as QuestionImport[]);

        // Calculate stats
        setStats({
          total: data.length,
          pending: data.filter(i => i.status === 'extracted' || i.status === 'pending').length,
          approved: data.filter(i => i.status === 'approved').length,
          rejected: data.filter(i => i.status === 'rejected').length,
          duplicates: data.filter(i => i.status === 'duplicate_detected').length,
          published: data.filter(i => i.status === 'published').length,
        });
      }
    } catch (err) {
      console.error('Error loading imports:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImports();
  }, [loadImports]);

  // Filter imports
  useEffect(() => {
    let filtered = imports;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        i =>
          i.question_text.toLowerCase().includes(query) ||
          i.source_reference?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(i => i.status === statusFilter);
    }

    if (sectionFilter !== 'all') {
      filtered = filtered.filter(i => i.section === sectionFilter);
    }

    setFilteredImports(filtered);
  }, [imports, searchQuery, statusFilter, sectionFilter]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredImports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredImports.map(i => i.id)));
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject' | 'publish') => {
    if (selectedIds.size === 0) return;

    const updates: Partial<QuestionImport> = {
      reviewed_by: profile?.user_id,
      reviewed_at: new Date().toISOString(),
      review_notes: 'Bulk action',
    };

    if (action === 'approve') {
      updates.status = 'approved';
    } else if (action === 'reject') {
      updates.status = 'rejected';
    }

    const idsArray = Array.from(selectedIds);

    if (action === 'publish') {
      // Publish each selected item
      for (const id of idsArray) {
        if (imports.find(i => i.id === id)?.status === 'approved') {
          await supabase.rpc('publish_import_to_bank', { p_import_id: id });
        }
      }
    } else {
      await supabase
        .from('question_imports')
        .update(updates)
        .in('id', idsArray);
    }

    setSelectedIds(new Set());
    loadImports();
  };

  const handleSingleAction = async (action: 'approve' | 'reject' | 'publish', item: QuestionImport) => {
    const updates: Partial<QuestionImport> = {
      reviewed_by: profile?.user_id,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes || null,
    };

    if (action === 'approve') {
      updates.status = 'approved';
    } else if (action === 'reject') {
      updates.status = 'rejected';
    }

    if (action === 'publish') {
      const { error } = await supabase.rpc('publish_import_to_bank', {
        p_import_id: item.id,
      });
      if (!error) {
        setImports(prev => prev.filter(i => i.id !== item.id));
        setReviewingItem(null);
        setReviewNotes('');
        loadImports();
      }
    } else {
      const { error } = await supabase
        .from('question_imports')
        .update(updates)
        .eq('id', item.id);

      if (!error) {
        setImports(prev =>
          prev.map(i => (i.id === item.id ? { ...i, ...updates } : i))
        );
        setReviewingItem(null);
        setReviewNotes('');
      }
    }
  };

  const getStatusBadge = (status: QuestionImport['status']) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pending' },
      extracted: { variant: 'default', label: 'Extracted' },
      reviewing: { variant: 'default', label: 'Reviewing' },
      approved: { variant: 'outline', label: 'Approved' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      published: { variant: 'outline', label: 'Published' },
      duplicate_detected: { variant: 'secondary', label: 'Duplicate' },
    };
    const { variant, label } = config[status] || config.pending;
    return <Badge variant={variant}>{label}</Badge>;
  };

  const pendingCount = stats.pending + stats.duplicates;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6" />
            Import Review Queue
          </h1>
          <p className="text-muted-foreground">
            Review, approve, and publish imported questions to the question bank
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Imports</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-warning">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Needs Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-success">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-warning">{stats.duplicates}</div>
            <p className="text-xs text-muted-foreground">Duplicates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-info">{stats.published}</div>
            <p className="text-xs text-muted-foreground">Published</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="extracted">Extracted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="duplicate_detected">Duplicates</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                <SelectItem value="math">Math</SelectItem>
                <SelectItem value="reading">Reading</SelectItem>
                <SelectItem value="writing">Writing</SelectItem>
              </SelectContent>
            </Select>

            {selectedIds.size > 0 && (
              <>
                <Separator orientation="vertical" className="h-8" />
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} selected
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      Bulk Actions
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleBulkAction('approve')}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve Selected
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction('reject')}>
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject Selected
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkAction('publish')}>
                      <Send className="mr-2 h-4 w-4" />
                      Publish Approved
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Questions ({filteredImports.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedIds.size === filteredImports.length && filteredImports.length > 0}
                onCheckedChange={selectAll}
              />
              <span className="text-sm text-muted-foreground">Select All</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredImports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No imports found</h3>
              <p className="text-sm text-muted-foreground">
                {imports.length === 0
                  ? 'No questions have been imported yet.'
                  : 'No imports match your current filters.'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2 pr-4">
                {filteredImports.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50',
                      item.status === 'duplicate_detected' && 'border-warning',
                      item.status === 'approved' && 'border-success',
                      item.status === 'rejected' && 'border-destructive',
                      selectedIds.has(item.id) && 'bg-muted/50'
                    )}
                  >
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(item.status)}
                        {item.duplicate_of && (
                          <Badge variant="outline" className="gap-1 text-warning border-warning">
                            <AlertTriangle className="h-3 w-3" />
                            Duplicate
                          </Badge>
                        )}
                        {item.section && (
                          <Badge variant="secondary" className="capitalize">
                            {item.section}
                          </Badge>
                        )}
                        {item.difficulty && (
                          <Badge
                            variant={
                              item.difficulty === 'easy' ? 'secondary' :
                              item.difficulty === 'hard' ? 'destructive' : 'default'
                            }
                          >
                            {item.difficulty}
                          </Badge>
                        )}
                        {item.import_batches?.batch_name && (
                          <span className="text-xs text-muted-foreground">
                            {item.import_batches.batch_name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm line-clamp-2 mb-2">{item.question_text}</p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Answer: <strong>{item.correct_answer || 'Not set'}</strong>
                        </span>
                        {item.skills?.code && (
                          <span className="font-mono">{item.skills.code}</span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                        {item.similarity_score && (
                          <span className="text-warning">
                            {(item.similarity_score * 100).toFixed(0)}% similar
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReviewingItem(item)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog
        open={!!reviewingItem}
        onOpenChange={(open) => {
          if (!open) {
            setReviewingItem(null);
            setReviewNotes('');
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Imported Question</DialogTitle>
            <DialogDescription>
              Verify accuracy before publishing to the question bank
            </DialogDescription>
          </DialogHeader>

          {reviewingItem && (
            <div className="space-y-6">
              {/* Status and Metadata */}
              <div className="flex flex-wrap items-center gap-2">
                {getStatusBadge(reviewingItem.status)}
                {reviewingItem.duplicate_of && (
                  <Badge variant="outline" className="gap-1 text-warning border-warning">
                    <AlertTriangle className="h-3 w-3" />
                    Duplicate of existing question
                  </Badge>
                )}
              </div>

              {/* Question Text */}
              <div>
                <h4 className="text-sm font-medium mb-2">Question Text</h4>
                <div className="rounded-lg bg-muted p-4">
                  <p className="whitespace-pre-wrap">{reviewingItem.question_text}</p>
                </div>
              </div>

              {/* Answer Choices */}
              {reviewingItem.choices && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Answer Choices</h4>
                  <div className="grid gap-2">
                    {Object.entries(reviewingItem.choices as Record<string, string>).map(([key, value]) => (
                      <div
                        key={key}
                        className={cn(
                          'flex items-center gap-3 rounded-lg border p-3',
                          reviewingItem.correct_answer?.toUpperCase() === key.toUpperCase() &&
                            'border-success bg-success/10'
                        )}
                      >
                        <Badge variant="outline" className="w-8 justify-center font-mono">
                          {key.toUpperCase()}
                        </Badge>
                        <span className="flex-1">{value}</span>
                        {reviewingItem.correct_answer?.toUpperCase() === key.toUpperCase() && (
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Numeric Answer */}
              {reviewingItem.question_format === 'numeric_entry' && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Correct Answer</h4>
                  <div className="rounded-lg border p-4 bg-success/10 border-success">
                    <span className="text-xl font-bold">{reviewingItem.correct_answer}</span>
                  </div>
                </div>
              )}

              {/* Explanation */}
              {reviewingItem.explanation && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Explanation</h4>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm whitespace-pre-wrap">{reviewingItem.explanation}</p>
                  </div>
                </div>
              )}

              {/* Hint */}
              {reviewingItem.hint && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Hint</h4>
                  <div className="rounded-lg bg-warning/10 border border-warning/25 p-3">
                    <p className="text-sm text-warning">{reviewingItem.hint}</p>
                  </div>
                </div>
              )}

              {/* Classification */}
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <h4 className="text-xs text-muted-foreground mb-1">Section</h4>
                  <p className="font-medium capitalize">{reviewingItem.section || 'Not set'}</p>
                </div>
                <div>
                  <h4 className="text-xs text-muted-foreground mb-1">Domain</h4>
                  <p className="font-medium">{reviewingItem.domains?.name || 'Not set'}</p>
                </div>
                <div>
                  <h4 className="text-xs text-muted-foreground mb-1">Skill</h4>
                  <p className="font-medium">
                    {reviewingItem.skills?.code ? `${reviewingItem.skills.code}: ` : ''}
                    {reviewingItem.skills?.name || 'Not set'}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs text-muted-foreground mb-1">Difficulty</h4>
                  <p className="font-medium capitalize">{reviewingItem.difficulty || 'Not set'}</p>
                </div>
              </div>

              {/* AI Confidence Scores */}
              {(reviewingItem.section_confidence || reviewingItem.difficulty_confidence) && (
                <div className="rounded-lg border border-dashed p-4">
                  <h4 className="text-sm font-medium mb-2">AI Classification Confidence</h4>
                  <div className="grid gap-4 md:grid-cols-4 text-sm">
                    {reviewingItem.section_confidence && (
                      <div>
                        <div className="text-xs text-muted-foreground">Section</div>
                        <div className="font-mono">{(reviewingItem.section_confidence * 100).toFixed(0)}%</div>
                      </div>
                    )}
                    {reviewingItem.domain_confidence && (
                      <div>
                        <div className="text-xs text-muted-foreground">Domain</div>
                        <div className="font-mono">{(reviewingItem.domain_confidence * 100).toFixed(0)}%</div>
                      </div>
                    )}
                    {reviewingItem.skill_confidence && (
                      <div>
                        <div className="text-xs text-muted-foreground">Skill</div>
                        <div className="font-mono">{(reviewingItem.skill_confidence * 100).toFixed(0)}%</div>
                      </div>
                    )}
                    {reviewingItem.difficulty_confidence && (
                      <div>
                        <div className="text-xs text-muted-foreground">Difficulty</div>
                        <div className="font-mono">{(reviewingItem.difficulty_confidence * 100).toFixed(0)}%</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {reviewingItem.tags && reviewingItem.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {reviewingItem.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Review Notes */}
              <div>
                <h4 className="text-sm font-medium mb-2">Review Notes</h4>
                <Input
                  placeholder="Add notes about this question..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setReviewingItem(null);
              setReviewNotes('');
            }}>
              Cancel
            </Button>
            {reviewingItem?.status === 'extracted' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => handleSingleAction('reject', reviewingItem!)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button onClick={() => handleSingleAction('approve', reviewingItem!)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
              </>
            )}
            {reviewingItem?.status === 'approved' && (
              <Button onClick={() => handleSingleAction('publish', reviewingItem!)}>
                <Send className="mr-2 h-4 w-4" />
                Publish to Bank
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
