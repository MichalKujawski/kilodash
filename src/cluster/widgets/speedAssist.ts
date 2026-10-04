import { ASSIST_FUNCTIONS, ASSIST_STATES, TIME_GAPS } from '@/core/assist/SpeedAssist';
import { clamp } from '@/core/math';
import { S } from '@/core/signals/catalog';
import type { FrameContext } from '../renderer/types';
import type { IconId } from '../telltales/icons';
import { SAFETY_COLORS } from '../themes/types';

export interface AssistLook {
  icon: IconId;
  color: string;
  /** Set speed text ("– – –" in standby without a stored speed). */
  setText: string;
  setKmh: number;
  state: (typeof ASSIST_STATES)[number];
  fn: (typeof ASSIST_FUNCTIONS)[number];
}

/**
 * How cruise/ACC/limiter look right now, from the signals alone:
 * active = green (limiter: white), overridden = white, standby and
 * interrupted = grey, take-over = flashing red, limiter exceeded = flashing amber.
 * Returns null when the system is off.
 */
export function assistLook(f: FrameContext): AssistLook | null {
  const st = f.store;
  const t = f.theme;
  let state: AssistLook['state'];
  let fn: AssistLook['fn'];
  if (st.has(S.SpeedAssistState)) {
    state = ASSIST_STATES[st.value(S.SpeedAssistState)] ?? 'off';
    fn = ASSIST_FUNCTIONS[st.value(S.SpeedAssistFunction)] ?? 'cruise';
  } else {
    // Cars that only report cruise on/off and the set speed.
    state =
      st.value(S.CruiseActive) > 0 ? 'active' : st.value(S.CruiseSpeed) > 0 ? 'interrupted' : 'off';
    fn = 'cruise';
  }
  if (state === 'off') return null;
  const setKmh = st.value(S.CruiseSpeed);
  const blink = Math.floor(f.now / 250) % 2 === 0;
  let color: string = t.text.tertiary;
  if (state === 'active' || state === 'hold')
    color = fn === 'limiter' ? t.text.primary : SAFETY_COLORS.info;
  else if (state === 'overridden') color = t.text.primary;
  if (st.value(S.AccTakeover) > 0) color = blink ? SAFETY_COLORS.danger : t.text.tertiary;
  if (st.value(S.LimiterExceeded) > 0) color = blink ? SAFETY_COLORS.caution : t.text.primary;
  return {
    icon: fn === 'acc' ? 'acc' : fn === 'limiter' ? 'limiter' : 'cruise',
    color,
    setText: setKmh > 0 ? String(Math.round(setKmh)) : '– – –',
    setKmh,
    state,
    fn,
  };
}

/**
 * ACC distance graphic (in the speedometer hub): the chosen distance as up to
 * five bars, and the car ahead placed by its real distance relative to the
 * gap ACC is aiming for. The car flashes when it drives off in stop & go.
 */
export function drawAccDistance(
  ctx: CanvasRenderingContext2D,
  f: FrameContext,
  look: AssistLook,
  cx: number,
  bottom: number,
): void {
  const st = f.store;
  const t = f.theme;
  if (look.fn !== 'acc') return;
  const setting = Math.round(st.value(S.AccDistance, 3));
  const engaged = look.state === 'active' || look.state === 'overridden' || look.state === 'hold';
  for (let i = 0; i < TIME_GAPS.length; i++) {
    const w = 46 - i * 6;
    const y = bottom - i * 8;
    const lit = i < setting;
    ctx.fillStyle = lit ? (engaged ? t.text.secondary : t.text.tertiary) : 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, y - 3, w, 4, 2);
    ctx.fill();
  }
  const gap = st.value(S.AccTargetDistance, -1);
  if (gap < 0 || !engaged) return;
  const v = st.value(S.Speed) / 3.6;
  const desired = 4 + v * (TIME_GAPS[setting - 1] ?? 1.6);
  // At the desired gap the car sits just beyond the lit bars.
  const k = clamp(gap / Math.max(desired, 4), 0, 1.6);
  const y = bottom - 6 - k * (setting * 8 + 4);
  const drivingOff = st.value(S.AccLeadDrivingOff) > 0;
  if (drivingOff && Math.floor(f.now / 300) % 2 === 0) return;
  ctx.fillStyle = drivingOff ? t.text.primary : look.color;
  // Rear view of a car: body, roof and two tail-light notches.
  ctx.beginPath();
  ctx.roundRect(cx - 13, y - 10, 26, 9, 2.5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - 9, y - 10);
  ctx.lineTo(cx - 6.5, y - 16);
  ctx.lineTo(cx + 6.5, y - 16);
  ctx.lineTo(cx + 9, y - 10);
  ctx.closePath();
  ctx.fill();
}
