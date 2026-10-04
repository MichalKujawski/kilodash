import type { FrameContext } from '../../renderer/types';

/** One page of the centre carousel, drawn in local coordinates (0..w, 0..h). */
export interface CenterPage {
  id: string;
  /** Called every frame, even when the page is hidden (keeps maps moving). */
  update?(f: FrameContext): void;
  /** Pages that depend on equipment hide themselves (default: always shown). */
  available?(f: FrameContext): boolean;
  draw(ctx: CanvasRenderingContext2D, f: FrameContext, w: number, h: number): void;
}
