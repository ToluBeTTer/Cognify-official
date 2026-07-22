const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Check, X, Save, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { generateQuestionFromStudent } from "@/lib/questionGenerator";

export default function PromoteQuestion({ question, onClose, onSaved }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = await generateQuestionFromStudent({
        text: question.text,
        image_url: question.image_url,
        subject: question.subject,
        topic: question.topic,
      });
      setGenerated(q);
    } catch (e) {
      setError(e.message || "Failed to generate question");
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => setGenerated({ ...generated, [field]: value });
  const updateOption = (idx, value) => {
    const opts = [...generated.options];
    opts[idx] = value;
    setGenerated({ ...generated, options: opts });
  };

  const save = async () => {
    if (!generated) return;
    // Validate
    if (!generated.prompt?.trim()) { toast({ title: "Prompt cannot be empty" }); return; }
    if (generated.options.length !== 4 || generated.options.some(o => !o?.trim())) { toast({ title: "Need exactly 4 non-empty options" }); return; }
    if (generated.correct_index < 0 || generated.correct_index > 3) { toast({ title: "Correct answer index must be 0-3" }); return; }
    setSaving(true);
    try {
      await db.entities.BankQuestion.create({
        prompt: generated.prompt,
        passage: generated.passage || "",
        options: generated.options,
        correct_index: generated.correct_index,
        explanation: generated.explanation,
        subject: generated.subject,
        topic: generated.topic,
        difficulty: generated.difficulty,
        question_type: generated.question_type,
        source: "promoted",
        review_status: "published",
      });
      toast({ title: "Question added to the bank!" });
      onSaved?.();
    } catch (e) {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full my-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            <h3 className="font-display text-lg font-semibold">Promote to Question Bank</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Original question context */}
          <div className="bg-secondary/40 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Original student question</p>
            <p className="text-sm">{question.text || "Image-based question"}</p>
            <div className="flex gap-2">
              <Badge variant="secondary">{question.subject}</Badge>
              {question.topic && <Badge variant="outline">{question.topic}</Badge>}
            </div>
            {question.image_url && <img src={question.image_url} alt="" className="rounded-lg border max-h-32 mt-2" />}
          </div>

          {!generated && !loading && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">
                AI will analyze the student's question and image, then generate a proper SAT question with answer choices, explanation, and any passage/context — all editable before saving.
              </p>
              <Button onClick={generate} className="gap-2 bg-accent hover:bg-accent/90 text-white">
                <Sparkles className="w-4 h-4" /> Generate Question with AI
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p className="text-sm text-muted-foreground">Analyzing question and generating SAT format…</p>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={generate}>
                <RefreshCw className="w-4 h-4" /> Try again
              </Button>
            </div>
          )}

          {generated && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-emerald-500">
                <Check className="w-4 h-4" />
                <span>AI generated — review and edit before saving</span>
              </div>

              {/* Prompt */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Question Prompt</label>
                <Textarea rows={3} value={generated.prompt} onChange={(e) => updateField("prompt", e.target.value)} className="resize-none" />
              </div>

              {/* Passage */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Passage / Context (optional)</label>
                <Textarea rows={4} value={generated.passage || ""} onChange={(e) => updateField("passage", e.target.value)} className="resize-none" placeholder="Reading passage, graph description, or other context…" />
              </div>

              {/* Options */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Answer Options (select the correct one)</label>
                <div className="space-y-2">
                  {generated.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <button
                        onClick={() => updateField("correct_index", idx)}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-semibold shrink-0 transition-all ${
                          generated.correct_index === idx
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-border text-muted-foreground hover:border-emerald-500/50"
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </button>
                      <Input value={opt} onChange={(e) => updateOption(idx, e.target.value)} className="flex-1" />
                      {generated.correct_index === idx && <Badge className="bg-emerald-500 text-white">Correct</Badge>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Explanation */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Explanation</label>
                <Textarea rows={3} value={generated.explanation} onChange={(e) => updateField("explanation", e.target.value)} className="resize-none" />
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Subject</label>
                  <select value={generated.subject} onChange={(e) => updateField("subject", e.target.value)} className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm">
                    <option>Math</option><option>Reading</option><option>Writing</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Topic</label>
                  <Input value={generated.topic} onChange={(e) => updateField("topic", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 block">Difficulty</label>
                  <select value={generated.difficulty} onChange={(e) => updateField("difficulty", e.target.value)} className="w-full h-9 rounded-md border border-input bg-card px-3 text-sm">
                    <option>Easy</option><option>Medium</option><option>Hard</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button onClick={save} disabled={saving} className="gap-2 flex-1 bg-emerald-500 hover:bg-emerald-600 text-white">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save to Question Bank
                </Button>
                <Button variant="outline" onClick={generate} disabled={saving} className="gap-2">
                  <RefreshCw className="w-4 h-4" /> Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}