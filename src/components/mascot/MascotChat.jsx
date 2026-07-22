import React, { useState, useRef, useEffect } from "react";
import { X, Minus, Maximize2, Minimize2, Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import MascotFace from "./MascotFace";
import { chatWithMilo } from "@/lib/milo";

const SUBJECTS = ["Math", "Reading", "Writing"];

const GREETING = {
  role: "assistant",
  text: "Hey! I'm Milo, your SAT buddy. Stuck on something? Ask me anything — or just fling me around if you need a break. 😄",
};

const READY_MSGS = [
  "Done! Tap to see what I found.",
  "Finished! Come take a look.",
  "Your answer's ready — tap me!",
  "Just wrapped that up. 👀",
  "Ping! Got your explanation.",
  "All set — come read it!",
];

export function pickReadyMsg() {
  return READY_MSGS[Math.floor(Math.random() * READY_MSGS.length)];
}

/**
 * Conversational Milo chat — a support-widget style side panel.
 * - Slides in from bottom-right
 * - Can be minimized (collapses to the floating mascot with a notification dot)
 * - Can go fullscreen on small screens
 * - Conversation history persists while mounted
 * - Calls onUnread(msg) when AI responds while the panel is closed
 */
export default function MascotChat({ open, fullscreen, onClose, onToggleFullscreen, config, onUnread }) {
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState("Math");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const openRef = useRef(open);

  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (overrideText) => {
    const q = (overrideText ?? input).trim();
    if (!q || loading) return;
    const userMsg = { role: "user", text: q };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const res = await chatWithMilo({ messages: newMsgs, subject });
      const aiMsg = { role: "assistant", text: res.answer };
      setMessages((m) => [...m, aiMsg]);
      if (!openRef.current) onUnread?.(pickReadyMsg());
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Hmm, my gears jammed for a second — mind trying again?" }]);
      if (!openRef.current) onUnread?.(pickReadyMsg());
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const containerClass = fullscreen
    ? "fixed inset-2 sm:inset-4 z-[10000]"
    : "fixed bottom-24 right-3 sm:right-6 z-[10000] w-[calc(100vw-1.5rem)] sm:w-[380px]";

  const innerClass = fullscreen
    ? "h-full"
    : "h-[62vh] max-h-[560px]";

  return (
    <div className={`${containerClass} flex flex-col`}>
      <div className={`flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden ${innerClass}`}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
          <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <MascotFace config={config} size={34} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Milo</p>
            <p className="text-[10px] text-emerald-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
            </p>
          </div>
          <button onClick={onToggleFullscreen} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title={fullscreen ? "Restore" : "Expand"}>
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Minimize">
            <Minus className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-background/40">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 mr-2 mt-1 self-end">
                  <MascotFace config={config} size={26} />
                </div>
              )}
              <div
                className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary text-secondary-foreground rounded-bl-md"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 mr-2 mt-1 self-end">
                <MascotFace config={config} size={26} />
              </div>
              <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-2.5 border-t border-border bg-card">
          <div className="flex items-center gap-2 mb-2">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={`text-[10px] font-medium px-2 py-1 rounded-full transition-colors ${
                  subject === s ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask Milo anything…"
              rows={1}
              className="flex-1 resize-none bg-background border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring max-h-24"
            />
            <Button size="icon" onClick={() => send()} disabled={loading || !input.trim()} className="shrink-0 h-9 w-9">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}