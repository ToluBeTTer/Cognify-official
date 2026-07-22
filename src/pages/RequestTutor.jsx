const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/ui-bits/PageHeader";
import { UserRound, Upload, X, Loader2, Send, CheckCircle2, Video } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const SUBJECTS = ["Math", "Reading", "Writing"];
const TOPICS = {
  Math: ["Algebra", "Geometry", "Statistics", "Advanced Math", "Word Problems", "Other"],
  Reading: ["Main Idea", "Inference", "Vocabulary", "Evidence", "Passage Analysis", "Other"],
  Writing: ["Grammar", "Punctuation", "Sentence Structure", "Transitions", "Style", "Other"],
};

export default function RequestTutor() {
  const { toast } = useToast();
  const [subject, setSubject] = useState("Math");
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setImageUrl(file_url);
    } catch { toast({ title: "Upload failed", variant: "destructive" }); }
    finally { setUploading(false); }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setVideoUrl(file_url);
    } catch { toast({ title: "Upload failed", variant: "destructive" }); }
    finally { setUploadingVideo(false); }
  };

  const handleSubmit = async () => {
    if (!text.trim() && !imageUrl) {
      toast({ title: "Please describe your question first." });
      return;
    }
    setSending(true);
    try {
      const me = await db.auth.me();
      await db.entities.Question.create({
        text: text.trim() || "See attached image/video",
        subject,
        topic: topic || undefined,
        image_url: imageUrl || undefined,
        tutor_response_video: videoUrl || undefined,
        status: "new",
        escalated: true,
      });
      await db.entities.Notification.create({
        user_id: me.id,
        title: "Tutor request sent!",
        message: "A tutor will review your question soon. Check My Requests for updates.",
        type: "system",
      });
      setSent(true);
    } catch {
      toast({ title: "Failed to send request", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="font-display text-2xl font-semibold mb-2">Request sent!</h2>
        <p className="text-muted-foreground mb-6">A tutor will review your question and respond. You can track it in My Requests.</p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => setSent(false)}>Send another</Button>
          <Button onClick={() => window.location.href = "/requests"}>View My Requests</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <PageHeader
        title="Ask a Tutor"
        subtitle="Submit your question directly to a human tutor — no AI, just expert help."
      />

      <Card className="p-6 space-y-5">
        {/* Subject */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Subject</p>
          <div className="flex gap-2">
            {SUBJECTS.map((s) => (
              <button key={s} onClick={() => { setSubject(s); setTopic(""); }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  subject === s ? "bg-accent text-white border-accent" : "border-border text-muted-foreground hover:border-accent/50"
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Topic */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Topic (optional)</p>
          <div className="flex flex-wrap gap-2">
            {TOPICS[subject].map((t) => (
              <button key={t} onClick={() => setTopic(topic === t ? "" : t)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  topic === t ? "bg-accent text-white border-accent" : "border-border text-muted-foreground hover:border-accent/50"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Question text */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Your question</p>
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="resize-none bg-card border-border/80 rounded-xl placeholder:text-muted-foreground/40 focus:border-accent/50"
            placeholder="Describe what you're stuck on. Be specific — the more detail you give, the better your tutor can help."
          />
        </div>

        {/* Image upload */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Attachments (optional)</p>
          <div className="space-y-2">
            <label className={`flex items-center gap-3 p-3.5 border border-dashed rounded-xl cursor-pointer transition-all ${
              imageUrl ? "border-accent/40 bg-accent/5" : "border-border hover:border-accent/40"
            }`}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm text-muted-foreground flex-1">{imageUrl ? "Image attached" : "Attach a screenshot or image"}</span>
              {imageUrl && (
                <button type="button" onClick={(e) => { e.preventDefault(); setImageUrl(""); }}>
                  <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </button>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            {imageUrl && <img src={imageUrl} alt="Attached" className="rounded-xl border border-border max-h-40 object-contain" />}

            <label className={`flex items-center gap-3 p-3.5 border border-dashed rounded-xl cursor-pointer transition-all ${
              videoUrl ? "border-purple-500/40 bg-purple-500/5" : "border-border hover:border-purple-500/30"
            }`}>
              {uploadingVideo ? <Loader2 className="w-4 h-4 animate-spin text-purple-400" /> : <Video className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm text-muted-foreground flex-1">{videoUrl ? "Video attached" : "Attach a video (e.g. recording yourself solving it)"}</span>
              {videoUrl && (
                <button type="button" onClick={(e) => { e.preventDefault(); setVideoUrl(""); }}>
                  <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                </button>
              )}
              <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
            </label>
            {videoUrl && <video src={videoUrl} controls className="rounded-xl border border-border w-full max-h-40" />}
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={sending}
          size="lg"
          className="w-full bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold gap-2"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending…" : "Send to Tutor"}
        </Button>
      </Card>
    </div>
  );
}