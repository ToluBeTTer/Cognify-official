'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Bookmark,
  Loader2,
  Bot,
  Users,
  ArrowRight,
  Trash2,
  Tag,
  Clock,
  Pencil,
  X,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

type SavedExplanation = Database['public']['Tables']['saved_explanations']['Row'];
type Question = Database['public']['Tables']['questions']['Row'];
type AIResponse = Database['public']['Tables']['ai_responses']['Row'];
type HumanResponse = Database['public']['Tables']['human_responses']['Row'];

interface SavedItem {
  saved: SavedExplanation;
  question: Question;
  ai_response: AIResponse | null;
  human_response: HumanResponse | null;
}

export default function SavedPage() {
  const { user } = useAuth();
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Edit-notes modal
  const [editItem, setEditItem] = useState<SavedItem | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editTagInput, setEditTagInput] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    fetchSaved();
  }, [user]);

  const fetchSaved = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data: savedData, error } = await supabase
        .from('saved_explanations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!savedData?.length) { setSavedItems([]); return; }

      const questionIds = savedData.map((s) => s.question_id);
      const aiIds = savedData.filter((s) => s.ai_response_id).map((s) => s.ai_response_id!);
      const humanIds = savedData.filter((s) => s.human_response_id).map((s) => s.human_response_id!);

      const [qRes, aiRes, humanRes] = await Promise.all([
        supabase.from('questions').select('*').in('id', questionIds),
        aiIds.length ? supabase.from('ai_responses').select('*').in('id', aiIds) : { data: [] },
        humanIds.length ? supabase.from('human_responses').select('*').in('id', humanIds) : { data: [] },
      ]);

      const qMap = new Map((qRes.data || []).map((q) => [q.id, q]));
      const aiMap = new Map((aiRes.data || []).map((r) => [r.id, r]));
      const humanMap = new Map((humanRes.data || []).map((r) => [r.id, r]));

      setSavedItems(
        savedData
          .map((saved) => ({
            saved,
            question: qMap.get(saved.question_id)!,
            ai_response: saved.ai_response_id ? aiMap.get(saved.ai_response_id) ?? null : null,
            human_response: saved.human_response_id ? humanMap.get(saved.human_response_id) ?? null : null,
          }))
          .filter((item) => item.question)
      );
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to load saved explanations: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async (savedId: string) => {
    setRemovingId(savedId);
    try {
      const { error } = await supabase.from('saved_explanations').delete().eq('id', savedId);
      if (error) throw error;
      setSavedItems((prev) => prev.filter((item) => item.saved.id !== savedId));
      toast.success('Removed from saved');
    } catch (error: any) {
      toast.error(`Failed to remove: ${error?.message || 'Unknown error'}`);
    } finally {
      setRemovingId(null);
    }
  };

  const openEditModal = (item: SavedItem) => {
    setEditItem(item);
    setEditNotes(item.saved.notes || '');
    setEditTags(item.saved.tags || []);
    setEditTagInput('');
  };

  const handleAddTag = () => {
    const tag = editTagInput.trim().toLowerCase();
    if (tag && !editTags.includes(tag)) setEditTags((prev) => [...prev, tag]);
    setEditTagInput('');
  };

  const handleSaveNotes = async () => {
    if (!editItem) return;
    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from('saved_explanations')
        .update({ notes: editNotes.trim() || null, tags: editTags })
        .eq('id', editItem.saved.id);
      if (error) throw error;

      setSavedItems((prev) =>
        prev.map((item) =>
          item.saved.id === editItem.saved.id
            ? { ...item, saved: { ...item.saved, notes: editNotes.trim() || null, tags: editTags } }
            : item
        )
      );
      toast.success('Notes saved');
      setEditItem(null);
    } catch (error: any) {
      toast.error(`Failed to save notes: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSavingNotes(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const aiSaved = savedItems.filter((item) => item.ai_response);
  const humanSaved = savedItems.filter((item) => item.human_response);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Saved Explanations</h1>
        <p className="text-muted-foreground mt-2">Your bookmarked explanations for review</p>
      </div>

      {savedItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bookmark className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No saved explanations</p>
            <p className="text-muted-foreground mb-4">Bookmark helpful explanations to review them later</p>
            <Button asChild><Link href="/questions">Browse Questions</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({savedItems.length})</TabsTrigger>
            <TabsTrigger value="ai">AI ({aiSaved.length})</TabsTrigger>
            <TabsTrigger value="human">Human ({humanSaved.length})</TabsTrigger>
          </TabsList>

          {[
            { value: 'all', items: savedItems },
            { value: 'ai', items: aiSaved },
            { value: 'human', items: humanSaved },
          ].map(({ value, items }) => (
            <TabsContent key={value} value={value} className="space-y-4 mt-6">
              {items.map((item) => (
                <Card key={item.saved.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {item.ai_response && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Bot className="h-3 w-3" />AI
                            </Badge>
                          )}
                          {item.human_response && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Users className="h-3 w-3" />Human
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-medium mb-1">{item.question.title || 'Untitled Question'}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.question.content || ''}
                        </p>
                        {item.saved.notes && (
                          <div className="mt-3 p-3 bg-warning/10 border border-warning/25 rounded-lg">
                            <p className="text-sm text-warning whitespace-pre-wrap">{item.saved.notes}</p>
                          </div>
                        )}
                        {item.saved.tags && item.saved.tags.length > 0 && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Tag className="h-3 w-3 text-muted-foreground" />
                            {item.saved.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" />Saved {new Date(item.saved.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(item)} title="Edit notes">
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/questions/${item.question.id}`}>
                            View<ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={removingId === item.saved.id}
                          onClick={() => handleRemove(item.saved.id)}
                        >
                          {removingId === item.saved.id
                            ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            : <Trash2 className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Edit notes modal */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Notes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Add personal notes about this explanation…"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {editTags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs">
                    {tag}
                    <button onClick={() => setEditTags((prev) => prev.filter((t) => t !== tag))} className="ml-1 hover:text-destructive">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag (e.g. algebra)"
                  value={editTagInput}
                  onChange={(e) => setEditTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={handleAddTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleSaveNotes} disabled={isSavingNotes}>
              {isSavingNotes ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Save Notes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
