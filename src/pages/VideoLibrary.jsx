const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

import PageHeader from "@/components/ui-bits/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Video, Search, Play, Eye, Sparkles, Upload, Inbox, TrendingUp } from "lucide-react";

export default function VideoLibrary() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [videos, setVideos] = useState([]);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [weakTopics, setWeakTopics] = useState([]);
  const [questionTopics, setQuestionTopics] = useState([]);

  useEffect(() => {
    db.auth.me().then(setMe).catch(() => {});
    db.entities.Video.filter({ status: "published" }, "-created_date", 200).then(v => {
      setVideos(v);
      setLoading(false);
    });
  }, []);

  // Build student profile: weak topics from practice attempts + topics from questions
  useEffect(() => {
    if (!me) return;
    (async () => {
      try {
        const attempts = await db.entities.PracticeAttempt.list("-created_date", 100);
        const questions = await db.entities.Question.list("-created_date", 100);
        const topics = {};
        attempts.forEach(a => { if (!a.correct && a.topic) topics[a.topic] = (topics[a.topic] || 0) + 1; });
        const wt = Object.entries(topics).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 5);
        setWeakTopics(wt);
        const qt = {};
        questions.forEach(q => { if (q.topic) qt[q.topic] = (qt[q.topic] || 0) + 1; });
        setQuestionTopics(Object.keys(qt).sort((a, b) => qt[b] - qt[a]).slice(0, 5));
      } catch {}
    })();
  }, [me]);

  const allInterestTopics = useMemo(() => [...new Set([...weakTopics, ...questionTopics])], [weakTopics, questionTopics]);

  const filtered = useMemo(() => {
    let result = videos;
    if (subjectFilter !== "All") result = result.filter(v => v.subject === subjectFilter);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(v =>
        v.title?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q) ||
        (v.tags || []).some(t => t.toLowerCase().includes(q)) ||
        v.topic?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [videos, search, subjectFilter]);

  const recommended = useMemo(() => {
    if (allInterestTopics.length === 0) return [];
    return videos.filter(v =>
      v.status === "published" &&
      allInterestTopics.some(t => v.topic?.toLowerCase().includes(t.toLowerCase()) || (v.tags || []).some(tag => tag.toLowerCase().includes(t.toLowerCase())))
    ).slice(0, 8);
  }, [videos, allInterestTopics]);

  const isSearching = search.trim() !== "" || subjectFilter !== "All";
  const showEmpty = !loading && filtered.length === 0;

  return (
    <div>
      <PageHeader
        title="Explanation Library"
        subtitle="Browse tutor video explanations. Search by topic, subject, or keyword."
        action={
          (me?.role === "creator" || me?.role === "admin") && (
            <Button onClick={() => navigate("/videos/upload")} className="gap-2 bg-accent hover:bg-accent/90 text-white">
              <Upload className="w-4 h-4" /> Upload Video
            </Button>
          )
        }
      />

      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, topic, tag, or keyword…"
          className="pl-10 h-11 rounded-xl"
        />
      </div>

      {/* Subject filter */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {["All", "Math", "Reading", "Writing"].map(s => (
          <button key={s} onClick={() => setSubjectFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
              subjectFilter === s ? "bg-accent text-white border-accent" : "border-border text-muted-foreground hover:border-accent/50"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* FYP / Recommended for you */}
      {!isSearching && recommended.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="font-display text-lg font-semibold">Recommended for You</h2>
            <Badge variant="secondary" className="ml-1">Based on your weak spots</Badge>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommended.map(v => <VideoCard key={v.id} video={v} />)}
          </div>
        </div>
      )}

      {/* All / Search results */}
      {!isSearching && (
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-display text-lg font-semibold">All Explanations</h2>
        </div>
      )}

      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-video rounded-xl bg-secondary/40 animate-pulse" />)}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => <VideoCard key={v.id} video={v} />)}
        </div>
      )}

      {/* Empty state */}
      {showEmpty && (
        <Card className="p-12 text-center">
          <Inbox className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <h3 className="font-display text-lg font-semibold mb-2">
            {isSearching ? "No videos match your search" : "No videos yet"}
          </h3>
          <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
            {isSearching
              ? "Looks like no videos are available for this. Be the first to request one, or ask our AI for help right now."
              : "The library is empty. Be the first to get help — ask a tutor or our AI."}
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate("/request-tutor")} variant="outline" className="gap-2">
              <Video className="w-4 h-4" /> Request a Tutor
            </Button>
            <Button onClick={() => navigate("/ask")} className="gap-2 bg-accent hover:bg-accent/90 text-white">
              <Sparkles className="w-4 h-4" /> Ask AI (Milo)
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function VideoCard({ video }) {
  return (
    <Link to={`/videos/${video.id}`}>
      <Card className="overflow-hidden group hover:border-accent hover:shadow-md transition-all cursor-pointer">
        {/* Thumbnail */}
        <div className="aspect-video bg-secondary relative overflow-hidden">
          {video.thumbnail_url ? (
            <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/10">
              <Play className="w-10 h-10 text-muted-foreground/40 group-hover:text-accent transition-colors" />
            </div>
          )}
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded-md flex items-center gap-1">
            <Eye className="w-3 h-3" /> {video.views || 0}
          </div>
        </div>
        {/* Info */}
        <div className="p-3">
          <h3 className="font-medium text-sm line-clamp-2 leading-snug mb-1.5">{video.title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">{video.subject}</Badge>
            {video.topic && <Badge variant="outline" className="text-[10px]">{video.topic}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{video.creator_name || "Cognify Tutor"}</p>
        </div>
      </Card>
    </Link>
  );
}