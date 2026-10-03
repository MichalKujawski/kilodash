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
  onFps?: (fps: number) => void;
}

/** Hosts the cluster canvas. The renderer runs its own rAF loop outside React. */
export function ClusterView({ session, layout, theme, onFps }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ClusterRenderer | null>(null);
  const onFpsRef = useRef(onFps);

  useEffect(() => {
    onFpsRef.current = onFps;
  }, [onFps]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = new ClusterRenderer(canvas, session.store, theme, {
      onFps: (f) => onFpsRef.current?.(f),
    });
    rendererRef.current = r;
    r.start();
    return () => {
      r.destroy();
      rendererRef.current = null;
    };
    // The renderer is created once per session; theme/layout changes are pushed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    rendererRef.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    rendererRef.current?.setWidgets(buildWidgets(layout, session.available, session.env()));
  }, [layout, session]);

  return (
    <canvas ref={canvasRef} className="cluster-canvas" aria-label="Instrument cluster" role="img" />
  );
}
