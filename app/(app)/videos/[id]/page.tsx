'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { resolveLibraryVideoUrl } from '@/lib/supabase/video-url';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Eye, Loader2, Play } from 'lucide-react';

interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  video_url: string;
  video_storage_path: string | null;
  video_storage_bucket: string | null;
  thumbnail_url: string | null;
  subject: 'math' | 'reading' | 'writing' | null;
  topic: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  views: number;
  creator_name: string | null;
}

export default function VideoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [video, setVideo] = useState<VideoRow | null>(null);
  const [playableUrl, setPlayableUrl] = useState<string | null>(null);
  const [related, setRelated] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from('videos').select('*').eq('id', id).maybeSingle();
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setVideo(data as VideoRow);
      resolveLibraryVideoUrl(data as VideoRow).then(setPlayableUrl);
      supabase.rpc('increment_video_views', { p_video_id: id }).then(() => {});

      if (data.topic || (data.tags ?? []).length > 0) {
        const { data: rel } = await supabase
          .from('videos')
          .select('id, title, description, tags, video_url, video_storage_path, video_storage_bucket, thumbnail_url, subject, topic, difficulty, views, creator_name')
          .eq('status', 'published')
          .neq('id', id)
          .or(data.topic ? `topic.eq.${data.topic},subject.eq.${data.subject ?? ''}` : `subject.eq.${data.subject ?? ''}`)
          .limit(6);
        setRelated((rel as VideoRow[]) ?? []);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !video) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground mb-4">This video isn't available anymore.</p>
        <Button variant="outline" onClick={() => router.push('/videos')}>
          Back to Library
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" className="gap-2 mb-4 -ml-2" onClick={() => router.push('/videos')}>
        <ArrowLeft className="h-4 w-4" /> Back to Library
      </Button>

      <Card className="overflow-hidden mb-6">
        <div className="aspect-video bg-black">
          {playableUrl ? (
            <video src={playableUrl} controls className="w-full h-full" poster={video.thumbnail_url ?? undefined} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/50">
              <Play className="h-10 w-10" />
            </div>
          )}
        </div>
      </Card>

      <h1 className="font-display text-2xl font-semibold mb-2">{video.title}</h1>
      <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
        <span>{video.creator_name || 'Cognify Tutor'}</span>
        <span className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" /> {video.views ?? 0} views
        </span>
      </div>

      <div className="flex gap-2 flex-wrap mb-6">
        {video.subject && <Badge variant="secondary" className="capitalize">{video.subject}</Badge>}
        {video.topic && <Badge variant="outline">{video.topic}</Badge>}
        {video.difficulty && <Badge variant="outline" className="capitalize">{video.difficulty}</Badge>}
        {(video.tags ?? []).map((t) => (
          <Badge key={t} variant="outline" className="text-muted-foreground">
            #{t}
          </Badge>
        ))}
      </div>

      {video.description && (
        <Card className="p-5 mb-8">
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{video.description}</p>
        </Card>
      )}

      {related.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold mb-4">Related Explanations</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {related.map((v) => (
              <Link key={v.id} href={`/videos/${v.id}`}>
                <Card className="overflow-hidden group hover:border-primary transition-all cursor-pointer">
                  <div className="aspect-video bg-secondary flex items-center justify-center">
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                    ) : (
                      <Play className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium line-clamp-2">{v.title}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
