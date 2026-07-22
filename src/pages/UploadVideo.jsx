const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "@/components/ui-bits/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Video, X, Save, Tag } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const SUBJECTS = ["Math", "Reading", "Writing"];
const COMMON_TAGS = ["Algebra", "Geometry", "Linear Equations", "Grammar", "Punctuation", "Main Idea", "Inference", "Word Problems", "Statistics", "Ratios", "Exponents", "Subject-Verb Agreement", "Transitions", "Vocabulary", "Data Interpretation", "Graph Analysis", "SAT Strategy", "Pacing", "Elimination", "Plugging In"];

export default function UploadVideo() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [subject, setSubject] = useState("Math");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [videoUrl, setVideoUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [saving, setSaving] = useState(false);

  const addTag = (t) => {
    const clean = t.trim();
    if (clean && !tags.includes(clean)) setTags([...tags, clean]);
    setTagInput("");
  };
  const removeTag = (t) => setTags(tags.filter(x => x !== t));

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setVideoUrl(file_url);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
    } catch { toast({ title: "Upload failed", variant: "destructive" }); }
    finally { setUploadingVideo(false); }
  };

  const handleThumbUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setThumbnailUrl(file_url);
    } catch { toast({ title: "Upload failed", variant: "destructive" }); }
    finally { setUploadingThumb(false); }
  };

  const save = async () => {
    if (!title.trim()) { toast({ title: "Title is required" }); return; }
    if (!videoUrl) { toast({ title: "Please upload a video file" }); return; }
    setSaving(true);
    try {
      const me = await db.auth.me();
      await db.entities.Video.create({
        title: title.trim(),
        description: description.trim(),
        tags,
        subject,
        topic: topic.trim() || undefined,
        difficulty,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl || undefined,
        creator_id: me.id,
        creator_name: me.full_name || "Cognify Tutor",
        views: 0,
        status: "published",
      });
      toast({ title: "Video published to library!" });
      navigate("/videos");
    } catch {
      toast({ title: "Failed to publish", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Upload Explanation Video" subtitle="Publish a video explanation to the student library." />

      <Card className="p-6 space-y-5">
        {/* Video upload */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 block">Video File *</label>
          <label className={`flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
            videoUrl ? "border-accent/40 bg-accent/5" : "border-border hover:border-accent/40"
          }`}>
            {uploadingVideo ? <Loader2 className="w-8 h-8 animate-spin text-accent" /> :
             videoUrl ? <Video className="w-8 h-8 text-accent" /> :
             <Upload className="w-8 h-8 text-muted-foreground" />}
            <span className="text-sm text-muted-foreground">
              {uploadingVideo ? "Uploading…" : videoUrl ? "Video uploaded — click to replace" : "Click to upload a video file"}
            </span>
            <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
          </label>
          {videoUrl && <video src={videoUrl} controls className="w-full mt-3 rounded-xl border border-border max-h-48" />}
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Title *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Solving Linear Equations: Step-by-Step Guide" />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Description</label>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will students learn from this video?" className="resize-none" />
        </div>

        {/* Subject / Topic / Difficulty */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm">
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Topic</label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Linear Equations" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm">
              <option>Easy</option><option>Medium</option><option>Hard</option>
            </select>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Tags</label>
          <div className="flex gap-2 mb-2">
            <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); } }}
              placeholder="Type a tag and press Enter" />
            <Button variant="outline" size="sm" onClick={() => addTag(tagInput)}>Add</Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(t => (
                <Badge key={t} variant="secondary" className="gap-1 pr-1">
                  <Tag className="w-3 h-3" />
                  {t}
                  <button onClick={() => removeTag(t)} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mb-1.5">Suggested tags:</p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_TAGS.filter(t => !tags.includes(t)).slice(0, 10).map(t => (
              <button key={t} onClick={() => addTag(t)} className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:border-accent/50 hover:text-accent transition-all">
                + {t}
              </button>
            ))}
          </div>
        </div>

        {/* Thumbnail */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 block">Thumbnail (optional)</label>
          <label className={`flex items-center gap-3 p-3.5 border border-dashed rounded-xl cursor-pointer transition-all ${
            thumbnailUrl ? "border-accent/40 bg-accent/5" : "border-border hover:border-accent/40"
          }`}>
            {uploadingThumb ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
            <span className="text-sm text-muted-foreground flex-1">{thumbnailUrl ? "Thumbnail uploaded — click to replace" : "Upload a custom thumbnail"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} />
          </label>
          {thumbnailUrl && <img src={thumbnailUrl} alt="" className="mt-2 rounded-lg border max-h-24" />}
        </div>

        <Button onClick={save} disabled={saving || uploadingVideo} size="lg" className="w-full gap-2 bg-accent hover:bg-accent/90 text-white">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Publishing…" : "Publish to Library"}
        </Button>
      </Card>
    </div>
  );
}