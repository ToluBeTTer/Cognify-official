import React from "react";
import { Card } from "@/components/ui/card";

export default function StatCard({ icon: Icon, label, value, hint, accent = "text-accent" }) {
  return (
    <Card className="p-5 border-border/70">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        {Icon && <Icon className={`w-5 h-5 ${accent}`} />}
      </div>
      <p className="font-display text-3xl font-semibold mt-2">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </Card>
  );
}