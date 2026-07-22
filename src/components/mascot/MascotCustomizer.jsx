import React, { useState } from "react";
import { Sparkles, ShoppingBag, Trophy, Palette, Coins, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MascotFace from "./MascotFace";

const TABS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "shop", label: "Shop", icon: ShoppingBag },
  { id: "rewards", label: "Rewards", icon: Trophy },
];

const REWARDS = [
  { label: "Correct answer", cogs: 10, icon: "✓" },
  { label: "Daily Challenge complete", cogs: 50, icon: "★" },
  { label: "Challenge Mode streak", cogs: 25, icon: "🔥" },
  { label: "Ask Milo a question", cogs: 5, icon: "✨" },
  { label: "Request a tutor", cogs: 15, icon: "💬" },
  { label: "Perfect practice session", cogs: 75, icon: "🏆" },
  { label: "Daily login streak", cogs: 20, icon: "📅" },
];

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#6366f1"];

/**
 * Reusable Milo customization card — used by the Wardrobe page.
 * Ready for future cosmetic items (accessories, clothing, hair) with drag-to-place positions.
 */
export default function MascotCustomizer({ profile, onSaveConfig, onSaveDone }) {
  const [tab, setTab] = useState("appearance");
  const [eyeStyle, setEyeStyle] = useState(profile?.mascot_config?.eye_style || "round");
  const [mouthStyle, setMouthStyle] = useState(profile?.mascot_config?.mouth_style || "smile");
  const [baseColor, setBaseColor] = useState(profile?.mascot_config?.base_color || "#3b82f6");

  const previewConfig = { eye_style: eyeStyle, mouth_style: mouthStyle, base_color: baseColor };

  const handleSave = async () => {
    await onSaveConfig?.({ eye_style: eyeStyle, mouth_style: mouthStyle, base_color: baseColor });
    onSaveDone?.();
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          <h2 className="font-display text-lg font-semibold">Milo's Wardrobe</h2>
        </div>
        <Badge className="bg-amber-400/15 text-amber-500 border-amber-400/30">
          <Coins className="w-3.5 h-3.5 mr-1" />
          {profile?.credits ?? 0} <span className="ml-1 text-[10px] uppercase tracking-wide">Cogs</span>
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors ${
              tab === t.id ? "text-accent border-b-2 border-accent" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="p-5 max-h-[60vh] overflow-y-auto">
        {tab === "appearance" && (
          <div className="space-y-5">
            <div className="flex flex-col items-center py-2">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-accent/10 blur-xl scale-150" />
                <div className="relative w-32 h-32 rounded-3xl bg-gradient-to-b from-accent/5 to-transparent border border-accent/20 flex items-center justify-center">
                  <MascotFace config={previewConfig} size={120} animate />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Your buddy Milo — more cosmetics &amp; drag-to-place accessories coming soon!
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Body Color</p>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBaseColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${baseColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Eyes</p>
              <div className="grid grid-cols-3 gap-2">
                {[["round", "Round"], ["happy", "Happy"], ["wink", "Wink"]].map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setEyeStyle(v)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all ${
                      eyeStyle === v ? "border-accent bg-accent/10" : "border-border hover:bg-secondary"
                    }`}
                  >
                    <MascotFace config={{ ...previewConfig, eye_style: v, mouth_style: "smile" }} size={36} />
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Mouth</p>
              <div className="grid grid-cols-3 gap-2">
                {[["smile", "Smile"], ["grin", "Grin"], ["ooh", "Surprised"]].map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setMouthStyle(v)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all ${
                      mouthStyle === v ? "border-accent bg-accent/10" : "border-border hover:bg-secondary"
                    }`}
                  >
                    <MascotFace config={{ ...previewConfig, eye_style: "round", mouth_style: v }} size={36} />
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-border p-4 text-center">
              <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Accessories &amp; Clothing</p>
              <p className="text-xs text-muted-foreground mt-1">
                Chains, bowties, earrings, hats, shirts &amp; more — drag-to-place cosmetics unlock in the Shop soon.
              </p>
            </div>

            <Button onClick={handleSave} className="w-full">
              Save Look
            </Button>
          </div>
        )}

        {tab === "shop" && (
          <div className="space-y-3">
            <div className="text-center py-6">
              <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">The Cog Shop is opening soon!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Spend Cogs on cosmetics — hats, chains, glasses, outfits &amp; accessories you can drag anywhere on Milo.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {["Premium Hat", "Gold Chain", "Cool Shades", "Bowtie", "Headphones", "Designer Jacket"].map((item) => (
                <div key={item} className="rounded-xl border border-dashed border-border p-4 text-center opacity-60">
                  <Lock className="w-4 h-4 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">{item}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Coming soon</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "rewards" && (
          <div className="space-y-2.5">
            <p className="text-sm text-muted-foreground mb-2">Earn Cogs by using Cognify:</p>
            {REWARDS.map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-sm">{r.icon}</span>
                  <span className="text-sm font-medium">{r.label}</span>
                </div>
                <Badge className="bg-amber-400/15 text-amber-500 border-amber-400/30">
                  +{r.cogs} <span className="text-[10px] ml-0.5">Cogs</span>
                </Badge>
              </div>
            ))}
            <div className="rounded-xl bg-accent/5 border border-accent/20 p-4 mt-2">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-accent" />
                <p className="text-sm font-semibold">Leaderboards &amp; Featured Milos</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Compete for top Cogs, longest streaks &amp; best-dressed Milo. Weekly featured community picks coming soon.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}