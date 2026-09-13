import { GameState } from '../state/game-state';
import { SaveSummary, describeSave, sanitizeSaveName } from '../state/save-format';
import { btn, h } from './dom';

/**
 * The two-column chooser shown when a device and the cloud both hold progress
 * and they disagree.
 *
 * It never picks for the player. Day, gold and depth can each legitimately go
 * backwards — a bad delve costs gold, a fresh run resets the depth — so there
 * is no field here that reliably means "newer", and guessing wrong quietly
 * destroys a run someone actually played. Both sides are described; the player
 * decides.
 */

export interface ChooserOpts {
  local: GameState;
  cloud: GameState;
  /** When the cloud row was last written, as an ISO timestamp. */
  cloudUpdatedAt: string;
  onKeepLocal: () => void;
  onTakeCloud: () => void;
  onDismiss: () => void;
}

function ago(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'earlier';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function column(title: string, s: SaveSummary, when: string, action: HTMLElement): HTMLElement {
  // A custom name is the fastest way to tell two otherwise identical saves
  // apart — which is exactly what a rename-only divergence looks like.
  const name = sanitizeSaveName(s.name);
  return h(
    'div',
    { class: 'save-col frame' },
    h('h3', { text: title }),
    name ? h('div', { class: 'gold-t', text: `“${name}”` }) : null,
    h('div', { text: `Day ${s.day}` }),
    h('div', { text: s.place }),
    h('div', { text: `${s.gold.toLocaleString()} gold banked · ${s.difficulty}` }),
    h('div', { class: 'dim small', text: `${s.runs} delve${s.runs === 1 ? '' : 's'} · saved ${when}` }),
    action,
  );
}

export function saveChooser(opts: ChooserOpts): HTMLElement {
  return h(
    'div',
    { class: 'modal-wrap' },
    h(
      'div',
      { class: 'modal frame gold save-chooser' },
      h('h2', { text: 'Two saves' }),
      h('p', { class: 'dim', text: 'This device and the cloud have both moved on since they last agreed. Pick the one to keep playing — the other is replaced.' }),
      h(
        'div',
        { class: 'save-cols' },
        column('This device', describeSave(opts.local), 'now', btn('Continue this device', opts.onKeepLocal, 'primary')),
        column('Cloud save', describeSave(opts.cloud), ago(opts.cloudUpdatedAt), btn('Continue cloud save', opts.onTakeCloud, 'primary')),
      ),
      h('div', { class: 'row', style: 'justify-content:center;margin-top:10px' },
        btn('Keep playing offline', opts.onDismiss, 'small'),
      ),
      h('p', { class: 'faint small', style: 'text-align:center;margin-top:6px', text: 'Nothing is uploaded or replaced until you choose.' }),
    ),
  );
}
