const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";

import PageHeader from "@/components/ui-bits/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CleanText from "@/components/CleanText";
import { ArrowLeft, Eye, Tag, User } from "lucide-react";

export default function VideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const v = await db.entities.Video.get(id);
        setVideo(v);
        // Increment views
        db.entities.Video.update(id, { views: (v.views || 0) + 1 }).catch(() => {});
        // Load related
        const all = await db.entities.Video.filter({ status: "published", subject: v.subject }, "-views", 20);
        setRelated(all.filter(r => r.id !== id).slice(0, 6));
      } catch {
        // not found
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading…</div>;
  if (!video) return (
    <div className="py-20 text-center">
      <p className="text-muted-foreground mb-4">Video not found.</p>
      <Button onClick={() => navigate("/videos")} variant="outline">Back to Library</Button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/videos")} className="gap-1 mb-4 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Back to Library
      </Button>

      {/* Player */}
      <div className="rounded-2xl overflow-hidden border border-border bg-black mb-5">
        <video src={video.video_url} controls autoPlay className="w-full max-h-[60vh] aspect-video" />
      </div>

      {/* Details */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{video.title}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="w-4 h-4" /> {video.views || 0} views</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{video.subject}</Badge>
          {video.topic && <Badge variant="outline">{video.topic}</Badge>}
          {video.difficulty && <Badge variant="outline">{video.difficulty}</Badge>
          }
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="w-4 h-4" />
          <span>{video.creator_name || "Cognify Tutor"}</span>
        </div>

        {video.description && (
          <Card className="p-4">
            <CleanText text={video.description} />
          </Card>
        )}

        {video.tags && video.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            {video.tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Related */}
      {related.length > 0 && (
        <div className="mt-10">
          <h2 className="font-display text-lg font-semibold mb-4">Related in {video.subject}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {related.map(r => (
              <Link key={r.id} to={`/videos/${r.id}`}>
                <Card className="overflow-hidden group hover:border-accent transition-all cursor-pointer">
                  <div className="aspect-video bg-secondary relative">
                    {r.thumbnail_url ? (
                      <img src={r.thumbnail_url} alt={r.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Eye className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm line-clamp-2">{r.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{r.views || 0} views</p>
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