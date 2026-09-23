import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '../core/rng';
import { GameState, newGame } from '../state/game-state';
import { contentHash, serializeSave } from '../state/save-format';
import { SAVE_REVISION } from '../state/migrations';
import type { CloudFetch, CloudSave } from '../cloud/cloud-save';

const fetchCloudSlots = vi.fn<() => Promise<Map<number, CloudFetch>>>();
const uploadSave = vi.fn();
vi.mock('../cloud/cloud-save', () => ({
  fetchCloudSlots: () => fetchCloudSlots(),
  uploadSave: (...args: unknown[]) => uploadSave(...args),
}));
vi.mock('../cloud/device', () => ({ deviceId: () => 'this-device' }));

const { CloudSync } = await import('../cloud/sync');
const { loadGame } = await import('../state/persistence');

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  fetchCloudSlots.mockReset();
  uploadSave.mockReset();
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  });
});

function cloudRow(state: GameState, generation: number, device = 'other-device'): Map<number, CloudFetch> {
  const save: CloudSave = { slot: 2, saveId: state.saveId ?? null, state, generation, updatedAt: '2026-09-19T00:00:00Z', device, raw: serializeSave(state) } as CloudSave;
  return new Map([[2, { kind: 'save', save }]]);
}

function sync(local: GameState) {
  return new CloudSync({ state: () => local, slot: () => 2, hasLocalSave: () => true, onStatus: () => {} });
}

describe('sign-in after a save-revision bump', () => {
  it('uploads local progress when the cloud row is untouched, even though migration changed its hash', async () => {
    const cloud = newGame(createRng(1));
    cloud.saveId = 'game-1';
    const local = JSON.parse(serializeSave(cloud)) as GameState;
    local.gold += 500;
    // The last agreement, as the previous build recorded it: generation 5, and
    // a hash of that build's serialization, which no longer matches anything
    // this build produces once migrations add fields.
    store.set('looting-simulator-sync-v1-game-1', JSON.stringify({ generation: 5, hash: 'hash-from-the-old-build', cloudSlot: 2 }));
    fetchCloudSlots.mockResolvedValue(cloudRow(cloud, 5));
    uploadSave.mockResolvedValue({ status: 'ok', slot: 2, generation: 6, updatedAt: 'now' });

    const result = await sync(local).begin();

    expect(result.kind).toBe('uploaded');
    expect(uploadSave).toHaveBeenCalledTimes(1);
    expect(uploadSave.mock.calls[0][2]).toBe(5);
  });

  it('still asks when another device really did write since the last agreement', async () => {
    const cloud = newGame(createRng(2));
    cloud.saveId = 'game-2';
    cloud.gold += 100;
    const local = JSON.parse(serializeSave(cloud)) as GameState;
    local.gold += 900;
    store.set('looting-simulator-sync-v1-game-2', JSON.stringify({ generation: 5, hash: 'hash-from-the-old-build', cloudSlot: 2 }));
    fetchCloudSlots.mockResolvedValue(cloudRow(cloud, 7));

    const result = await sync(local).begin();

    expect(result.kind).toBe('choose');
    expect(uploadSave).not.toHaveBeenCalled();
  });

  it('takes the cloud when only the cloud moved on', async () => {
    const local = newGame(createRng(3));
    local.saveId = 'game-3';
    const localHash = (await import('../state/save-format')).contentHash(serializeSave(local));
    const cloud = JSON.parse(serializeSave(local)) as GameState;
    cloud.gold += 300;
    store.set('looting-simulator-sync-v1-game-3', JSON.stringify({ generation: 5, hash: localHash, cloudSlot: 2 }));
    fetchCloudSlots.mockResolvedValue(cloudRow(cloud, 6));

    const result = await sync(local).begin();

    expect(result.kind).toBe('take-cloud');
    expect(uploadSave).not.toHaveBeenCalled();
  });
});

describe('an untouched save loaded across a save-revision bump', () => {
  const META = 'looting-simulator-sync-v1-game-4';
  const SLOT_KEY = 'looting-simulator-save-v2-s2';

  /** The save as the previous build left it on disk: one revision older. */
  function oldBuildRaw(state: GameState): string {
    const raw = serializeSave(state);
    const stamp = `"revision":${SAVE_REVISION}`;
    expect(raw).toContain(stamp);
    return raw.replace(stamp, `"revision":${SAVE_REVISION - 1}`);
  }

  it('takes the cloud when another device wrote, rather than asking about a save nobody touched', async () => {
    const agreed = newGame(createRng(4));
    agreed.saveId = 'game-4';
    const raw = oldBuildRaw(agreed);
    store.set(SLOT_KEY, raw);
    store.set(META, JSON.stringify({ generation: 5, hash: contentHash(raw), cloudSlot: 2 }));
    const cloud = JSON.parse(serializeSave(agreed)) as GameState;
    cloud.gold += 300;
    fetchCloudSlots.mockResolvedValue(cloudRow(cloud, 6));

    const local = loadGame(2)!;
    // Migration re-stamps the revision, so this build hashes it differently…
    expect(contentHash(serializeSave(local))).not.toBe(contentHash(raw));
    const result = await sync(local).begin();

    // …but it is the same game the last agreement recorded.
    expect(result.kind).toBe('take-cloud');
    expect(uploadSave).not.toHaveBeenCalled();
  });

  it('leaves the agreement alone when the save on disk had moved on from it', async () => {
    const agreed = newGame(createRng(5));
    agreed.saveId = 'game-4';
    const played = JSON.parse(serializeSave(agreed)) as GameState;
    played.gold += 900;
    store.set(SLOT_KEY, oldBuildRaw(played));
    const agreement = JSON.stringify({ generation: 5, hash: contentHash(oldBuildRaw(agreed)), cloudSlot: 2 });
    store.set(META, agreement);

    loadGame(2);

    expect(store.get(META)).toBe(agreement);
  });
});
