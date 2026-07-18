'use client';

import { useState, useRef, useEffect } from 'react';
import { getAIProvider } from '@/lib/ai';
import { useMascotProfile } from '@/hooks/use-mascot-profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send, Loader2, HelpCircle } from 'lucide-react';
import { MiloFace } from './milo-face';

interface ChatMessage {
  role: 'user' | 'milo';
  text: string;
}

export function MiloChatCasual({ onClose }: { onClose: () => void }) {
  const { profile, bumpStat } = useMascotProfile();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'milo', text: "Hey! Just here to chat if you want a break. What's up?" },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setIsSending(true);
    bumpStat('chats');

    try {
      const history = messages
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'Student' : 'Milo'}: ${m.text}`)
        .join('\n');

      const result = await getAIProvider().generateResponse({
        type: 'casual_chat',
        content: text,
        context: { previousContext: history },
      });

      const reply = result.success ? result.data?.explanation || "Hmm, I'm a little quiet right now." : "I'm having trouble hearing you right now — try again in a bit?";
      setMessages((prev) => [...prev, { role: 'milo', text: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'milo', text: "Something went wrong on my end — try again?" }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[62] w-[340px] max-w-[90vw] bg-card border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-milo/10">
        <div className="flex items-center gap-2">
          <MiloFace equipped={profile.equippedItems} size={28} />
          <div>
            <p className="text-sm font-semibold leading-tight">Milo</p>
            <p className="text-[11px] text-muted-foreground leading-tight">just hanging out</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-muted transition-colors">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 max-h-80 overflow-y-auto px-4 py-3 space-y-2.5">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-2xl px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-border space-y-2">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Say something…"
            className="flex-1"
          />
          <Button size="icon" onClick={send} disabled={isSending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <HelpCircle className="h-3 w-3" /> Need real SAT help instead? Close this and tap Milo again.
        </p>
      </div>
    </div>
  );
}
