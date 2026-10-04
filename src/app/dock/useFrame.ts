import { useEffect, useRef } from 'react';

/**
 * Calls `draw` every animation frame, for the few dock parts that move with
 * the car (blinking arrows, pedal travel, wheel angle). They write to DOM refs
 * directly, so React never re-renders at frame rate.
 */
export function useFrame(draw: () => void): void {
  const ref = useRef(draw);
  useEffect(() => {
    ref.current = draw;
  });
  useEffect(() => {
    let id = 0;
    const loop = (): void => {
      ref.current();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
}
