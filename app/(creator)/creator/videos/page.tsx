'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload, Eye, Pencil, Trash2, Loader2, Video as VideoIcon } from 'lucide-react';

interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  views: number;
  status: 'published' | 'unlisted' | 'draft';
  subject: string | null;
  topic: string | null;
  created_at: string;
}

export default function ManageVideosPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<VideoRow | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadVideos();
  }, [user]);

  const loadVideos = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('videos')
      .select('id, title, description, tags, views, status, subject, topic, created_at')
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });
    setVideos(data ?? []);
    setLoading(false);
  };

  const openEdit = (v: VideoRow) => {
    setEditing(v);
    setEditTitle(v.title);
    setEditDescription(v.description ?? '');
    setEditTags((v.tags ?? []).join(', '));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('videos')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
        })
        .eq('id', editing.id);
      if (error) throw error;
      toast.success('Video updated');
      setEditing(null);
      loadVideos();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteVideo = async (id: string) => {
    if (!confirm('Remove this video from the library? This cannot be undone.')) return;
    const { error } = await supabase.from('videos').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Video removed');
    loadVideos();
  };

  return (
    <div>
      <PageHeader
        title="My Videos"
        subtitle="Manage the explanation videos you've published to the library."
        action={
          <Button onClick={() => router.push('/creator/videos/upload')} className="gap-2">
            <Upload className="h-4 w-4" /> Upload Video
          </Button>
        }
      />

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && videos.length === 0 && (
        <Card className="p-12 text-center">
          <VideoIcon className="h-10 w-10 mx-auto mb-4 opacity-30" />
          <p className="text-muted-foreground mb-4">You haven't published any videos yet.</p>
          <Button onClick={() => router.push('/creator/videos/upload')}>Upload your first video</Button>
        </Card>
      )}

      <div className="space-y-3">
        {videos.map((v) => (
          <Card key={v.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Link href={`/videos/${v.id}`} className="font-medium text-sm hover:text-primary line-clamp-1">
                {v.title}
              </Link>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant={v.status === 'published' ? 'secondary' : 'outline'} className="text-[10px] capitalize">
                  {v.status}
                </Badge>
                {v.subject && <Badge variant="outline" className="text-[10px] capitalize">{v.subject}</Badge>}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {v.views ?? 0}
                </span>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => openEdit(v)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteVideo(v.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Video</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} />
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
