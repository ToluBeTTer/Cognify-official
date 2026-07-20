'use client';

import { useState, useEffect, useCallback } from 'react';
import { MiloFace } from './milo-face';
import { MASCOT_CATALOG, RARITY_COLOR, type ItemCategory } from '@/lib/mascot/catalog';
import type { MascotProfileData } from '@/hooks/use-mascot-profile';
import { Button } from '@/components/ui/button';
import { X, Coins, Check, Lock, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES: { key: ItemCategory; label: string }[] = [
  { key: 'color', label: 'Color' },
  { key: 'eyes', label: 'Eyes' },
  { key: 'mouth', label: 'Mouth' },
  { key: 'nose', label: 'Nose' },
  { key: 'hair', label: 'Hair' },
  { key: 'accessory', label: 'Accessories' },
  { key: 'clothing', label: 'Clothing' },
  { key: 'bg', label: 'Background' },
];

const POSITIONABLE: ItemCategory[] = ['hair', 'accessory', 'clothing'];
const NUDGE = 2;

interface MiloWardrobeProps {
  profile: MascotProfileData;
  onEquip: (category: ItemCategory, itemId: string) => Promise<void>;
  onPurchase: (itemId: string) => Promise<boolean>;
  onSaveOffset?: (category: string, dx: number, dy: number) => Promise<void>;
  onClose: () => void;
}

export function MiloWardrobe({ profile, onEquip, onPurchase, onSaveOffset, onClose }: MiloWardrobeProps) {
  const [activeCategory, setActiveCategory] = useState<ItemCategory>('color');
  const items = MASCOT_CATALOG.filter((i) => i.category === activeCategory);
  const canPosition = POSITIONABLE.includes(activeCategory) && profile.equippedItems[activeCategory]?.split('-')[1] !== 'none';

  const offset = profile.itemOffsets[activeCategory] ?? { dx: 0, dy: 0 };

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (!onSaveOffset) return;
      onSaveOffset(activeCategory, offset.dx + dx, offset.dy + dy);
    },
    [onSaveOffset, activeCategory, offset]
  );

  useEffect(() => {
    if (!canPosition) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); nudge(0, -NUDGE); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(0, NUDGE); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-NUDGE, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(NUDGE, 0); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canPosition, nudge]);

  const handleItemClick = async (itemId: string, price: number) => {
    const owned = profile.ownedItems.includes(itemId);
    if (owned) {
      await onEquip(activeCategory, itemId);
      return;
    }
    if (profile.credits < price) {
      toast.error(`Not enough Cogs — you need ${price - profile.credits} more.`);
      return;
    }
    const ok = await onPurchase(itemId);
    if (ok) {
      toast.success('Purchased! Equipping now.');
      await onEquip(activeCategory, itemId);
    } else {
      toast.error('Could not complete purchase — try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-[63] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:w-[480px] max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-display font-semibold">Customize Milo</h2>
            <p className="text-xs text-muted-foreground">Earned by studying, not idling</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-warning/10 text-warning px-2.5 py-1 rounded-full text-sm font-semibold">
              <Coins className="h-3.5 w-3.5" /> {profile.credits}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex justify-center py-5 bg-secondary/20">
          <MiloFace equipped={profile.equippedItems} size={110} expression="happy" itemOffsets={profile.itemOffsets} />
        </div>

        <div className="flex gap-1.5 px-4 py-2 overflow-x-auto border-b border-border">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveCategory(c.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                activeCategory === c.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {canPosition && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-secondary/30 border-b border-border">
            <p className="text-xs text-muted-foreground">Drag with arrow keys, or use the pad:</p>
            <div className="flex items-center gap-1">
              <div className="grid grid-cols-3 gap-0.5">
                <div />
                <button onClick={() => nudge(0, -NUDGE)} className="p-1.5 rounded-md hover:bg-secondary"><ArrowUp className="h-3 w-3" /></button>
                <div />
                <button onClick={() => nudge(-NUDGE, 0)} className="p-1.5 rounded-md hover:bg-secondary"><ArrowLeft className="h-3 w-3" /></button>
                <button onClick={() => onSaveOffset?.(activeCategory, 0, 0)} className="p-1.5 rounded-md hover:bg-secondary"><RotateCcw className="h-3 w-3" /></button>
                <button onClick={() => nudge(NUDGE, 0)} className="p-1.5 rounded-md hover:bg-secondary"><ArrowRight className="h-3 w-3" /></button>
                <div />
                <button onClick={() => nudge(0, NUDGE)} className="p-1.5 rounded-md hover:bg-secondary"><ArrowDown className="h-3 w-3" /></button>
                <div />
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 gap-3">
          {items.map((item) => {
            const owned = profile.ownedItems.includes(item.id);
            const equipped = profile.equippedItems[activeCategory] === item.id;
            const canAfford = profile.credits >= item.price;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id, item.price)}
                className={cn(
                  'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all',
                  equipped ? 'border-success bg-success/5' : 'border-border hover:border-primary/40',
                  !owned && !canAfford && 'opacity-60'
                )}
              >
                {equipped && (
                  <div className="absolute top-1.5 right-1.5 bg-success text-white rounded-full p-0.5">
                    <Check className="h-2.5 w-2.5" />
                  </div>
                )}
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold',
                    item.category === 'color' && 'border-2 border-white/20'
                  )}
                  style={
                    item.category === 'color'
                      ? { backgroundColor: `hsl(${item.color})` }
                      : { backgroundColor: `${RARITY_COLOR[item.rarity]}22`, color: RARITY_COLOR[item.rarity] }
                  }
                >
                  {item.category !== 'color' && item.name[0]}
                </div>
                <p className="text-[11px] font-medium text-center leading-tight line-clamp-2">{item.name}</p>
                {!owned && (
                  <span className="text-[10px] font-semibold flex items-center gap-0.5 text-muted-foreground">
                    {item.price === 0 ? (
                      'Free'
                    ) : (
                      <>
                        {!canAfford && <Lock className="h-2.5 w-2.5" />}
                        <Coins className="h-2.5 w-2.5" /> {item.price}
                      </>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
