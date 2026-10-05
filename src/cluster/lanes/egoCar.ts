/**
 * Our own car in the lane view: a smooth, glossy hatchback seen from behind
 * and above, the way premium clusters show it. Built from a few profile
 * points (metres, car frame) projected with the lane view's camera, so it
 * stays in perspective through bends and lane changes. Original artwork:
 * no manufacturer's shape.
 */
type Project = (x: number, y: number, z: number) => [number, number];

/** Half width, length (m), and the body profile from the rear bumper forwards. */
const HW = 0.92;
const L = 4.6;
const PROFILE = {
  bumperBottom: 0.3,
  tailTop: 0.96,
  deckEnd: 0.55, // trunk lid length
  roofRear: 1.35,
  roofFront: 2.85,
  hoodStart: 3.5,
  roofY: 1.42,
  hoodY: 1.0,
  noseY: 0.84,
};

const BODY = '#cdd3dc';
const SHADE = '#0b0d10';

function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = (s: number): number => {
    const x = (pa >> s) & 255;
    return Math.round(x + (((pb >> s) & 255) - x) * k);
  };
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

/** A closed polygon with softly rounded corners (r in px, limited by the edges). */
function rounded(ctx: CanvasRenderingContext2D, pts: [number, number][], r: number): void {
  const n = pts.length;
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  ctx.beginPath();
  const start = mid(pts[n - 1]!, pts[0]!);
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % n]!;
    const edge = Math.hypot(q[0] - p[0], q[1] - p[1]);
    ctx.arcTo(p[0], p[1], q[0], q[1], Math.min(r, edge * 0.4));
  }
  ctx.closePath();
}

/** Four points across the car at height y and distance z, half-width w (fraction of HW). */
const across = (
  P: Project,
  w: number,
  y: number,
  z: number,
): [[number, number], [number, number]] => [P(-HW * w, y, z), P(HW * w, y, z)];

export function drawEgoCar(
  ctx: CanvasRenderingContext2D,
  P: Project,
  near: number,
  braking: boolean,
): void {
  const p = PROFILE;
  const far = near + L;
  const z = (d: number): number => near + d;
  const [rl, rr] = across(P, 1, p.bumperBottom, near);
  const px = rr[0] - rl[0]; // rear width on screen, px: scales all the rounding
  const r = px * 0.06;

  // Soft contact shadow, a little wider and longer than the car.
  for (const [grow, a] of [
    [0.3, 0.1],
    [0.15, 0.14],
    [0.02, 0.22],
  ] as const) {
    const [a0, a1] = across(P, 1 + grow, 0, near - grow);
    const [b0, b1] = across(P, 1 + grow * 0.6, 0, far + grow);
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    rounded(ctx, [a0, a1, b1, b0], px * 0.35);
    ctx.fill();
  }

  // Tyres: only their lower parts show below the body.
  ctx.fillStyle = '#07080a';
  for (const [z0, z1] of [
    [0.55, 1.15],
    [3.45, 4.05],
  ] as const)
    for (const side of [-1, 1]) {
      const a = P(side * HW * 0.98, 0, z(z0));
      const b = P(side * HW * 0.98, 0.55, z(z1));
      const c = P(side * HW * 0.78, 0, z(z0));
      rounded(ctx, [a, [a[0], b[1]], [c[0], b[1]], c], r);
      ctx.fill();
    }

  // Flanks: the body's outline from the rear bumper to the nose.
  const flank = ctx.createLinearGradient(0, P(0, p.hoodY, far)[1], 0, rl[1]);
  flank.addColorStop(0, mix(BODY, SHADE, 0.35));
  flank.addColorStop(1, mix(BODY, SHADE, 0.62));
  ctx.fillStyle = flank;
  rounded(
    ctx,
    [
      rl,
      P(-HW, p.tailTop, near),
      P(-HW * 0.97, p.hoodY, z(p.hoodStart)),
      P(-HW * 0.9, p.noseY, far),
      P(HW * 0.9, p.noseY, far),
      P(HW * 0.97, p.hoodY, z(p.hoodStart)),
      P(HW, p.tailTop, near),
      rr,
    ],
    r * 1.5,
  );
  ctx.fill();

  // Hood (furthest, mostly hidden by the roof), then windscreen, roof, rear window.
  const [hf0, hf1] = across(P, 0.86, p.noseY + 0.04, far - 0.05);
  const [hb0, hb1] = across(P, 0.92, p.hoodY, z(p.hoodStart));
  // Hood: further away and angled down, so a little darker than the roof.
  ctx.fillStyle = mix(BODY, SHADE, 0.32);
  rounded(ctx, [hb0, hb1, hf1, hf0], r);
  ctx.fill();

  const [wf0, wf1] = across(P, 0.66, p.roofY - 0.02, z(p.roofFront));
  const glass = (a: [number, number], b: [number, number]): CanvasGradient => {
    const g = ctx.createLinearGradient(0, a[1], 0, b[1]);
    g.addColorStop(0, '#1d2733');
    g.addColorStop(1, '#0c1117');
    return g;
  };
  ctx.fillStyle = glass(wf0, hb0);
  rounded(ctx, [hb0, hb1, wf1, wf0], r);
  ctx.fill();

  const [rf0, rf1] = across(P, 0.66, p.roofY, z(p.roofFront));
  const [rb0, rb1] = across(P, 0.7, p.roofY, z(p.roofRear));
  const roof = ctx.createLinearGradient(0, rf0[1], 0, rb0[1]);
  roof.addColorStop(0, mix(BODY, SHADE, 0.2));
  roof.addColorStop(1, mix(BODY, '#ffffff', 0.25));
  ctx.fillStyle = roof;
  rounded(ctx, [rb0, rb1, rf1, rf0], r * 1.4);
  ctx.fill();
  // A soft specular stripe along the roof.
  const [s0, s1] = across(P, 0.18, p.roofY + 0.01, z(p.roofRear + 0.15));
  const [s2, s3] = across(P, 0.14, p.roofY + 0.01, z(p.roofFront - 0.2));
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  rounded(ctx, [s0, s1, s3, s2], r);
  ctx.fill();

  const [gb0, gb1] = across(P, 0.86, p.tailTop + 0.1, z(p.deckEnd));
  ctx.fillStyle = glass(rb0, gb0);
  rounded(ctx, [gb0, gb1, rb1, rb0], r);
  ctx.fill();
  // Reflection streak across the rear window.
  ctx.save();
  rounded(ctx, [gb0, gb1, rb1, rb0], r);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = px * 0.08;
  ctx.beginPath();
  ctx.moveTo(gb0[0] + px * 0.25, gb0[1]);
  ctx.lineTo(rb0[0] + px * 0.45, rb0[1]);
  ctx.stroke();
  ctx.restore();

  // Trunk lid.
  const [t0, t1] = across(P, 0.97, p.tailTop, near + 0.02);
  const deck = ctx.createLinearGradient(0, gb0[1], 0, t0[1]);
  deck.addColorStop(0, mix(BODY, '#ffffff', 0.15));
  deck.addColorStop(1, mix(BODY, SHADE, 0.1));
  ctx.fillStyle = deck;
  rounded(ctx, [t0, t1, gb1, gb0], r);
  ctx.fill();

  // Rear face: body colour, darker diffuser, plate recess, full-width light bar.
  const top = t0[1];
  const bottom = rl[1];
  const h = bottom - top;
  const face = ctx.createLinearGradient(0, top, 0, bottom);
  face.addColorStop(0, mix(BODY, SHADE, 0.18));
  face.addColorStop(1, mix(BODY, SHADE, 0.45));
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.roundRect(rl[0], top, px, h, [r * 1.2, r * 1.2, r * 2.2, r * 2.2]);
  ctx.fill();
  ctx.fillStyle = mix(BODY, SHADE, 0.82);
  ctx.beginPath();
  ctx.roundRect(rl[0] + px * 0.06, top + h * 0.78, px * 0.88, h * 0.22, [0, 0, r * 2, r * 2]);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.roundRect(rl[0] + px * 0.36, top + h * 0.48, px * 0.28, h * 0.2, r * 0.4);
  ctx.fill();

  // Light bar: the full width, taller at the ends; brighter and glowing while braking.
  const barY = top + h * 0.2;
  const barH = Math.max(1.5, h * 0.07);
  ctx.save();
  ctx.fillStyle = braking ? '#ff3b2e' : '#b0261c';
  if (braking) {
    ctx.shadowColor = '#ff3b2e';
    ctx.shadowBlur = px * 0.12;
  }
  ctx.fillRect(rl[0] + px * 0.04, barY, px * 0.92, barH);
  for (const x0 of [0.03, 0.83]) {
    ctx.beginPath();
    ctx.roundRect(rl[0] + px * x0, barY - barH * 0.6, px * 0.14, barH * 2.6, barH);
    ctx.fill();
  }
  ctx.restore();
}
