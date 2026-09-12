import { GameState } from '../state/game-state';
import { Slot } from '../state/persistence';
import { contentHash, describeSave, serializeSave } from '../state/save-format';
import { CloudSave } from '../cloud/cloud-save';
import { btn, h } from './dom';

/**
 * The three playthroughs, on the title screen.
 *
 * A slot can exist on this device, in the cloud, or both, and the card says
 * which without making a fuss about it. Where both exist and differ, the card
 * says so and the choosing happens on entry rather than here — picking a slot
 * should never be the moment a save is silently discarded.
 */

export interface SlotView {
  slot: Slot;
  local: GameState | null;
  cloud: CloudSave | null;
}

export function slotPicker(views: SlotView[], onPlay: (slot: Slot) => void): HTMLElement {
  return h('div', { class: 'slots' }, ...views.map((v) => card(v, onPlay)));
}

function card(v: SlotView, onPlay: (slot: Slot) => void): HTMLElement {
  const shown = v.local ?? v.cloud?.state ?? null;
  const kids: (Node | null)[] = [h('div', { class: 'slot-name', text: `Slot ${v.slot}` })];

  if (!shown) {
    kids.push(
      h('div', { class: 'dim', text: 'Empty' }),
      h('div', { class: 'grow' }),
      btn('Begin', () => onPlay(v.slot), 'small'),
    );
  } else {
    const s = describeSave(shown);
    kids.push(
      h('div', { text: `Day ${s.day}` }),
      h('div', { class: 'dim small', text: s.place }),
      h('div', { class: 'dim small', text: `${s.gold.toLocaleString()} gold` }),
      h('div', { class: 'grow' }),
      note(v),
      btn('Continue', () => onPlay(v.slot), 'small primary'),
    );
  }
  return h('div', { class: 'slot-card frame' }, ...kids.filter((k): k is Node => k !== null));
}

/** Say where this slot lives, but only when it is not the ordinary case. */
function note(v: SlotView): HTMLElement | null {
  if (!v.cloud) return null;
  if (!v.local) return h('div', { class: 'blue-t small', text: 'From the cloud' });
  const same = contentHash(serializeSave(v.local)) === contentHash(v.cloud.raw);
  return same ? null : h('div', { class: 'gold-t small', text: 'Two versions — you choose' });
}
