import type { SignalId } from '@/core/signals/types';
import type { VehicleEnv, Widget } from '../renderer/types';
import { WIDGETS } from '../widgets/registry';
import type { LayoutDefinition, WidgetSpec } from './types';

export interface ResolvedSlot {
  slotId: string;
  spec: WidgetSpec | null;
}

/**
 * Picks, for each slot, the first candidate widget whose required signals are all
 * available. Slots with no viable candidate stay empty (never faked).
 */
export function resolveLayout(
  layout: LayoutDefinition,
  available: ReadonlySet<SignalId>,
): ResolvedSlot[] {
  return layout.slots.map((slot) => {
    const spec =
      slot.candidates.find((c) => {
        const factory = WIDGETS.get(c.type);
        return (
          factory !== undefined && factory.requires(c.props ?? {}).every((id) => available.has(id))
        );
      }) ?? null;
    return { slotId: slot.id, spec };
  });
}

export function buildWidgets(
  layout: LayoutDefinition,
  available: ReadonlySet<SignalId>,
  env: VehicleEnv,
): Widget[] {
  const resolved = resolveLayout(layout, available);
  const out: Widget[] = [];
  resolved.forEach((r, i) => {
    if (!r.spec) return;
    const factory = WIDGETS.get(r.spec.type)!;
    out.push(factory.create(layout.slots[i]!.rect, r.spec.props ?? {}, env));
  });
  return out;
}
