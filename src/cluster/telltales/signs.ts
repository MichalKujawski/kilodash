/**
 * Road signs as shown in the cluster (German/Vienna-convention style, original
 * drawing): speed limit (red ring), end of a limit (grey with a diagonal),
 * end of all restrictions, no overtaking.
 */
export type SignSpec =
  | { kind: 'limit'; value: number; temporary?: boolean }
  | { kind: 'limitEnd'; value: number }
  | { kind: 'endAll' }
  | { kind: 'noOvertaking' };

export function drawSign(
  ctx: CanvasRenderingContext2D,
  sign: SignSpec,
  x: number,
  y: number,
  r: number,
  family: string,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  // White disc with a subtle dark outline so it reads on any background.
  ctx.fillStyle = sign.kind === 'limit' && sign.temporary ? '#f6d23a' : '#f4f5f6';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.stroke();
  if (sign.kind === 'limit' || sign.kind === 'noOvertaking') {
    ctx.strokeStyle = '#d4231b';
    ctx.lineWidth = r * 0.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.84, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (sign.kind === 'limit' || sign.kind === 'limitEnd') {
    const txt = String(sign.value);
    ctx.font = `600 ${Math.round(r * (txt.length > 2 ? 0.82 : 1.0))}px ${family}`;
    ctx.fillStyle = sign.kind === 'limitEnd' ? '#8a8f95' : '#111';
    ctx.fillText(txt, 0, r * 0.06);
  }
  if (sign.kind === 'limitEnd' || sign.kind === 'endAll') {
    // Diagonal stripe(s) from top right to bottom left.
    ctx.strokeStyle = '#2b2e33';
    ctx.lineWidth = r * 0.07;
    const n = sign.kind === 'endAll' ? 5 : 3;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * r * 0.16;
      ctx.beginPath();
      ctx.moveTo(r + o, -r + o);
      ctx.lineTo(-r + o, r + o);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (sign.kind === 'noOvertaking') {
    // Two cars side by side: red (overtaker, left) and black.
    const car = (cx: number, col: string): void => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(cx - r * 0.17, -r * 0.42, r * 0.34, r * 0.72, r * 0.08);
      ctx.fill();
    };
    car(-r * 0.24, '#d4231b');
    car(r * 0.24, '#111');
  }
  ctx.restore();
}

/**
 * Supplementary plate under a sign (white rectangle, black symbol): rain
 * cloud for "when wet", clock for a time range.
 */
export function drawPlate(
  ctx: CanvasRenderingContext2D,
  kind: 'wet' | 'time',
  x: number,
  y: number,
  w: number,
): void {
  const h = w * 0.55;
  ctx.save();
  ctx.fillStyle = '#f4f5f6';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y, w, h, 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#111';
  ctx.fillStyle = '#111';
  ctx.lineWidth = 1.4;
  const cx = x;
  const cy = y + h / 2;
  if (kind === 'wet') {
    // Cloud with three drops.
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 1.5, 3, Math.PI, 0);
    ctx.arc(cx + 2.5, cy - 2.5, 3.5, Math.PI * 1.1, Math.PI * 0.1);
    ctx.lineTo(cx + 5.5, cy + 0.5);
    ctx.lineTo(cx - 6, cy + 0.5);
    ctx.closePath();
    ctx.fill();
    for (const dx of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, cy + 2.5);
      ctx.lineTo(cx + dx - 1, cy + 4.5);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, h * 0.36, 0, Math.PI * 2);
    ctx.moveTo(cx, cy - h * 0.22);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + h * 0.16, cy + h * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}
