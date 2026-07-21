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
const PLACEMENT_SPEED = 140; // release below this speed = "place it here", not "throw it"
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
  const pointerHistory = useRef<{ x: number; y: number; t: number }[]>([]);
  const rafRef = useRef<number | null>(null);
  const squish = useRef({ x: 1, y: 1 });
  const squishVel = useRef({ x: 0, y: 0 }); // spring velocity — gives the squash an elastic overshoot/wobble instead of a snap-back
  const isPlaced = useRef(true); // true = resting exactly where put, no gravity (the "stick it anywhere" behavior)
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
      } else if (roll < 0.4 && !isPlaced.current) {
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

  // Physics loop. Three states: dragging (follows pointer), placed (gentle
  // release — stays exactly where you put it, gravity off, this is the
  // "stick it anywhere" behavior), and thrown (a real throw — gravity +
  // bounce with slime-like weight: heavy, low-bounce, and a spring-based
  // squash that overshoots and wobbles rather than snapping back like a
  // rubber ball). A throw settles back into "placed" once it stops moving.
  useEffect(() => {
    const GRAVITY = 1300;
    const FRICTION = 0.94; // more damping than a ball — doesn't roll/slide far
    const BOUNCE = 0.32; // low restitution — a plop, not a bounce
    const SPRING_STIFFNESS = 140;
    const SPRING_DAMPING = 9;
    let last = performance.now();
    let stillFrames = 0;
    let breatheT = 0;

    const springStep = (dt: number) => {
      // damped spring pulling squish back toward 1 — overshoots past 1
      // before settling, which is what actually reads as "jelly" instead
      // of "snapped back instantly".
      const fx = -SPRING_STIFFNESS * (squish.current.x - 1) - SPRING_DAMPING * squishVel.current.x;
      const fy = -SPRING_STIFFNESS * (squish.current.y - 1) - SPRING_DAMPING * squishVel.current.y;
      squishVel.current.x += fx * dt;
      squishVel.current.y += fy * dt;
      squish.current.x += squishVel.current.x * dt;
      squish.current.y += squishVel.current.y * dt;
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;

      if (isDragging.current) {
        pos.current.x += (dragTarget.current.x - pos.current.x) * 0.3;
        pos.current.y += (dragTarget.current.y - pos.current.y) * 0.3;
        // a slight lag-based stretch toward the drag direction feels goopier
        // than a fixed squash while being carried around.
        const dx = dragTarget.current.x - pos.current.x;
        const dy = dragTarget.current.y - pos.current.y;
        squish.current = {
          x: 1 + Math.max(-0.25, Math.min(0.25, dy * 0.01)),
          y: 1 - Math.max(-0.25, Math.min(0.25, dy * 0.01)) + Math.max(-0.1, Math.min(0.1, dx * 0.004)),
        };
        applyTransform(pos.current.x, pos.current.y, squish.current.x, squish.current.y, 1);
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

      if (isPlaced.current) {
        // stuck exactly where it was put — no gravity, just a slow idle
        // breathing pulse so it doesn't look frozen/dead.
        breatheT += dt;
        const breathe = 1 + Math.sin(breatheT * 1.4) * 0.02;
        applyTransform(pos.current.x, pos.current.y, breathe, 2 - breathe, 1);
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
        squish.current = { x: 1.5, y: 0.62 };
        squishVel.current = { x: 0, y: 0 };
        registerBounce();
      } else if (pos.current.x > maxX) {
        pos.current.x = maxX;
        vel.current.x *= -BOUNCE;
        squish.current = { x: 1.5, y: 0.62 };
        squishVel.current = { x: 0, y: 0 };
        registerBounce();
      }
      if (pos.current.y > maxY) {
        pos.current.y = maxY;
        vel.current.y *= -BOUNCE;
        squish.current = { x: 1.55, y: 0.58 };
        squishVel.current = { x: 0, y: 0 };
        if (Math.abs(vel.current.y) > 60) registerBounce();
      } else if (pos.current.y < 0) {
        pos.current.y = 0;
        vel.current.y *= -BOUNCE;
      }

      springStep(dt);
      applyTransform(pos.current.x, pos.current.y, squish.current.x, squish.current.y, 1);

      // once it's essentially stopped moving, it becomes "placed" — stays
      // exactly there from now on, same as a gentle manual placement.
      const speed = Math.hypot(vel.current.x, vel.current.y);
      const onFloor = pos.current.y >= maxY - 1;
      if (speed < 15 && onFloor) {
        stillFrames++;
        if (stillFrames > 20) {
          isPlaced.current = true;
          squish.current = { x: 1, y: 1 };
          squishVel.current = { x: 0, y: 0 };
          if (!hasSavedRestRef.current) {
            hasSavedRestRef.current = true;
            savePosition({ x: pos.current.x, y: pos.current.y });
          }
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
    isPlaced.current = false;
    isFlyingOff.current = false;
    movedDistance.current = 0;
    hasSavedRestRef.current = false;
    dragTarget.current = { x: pos.current.x, y: pos.current.y };
    const now = performance.now();
    lastPointer.current = { x: e.clientX, y: e.clientY, t: now };
    pointerHistory.current = [{ x: e.clientX, y: e.clientY, t: now }];
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
    lastPointer.current = { x: e.clientX, y: e.clientY, t: now };

    // keep a short rolling window of recent samples — release velocity is
    // computed from this window, not frame-to-frame deltas, so a single
    // noisy high-polling-rate sample can't spike the "throw" speed and
    // accidentally trigger a hard throw/fly-off from a small nudge.
    pointerHistory.current.push({ x: e.clientX, y: e.clientY, t: now });
    pointerHistory.current = pointerHistory.current.filter((s) => now - s.t < 100);
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setExpression('idle');

    if (movedDistance.current < 6) {
      isPlaced.current = true;
      setPanel((p) => (p === 'none' ? 'menu' : 'none'));
      return;
    }

    // smoothed release velocity from the recent sample window
    const hist = pointerHistory.current;
    const oldest = hist[0];
    const newest = hist[hist.length - 1] ?? oldest;
    const dt = Math.max((newest?.t ?? 0) - (oldest?.t ?? 0), 16) / 1000;
    const releaseVel = oldest && newest
      ? {
          x: Math.max(-2600, Math.min(2600, ((newest.x - oldest.x) / dt) * 0.9)),
          y: Math.max(-2600, Math.min(2600, ((newest.y - oldest.y) / dt) * 0.9)),
        }
      : { x: 0, y: 0 };
    vel.current = releaseVel;

    const speed = Math.hypot(releaseVel.x, releaseVel.y);

    if (speed < PLACEMENT_SPEED) {
      // gentle release — stick exactly here, anywhere on screen, no bounce.
      isPlaced.current = true;
      squish.current = { x: 1.12, y: 0.9 }; // tiny plop on landing
      squishVel.current = { x: 0, y: 0 };
      if (!hasSavedRestRef.current) {
        hasSavedRestRef.current = true;
        savePosition({ x: pos.current.x, y: pos.current.y });
      }
      return;
    }

    bumpStat('throws');
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
