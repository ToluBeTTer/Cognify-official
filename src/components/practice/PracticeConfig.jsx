import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Settings2 } from "lucide-react";

const SUBJECTS = ["All", "Math", "Reading", "Writing"];
const DIFFICULTIES = ["All", "Easy", "Medium", "Hard", "Expert"];
const COUNTS = [5, 8, 10, 15, 20, 25];

// Modes that are infinite (no question count)
const INFINITE_MODES = ["Endless Practice", "Streak Mode"];
// Modes that are adaptive (no fixed difficulty)
const ADAPTIVE_MODES = ["Challenge Mode", "Adaptive Practice", "Weakness Mode"];

export default function PracticeConfig({ mode, onStart }) {
  const navigate = useNavigate();
  const [subject, setSubject] = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const [count, setCount] = useState(10);

  const isInfinite = INFINITE_MODES.includes(mode);
  const isAdaptive = ADAPTIVE_MODES.includes(mode);

  const handleStart = () => {
    onStart({
      subject: subject === "All" ? null : subject,
      difficulty: difficulty === "All" ? null : difficulty,
      count: isInfinite ? null : count,
    });
  };

  return (
    <div className="max-w-lg mx-auto">
      <button
        onClick={() => navigate("/study")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Study Hub
      </button>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">{mode}</h2>
            <p className="text-sm text-muted-foreground">Configure your session</p>
          </div>
        </div>

        {/* Subject */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Subject</p>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  subject === s
                    ? "bg-accent text-white border-accent"
                    : "border-border text-muted-foreground hover:border-accent/50 hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty — hidden for adaptive modes */}
        {!isAdaptive && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Difficulty</p>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    difficulty === d
                      ? "bg-accent text-white border-accent"
                      : "border-border text-muted-foreground hover:border-accent/50 hover:text-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            {isAdaptive && (
              <p className="text-xs text-muted-foreground mt-2">Difficulty adapts automatically during this mode.</p>
            )}
          </div>
        )}
        {isAdaptive && (
          <div className="text-xs text-muted-foreground bg-accent/5 border border-accent/20 rounded-xl px-4 py-3">
            🎯 <strong>Adaptive mode</strong> — difficulty adjusts automatically based on your performance.
          </div>
        )}

        {/* Question count — hidden for infinite modes */}
        {!isInfinite && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Questions</p>
            <div className="flex flex-wrap gap-2">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCount(c)}
                  className={`w-12 h-10 rounded-xl text-sm font-medium border transition-all ${
                    count === c
                      ? "bg-accent text-white border-accent"
                      : "border-border text-muted-foreground hover:border-accent/50 hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
        {isInfinite && (
          <div className="text-xs text-muted-foreground bg-accent/5 border border-accent/20 rounded-xl px-4 py-3">
            ∞ <strong>Endless mode</strong> — AI generates fresh questions as you go. No limit.
          </div>
        )}

        <Button onClick={handleStart} size="lg" className="w-full bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold gap-2">
          Start Session →
        </Button>
      </Card>
    </div>
  );
}