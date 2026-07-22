import React from "react";
import PageHeader from "@/components/ui-bits/PageHeader";
import MascotCustomizer from "@/components/mascot/MascotCustomizer";
import { useMascotProfile } from "@/hooks/useMascotProfile";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Sparkles } from "lucide-react";

export default function Wardrobe() {
  const { user } = useAuth();
  const { profile, saveConfig } = useMascotProfile(user);
  const { toast } = useToast();

  return (
    <div>
      <PageHeader
        title="Wardrobe"
        subtitle="Customize Milo and spend your Cogs on cosmetics."
        action={
          profile ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-500">
              <Sparkles className="w-4 h-4" />
              <span className="font-semibold text-sm">{profile.credits ?? 0}</span>
              <span className="text-xs uppercase tracking-wide">Cogs</span>
            </div>
          ) : null
        }
      />
      <div className="max-w-xl">
        <MascotCustomizer
          profile={profile}
          onSaveConfig={saveConfig}
          onSaveDone={() => toast({ title: "Looking sharp!", description: "Milo's new look is saved." })}
        />
      </div>
    </div>
  );
}