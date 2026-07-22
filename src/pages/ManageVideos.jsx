const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import PageHeader from "@/components/ui-bits/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Sparkles, Eye, Save, X, Wand2, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { optimizeVideoMetadata } from "@/lib/adminAI";

export default function ManageVideos() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [me, setMe] = useState(null);
  const [videos, setVideos] = useState([]);
  const [editing, setEditing] = useState(null);
  const [optimizing, setOptimizing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const user = await db.auth.me();
    setMe(user);
    const all = await db.entities.Video.list("-created_date", 100);
    // Admins see all, creators see their own
    const visible = user.role === "admin" ? all : all.filter(v => v.creator_id === user.id);
    setVideos(visible);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (v) => {
    setEditing({
      ...v,
      tags: v.tags || [],
      tagsInput: "",
    });
  };

  const addTag = (t) => {
    const clean = t.trim();
    if (clean && !editing.tags.includes(clean)) setEditing({ ...editing, tags: [...editing.tags, clean] });
    setEditing({ ...editing, tagsInput: "" });
  };

  const optimize = async (v) => {
    setOptimizing(v.id);
    try {
      const result = await optimizeVideoMetadata(v);
      setEditing({
        ...v,
        title: result.title || v.title,
        description: result.description || v.description || "",
        tags: result.tags || v.tags || [],
        tagsInput: "",
      });
      toast({ title: "AI optimized metadata — review and save" });
    } catch {
      toast({ title: "AI optimization failed", variant: "destructive" });
    } finally {
      setOptimizing(null);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await db.entities.Video.update(editing.id, {
        title: editing.title,
        description: editing.description,
        tags: editing.tags,
        subject: editing.subject,
        topic: editing.topic,
        difficulty: editing.difficulty,
        thumbnail_url: editing.thumbnail_url,
      });
      toast({ title: "Video updated" });
      setEditing(null);
      load();
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (v) => {
    if (!confirm("Delete this video from the library?")) return;
    await db.entities.Video.delete(v.id);
    load();
    toast({ title: "Video removed" });
  };

  return (
    <div>
      <PageHeader
        title="Manage Videos"
        subtitle="Edit metadata, optimize with AI, or remove your library videos."
        action={
          <Button onClick={() => navigate("/videos/upload")} className="gap-2 bg-accent hover:bg-accent/90 text-white">
            <Upload className="w-4 h-4" /> Upload New
          </Button>
        }
      />

      {videos.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground">
          <p>You haven't uploaded any videos yet.</p>
        </Card>
      )}

      <div className="space-y-4">
        {videos.map(v => (
          <Card key={v.id} className="overflow-hidden">
            {editing?.id === v.id ? (
              /* Edit mode */
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">Editing</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => optimize(v)} disabled={optimizing === v.id} className="gap-1.5">
                      {optimizing === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-accent" />}
                      AI Optimize
                    </Button>
                    <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-40 shrink-0">
                    <div className="aspect-video bg-secondary rounded-lg overflow-hidden">
                      {v.thumbnail_url ? <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" /> :
                        <video src={v.video_url} className="w-full h-full object-cover" />}
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="font-medium" />
                    <Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Description" className="resize-none" />
                    <div className="grid grid-cols-3 gap-2">
                      <select value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} className="h-8 rounded-md border border-input bg-card px-2 text-xs">
                        <option>Math</option><option>Reading</option><option>Writing</option>
                      </select>
                      <Input value={editing.topic || ""} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} placeholder="Topic" className="h-8 text-xs" />
                      <select value={editing.difficulty} onChange={(e) => setEditing({ ...editing, difficulty: e.target.value })} className="h-8 rounded-md border border-input bg-card px-2 text-xs">
                        <option>Easy</option><option>Medium</option><option>Hard</option>
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {editing.tags.map((t, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 pr-1 text-xs">
                          {t}
                          <button onClick={() => setEditing({ ...editing, tags: editing.tags.filter((_, j) => j !== i) })}>
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                      <Input value={editing.tagsInput || ""} onChange={(e) => setEditing({ ...editing, tagsInput: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(editing.tagsInput || ""); } }}
                        placeholder="Add tag + Enter" className="h-7 w-32 text-xs" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveEdit} disabled={saving} size="sm" className="gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="flex gap-4 p-4">
                <div className="w-32 sm:w-40 shrink-0">
                  <div className="aspect-video bg-secondary rounded-lg overflow-hidden relative">
                    {v.thumbnail_url ? <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" /> :
                      <video src={v.video_url} className="w-full h-full object-cover" />}
                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Eye className="w-2.5 h-2.5" /> {v.views || 0}
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium line-clamp-2 mb-1">{v.title}</h3>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge variant="secondary" className="text-[10px]">{v.subject}</Badge>
                    {v.topic && <Badge variant="outline" className="text-[10px]">{v.topic}</Badge>}
                    {v.difficulty && <Badge variant="outline" className="text-[10px]">{v.difficulty}</Badge>}
                  </div>
                  {v.description && <p className="text-sm text-muted-foreground line-clamp-2">{v.description}</p>}
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => startEdit(v)} className="gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(v)} className="gap-1.5 text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}