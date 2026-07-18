'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { MiloFace } from './milo-face';
import { useMascotProfile } from '@/hooks/use-mascot-profile';
import { MiloActionMenu } from './milo-action-menu';
import { MiloChatCasual } from './milo-chat-casual';
import { MiloWardrobe } from './milo-wardrobe';
import { MiloAssistant } from '@/components/milo/milo-assistant';

const SIZE = 68;
const REST_MARGIN = 20;
const SETTLE_DELAY_MS = 4500;

// Personality lines for idle speech bubbles — separate from the serious
// tutoring voice, this is the "hanging out" side of Milo.
const IDLE_LINES = [
  "Don't forget to stretch!",
  'Ask me anything when you need help 👋',
  'You got this.',
  "Psst — I'm draggable.",
  'Practicing today?',
];

type PanelMode = 'none' | 'menu' | 'help' | 'chat' | 'wardrobe';

export function FloatingMilo() {
  const { profile, loading, equip, purchase, bumpStat, savePosition } = useMascotProfile();
  const [panel, setPanel] = useState<PanelMode>('none');
  const [bubble, setBubble] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 }); // top-left, px, viewport-relative
  const vel = useRef({ x: 0, y: 0 });
  const dragTarget = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const movedDistance = useRef(0);
  const lastPointer = useRef({ x: 0, y: 0, t: 0 });
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const squish = useRef({ x: 1, y: 1 });
  const initializedRef = useRef(false);

  const restPosition = useCallback(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0 };
    return {
      x: window.innerWidth - SIZE - REST_MARGIN,
      y: window.innerHeight - SIZE - REST_MARGIN,
    };
  }, []);

  // initial placement
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const rest = restPosition();
    pos.current = rest;
    if (containerRef.current) {
      containerRef.current.style.transform = `translate(${rest.x}px, ${rest.y}px)`;
    }
  }, [restPosition]);

  // occasional idle speech bubble + tiny random hop, for "aliveness"
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDragging.current || panel !== 'none') return;
      if (Math.random() < 0.35) {
        setBubble(IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)]);
        setTimeout(() => setBubble(null), 3200);
      } else {
        vel.current.y -= 40; // tiny hop
      }
    }, 14000);
    return () => clearInterval(interval);
  }, [panel]);

  const applyTransform = useCallback((x: number, y: number, sx: number, sy: number) => {
    if (!containerRef.current) return;
    containerRef.current.style.transform = `translate(${x}px, ${y}px) scale(${sx}, ${sy})`;
  }, []);

  // physics loop — gravity + wall bounce while released, elastic squash,
  // then a smooth drift back to the resting corner after settling so the
  // buddy never permanently blocks the actual app content.
  useEffect(() => {
    const GRAVITY = 1400;
    const FRICTION = 0.985;
    const BOUNCE = 0.55;

    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;

      if (!isDragging.current) {
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
          bumpStat('wallHits');
        } else if (pos.current.x > maxX) {
          pos.current.x = maxX;
          vel.current.x *= -BOUNCE;
          squish.current = { x: 1.25, y: 0.75 };
          bumpStat('wallHits');
        }
        if (pos.current.y > maxY) {
          pos.current.y = maxY;
          vel.current.y *= -BOUNCE;
          squish.current = { x: 1.2, y: 0.8 };
        } else if (pos.current.y < 0) {
          pos.current.y = 0;
          vel.current.y *= -BOUNCE;
        }

        // ease squish back to normal (elastic settle)
        squish.current.x += (1 - squish.current.x) * 0.18;
        squish.current.y += (1 - squish.current.y) * 0.18;

        applyTransform(pos.current.x, pos.current.y, squish.current.x, squish.current.y);
      } else {
        // smooth lerp-follow while dragging — not 1:1, gives a nice elastic lag
        pos.current.x += (dragTarget.current.x - pos.current.x) * 0.35;
        pos.current.y += (dragTarget.current.y - pos.current.y) * 0.35;
        applyTransform(pos.current.x, pos.current.y, 1.08, 0.92);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [applyTransform, bumpStat]);

  const scheduleSettleReturn = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      // only drift home if it's basically stopped moving (not mid-bounce)
      const speed = Math.hypot(vel.current.x, vel.current.y);
      if (speed > 30) {
        scheduleSettleReturn();
        return;
      }
      const rest = restPosition();
      const start = { ...pos.current };
      const duration = 600;
      const startTime = performance.now();
      vel.current = { x: 0, y: 0 };

      const animateHome = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        pos.current = {
          x: start.x + (rest.x - start.x) * eased,
          y: start.y + (rest.y - start.y) * eased,
        };
        applyTransform(pos.current.x, pos.current.y, 1, 1);
        if (t < 1) requestAnimationFrame(animateHome);
        else savePosition(rest);
      };
      requestAnimationFrame(animateHome);
    }, SETTLE_DELAY_MS);
  }, [applyTransform, restPosition, savePosition]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    isDragging.current = true;
    movedDistance.current = 0;
    dragTarget.current = { x: pos.current.x, y: pos.current.y };
    lastPointer.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (settleTimer.current) clearTimeout(settleTimer.current);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    movedDistance.current += Math.hypot(dx, dy);

    dragTarget.current = {
      x: dragTarget.current.x + dx,
      y: dragTarget.current.y + dy,
    };

    const now = performance.now();
    const dt = Math.max(now - lastPointer.current.t, 1) / 1000;
    vel.current = {
      x: Math.max(-1600, Math.min(1600, (dx / dt) * 0.9)),
      y: Math.max(-1600, Math.min(1600, (dy / dt) * 0.9)),
    };
    lastPointer.current = { x: e.clientX, y: e.clientY, t: now };
  };

  const handlePointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (movedDistance.current < 6) {
      setPanel((p) => (p === 'none' ? 'menu' : 'none'));
    } else {
      bumpStat('throws');
      scheduleSettleReturn();
    }
  };

  if (loading) return null;

  return (
    <>
      <div
        ref={containerRef}
        className="fixed top-0 left-0 z-[60] cursor-grab active:cursor-grabbing touch-none"
        style={{ width: SIZE, height: SIZE }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {bubble && (
          <div className="absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap bg-card border border-border shadow-md rounded-xl px-3 py-1.5 text-xs font-medium">
            {bubble}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-card border-b border-r border-border rotate-45" />
          </div>
        )}
        <div className="drop-shadow-lg">
          <MiloFace equipped={profile.equippedItems} size={SIZE} />
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

      {panel === 'chat' && <MiloChatCasual onClose={() => setPanel('none')} />}

      {panel === 'wardrobe' && (
        <MiloWardrobe
          profile={profile}
          onEquip={equip}
          onPurchase={purchase}
          onClose={() => setPanel('none')}
        />
      )}
    </>
  );
}
