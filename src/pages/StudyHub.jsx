import React from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/ui-bits/PageHeader";
import { Card } from "@/components/ui/card";
import { Zap, Timer, Brain, Target, Shuffle, Flame, Trophy, Calendar, RotateCcw, Infinity, Video } from "lucide-react";

const MODES = [
  { name: "Quick Practice", desc: "A short focused set to warm up.", icon: Zap },
  { name: "Timed Practice", desc: "Simulate real SAT pacing.", icon: Timer },
  { name: "Adaptive Practice", desc: "Difficulty adjusts to you.", icon: Brain },
  { name: "Weakness Mode", desc: "Target your weak topics.", icon: Target },
  { name: "Mixed Mode", desc: "Randomized across subjects.", icon: Shuffle },
  { name: "Streak Mode", desc: "Chain correct answers.", icon: Flame },
  { name: "Challenge Mode", desc: "Difficulty adapts live to your performance.", icon: Trophy },
  { name: "Daily Challenge", desc: "A fresh set each day.", icon: Calendar },
  { name: "Review Mode", desc: "Revisit missed & saved.", icon: RotateCcw },
  { name: "Endless Practice", desc: "AI generates infinite fresh questions.", icon: Infinity },
];

export default function StudyHub() {
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="Study Hub" subtitle="Choose a practice mode and start building mastery." />

      {/* Video Library featured card */}
      <Card onClick={() => navigate("/videos")}
        className="p-5 mb-6 cursor-pointer hover:border-accent hover:shadow-md transition-all group bg-gradient-to-br from-accent/5 to-primary/5 border-accent/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 group-hover:bg-accent/20 flex items-center justify-center transition-colors shrink-0">
            <Video className="w-6 h-6 text-accent" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-semibold">Explanation Library</h3>
            <p className="text-sm text-muted-foreground">Browse video explanations from top tutors — personalized to your weak spots.</p>
          </div>
          <span className="text-accent text-sm font-medium group-hover:translate-x-1 transition-transform">Explore →</span>
        </div>
      </Card>

      <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3 px-1">Practice Modes</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODES.map((m) => (
          <Card key={m.name} onClick={() => navigate(`/practice?mode=${encodeURIComponent(m.name)}`)}
            className="p-5 cursor-pointer hover:border-accent hover:shadow-md transition-all group">
            <div className="w-11 h-11 rounded-xl bg-primary/5 group-hover:bg-accent/10 flex items-center justify-center mb-3 transition-colors">
              <m.icon className="w-5 h-5 text-primary group-hover:text-accent transition-colors" />
            </div>
            <h3 className="font-display text-lg font-semibold">{m.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{m.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}