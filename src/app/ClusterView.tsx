import { useEffect, useRef } from 'react';
import { ClusterRenderer } from '@/cluster/renderer/ClusterRenderer';
import { buildWidgets } from '@/cluster/layouts/resolve';
import type { LayoutDefinition } from '@/cluster/layouts/types';
import type { Theme } from '@/cluster/themes/types';
import type { ClusterSession } from './session';

interface Props {
  session: ClusterSession;
  layout: LayoutDefinition;
  theme: Theme;
  onFps?: (fps: number, frameMs: number) => void;
  onRenderer?: (r: ClusterRenderer | null) => void;
  /** Move the glass reflection a few px with the pointer (website only). */
  parallax?: boolean;
  lowPower?: boolean;
  /** Cross-fade theme changes (off while editing a theme live). */
  animateTheme?: boolean;
}

/** Hosts the cluster canvas. The renderer runs its own rAF loop outside React. */
export function ClusterView({
  session,
  layout,
  theme,
  onFps,
  onRenderer,
  parallax,
  lowPower,
  animateTheme = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animateRef = useRef(animateTheme);
  const rendererRef = useRef<ClusterRenderer | null>(null);
  const onFpsRef = useRef(onFps);
  const onRendererRef = useRef(onRenderer);

  useEffect(() => {
    onFpsRef.current = onFps;
    onRendererRef.current = onRenderer;
    animateRef.current = animateTheme;
  }, [onFps, onRenderer, animateTheme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = new ClusterRenderer(canvas, session.store, theme, {
      lowPower,
      flasher: session.flasher,
      alerts: session.alerts,
      onFps: (f, ms) => onFpsRef.current?.(f, ms),
    });
    rendererRef.current = r;
    if (new URLSearchParams(window.location.search).has('profile')) {
      r.profile = {};
      (window as unknown as { __clusterProfile: unknown }).__clusterProfile = r.profile;
    }
    onRendererRef.current?.(r);
    r.start();
    return () => {
      r.destroy();
      rendererRef.current = null;
      onRendererRef.current?.(null);
    };
    // The renderer is created once per session; theme/layout changes are pushed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    rendererRef.current?.setTheme(theme, animateRef.current);
  }, [theme]);

  useEffect(() => {
    rendererRef.current?.setLayout(layout, buildWidgets(layout, session.available, session.env()));
  }, [layout, session]);

  useEffect(() => {
    if (!parallax) return;
    const move = (e: PointerEvent): void => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      rendererRef.current?.setGlassOffset(nx * -6, ny * -4);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [parallax]);

  return (
    <canvas ref={canvasRef} className="cluster-canvas" aria-label="Instrument cluster" role="img" />
  );
}
