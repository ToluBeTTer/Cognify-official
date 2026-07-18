'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Video as VideoIcon,
  Search,
  Play,
  Eye,
  Sparkles,
  Upload,
  Inbox,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoRow {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  thumbnail_url: string | null;
  subject: 'math' | 'reading' | 'writing' | null;
  topic: string | null;
  views: number;
  creator_name: string | null;
}

const SUBJECTS = ['All', 'math', 'reading', 'writing'] as const;
const SUBJECT_LABELS: Record<string, string> = { All: 'All', math: 'Math', reading: 'Reading', writing: 'Writing' };

export default function VideoLibraryPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<(typeof SUBJECTS)[number]>('All');
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [askedTopics, setAskedTopics] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('videos')
        .select('id, title, description, tags, thumbnail_url, subject, topic, views, creator_name')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(200);
      setVideos(data ?? []);
      setLoading(false);
    })();
  }, []);

  // Build a lightweight "what does this student need" signal from their own
  // recent activity — missed topics in practice, and topics they've asked
  // Milo/tutors about. This is what powers "Recommended for You" below.
  useEffect(() => {
    if (!profile?.user_id) return;
    (async () => {
      try {
        const { data: attempts } = await supabase
          .from('practice_attempts')
          .select('is_correct, domain')
          .eq('user_id', profile.user_id)
          .order('attempted_at', { ascending: false })
          .limit(150);
        const missCounts: Record<string, number> = {};
        (attempts ?? []).forEach((a: any) => {
          if (!a.is_correct && a.domain) missCounts[a.domain] = (missCounts[a.domain] || 0) + 1;
        });
        setWeakTopics(
          Object.entries(missCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([t]) => t)
            .slice(0, 5)
        );

        const { data: questions } = await supabase
          .from('questions')
          .select('title')
          .eq('user_id', profile.user_id)
          .order('created_at', { ascending: false })
          .limit(100);
        // Titles are short free-text ("Stuck during practice: <domain>...") —
        // treat distinct words as a loose topic signal alongside weakTopics.
        setAskedTopics(
          Array.from(
            new Set(
              (questions ?? [])
                .map((q: any) => q.title as string)
                .filter(Boolean)
            )
          ).slice(0, 5)
        );
      } catch {
        // best-effort personalization — library still works without it
      }
    })();
  }, [profile?.user_id]);

  const interestTopics = useMemo(
    () => Array.from(new Set([...weakTopics, ...askedTopics])),
    [weakTopics, askedTopics]
  );

  const filtered = useMemo(() => {
    let result = videos;
    if (subjectFilter !== 'All') result = result.filter((v) => v.subject === subjectFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          (v.description ?? '').toLowerCase().includes(q) ||
          (v.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
          (v.topic ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [videos, search, subjectFilter]);

  const recommended = useMemo(() => {
    if (interestTopics.length === 0) return [];
    return videos
      .filter((v) =>
        interestTopics.some(
          (t) =>
            v.topic?.toLowerCase().includes(t.toLowerCase()) ||
            (v.tags ?? []).some((tag) => tag.toLowerCase().includes(t.toLowerCase()))
        )
      )
      .slice(0, 6);
  }, [videos, interestTopics]);

  const isSearching = search.trim() !== '' || subjectFilter !== 'All';
  const showEmpty = !loading && filtered.length === 0;
  const canUpload = profile?.role === 'creator' || profile?.role === 'admin';

  return (
    <div>
      <PageHeader
        title="Explanation Library"
        subtitle="Browse tutor video explanations — search by topic, subject, or keyword."
        action={
          canUpload && (
            <Button onClick={() => router.push('/creator/videos/upload')} className="gap-2">
              <Upload className="h-4 w-4" /> Upload Video
            </Button>
          )
        }
      />

      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, topic, tag, or keyword…"
          className="pl-10 h-11 rounded-xl"
        />
      </div>

      <div className="flex gap-2 mb-8 flex-wrap">
        {SUBJECTS.map((s) => (
          <button
            key={s}
            onClick={() => setSubjectFilter(s)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium border transition-all',
              subjectFilter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            {SUBJECT_LABELS[s]}
          </button>
        ))}
      </div>

      {!isSearching && recommended.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Recommended for You</h2>
            <Badge variant="secondary" className="ml-1">Based on your weak spots</Badge>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommended.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        </div>
      )}

      {!isSearching && (
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">All Explanations</h2>
        </div>
      )}

      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-video rounded-xl bg-secondary/40 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}

      {showEmpty && (
        <Card className="p-12 text-center">
          <Inbox className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <h3 className="font-display text-lg font-semibold mb-2">
            {isSearching ? 'No videos match your search' : 'No videos yet'}
          </h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            {isSearching
              ? "Looks like there's little or nothing available for this yet. Be the first to request one, or ask our AI for help right now."
              : 'The library is empty so far. Be the first to get help — ask a tutor or Milo.'}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button variant="outline" className="gap-2" onClick={() => router.push('/questions/new')}>
              <VideoIcon className="h-4 w-4" /> Request a Tutor
            </Button>
            <Button className="gap-2" onClick={() => router.push('/ai-help')}>
              <Sparkles className="h-4 w-4" /> Ask Milo
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function VideoCard({ video }: { video: VideoRow }) {
  return (
    <Link href={`/videos/${video.id}`}>
      <Card className="overflow-hidden group hover:border-primary hover:shadow-md transition-all cursor-pointer">
        <div className="aspect-video bg-secondary relative overflow-hidden">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/10">
              <Play className="h-10 w-10 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </div>
          )}
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-md flex items-center gap-1">
            <Eye className="h-3 w-3" /> {video.views || 0}
          </div>
        </div>
        <div className="p-3">
          <h3 className="font-medium text-sm line-clamp-2 leading-snug mb-1.5">{video.title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {video.subject && (
              <Badge variant="secondary" className="text-[10px] capitalize">
                {video.subject}
              </Badge>
            )}
            {video.topic && (
              <Badge variant="outline" className="text-[10px]">
                {video.topic}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 line-clamp-1">
            {video.creator_name || 'Cognify Tutor'}
          </p>
        </div>
      </Card>
    </Link>
  );
}
