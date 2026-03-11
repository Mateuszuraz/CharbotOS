/**
 * CustomCursor — brutalist ink-bleed cursor that follows the mouse.
 * Design: small solid square dot + slightly delayed trailing ring.
 * Hides the system cursor globally via CSS (applied in index.css).
 */
import React, { useEffect, useRef, useState } from 'react';

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  // Raw mouse position
  const mousePos = useRef({ x: -100, y: -100 });
  // Ring lags behind with lerp
  const ringPos = useRef({ x: -100, y: -100 });
  const rafId = useRef<number>(0);

  const [isPointer, setIsPointer] = useState(false);
  const [isText, setIsText] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      const target = e.target as HTMLElement;
      const computed = window.getComputedStyle(target).cursor;
      setIsPointer(computed === 'pointer');
      setIsText(computed === 'text');
      setIsHidden(false);
    };

    const onLeave = () => setIsHidden(true);
    const onEnter = () => setIsHidden(false);
    const onDown = () => setIsClicking(true);
    const onUp = () => setIsClicking(false);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const RING_SPEED = 0.12;

    const animate = () => {
      const dot = dotRef.current;
      const ring = ringRef.current;
      if (dot && ring) {
        // Dot: instant
        dot.style.transform = `translate(${mousePos.current.x}px, ${mousePos.current.y}px)`;

        // Ring: lerp
        ringPos.current.x = lerp(ringPos.current.x, mousePos.current.x, RING_SPEED);
        ringPos.current.y = lerp(ringPos.current.y, mousePos.current.y, RING_SPEED);
        ring.style.transform = `translate(${ringPos.current.x}px, ${ringPos.current.y}px)`;
      }
      rafId.current = requestAnimationFrame(animate);
    };
    rafId.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  if (isHidden) return null;

  const dotSize = isClicking ? 6 : isPointer ? 10 : 5;
  const ringSize = isClicking ? 28 : isPointer ? 36 : 22;

  return (
    <>
      {/* Dot */}
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[99998] will-change-transform"
        style={{
          width: dotSize,
          height: dotSize,
          marginLeft: -dotSize / 2,
          marginTop: -dotSize / 2,
          background: 'var(--color-text-primary)',
          transition: 'width 0.12s ease, height 0.12s ease, margin 0.12s ease',
          // Square for pointer, wide rect for text, tiny dot otherwise
          borderRadius: isText ? 1 : isPointer ? 0 : 0,
        }}
      />

      {/* Trailing ring */}
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[99997] will-change-transform"
        style={{
          width: ringSize,
          height: ringSize,
          marginLeft: -ringSize / 2,
          marginTop: -ringSize / 2,
          border: '2px solid var(--color-text-primary)',
          opacity: isClicking ? 0.3 : 0.18,
          transition: 'width 0.18s ease, height 0.18s ease, margin 0.18s ease, opacity 0.15s ease',
        }}
      />
    </>
  );
}
