import React, { useRef, useState, useEffect, useCallback } from "react";
import MascotFace from "./MascotFace";

const SIZE = 60;
const FRICTION = 0.93;     // velocity decay per frame
const BOUNCE = 0.55;       // energy retained on wall bounce
const MIN_VEL = 0.4;       // stop threshold
const SQUISH_MS = 160;
const MSG_MS = 2600;

const SNARKY = [
  "Woah, that was a doozy!",
  "Ouch, that hurt!",
  "That took my brain for a loop!",
  "Enough playing — back to work!",
  "Do that again and I'll turn you into a common denominator.",
  "My gears are still spinning…",
  "I think you dislocated my exponent!",
  "Oof, right in the quadratic formula!",
  "Hey! I'm an intellectual being, you know.",
  "Watch the hairdo!",
  "Bonk! Probability of that: 100%.",
  "That's one way to test gravity…",
  "I'm not a beach ball, you know!",
  "My circuits felt that one!",
  "You knocked the pi right out of me!",
  "Right in the asymptote!",
  "Even my margins are bruised.",
  "Do you kiss your math teacher with that aim?",
  "My hypotenuse is rattled!",
  "Newton says I get to hit back. Just kidding.",
  "That's it — pop quiz time, buddy.",
  "Need a moment? I do.",
  "I just dropped all my variables!",
  "Gah! My short-term memory just got shorter!",
  "Did you calculate that angle, or just feel it?",
];

function randomMsg() {
  return SNARKY[Math.floor(Math.random() * SNARKY.length)];
}

/**
 * Floating, draggable, flingable Milo mascot.
 * Pure client-side physics — no AI tokens / API calls.
 * Click (no drag) opens the customization panel via onOpenPanel.
 */
export default function FloatingMascot({ config, onOpenChat, unread, unreadMsg }) {
  const [pos, setPos] = useState({ x: -1, y: -1 }); // -1 = not initialized
  const [squish, setSquish] = useState({ x: 1, y: 1 });
  const [squishing, setSquishing] = useState(false);
  const [message, setMessage] = useState(null);
  const [showMsg, setShowMsg] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const [idle, setIdle] = useState(true);

  const posRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, offX: 0, offY: 0, lastX: 0, lastY: 0, lastT: 0, vx: 0, vy: 0, moved: false, down: 0 });
  const animRef = useRef({ vx: 0, vy: 0, raf: null });
  const msgTimer = useRef(null);
  const squashTimer = useRef(null);

  // Initialize to bottom-right
  useEffect(() => {
    const place = () => {
      const x = window.innerWidth - SIZE - 24;
      const y = window.innerHeight - SIZE - 24;
      posRef.current = { x, y };
      setPos({ x, y });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  const flashMessage = useCallback((text) => {
    setMessage(text);
    setShowMsg(true);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setShowMsg(false), MSG_MS);
  }, []);

  const doSquish = useCallback((axis) => {
    // axis = 'x' means hit a vertical wall → squash horizontally
    setSquish(axis === "x" ? { x: 0.65, y: 1.25 } : { x: 1.25, y: 0.65 });
    setSquishing(true);
    if (squashTimer.current) clearTimeout(squashTimer.current);
    squashTimer.current = setTimeout(() => {
      setSquish({ x: 1, y: 1 });
      setSquishing(false);
    }, SQUISH_MS);
  }, []);

  const flingStep = useCallback(() => {
    const a = animRef.current;
    let { x, y } = posRef.current;

    x += a.vx;
    y += a.vy;

    let hit = false;
    let axis = null;

    if (x < 0) {
      x = 0;
      a.vx = -a.vx * BOUNCE;
      hit = true;
      axis = "x";
    } else if (x > window.innerWidth - SIZE) {
      x = window.innerWidth - SIZE;
      a.vx = -a.vx * BOUNCE;
      hit = true;
      axis = "x";
    }
    if (y < 0) {
      y = 0;
      a.vy = -a.vy * BOUNCE;
      hit = true;
      axis = "y";
    } else if (y > window.innerHeight - SIZE) {
      y = window.innerHeight - SIZE;
      a.vy = -a.vy * BOUNCE;
      hit = true;
      axis = "y";
    }

    posRef.current = { x, y };
    setPos({ x, y });

    if (hit) {
      doSquish(axis);
      flashMessage(randomMsg());
    }

    a.vx *= FRICTION;
    a.vy *= FRICTION;

    if (Math.abs(a.vx) > MIN_VEL || Math.abs(a.vy) > MIN_VEL) {
      animRef.current.raf = requestAnimationFrame(flingStep);
    } else {
      animRef.current.raf = null;
    }
  }, [doSquish, flashMessage]);

  const onPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // cancel ongoing fling
    if (animRef.current.raf) {
      cancelAnimationFrame(animRef.current.raf);
      animRef.current.raf = null;
    }
    const px = e.clientX;
    const py = e.clientY;
    dragRef.current = {
      active: true,
      offX: px - posRef.current.x,
      offY: py - posRef.current.y,
      lastX: px,
      lastY: py,
      lastT: performance.now(),
      vx: 0,
      vy: 0,
      moved: false,
      down: performance.now(),
    };
    setGrabbing(true);
    setIdle(false);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.active) return;
    const px = e.clientX;
    const py = e.clientY;

    const rawX = px - d.offX;
    const rawY = py - d.offY;
    const clampedX = Math.max(0, Math.min(window.innerWidth - SIZE, rawX));
    const clampedY = Math.max(0, Math.min(window.innerHeight - SIZE, rawY));

    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    // px per ~16ms frame
    d.vx = ((px - d.lastX) / dt) * 16;
    d.vy = ((py - d.lastY) / dt) * 16;

    if (Math.abs(px - d.lastX) > 2 || Math.abs(py - d.lastY) > 2) d.moved = true;

    posRef.current = { x: clampedX, y: clampedY };
    setPos({ x: clampedX, y: clampedY });

    d.lastX = px;
    d.lastY = py;
    d.lastT = now;
  };

  const endDrag = (e) => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    setGrabbing(false);

    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      /* noop */
    }

    const wasClick = !d.moved && performance.now() - d.down < 350;
    if (wasClick) {
      onOpenChat?.();
      setIdle(true);
      return;
    }

    const speed = Math.hypot(d.vx, d.vy);
    if (speed > 3) {
      animRef.current.vx = d.vx;
      animRef.current.vy = d.vy;
      animRef.current.raf = requestAnimationFrame(flingStep);
    } else {
      setIdle(true);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (animRef.current.raf) cancelAnimationFrame(animRef.current.raf);
      if (msgTimer.current) clearTimeout(msgTimer.current);
      if (squashTimer.current) clearTimeout(squashTimer.current);
    };
  }, []);

  // Occasional idle wiggle so Milo feels alive
  useEffect(() => {
    if (!idle) return;
    const t = setInterval(() => {
      setSquishing(true);
      setSquish({ x: 1.08, y: 0.94 });
      setTimeout(() => {
        setSquish({ x: 1, y: 1 });
        setSquishing(false);
      }, 220);
    }, 6000 + Math.random() * 5000);
    return () => clearInterval(t);
  }, [idle]);

  if (pos.x < 0) return null; // not placed yet

  const transform = `translate(${pos.x}px, ${pos.y}px) scale(${squish.x}, ${squish.y})`;
  const transformOrigin = "center center";

  return (
    <>
      {/* Notification bubble (unread AI response while chat closed) */}
      {unread && unreadMsg && !showMsg && (
        <div
          className="fixed z-[10000] pointer-events-none"
          style={{ left: pos.x + SIZE / 2, top: pos.y - 6, transform: "translate(-50%, -100%)" }}
        >
          <div className="bg-emerald-500/15 border border-emerald-500/40 rounded-2xl px-3.5 py-2 shadow-lg shadow-black/20 max-w-[200px]">
            <p className="text-xs font-medium text-emerald-500 leading-snug text-center">{unreadMsg}</p>
            <div className="absolute left-1/2 -bottom-1 w-2.5 h-2.5 bg-emerald-500/15 border-r border-b border-emerald-500/40 rotate-45 -translate-x-1/2" />
          </div>
        </div>
      )}

      {/* Speech bubble */}
      {showMsg && message && (
        <div
          className="fixed z-[10000] pointer-events-none"
          style={{ left: pos.x + SIZE / 2, top: pos.y - 6, transform: "translate(-50%, -100%)" }}
        >
          <div className="bg-card border border-accent/30 rounded-2xl px-3.5 py-2 shadow-lg shadow-black/20 max-w-[200px]">
            <p className="text-xs font-medium text-foreground leading-snug text-center">{message}</p>
            <div className="absolute left-1/2 -bottom-1 w-2.5 h-2.5 bg-card border-r border-b border-accent/30 rotate-45 -translate-x-1/2" />
          </div>
        </div>
      )}

      {/* Mascot */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="fixed z-[9999]"
        style={{
          left: 0,
          top: 0,
          width: SIZE,
          height: SIZE,
          transform,
          transformOrigin,
          transition: squishing ? "transform 0.16s ease-out" : grabbing ? "none" : "transform 0.18s cubic-bezier(0.34,1.56,0.64,1)",
          touchAction: "none",
          cursor: grabbing ? "grabbing" : "grab",
          willChange: "transform",
        }}
        role="button"
        aria-label="Milo — drag to move, click to customize"
        title="Drag me around! Click to customize."
      >
        <div className="relative w-full h-full">
          {/* glow ring */}
          <div className="absolute inset-0 rounded-full bg-accent/20 blur-md scale-110" />
          <div className="relative w-full h-full rounded-full bg-gradient-to-b from-accent/10 to-transparent border border-accent/20 flex items-center justify-center overflow-visible">
            <MascotFace config={config} size={SIZE} animate={idle} />
          </div>

          {/* Unread notification dot */}
          {unread && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive border-2 border-card flex items-center justify-center shadow-md">
              <span className="text-[10px] font-bold text-destructive-foreground leading-none">!</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}