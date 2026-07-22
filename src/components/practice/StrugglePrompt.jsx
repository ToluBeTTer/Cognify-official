const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { UserRound, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

/**
 * Shown inside practice modes when a student is consistently struggling
 * on the same topic. Offers to send a tutor request.
 */
export default function StrugglePrompt({ topic, subject, sampleQuestion, onDismiss }) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      const me = await db.auth.me().catch(() => null);
      const q = await db.entities.Question.create({
        text: `[Auto-escalated from practice] I'm struggling with "${topic}" in ${subject}. Please help me understand this concept.\n\nExample question I got wrong:\n${sampleQuestion || "(see practice session)"}`,
        subject: subject || "Math",
        topic,
        status: "new",
        escalated: true,
      });
      if (me) {
        await db.entities.Notification.create({
          user_id: me.id,
          title: "Tutor request sent",
          message: `We've flagged your struggle with "${topic}" to a tutor. They'll respond soon.`,
          type: "system",
        }).catch(() => {});
      }
      setSent(true);
      toast({ title: "Request sent to a tutor!", description: "Track it in My Requests." });
    } catch {
      toast({ title: "Couldn't send request", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-card border border-amber-500/30 rounded-2xl shadow-xl p-5 animate-in slide-in-from-bottom-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <UserRound className="w-5 h-5 text-amber-400" />
          <p className="font-semibold text-sm">Milo noticed you're struggling</p>
        </div>
        <button onClick={onDismiss} className="p-1 rounded-full hover:bg-muted transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        You've missed several <strong className="text-foreground">{topic}</strong> questions in a row.
        Would you like Milo to send this to a human tutor for a personalized explanation?
      </p>

      {sent ? (
        <p className="text-sm text-emerald-500 font-medium">✓ Request sent! Check My Requests for a response.</p>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black rounded-xl gap-2 font-semibold"
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserRound className="w-3.5 h-3.5" />}
            Send to tutor
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}