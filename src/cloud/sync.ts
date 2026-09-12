import { GameState } from '../state/game-state';
import { Slot } from '../state/persistence';
import { contentHash, serializeSave } from '../state/save-format';
import { CloudFetch, CloudSave, fetchCloudSlots, uploadSave } from './cloud-save';

/**
 * The local-first sync coordinator.
 *
 * Local saving is untouched and stays synchronous: it happens, then this marks
 * the snapshot dirty and gets around to the network when it can. Every failure
 * here — offline, a dead project, a conflict — leaves the player with a working
 * game and a save on their disk. That is the whole contract.
 *
 * It never installs state. Deciding to replace the running game is the owner's
 * job, because `World` holds direct references to `GameState` and `RunState`
 * and swapping either underneath a live run would be a bug the player pays for.
 */

/** Long enough to swallow a flurry of town clicks, short enough to feel live. */
const DEBOUNCE_MS = 3000;

export type SyncStatus =
  | 'off'
  | 'saved-local'
  | 'syncing'
  | 'synced'
  | 'conflict'
  | 'update-required';

const TEXT: Record<SyncStatus, string> = {
  off: '',
  // Offline, errored and simply-not-sent-yet all read the same to the player:
  // the save is safe, it just is not on the server. Nothing here is worth
  // interrupting a delve with.
  'saved-local': 'Saved on this device',
  syncing: 'Syncing...',
  synced: 'Synced',
  conflict: 'Conflict: choose a save',
  'update-required': 'Update required to use this cloud save',
};

/**
 * What a fresh sign-in found. The caller turns this into a question for the
 * player, or into nothing at all when there is only one candidate.
 */
export type Reconciliation =
  | { kind: 'none' }
  | { kind: 'uploaded' }
  | { kind: 'take-cloud'; save: CloudSave }
  | { kind: 'choose'; save: CloudSave }
  | { kind: 'update-required' };

export interface SyncDeps {
  /** The live state. Read at upload time so a delayed upload sends the truth. */
  state: () => GameState;
  /** The slot being played. Each one is a separate row with its own history. */
  slot: () => Slot;
  /** Whether anything was loaded from localStorage when the page booted. */
  hasLocalSave: () => boolean;
  onStatus: (status: SyncStatus, text: string) => void;
  /** A conflict turned up mid-play; the owner should ask when it is safe to. */
  onConflict?: () => void;
}

export class CloudSync {
  private generation: number | null = null;
  private lastHash: string | null = null;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;
  private active = false;
  /**
   * An unresolved conflict bars every upload.
   *
   * Without this, the debounce is a silent resolver: the player is still
   * looking at the chooser while a timer armed before the conflict was known
   * fires, uploads this device's save at the generation `begin()` just learned,
   * and destroys the other device's progress. The question would answer itself,
   * always in favour of whoever was holding the phone.
   */
  private blocked = false;
  private _status: SyncStatus = 'off';
  /** Where this playthrough actually lives in the cloud, which need not be the
   * slot this device files it under. */
  private cloudSlot: Slot | null = null;

  constructor(private deps: SyncDeps) {
    // A device that was offline when it last tried is the common case for a
    // phone; retry the moment the network comes back rather than on the next
    // save, which might be a whole delve away.
    window.addEventListener('online', () => {
      if (this.active && this.dirty) void this.push();
    });
  }

  get status(): SyncStatus {
    return this._status;
  }

  private set(status: SyncStatus): void {
    this._status = status;
    this.deps.onStatus(status, TEXT[status]);
  }

  /**
   * Sign-in: work out what the player has where. Nothing is installed and
   * nothing is overwritten — a decision that could lose progress is always
   * returned to the caller to ask about.
   */
  async begin(): Promise<Reconciliation> {
    this.active = true;
    this.set('syncing');
    let all: Map<Slot, CloudFetch>;
    try {
      all = await fetchCloudSlots();
    } catch {
      this.set('saved-local');
      return { kind: 'none' };
    }

    const match = this.findMine(all);

    if (match === 'incompatible') {
      this.set('update-required');
      return { kind: 'update-required' };
    }

    if (!match) {
      // This playthrough has no copy in the cloud. Someone who has been playing
      // offline and just signed in lands here: their game goes up as it is, and
      // there is nothing up there for it to displace.
      this.cloudSlot = null;
      this.generation = null;
      if (!this.deps.hasLocalSave()) {
        this.set('synced');
        return { kind: 'none' };
      }
      const ok = await this.push();
      return ok ? { kind: 'uploaded' } : { kind: 'none' };
    }

    this.cloudSlot = match.slot;
    this.generation = match.generation;

    // Same bytes on both sides: nothing happened while this device was away.
    if (contentHash(match.raw) === contentHash(serializeSave(this.deps.state()))) {
      this.lastHash = contentHash(match.raw);
      this.set('synced');
      return { kind: 'none' };
    }

    // Nothing of the player's own on this device, so there is no question to
    // ask: the cloud save is the only progress that exists.
    if (!this.deps.hasLocalSave()) {
      this.set('synced');
      return { kind: 'take-cloud', save: match };
    }

    this.blocked = true;
    this.set('conflict');
    return { kind: 'choose', save: match };
  }

  /**
   * Find this playthrough in the cloud by its identity, wherever it is filed.
   * A row written before ids existed can only be matched by position, and only
   * where this device files this game — nothing else could have put it there.
   */
  private findMine(all: Map<Slot, CloudFetch>): CloudSave | 'incompatible' | null {
    const mine = this.deps.state().saveId;
    if (mine) {
      for (const found of all.values()) {
        if (found.kind === 'save' && found.save.state.saveId === mine) return found.save;
      }
    }
    const here = all.get(this.deps.slot());
    if (here?.kind === 'incompatible') return 'incompatible';
    if (here?.kind === 'save' && !here.save.state.saveId) return here.save;
    return null;
  }

  /** The player chose this device. Their snapshot replaces the cloud row. */
  async keepLocal(): Promise<void> {
    this.blocked = false;
    this.dirty = true;
    await this.push(true);
  }

  /** The player chose the cloud save; the caller has installed it. */
  adopt(save: CloudSave): void {
    this.blocked = false;
    this.cloudSlot = save.slot;
    this.generation = save.generation;
    this.lastHash = contentHash(save.raw);
    this.dirty = false;
    this.set('synced');
  }

  /**
   * Point the coordinator at a different slot. Generation and hash describe one
   * row, so carrying them across would have this device claim it was replacing
   * a generation belonging to another playthrough.
   */
  switchSlot(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.blocked = false;
    this.dirty = false;
    this.cloudSlot = null;
    this.generation = null;
    this.lastHash = null;
  }

  /** Sign-out, or a switch to another account. */
  reset(): void {
    this.active = false;
    this.blocked = false;
    this.dirty = false;
    this.generation = null;
    this.lastHash = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.set('off');
  }

  /**
   * A local save just happened. Cheap and safe to call from anywhere, including
   * the fifteen-second checkpoint inside a run: it only ever arms a timer.
   */
  touch(): void {
    if (!this.active || this._status === 'update-required') return;
    this.dirty = true;
    if (this._status === 'synced') this.set('saved-local');
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.push();
    }, DEBOUNCE_MS);
  }

  /** A checkpoint worth not losing: a floor, the trip home, the end of a run. */
  flush(): void {
    if (!this.active || !this.dirty) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    void this.push();
  }

  /**
   * Send the current snapshot, unless it would change nothing. Returns whether
   * the row now holds this device's state.
   */
  private async push(force = false): Promise<boolean> {
    if (this.busy || (!this.dirty && !force)) return false;
    // A conflict the player has not answered yet outranks any pending upload.
    if (this.blocked && !force) return false;
    if (!navigator.onLine) {
      this.set('saved-local');
      return false;
    }

    const state = this.deps.state();
    const raw = serializeSave(state);
    const hash = contentHash(raw);
    // Town UI churn reaches the same save path as real progress, so most of
    // what arrives here is identical to what was already sent.
    if (hash === this.lastHash && !force) {
      this.dirty = false;
      this.set('synced');
      return true;
    }

    this.busy = true;
    this.set('syncing');
    try {
      const res = await uploadSave(this.cloudSlot ?? this.deps.slot(), state, this.generation);
      if (res.status === 'ok' || res.status === 'unchanged') {
        this.cloudSlot = res.slot;
        this.generation = res.generation;
        this.lastHash = hash;
        this.dirty = false;
        this.set('synced');
        return true;
      }
      if (res.status === 'stale_client') {
        this.set('update-required');
        return false;
      }
      // Conflict: another device moved on. The save is safe here; resolving is
      // a question for town or the title screen, never mid-delve.
      this.generation = res.generation;
      this.blocked = true;
      this.set('conflict');
      this.deps.onConflict?.();
      return false;
    } catch {
      // Offline, asleep, or the project is down. The local save already landed.
      this.set('saved-local');
      return false;
    } finally {
      this.busy = false;
    }
  }
}
