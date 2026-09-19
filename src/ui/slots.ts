import { GameState } from '../state/game-state';
import { DIFFICULTIES, DIFFICULTY_IDS, DifficultyId } from '../data/difficulty';
import { Slot } from '../state/persistence';
import { MAX_SAVE_NAME, describeSave, fallenRecord, displaySaveName, progressHash, sanitizeSaveName } from '../state/save-format';
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
  /** A cloud save this build is too old to read. Shown, never overwritten. */
  cloudUnreadable?: boolean;
}

/**
 * Entering a slot. `difficulty` is set only when this is a brand-new game and
 * the player picked one on the card; continuing a save carries its own, and
 * passing anything here would overwrite it.
 */
export type OnPlay = (slot: Slot, difficulty?: DifficultyId) => void;

export interface SlotActions {
  onRename?: (slot: Slot, name: string) => void;
  onDelete?: (slot: Slot) => void;
}

export function slotPicker(views: SlotView[], onPlay: OnPlay, actions: SlotActions = {}): HTMLElement {
  return h('div', { class: 'slots' }, ...views.map((v) => card(v, onPlay, actions)));
}

type CardMode = 'view' | 'rename' | 'confirm' | 'difficulty';

function card(v: SlotView, onPlay: OnPlay, actions: SlotActions): HTMLElement {
  const el = h('div', { class: 'slot-card frame' });
  let mode: CardMode = 'view';
  const render = (): void => {
    el.replaceChildren();
    if (mode === 'rename') for (const k of renameEls()) el.append(k);
    else if (mode === 'difficulty') for (const k of difficultyEls()) el.append(k);
    else if (mode === 'confirm') for (const k of confirmEls()) el.append(k);
    else for (const k of viewEls()) el.append(k);
  };

  function title(): string {
    const shown = v.local ?? v.cloud?.state ?? null;
    return displaySaveName(shown?.name, v.slot);
  }

  /** The card as the player normally sees it. */
  function viewEls(): Node[] {
    const shown = v.local ?? v.cloud?.state ?? null;
    if (!shown && v.cloudUnreadable) {
      // There is a save here; this build just cannot read it. Saying "Empty"
      // would invite starting a new game straight over the top of it — and for
      // the same reason it offers no rename and no delete.
      return [
        h('div', { class: 'slot-name', text: `Slot ${v.slot}` }),
        h('div', { class: 'gold-t small', text: 'Needs a newer version' }),
        h('div', { class: 'grow' }),
        btn('Update', () => location.reload(), 'small'),
      ];
    }
    if (!shown) {
      return [
        h('div', { class: 'slot-name', text: `Slot ${v.slot}` }),
        h('div', { class: 'dim', text: 'Empty' }),
        h('div', { class: 'grow' }),
        btn('Begin', () => { mode = 'difficulty'; render(); }, 'small'),
      ];
    }
    const s = describeSave(shown);
    const kids: Node[] = [h('div', { class: 'slot-name', text: title() })];
    if (sanitizeSaveName(s.name)) kids.push(h('div', { class: 'dim small', text: `Slot ${v.slot}` }));
    kids.push(
      h('div', { text: `Day ${s.day}` }),
      h('div', { class: 'dim small', text: s.place }),
      h('div', { class: 'dim small', text: `${s.gold.toLocaleString()} gold · ${s.difficulty}` }),
      h('div', { class: 'grow' }),
    );
    const n = note(v);
    if (n) kids.push(n);
    // A fallen Hardcore hero: a headstone, not a game. It can be read, named
    // and deleted, never continued.
    const fallen = fallenRecord(shown) ?? (v.cloud ? fallenRecord(v.cloud.state) : null);
    if (fallen) {
      kids.push(h('div', {
        class: 'red-t small',
        text: `Fallen${fallen.killedBy ? ` to ${fallen.killedBy}` : ''} on day ${fallen.day}`,
      }));
      if (actions.onRename || actions.onDelete) {
        kids.push(h(
          'div',
          { class: 'row', style: 'margin-top:4px' },
          actions.onRename ? btn('Rename', () => { mode = 'rename'; render(); }, 'small') : null,
          actions.onDelete ? btn('Delete', () => { mode = 'confirm'; render(); }, 'small') : null,
        ));
      }
      return kids;
    }
    // A save taken mid-delve resumes straight back in the dungeon, so say so:
    // "Continue" undersells the teleport.
    const midDelve = !!shown.run && shown.run.outcome === 'active';
    kids.push(btn(midDelve ? 'Resume delve' : 'Continue', () => onPlay(v.slot), 'small primary'));
    if (actions.onRename || actions.onDelete) {
      kids.push(h(
        'div',
        { class: 'row', style: 'margin-top:4px' },
        actions.onRename ? btn('Rename', () => { mode = 'rename'; render(); }, 'small') : null,
        actions.onDelete ? btn('Delete', () => { mode = 'confirm'; render(); }, 'small') : null,
      ));
    }
    return kids;
  }

  /** An inline editor: the slot never leaves the title screen to be renamed. */
  function renameEls(): Node[] {
    const current = sanitizeSaveName(v.local?.name ?? v.cloud?.state?.name ?? '');
    const input = h('input', {
      attrs: { type: 'text', maxlength: String(MAX_SAVE_NAME), placeholder: `Slot ${v.slot}` },
    });
    input.value = current;
    const save = (): void => {
      actions.onRename?.(v.slot, input.value);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      else if (e.key === 'Escape') { mode = 'view'; render(); }
      e.stopPropagation();
    });
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
    return [
      h('div', { class: 'slot-name', text: `Slot ${v.slot}` }),
      h('div', { class: 'dim small', text: 'Name this save' }),
      input,
      h('div', { class: 'grow' }),
      h(
        'div',
        { class: 'row', style: 'margin-top:4px' },
        btn('Save', save, 'small primary'),
        btn('Cancel', () => { mode = 'view'; render(); }, 'small'),
      ),
    ];
  }

  /**
   * Picked once, when the save is created. Hard is preselected because it is
   * the game as it was and the default everything else assumes; Normal is a
   * deliberate choice, not somewhere you land by mishitting a button. It stays
   * changeable later behind the gear in town, between delves.
   */
  function difficultyEls(): Node[] {
    let picked: DifficultyId = 'hard';
    const rows = h('div', { class: 'slot-diff' });
    const paint = (): void => {
      rows.replaceChildren(...DIFFICULTY_IDS.map((id) => {
        const def = DIFFICULTIES[id];
        const b = btn(def.name, () => { picked = id; paint(); }, `small${picked === id ? ' primary' : ''}`);
        b.title = def.description;
        return h('div', { class: 'row' }, b, h('span', { class: 'dim small', text: def.tagline }));
      }));
      // Tooltips never show on a phone, so the one choice that cannot be
      // undone says so on the card itself.
      if (DIFFICULTIES[picked].oneLife) {
        rows.append(h('div', { class: 'red-t small', text: 'One death ends this save for good. Cannot be changed later.' }));
      }
    };
    paint();
    return [
      h('div', { class: 'slot-name', text: `Slot ${v.slot}` }),
      h('div', { class: 'dim small', text: 'How hard?' }),
      rows,
      h('div', { class: 'grow' }),
      h(
        'div',
        { class: 'row', style: 'margin-top:4px' },
        btn('Begin', () => onPlay(v.slot, picked), 'small primary'),
        btn('Back', () => { mode = 'view'; render(); }, 'small'),
      ),
    ];
  }

  /** Deleting is forever, here and in the cloud, so it asks twice. */
  function confirmEls(): Node[] {
    return [
      h('div', { class: 'slot-name', text: title() }),
      h('div', { class: 'red-t', text: 'Delete this save?' }),
      h('div', { class: 'dim small', text: 'Gone here and in the cloud. There is no undo.' }),
      h('div', { class: 'grow' }),
      h(
        'div',
        { class: 'row', style: 'margin-top:4px' },
        btn('Delete forever', () => actions.onDelete?.(v.slot), 'small danger'),
        btn('Keep', () => { mode = 'view'; render(); }, 'small'),
      ),
    ];
  }

  render();
  return el;
}

/** Say where this slot lives, but only when it is not the ordinary case. */
function note(v: SlotView): HTMLElement | null {
  if (!v.cloud) return null;
  if (!v.local) return h('div', { class: 'blue-t small', text: 'From the cloud' });
  const same = progressHash(v.local) === progressHash(v.cloud.state);
  return same ? null : h('div', { class: 'gold-t small', text: 'Two versions — you choose' });
}
