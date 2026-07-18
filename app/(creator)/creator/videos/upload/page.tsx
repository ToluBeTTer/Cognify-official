'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, supabase } from '@/lib/supabase';
import { optimizeVideoMetadata } from '@/lib/ai/admin-ai-client';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Sparkles, Loader2, X, Video as VideoIcon } from 'lucide-react';

const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB

export default function UploadVideoPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [subject, setSubject] = useState<'math' | 'reading' | 'writing' | ''>('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | ''>('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_SIZE) {
      toast.error('Video too large (max 500MB)');
      return;
    }
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a video file');
      return;
    }
    setVideoFile(file);
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''));
  }, [title]);

  const handleSuggestMetadata = async () => {
    if (!title && !description) {
      toast.error('Add a rough title or description first — AI needs something to work from');
      return;
    }
    setIsSuggesting(true);
    try {
      const result = await optimizeVideoMetadata({
        title,
        description,
        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
        subject,
        topic,
        difficulty,
      });
      setTitle(result.title);
      setDescription(result.description);
      setTagsInput(result.tags.join(', '));
      toast.success('AI suggestions applied — review and edit before publishing');
    } catch (err: any) {
      toast.error(err?.message || 'Could not generate suggestions right now');
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleUpload = async () => {
    if (!videoFile || !user) {
      toast.error('Choose a video file first');
      return;
    }
    if (!title.trim()) {
      toast.error('Give the video a title');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = videoFile.name.split('.').pop();
      const path = `library/${user.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('response-videos')
        .upload(path, videoFile, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data: signedData } = await supabase.storage
        .from('response-videos')
        .createSignedUrl(uploadData.path, 3600);

      const { error: insertError } = await supabase.from('videos').insert({
        title: title.trim(),
        description: description.trim() || null,
        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
        video_url: signedData?.signedUrl || '',
        video_storage_path: uploadData.path,
        video_storage_bucket: 'response-videos',
        subject: subject || null,
        topic: topic.trim() || null,
        difficulty: difficulty || null,
        creator_id: user.id,
        creator_name: profile?.full_name || profile?.email || null,
        status: 'published',
      });
      if (insertError) throw insertError;

      toast.success('Video published to the library!');
      router.push('/creator/videos');
    } catch (err: any) {
      toast.error(`Upload failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Upload Explanation Video" subtitle="Publish a video to the library for students to find on their own." />

      <Card>
        <CardContent className="p-6 space-y-5">
          {!videoFile ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl py-12 cursor-pointer hover:border-primary/50 transition-colors">
              <VideoIcon className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Click to choose a video file</p>
              <p className="text-xs text-muted-foreground mt-1">MP4, MOV, WebM — up to 500MB</p>
              <input type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
            </label>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
              <span className="text-sm truncate">{videoFile.name}</span>
              <Button variant="ghost" size="icon" onClick={() => setVideoFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Solving systems of equations by substitution" />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will a student learn from this video?"
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input id="tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="linear equations, substitution, systems" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Subject</Label>
              <Select value={subject} onValueChange={(v) => setSubject(v as any)}>
                <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="math">Math</SelectItem>
                  <SelectItem value="reading">Reading</SelectItem>
                  <SelectItem value="writing">Writing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Algebra" />
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as any)}>
                <SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button variant="outline" className="w-full gap-2" onClick={handleSuggestMetadata} disabled={isSuggesting}>
            {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Suggest title, description & tags with AI
          </Button>

          <Button className="w-full gap-2" onClick={handleUpload} disabled={isUploading}>
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Publish to Library
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
