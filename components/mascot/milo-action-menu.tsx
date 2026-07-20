'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircleQuestion, Sparkles, Shirt, Trophy, X } from 'lucide-react';

interface MiloActionMenuProps {
  anchorSize: number;
  getPosition: () => { x: number; y: number };
  onClose: () => void;
  onSelect: (mode: 'help' | 'chat' | 'wardrobe' | 'leaderboard') => void;
}

export function MiloActionMenu({ anchorSize, getPosition, onClose, onSelect }: MiloActionMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const { x, y } = getPosition();
    const menuWidth = 220;
    const menuHeight = 228;
    const openLeft = x + anchorSize + menuWidth > window.innerWidth;
    const openAbove = y + anchorSize + menuHeight > window.innerHeight;
    setStyle({
      left: openLeft ? x - menuWidth + anchorSize : x,
      top: openAbove ? y - menuHeight - 8 : y + anchorSize + 8,
    });
  }, [anchorSize, getPosition]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[61] w-[220px] bg-card border border-border rounded-2xl shadow-xl p-2 animate-in fade-in zoom-in-95 duration-150"
      style={style}
    >
      <button
        onClick={() => onSelect('help')}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-colors text-left"
      >
        <MessageCircleQuestion className="h-4 w-4 text-primary shrink-0" />
        <div>
          <p className="text-sm font-medium">Ask for Help</p>
          <p className="text-xs text-muted-foreground">Real SAT tutoring from Milo</p>
        </div>
      </button>
      <button
        onClick={() => onSelect('chat')}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-colors text-left"
      >
        <Sparkles className="h-4 w-4 text-milo shrink-0" />
        <div>
          <p className="text-sm font-medium">Just Chat</p>
          <p className="text-xs text-muted-foreground">Say hi, take a break</p>
        </div>
      </button>
      <button
        onClick={() => onSelect('wardrobe')}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-colors text-left"
      >
        <Shirt className="h-4 w-4 text-purple shrink-0" />
        <div>
          <p className="text-sm font-medium">Customize Milo</p>
          <p className="text-xs text-muted-foreground">Cosmetics & Cogs shop</p>
        </div>
      </button>
      <button
        onClick={() => onSelect('leaderboard')}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/60 transition-colors text-left"
      >
        <Trophy className="h-4 w-4 text-warning shrink-0" />
        <div>
          <p className="text-sm font-medium">Leaderboard</p>
          <p className="text-xs text-muted-foreground">Top studiers this term</p>
        </div>
      </button>
      <button
        onClick={onClose}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 mt-1 rounded-xl text-xs text-muted-foreground hover:bg-secondary/40 transition-colors"
      >
        <X className="h-3 w-3" /> Close
      </button>
    </div>
  );
}
