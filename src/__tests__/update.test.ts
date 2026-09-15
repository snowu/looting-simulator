import { describe, expect, it } from 'vitest';
import {
  buildUpdateUrl,
  isNewerBuild,
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
