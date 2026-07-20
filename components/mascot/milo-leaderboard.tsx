'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MiloFace } from './milo-face';
import { DEFAULT_EQUIPPED, type ItemCategory } from '@/lib/mascot/catalog';
import { X, Trophy, Flame, Coins, Loader2 } from 'lucide-react';

interface LeaderboardRow {
  user_id: string;
  display_name: string;
  role: string;
  total_earned: number;
  streak_days: number;
  equipped_items: Record<ItemCategory, string>;
}

const MEDAL_COLORS = ['#f59e0b', '#94a3b8', '#b45309'];

export function MiloLeaderboard({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('mascot_leaderboard')
        .select('*')
        .limit(20);
      setRows((data as LeaderboardRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-[63] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:w-[420px] max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 sm:zoom-in-95">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            <div>
              <h2 className="font-display font-semibold">Top Studiers</h2>
              <p className="text-xs text-muted-foreground">Ranked by Cogs earned — real study activity</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && rows.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-12">
              No one's on the board yet — be the first!
            </p>
          )}
          {!loading &&
            rows.map((row, i) => (
              <div
                key={row.user_id}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/40 transition-colors"
              >
                <div
                  className="w-6 text-center font-display font-bold text-sm shrink-0"
                  style={{ color: i < 3 ? MEDAL_COLORS[i] : undefined }}
                >
                  {i + 1}
                </div>
                <MiloFace equipped={{ ...DEFAULT_EQUIPPED, ...row.equipped_items }} size={40} variant="widget" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{row.display_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{row.role}</p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className="text-xs font-semibold flex items-center gap-1 text-warning">
                    <Coins className="h-3 w-3" /> {row.total_earned}
                  </span>
                  {row.streak_days > 0 && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Flame className="h-2.5 w-2.5" /> {row.streak_days}d
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
