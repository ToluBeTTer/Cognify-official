import React from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy } from "lucide-react";

export default function SessionSummary({ correct, total, mode, onExit, onRetry }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  return (
    <div className="max-w-md mx-auto text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
        <Trophy className="w-8 h-8 text-accent" />
      </div>
      <h2 className="font-display text-3xl font-semibold">Session complete!</h2>
      <p className="text-muted-foreground mt-2">
        You got <span className="font-semibold text-foreground">{correct}</span> of {total} correct ({pct}%).
      </p>
      <Progress value={pct} className="my-6" />
      <div className="flex gap-3 justify-center">
        <Button variant="outline" onClick={onExit}>Study Hub</Button>
        <Button onClick={onRetry}>Practice again</Button>
      </div>
    </div>
  );
}