'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { MiloFace, type MiloExpression } from './milo-face';
import { useMascotProfile } from '@/hooks/use-mascot-profile';
import { MiloActionMenu } from './milo-action-menu';
import { MiloChatCasual } from './milo-chat-casual';
import { MiloWardrobe } from './milo-wardrobe';
import { MiloLeaderboard } from './milo-leaderboard';
import { MiloAssistant } from '@/components/milo/milo-assistant';
import { pickLine } from '@/lib/mascot/voice-lines';

const SIZE = 68;
const REST_MARGIN = 20;
const SUPER_THROW_SPEED = 2200; // triggers the secret fly-off-screen easter egg
const DIZZY_WINDOW_MS = 1500;
const DIZZY_BOUNCE_COUNT = 3;

type PanelMode = 'none' | 'menu' | 'help' | 'chat' | 'wardrobe' | 'leaderboard';

export function FloatingMilo() {
  const { profile, loading, equip, purchase, bumpStat, savePosition, saveItemOffset } = useMascotProfile();
  const [panel, setPanel] = useState<PanelMode>('none');
  const [bubble, setBubble] = useState<string | null>(null);
  const [expression, setExpression] = useState<MiloExpression>('idle');
  const [isOffscreen, setIsOffscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const dragTarget = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const isFlyingOff = useRef(false);
  const movedDistance = useRef(0);
  const lastPointer = useRef({ x: 0, y: 0, t: 0 });
  const rafRef = useRef<number | null>(null);
  const squish = useRef({ x: 1, y: 1 });
  const initializedRef = useRef(false);
  const bounceTimestamps = useRef<number[]>([]);
  const hasSavedRestRef = useRef(true);
  const expressionResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reappearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showBubble = useCallback((text: string, ms = 3000) => {
    setBubble(text);
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  }, []);

  const flashExpression = useCallback((expr: MiloExpression, ms = 500) => {
    setExpression(expr);
    if (expressionResetTimer.current) clearTimeout(expressionResetTimer.current);
    expressionResetTimer.current = setTimeout(() => setExpression('idle'), ms);
  }, []);

  const restPosition = useCallback(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    return {
      x: window.innerWidth - SIZE - REST_MARGIN,
      y: window.innerHeight - SIZE - REST_MARGIN,
    };
  }, []);

  // Initial placement — restores wherever the student last left Milo
  // (persisted via savePosition) instead of always defaulting to a corner,
  // so "thrown and left somewhere" actually sticks across visits.
  useEffect(() => {
    if (initializedRef.current || loading) return;
    initializedRef.current = true;
    const saved = profile.savedPosition;
    const start =
      saved && typeof window !== 'undefined'
        ? {
            x: Math.min(Math.max(saved.x, 0), window.innerWidth - SIZE),
            y: Math.min(Math.max(saved.y, 0), window.innerHeight - SIZE),
          }
        : restPosition();
    pos.current = start;
    if (containerRef.current) {
      containerRef.current.style.transform = `translate(${start.x}px, ${start.y}px)`;
    }
  }, [loading, profile.savedPosition, restPosition]);

  // Idle personality — occasional voice line (nag to study or a fun fact)
  // plus a tiny random hop, so it doesn't just sit there looking dead.
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDragging.current || panel !== 'none' || isOffscreen) return;
      const roll = Math.random();
      if (roll < 0.22) {
        showBubble(pickLine(Math.random() < 0.5 ? 'nagging' : 'factoid'), 4000);
      } else if (roll < 0.4) {
        vel.current.y -= 40;
      }
    }, 16000);
    return () => clearInterval(interval);
  }, [panel, isOffscreen, showBubble]);

  const applyTransform = useCallback((x: number, y: number, sx: number, sy: number, opacity = 1) => {
    if (!containerRef.current) return;
    containerRef.current.style.transform = `translate(${x}px, ${y}px) scale(${sx}, ${sy})`;
    containerRef.current.style.opacity = String(opacity);
  }, []);

  const registerBounce = useCallback(() => {
    const now = performance.now();
    bounceTimestamps.current.push(now);
    bounceTimestamps.current = bounceTimestamps.current.filter((t) => now - t < DIZZY_WINDOW_MS);
    bumpStat('wallHits');

    if (bounceTimestamps.current.length >= DIZZY_BOUNCE_COUNT) {
      flashExpression('dizzy', 1200);
      showBubble(pickLine('dizzy'), 2200);
      bounceTimestamps.current = [];
    } else {
      flashExpression('hurt', 350);
      if (Math.random() < 0.35) showBubble(pickLine('bounced'), 1800);
    }
  }, [bumpStat, flashExpression, showBubble]);

  const triggerOffscreenFling = useCallback(() => {
    isFlyingOff.current = true;
    showBubble(pickLine('thrown'), 1500);
    bumpStat('offscreen');

    const delay = 6000 + Math.random() * 8000; // 6–14s before it comes back
    reappearTimer.current = setTimeout(() => {
      if (typeof window === 'undefined') return;
      const edge = Math.floor(Math.random() * 4);
      const margin = 10;
      let next = { x: 0, y: 0 };
      if (edge === 0) next = { x: Math.random() * (window.innerWidth - SIZE), y: margin };
      else if (edge === 1) next = { x: Math.random() * (window.innerWidth - SIZE), y: window.innerHeight - SIZE - margin };
      else if (edge === 2) next = { x: margin, y: Math.random() * (window.innerHeight - SIZE) };
      else next = { x: window.innerWidth - SIZE - margin, y: Math.random() * (window.innerHeight - SIZE) };

      pos.current = next;
      vel.current = { x: 0, y: 0 };
      isFlyingOff.current = false;
      setIsOffscreen(false);
      applyTransform(next.x, next.y, 1, 1, 1);
      showBubble(pickLine('offscreenReturn'), 3200);
      savePosition({ x: next.x, y: next.y });
    }, delay);
  }, [applyTransform, bumpStat, savePosition, showBubble]);

  // Physics loop — gravity + wall bounce while released. When a throw
  // exceeds the "too hard" threshold, it sails straight off the viewport
  // entirely (the secret easter egg) instead of bouncing, then reappears
  // later at a random edge. Otherwise it settles wherever it lands and
  // stays there — no forced drift back to a "home" corner.
  useEffect(() => {
    const GRAVITY = 1400;
    const FRICTION = 0.985;
    const BOUNCE = 0.55;
    let last = performance.now();
    let stillFrames = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;

      if (isDragging.current) {
        pos.current.x += (dragTarget.current.x - pos.current.x) * 0.35;
        pos.current.y += (dragTarget.current.y - pos.current.y) * 0.35;
        applyTransform(pos.current.x, pos.current.y, 1.08, 0.92, 1);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (isFlyingOff.current) {
        pos.current.x += vel.current.x * dt;
        pos.current.y += vel.current.y * dt;
        vel.current.y += GRAVITY * 0.3 * dt; // light gravity so it arcs, doesn't fly perfectly straight
        const margin = 220;
        const offLeft = pos.current.x < -margin;
        const offRight = pos.current.x > window.innerWidth + margin;
        const offTop = pos.current.y < -margin;
        const offBottom = pos.current.y > window.innerHeight + margin;
        applyTransform(pos.current.x, pos.current.y, 0.85, 0.85, 1);
        if (offLeft || offRight || offTop || offBottom) {
          setIsOffscreen(true);
          applyTransform(pos.current.x, pos.current.y, 0.85, 0.85, 0);
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      vel.current.y += GRAVITY * dt;
      pos.current.x += vel.current.x * dt;
      pos.current.y += vel.current.y * dt;
      vel.current.x *= FRICTION;

      const maxX = window.innerWidth - SIZE;
      const maxY = window.innerHeight - SIZE;

      if (pos.current.x < 0) {
        pos.current.x = 0;
        vel.current.x *= -BOUNCE;
        squish.current = { x: 1.25, y: 0.75 };
        registerBounce();
      } else if (pos.current.x > maxX) {
        pos.current.x = maxX;
        vel.current.x *= -BOUNCE;
        squish.current = { x: 1.25, y: 0.75 };
        registerBounce();
      }
      if (pos.current.y > maxY) {
        pos.current.y = maxY;
        vel.current.y *= -BOUNCE;
        squish.current = { x: 1.2, y: 0.8 };
        if (Math.abs(vel.current.y) > 60) registerBounce();
      } else if (pos.current.y < 0) {
        pos.current.y = 0;
        vel.current.y *= -BOUNCE;
      }

      squish.current.x += (1 - squish.current.x) * 0.18;
      squish.current.y += (1 - squish.current.y) * 0.18;
      applyTransform(pos.current.x, pos.current.y, squish.current.x, squish.current.y, 1);

      // once it's essentially stopped moving on the floor, remember where
      // it's resting — this is the "stays where you put it" behavior.
      const speed = Math.hypot(vel.current.x, vel.current.y);
      const onFloor = pos.current.y >= maxY - 1;
      if (speed < 15 && onFloor) {
        stillFrames++;
        if (stillFrames > 30 && !hasSavedRestRef.current) {
          hasSavedRestRef.current = true;
          savePosition({ x: pos.current.x, y: pos.current.y });
        }
      } else {
        stillFrames = 0;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [applyTransform, registerBounce, savePosition]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    isDragging.current = true;
    isFlyingOff.current = false;
    movedDistance.current = 0;
    hasSavedRestRef.current = false;
    dragTarget.current = { x: pos.current.x, y: pos.current.y };
    lastPointer.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    setExpression('dragged');
    if (reappearTimer.current) clearTimeout(reappearTimer.current);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    movedDistance.current += Math.hypot(dx, dy);
    dragTarget.current = { x: dragTarget.current.x + dx, y: dragTarget.current.y + dy };

    const now = performance.now();
    const dt = Math.max(now - lastPointer.current.t, 1) / 1000;
    vel.current = {
      x: Math.max(-2800, Math.min(2800, (dx / dt) * 0.9)),
      y: Math.max(-2800, Math.min(2800, (dy / dt) * 0.9)),
    };
    lastPointer.current = { x: e.clientX, y: e.clientY, t: now };
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setExpression('idle');

    if (movedDistance.current < 6) {
      setPanel((p) => (p === 'none' ? 'menu' : 'none'));
      return;
    }

    bumpStat('throws');
    const speed = Math.hypot(vel.current.x, vel.current.y);
    if (speed > SUPER_THROW_SPEED) {
      triggerOffscreenFling();
    } else if (Math.random() < 0.55) {
      showBubble(pickLine('thrown'), 1600);
    }
  };

  if (loading) return null;

  return (
    <>
      <div
        ref={containerRef}
        className="fixed top-0 left-0 z-[60] cursor-grab active:cursor-grabbing touch-none"
        style={{ width: SIZE, height: SIZE, display: isOffscreen ? 'none' : 'block' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {bubble && (
          <div className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap bg-card border border-border shadow-md rounded-xl px-3 py-1.5 text-xs font-medium max-w-[220px] overflow-hidden text-ellipsis">
            {bubble}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-card border-b border-r border-border rotate-45" />
          </div>
        )}
        <div className="drop-shadow-lg">
          <MiloFace equipped={profile.equippedItems} expression={expression} size={SIZE} variant="widget" itemOffsets={profile.itemOffsets} />
        </div>
      </div>

      {panel === 'menu' && (
        <MiloActionMenu
          anchorSize={SIZE}
          getPosition={() => pos.current}
          onClose={() => setPanel('none')}
          onSelect={(mode) => setPanel(mode)}
        />
      )}

      <MiloAssistant
        hideTrigger
        externalOpen={panel === 'help'}
        onExternalOpenChange={(open) => setPanel(open ? 'help' : 'none')}
      />

      {panel === 'chat' && (
        <MiloChatCasual
          onClose={() => setPanel('none')}
          onOpen={() => showBubble(pickLine('greeting'), 2000)}
        />
      )}

      {panel === 'wardrobe' && (
        <MiloWardrobe
          profile={profile}
          onEquip={equip}
          onPurchase={purchase}
          onSaveOffset={saveItemOffset}
          onClose={() => setPanel('none')}
        />
      )}

      {panel === 'leaderboard' && <MiloLeaderboard onClose={() => setPanel('none')} />}
    </>
  );
}
