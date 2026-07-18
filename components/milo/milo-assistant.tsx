'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bot,
  X,
  Send,
  Calculator,
  BookOpen,
  Pencil,
  Lightbulb,
  TrendingUp,
  Sparkles,
  Loader2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { getAIProvider } from '@/lib/ai';
import { toast } from 'sonner';
import { MarkdownContent } from '@/components/ui/markdown-content';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: string;
  timestamp: Date;
}

const quickActions = [
  { id: 'question', label: 'Ask Question', icon: Lightbulb, prompt: 'Help me understand this SAT question: ' },
  { id: 'calculation', label: 'Math Help', icon: Calculator, prompt: 'Walk me through this math problem step by step: ' },
  { id: 'grammar', label: 'Grammar', icon: BookOpen, prompt: 'Explain this grammar rule: ' },
  { id: 'writing', label: 'Writing', icon: Pencil, prompt: 'Help me improve this writing: ' },
  { id: 'concept', label: 'Concept', icon: TrendingUp, prompt: 'Explain this SAT concept: ' },
];

interface MiloAssistantProps {
  /** When true, the component never renders its own corner bubble trigger — some other UI (e.g. FloatingMilo) controls when it opens. */
  hideTrigger?: boolean;
  /** Controlled open state, used together with hideTrigger. Falls back to internal state when omitted. */
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function MiloAssistant({ hideTrigger = false, externalOpen, onExternalOpenChange }: MiloAssistantProps = {}) {
  const { user } = useAuth();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalIsOpen;
  const setIsOpen = useCallback(
    (value: boolean) => {
      setInternalIsOpen(value);
      onExternalOpenChange?.(value);
    },
    [onExternalOpenChange]
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && user && !conversationId) {
      initConversation();
    }
  }, [isOpen, user, conversationId]);

  const initConversation = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('milo_conversations')
        .insert({ user_id: user.id, title: 'New Chat' })
        .select('id')
        .single();
      if (!error && data) setConversationId(data.id);
    } catch {
      // Local mode fallback
    }
  };

  // Handle image selection for screenshot analysis
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setImageUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/milo/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('milo-uploads')
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = await supabase.storage
        .from('milo-uploads')
        .createSignedUrl(data.path, 3600);

      if (urlData?.signedUrl) {
        setPendingImage(urlData.signedUrl);
      }
    } catch (error: any) {
      toast.error('Failed to upload image');
      console.error('Image upload error:', error);
    } finally {
      setImageUploading(false);
    }
  };

  const handleSend = useCallback(async (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text || isLoading) return;

    const attachedImageUrl = pendingImage;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: pendingImage ? `[Image attached]\n\n${text}` : text,
      type: 'chat',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setPendingImage(null); // Clear pending image after sending
    setIsLoading(true);

    try {
      // Save user message to DB
      if (conversationId && user) {
        await supabase.from('milo_messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content: text,
          message_type: 'chat',
        });

        // Fix: increment interaction count via RPC or upsert with increment
        const { data: existing } = await supabase
          .from('user_learning_profiles')
          .select('total_ai_interactions')
          .eq('user_id', user.id)
          .maybeSingle();

        const newCount = (existing?.total_ai_interactions ?? 0) + 1;
        await supabase.from('user_learning_profiles').upsert(
          { user_id: user.id, total_ai_interactions: newCount },
          { onConflict: 'user_id' }
        );
      }

      // Give Milo the last few turns so replies feel like one ongoing
      // conversation instead of a series of one-shot answers.
      const recentHistory = messages
        .slice(-6)
        .map((m) => `${m.role === 'user' ? 'Student' : 'Milo'}: ${m.content}`)
        .join('\n');

      const aiProvider = getAIProvider();
      const aiResult = await aiProvider.generateResponse({
        type: 'follow-up',
        content: text,
        attachments: attachedImageUrl ? [{ type: 'image', url: attachedImageUrl }] : undefined,
        context: recentHistory ? { previousContext: recentHistory } : undefined,
      });

      const responseContent =
        aiResult.success && aiResult.data?.explanation
          ? aiResult.data.explanation
          : aiResult.error || "I'm having trouble responding right now — mind trying that again in a moment?";

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        type: 'chat',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (conversationId) {
        await supabase.from('milo_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: responseContent,
          message_type: 'chat',
        });
      }
    } catch (error: any) {
      console.error('Milo error:', error);
      toast.error(`Failed to send message: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, conversationId, user]);

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setInput('');
    if (user) initConversation();
  };

  // Simple markdown-like rendering: bold **text**
  if (hideTrigger && !isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Floating Button */}
      {!isOpen && !hideTrigger && (
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="h-14 w-14 rounded-full shadow-xl bg-gradient-milo glow-milo border-0 hover:scale-105 transition-all"
        >
          <Bot className="h-6 w-6 text-milo-foreground" />
          <span className="sr-only">Open Milo</span>
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={cn(
            'bg-card border rounded-2xl shadow-2xl flex flex-col transition-all duration-300',
            isExpanded ? 'w-96 h-[620px]' : 'w-80 h-[480px]'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-milo/5 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-milo glow-milo flex items-center justify-center">
                <Bot className="h-5 w-5 text-milo-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Milo</h3>
                <div className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-success" />
                  <p className="text-xs text-muted-foreground">SAT Tutor</p>
                </div>
              </div>
              <Badge variant="secondary" className="ml-1 text-xs">
                <Sparkles className="h-2.5 w-2.5 mr-1" />AI
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handleNewChat} className="h-7 w-7" title="New chat">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="h-7 w-7">
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-7 w-7">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          {messages.length === 0 && (
            <div className="flex gap-1 p-2 border-b overflow-x-auto scrollbar-hide">
              {quickActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => setInput(action.prompt)}
                  className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <action.icon className="h-3 w-3" />
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 pb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-milo glow-milo flex items-center justify-center">
                  <Bot className="h-6 w-6 text-milo-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Hi, I'm Milo!</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Your SAT prep assistant. Ask me about any math, reading, or writing concept.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                  {['Explain quadratics', 'Grammar tips', 'Reading strategy'].map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="text-xs px-2.5 py-1 rounded-full border border-milo/30 text-milo hover:bg-milo/10 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-sm'
                        : 'bg-milo/10 border border-milo/15 rounded-bl-sm'
                    )}
                  >
                    {msg.role === 'assistant' ? <MarkdownContent content={msg.content} className="text-sm" /> : <p>{msg.content}</p>}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-milo/10 border border-milo/15 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-milo/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-milo/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 rounded-full bg-milo/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t space-y-2">
            {/* Pending image preview */}
            {pendingImage && (
              <div className="relative inline-block">
                <img src={pendingImage} alt="Uploaded screenshot" className="h-16 rounded border" />
                <button
                  onClick={() => setPendingImage(null)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Ask about any SAT topic…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                className="flex-1 text-sm h-9"
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageUploading}
                className="h-9 w-9 flex-shrink-0"
                title="Upload screenshot"
              >
                {imageUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
              </Button>
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-9 w-9 flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
