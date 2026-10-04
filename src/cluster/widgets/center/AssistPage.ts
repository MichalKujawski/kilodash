import { buildLaneView } from '../../lanes/buildLaneView';
import { Canvas2DLaneRenderer } from '../../lanes/Canvas2DLaneRenderer';
import type { LaneSceneRenderer } from '../../lanes/types';
import { label } from '../../renderer/draw';
import type { FrameContext } from '../../renderer/types';
import type { CenterPage } from './types';

/** Driver assistance page: the lane view with traffic, lines and our car. */
export class AssistPage implements CenterPage {
  readonly id = 'assist';
  private renderer: LaneSceneRenderer = new Canvas2DLaneRenderer();

  draw(ctx: CanvasRenderingContext2D, f: FrameContext, w: number, h: number): void {
    const model = buildLaneView(f);
    if (!model) {
      label(
        ctx,
        'Driver assistance',
        w / 2,
        58,
        16,
        f.theme.fonts.primary,
        f.theme.text.tertiary,
        'center',
      );
      return;
    }
    this.renderer.draw(ctx, model, { x: 0, y: 30, w, h: h - 30 }, f.theme, f.now);
  }
}
