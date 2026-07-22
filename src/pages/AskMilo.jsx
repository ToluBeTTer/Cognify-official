const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from "react";

import CleanText from "@/components/CleanText";
import { askMilo } from "@/lib/milo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, Upload, Loader2, Bookmark, UserRound,
  AlertTriangle, CheckCircle2, Zap, Brain, BookOpen, Target, X, Video
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const SUBJECTS = ["Math", "Reading", "Writing"];

const RESPONSE_TYPES = [
  { label: "Quick Hint", icon: Zap, description: "Just a nudge in the right direction" },
  { label: "Full Explanation", icon: Brain, description: "Step-by-step walkthrough" },
  { label: "Simplified", icon: BookOpen, description: "Plain-language breakdown" },
  { label: "SAT Strategy", icon: Target, description: "Test-taking tips & shortcuts" },
];

const RESPONSE_TYPE_MAP = {
  "Quick Hint": "Quick Hint",
  "Full Explanation": "Full Explanation",
  "Simplified": "Simplified Explanation",
  "SAT Strategy": "SAT Strategy Tip",
};

const SUGGESTION_CHIPS = [
  "Explain this step by step",
  "What's the best SAT strategy?",
  "Simplify this for me",
  "Give me just a hint",
  "Why is this the right answer?",
  "What topic does this test?",
];

export default function AskMilo() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("Math");
  const [responseType, setResponseType] = useState("Full Explanation");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [questionId, setQuestionId] = useState(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setImageUrl(file_url);
      toast({ title: "Image attached", description: "Milo will read and analyze it." });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setVideoUrl(file_url);
      toast({ title: "Video attached", description: "Tutor can view this with your question." });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleAsk = async (promptOverride) => {
    const questionText = promptOverride || text;
    if (!questionText.trim() && !imageUrl) {
      toast({ title: "Add your question first" });
      return;
    }
    if (promptOverride) setText(promptOverride);
    setLoading(true);
    setResult(null);
    try {
      const entityType = RESPONSE_TYPE_MAP[responseType] || responseType;
      const res = await askMilo({ text: questionText, image_url: imageUrl, subject, responseType: entityType });
      setResult(res);
      const q = await db.entities.Question.create({
        text: questionText,
        image_url: imageUrl || undefined,
        subject,
        milo_response_type: entityType,
        milo_response: res.answer,
        milo_confidence: res.confidence,
        topic: res.topic,
        status: "ai_answered",
      });
      setQuestionId(q.id);
    } catch {
      toast({ title: "Milo hit a snag", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!questionId) return;
    await db.entities.Question.update(questionId, {
      escalated: true,
      status: "new",
      tutor_response_video: videoUrl || undefined,
    });
    toast({ title: "Sent to a tutor", description: "Track it under My Requests." });
  };

  const handleSave = async () => {
    await db.entities.SavedItem.create({
      title: text.slice(0, 80) || "Milo explanation",
      content: result.answer,
      item_type: "ai_explanation",
      subject,
      source_question_id: questionId,
    });
    toast({ title: "Saved to your collection" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent" />
          </span>
          Ask Milo
        </h1>
        <p className="text-muted-foreground mt-2 ml-[52px]">Your AI study companion — instant SAT explanations, hints, and strategies.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Left: Input */}
        <div className="space-y-4">
          {/* Subject pills */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Subject</p>
            <div className="flex gap-2">
              {SUBJECTS.map((s) => (
                <button key={s} onClick={() => setSubject(s)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                    subject === s
                      ? "bg-accent text-white border-accent shadow-sm shadow-accent/30"
                      : "border-border text-muted-foreground hover:border-accent/50 hover:text-foreground"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Response type */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Help type</p>
            <div className="grid grid-cols-2 gap-2">
              {RESPONSE_TYPES.map(({ label, icon: Icon, description }) => (
                <button key={label} onClick={() => setResponseType(label)}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all duration-150 ${
                    responseType === label
                      ? "border-accent/50 bg-accent/10 text-foreground"
                      : "border-border bg-card hover:border-accent/30 text-muted-foreground hover:text-foreground"
                  }`}>
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${responseType === label ? "text-accent" : ""}`} />
                  <div>
                    <p className="text-xs font-semibold">{label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Text input */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Your question</p>
            <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)}
              className="resize-none bg-card border-border/80 rounded-xl placeholder:text-muted-foreground/40 focus:border-accent/50"
              placeholder="Paste or type the SAT question you're stuck on… or just attach a screenshot below." />
          </div>

          {/* Suggestion chips */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">Suggestions</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTION_CHIPS.map((chip) => (
                <button key={chip} onClick={() => handleAsk(chip)}
                  className="px-3 py-1.5 rounded-full text-xs border border-border bg-card hover:border-accent/50 hover:bg-accent/5 hover:text-accent text-muted-foreground transition-all duration-150">
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Attachments</p>
            <label className={`flex items-center gap-3 p-3.5 border border-dashed rounded-xl cursor-pointer transition-all duration-150 ${
              imageUrl ? "border-accent/40 bg-accent/5" : "border-border hover:border-accent/40 hover:bg-accent/5"
            }`}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm text-muted-foreground flex-1">
                {imageUrl ? "📷 Screenshot attached — Milo will read it" : "Attach a screenshot (Milo will analyze it)"}
              </span>
              {imageUrl && (
                <button type="button" onClick={(e) => { e.preventDefault(); setImageUrl(""); }}
                  className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3 h-3" />
                </button>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            {imageUrl && <img src={imageUrl} alt="Question screenshot" className="rounded-xl border border-border max-h-40 object-contain" />}

            {/* Video upload */}
            <label className={`flex items-center gap-3 p-3.5 border border-dashed rounded-xl cursor-pointer transition-all duration-150 ${
              videoUrl ? "border-purple-500/40 bg-purple-500/5" : "border-border hover:border-purple-500/30 hover:bg-purple-500/5"
            }`}>
              {uploadingVideo ? <Loader2 className="w-4 h-4 animate-spin text-purple-400" /> : <Video className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm text-muted-foreground flex-1">
                {videoUrl ? "🎥 Video attached — tutor will see this" : "Attach a video explanation (optional, sent to tutor)"}
              </span>
              {videoUrl && (
                <button type="button" onClick={(e) => { e.preventDefault(); setVideoUrl(""); }}
                  className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3 h-3" />
                </button>
              )}
              <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
            </label>
            {videoUrl && (
              <video src={videoUrl} controls className="rounded-xl border border-border w-full max-h-48" />
            )}
          </div>

          <Button onClick={() => handleAsk()} disabled={loading} size="lg" className="w-full gap-2 bg-accent hover:bg-accent/90 text-white rounded-xl shadow-lg shadow-accent/20 font-semibold">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? "Milo is thinking…" : "Ask Milo"}
          </Button>
        </div>

        {/* Right: Response */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
            <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Milo's response</p>
              {result && <p className="text-[10px] text-muted-foreground capitalize">Topic: {result.topic} · Confidence: {result.confidence}</p>}
            </div>
          </div>

          <div className="p-5 min-h-64">
            {!result && !loading && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/15 flex items-center justify-center mb-4">
                  <Sparkles className="w-7 h-7 text-accent/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Milo's explanation will appear here</p>
                <p className="text-xs text-muted-foreground/50 mt-1">Type a question, attach a screenshot, or tap a suggestion above</p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
                <p className="text-sm text-muted-foreground">
                  {imageUrl ? "Milo is reading your image…" : "Milo is thinking…"}
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {result.confidence === "low" && (
                  <div className="flex gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Milo isn't fully confident here — consider escalating to a human tutor.</span>
                  </div>
                )}
                <CleanText text={result.answer} />
              </div>
            )}
          </div>

          {result && (
            <div className="flex flex-wrap gap-2 px-5 py-4 border-t border-border/60 bg-muted/20">
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs" onClick={handleSave}>
                <Bookmark className="w-3.5 h-3.5" /> Save
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs" onClick={handleEscalate}>
                <UserRound className="w-3.5 h-3.5" /> Ask a tutor
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 rounded-xl text-xs text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => questionId && db.entities.Question.update(questionId, { status: "resolved" }).then(() => toast({ title: "Marked resolved ✓" }))}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark resolved
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}