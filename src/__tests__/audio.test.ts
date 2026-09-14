import { describe, expect, it, afterEach } from 'vitest';
import { audio } from '../audio/sfx';

/** Map-backed localStorage, since these tests run outside a browser. */
function installFakeStorage(fill: Record<string, string> = {}): Map<string, string> {
  const store = new Map<string, string>(Object.entries(fill));
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  } as Storage;
  return store;
}

afterEach(() => {
  audio.setMuted(false);
  audio.setVolume(0.7);
});

describe('audio prefs', () => {
  it('clamps volume to 0..1', () => {
    audio.setVolume(1.5);
    expect(audio.volume).toBe(1);
    audio.setVolume(-0.2);
    expect(audio.volume).toBe(0);
  });

  it('toggles and explicitly sets mute', () => {
    expect(audio.toggleMute()).toBe(true);
    expect(audio.toggleMute()).toBe(false);
    expect(audio.setMuted(true)).toBe(true);
    expect(audio.muted).toBe(true);
  });

  it('persists volume and mute, and reloads them', () => {
    const store = installFakeStorage();
    audio.setVolume(0.42);
    audio.setMuted(true);
    expect(store.get('looting-simulator-audio-volume')).toBe('0.42');
    expect(store.get('looting-simulator-audio-muted')).toBe('1');

    // Simulate a fresh boot reading the same storage: snapshot what was
    // persisted, drift the live engine (which rewrites storage as it goes),
    // then put the snapshot back and reload.
    const vol = store.get('looting-simulator-audio-volume')!;
    const mut = store.get('looting-simulator-audio-muted')!;
    audio.setVolume(0.9);
    audio.setMuted(false);
    store.set('looting-simulator-audio-volume', vol);
    store.set('looting-simulator-audio-muted', mut);
    audio.loadPrefs();
    expect(audio.volume).toBeCloseTo(0.42);
    expect(audio.muted).toBe(true);
  });

  it('falls back to defaults on garbage', () => {
    installFakeStorage({
      'looting-simulator-audio-volume': 'not-a-number',
      'looting-simulator-audio-muted': 'maybe',
    });
    audio.loadPrefs();
    expect(audio.volume).toBe(0.7);
    expect(audio.muted).toBe(false);
  });
});
