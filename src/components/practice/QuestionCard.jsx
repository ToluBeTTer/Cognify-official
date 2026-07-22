import React, { useState } from "react";
import CleanText from "@/components/CleanText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { askMilo } from "@/lib/milo";

export default function QuestionCard({ question, selected, onSelect, onNext, nextLabel = "Next question →" }) {
  const showResult = selected != null;
  const [miloOpen, setMiloOpen] = useState(false);
  const [miloLoading, setMiloLoading] = useState(false);
  const [miloResult, setMiloResult] = useState(null);

  const handleAskMilo = async () => {
    if (miloResult) { setMiloOpen((o) => !o); return; }
    setMiloOpen(true);
    setMiloLoading(true);
    try {
      const res = await askMilo({
        text: question.passage
          ? `Passage: ${question.passage}\n\nQuestion: ${question.prompt}`
          : question.prompt,
        subject: question.subject || "Math",
        responseType: "Full Explanation",
      });
      setMiloResult(res);
    } catch {
      setMiloResult({ answer: "Milo couldn't load an explanation right now. Try again.", confidence: "low" });
    } finally {
      setMiloLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      {/* Badges */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Badge variant="outline">{question.subject}</Badge>
        {question.difficulty && <Badge variant="outline" className="capitalize">{question.difficulty}</Badge>}
        {question.topic && <Badge variant="outline">{question.topic}</Badge>}
        {question._procedural && (
          <Badge variant="outline" className="text-accent border-accent/30">AI-generated</Badge>
        )}
      </div>

      {/* Passage */}
      {question.passage && (
        <div className="text-sm text-muted-foreground italic mb-4 p-4 bg-muted/30 rounded-xl border border-border/40 leading-relaxed">
          {question.passage}
        </div>
      )}

      {/* Prompt */}
      <p className="font-medium text-lg mb-5">{question.prompt}</p>

      {/* Options */}
      <div className="space-y-2">
        {question.options.map((opt, i) => {
          const isCorrect = i === question.correct_index;
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              disabled={showResult}
              className={`w-full text-left px-4 py-3 rounded-xl border flex items-center gap-3 transition-all duration-150
                ${showResult && isCorrect ? "border-emerald-500/50 bg-emerald-500/10" : ""}
                ${showResult && selected === i && !isCorrect ? "border-red-500/50 bg-red-500/10" : ""}
                ${!showResult ? "border-border hover:border-accent/50 hover:bg-accent/5 cursor-pointer" : "border-border opacity-60"}`}
            >
              <span className="font-semibold shrink-0">{String.fromCharCode(65 + i)}.</span>
              <span className="flex-1">{opt}</span>
              {showResult && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
              {showResult && selected === i && !isCorrect && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {showResult && question.explanation && (
        <div className="mt-4 pt-4 border-t border-border/60">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">Explanation</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{question.explanation}</p>
        </div>
      )}

      {/* Ask Milo inline (only after answering) */}
      {showResult && (
        <div className="mt-4 border border-accent/20 rounded-xl overflow-hidden">
          <button
            onClick={handleAskMilo}
            className="w-full flex items-center justify-between px-4 py-3 bg-accent/5 hover:bg-accent/10 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">Ask Milo for a deeper explanation</span>
            </div>
            {miloOpen ? <ChevronUp className="w-4 h-4 text-accent" /> : <ChevronDown className="w-4 h-4 text-accent" />}
          </button>

          {miloOpen && (
            <div className="px-4 py-3 border-t border-accent/10">
              {miloLoading ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-accent" /> Milo is thinking…
                </div>
              ) : miloResult ? (
                <CleanText text={miloResult.answer} />
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Next button */}
      {showResult && (
        <Button className="w-full mt-4 rounded-xl gap-2" onClick={onNext}>
          {nextLabel}
        </Button>
      )}
    </div>
  );
}