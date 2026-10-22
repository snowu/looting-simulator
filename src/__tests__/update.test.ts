import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildUpdateUrl,
  isNewerBuild,
  markResumeAfterUpdate,
  takeResumeAfterUpdate,
  versionedAssetUrl,
} from '../ui/update';

describe('versioning system', () => {
  it('detects a newer build only when ids differ', () => {
    expect(isNewerBuild('abc', 'abc')).toBe(false);
    expect(isNewerBuild('abc', 'def')).toBe(true);
    expect(isNewerBuild('abc', null)).toBe(false);
    expect(isNewerBuild('abc', undefined)).toBe(false);
    expect(isNewerBuild('abc', '')).toBe(false);
  });

  it('builds a fresh page URL that busts the cached page', () => {
    const url = buildUpdateUrl('https://example.com/looting-simulator/', '/looting-simulator/', 'def1234');
    expect(url).toBe('https://example.com/looting-simulator/?v=def1234');
  });

  it('keeps the deployment path when the tab sits on a sub-URL', () => {
    // Installed/shortcut launches can sit at ./ with ?v= already present.
    const url = buildUpdateUrl(
      'https://example.com/looting-simulator/?v=oldid',
      '/looting-simulator/',
      'newid',
    );
    expect(url).toBe('https://example.com/looting-simulator/?v=newid');
  });

  it('versions unhashed public assets so a new build downloads them again', () => {
    expect(versionedAssetUrl('/looting-simulator/art/manifest.json', 'abc1234')).toBe(
      '/looting-simulator/art/manifest.json?v=abc1234',
    );
    expect(versionedAssetUrl('/looting-simulator/art/rat_0.png', 'abc1234')).toBe(
      '/looting-simulator/art/rat_0.png?v=abc1234',
    );
  });

  it('appends to an existing query instead of starting a second one', () => {
    expect(versionedAssetUrl('/looting-simulator/art/manifest.json?t=1', 'abc')).toBe(
      '/looting-simulator/art/manifest.json?t=1&v=abc',
    );
  });

  it('leaves dev asset URLs alone', () => {
    expect(versionedAssetUrl('/art/manifest.json', 'dev')).toBe('/art/manifest.json');
  });
});

describe('resuming a delve after an update', () => {
  const store = new Map<string, string>();
  const fake = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  const g = globalThis as { sessionStorage?: unknown };
  let saved: unknown;
  beforeEach(() => {
    saved = g.sessionStorage;
    g.sessionStorage = fake;
    store.clear();
  });
  afterEach(() => {
    g.sessionStorage = saved;
  });

  it('hands the slot to the next boot, once', () => {
    markResumeAfterUpdate(2);
    expect(takeResumeAfterUpdate()).toBe(2);
    expect(takeResumeAfterUpdate()).toBe(null);
  });

  it('is empty when no update asked for it', () => {
    expect(takeResumeAfterUpdate()).toBe(null);
  });

  it('shrugs off blocked storage', () => {
    g.sessionStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} };
    expect(() => markResumeAfterUpdate(1)).not.toThrow();
    expect(takeResumeAfterUpdate()).toBe(null);
  });
});
