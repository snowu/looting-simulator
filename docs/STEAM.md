# Shipping on Steam

What it would take to publish Looting Simulator on Steam, as assessed on
**2026-10-17** (at commit `9ca1d68`). Nothing here is built yet. Re-check the
art numbers with `npm run art:status` and the Steam figures against Steamworks
before planning around them.

## Summary

| Part | Effort |
|---|---|
| Wrapping the game for desktop and Steam | ~2–4 weeks of engineering |
| Valve's process | ~1 month of calendar time, little work |
| Content for a paid release (art, music) | months, set by the artist and the composer |

The engineering is small. What decides the date is the content: most sprites
are still placeholders, and the game has no music.

## Already in place

- **The build is portable.** `npx vite build --base=./` produced 3.4 MB of
  static files with every path relative, which is what a desktop wrapper needs.
  `vite.config.ts` hardcodes `base: '/looting-simulator/'` for GitHub Pages, so a
  Steam build overrides it.
- **Gamepad support** exists (`src/ui/gamepad.ts`), the biggest piece of Steam
  Deck support.
- **No server needed.** Sound is synthesised with WebAudio (`src/audio/sfx.ts`),
  saves are local and work offline, and Supabase is optional.
- **Licences are fine.** three.js is MIT and the fonts are OFL.

## Engineering work

| Task | Effort |
|---|---|
| **Electron wrapper.** Electron rather than Tauri: Tauri uses WebKitGTK on Linux and the Steam Deck, where WebGL is unreliable. Electron ships its own Chromium, so it behaves the same everywhere at a cost of ~150 MB. | 1–3 days |
| **A Steam build flag** that turns off the web-only features: the service worker (`src/pwa/register.ts`), the update banner (`src/ui/update.ts`), the Google Fonts link in `index.html` (bundle those fonts like the two in `src/assets/fonts`), the GitHub bug-report link, and Supabase sign-in. | 2–4 days |
| **Desktop basics.** Quit to desktop (only "back to title" exists), windowed, fullscreen and resolution settings, and checking pointer lock under Electron. | 2–3 days |
| **Saves as files.** Saves go through `localStorage` in `src/state/persistence.ts`. Under Electron that lands in a LevelDB blob Steam Cloud cannot sync, so the Steam build writes real files through the wrapper. `persistence.ts` is the one door to storage, so the change stays small. The [save rules](../CONTRIBUTING.md) still apply. | 2–3 days |
| **Steamworks** via `steamworks.js`: Steam Cloud save paths, achievements (optional but expected), the overlay (often temperamental under Electron), and a Linux build. | 3–5 days |
| **Steam Deck pass.** Every menu works with a controller alone, text entry (save names) opens the on-screen keyboard, and the UI reads at 1280×800. Touch controls don't apply there. | 3–7 days, depending on how much of the town UI the gamepad already reaches |

### Moving web saves to Steam

Players on the web version have no way to carry a save over. An export/import
save option in Settings would cover it cheaply.

## Content

- **Art.** `npm run art:status` on 2026-10-17:

  | Folder | Painted |
  |---|---|
  | enemies | 0 / 98 |
  | icons | 69 / 82 |
  | props | 0 / 91 |
  | textures | 0 / 97 |
  | ui | 0 / 2 |
  | viewmodels | 0 / 27 |
  | **all** | **69 / 397 (17%)** |

  That leaves 328 sprites, months of artist time, and the store page and trailer
  are judged on them.
- **Music.** None yet. Synthesised SFX are fine, but a dungeon crawler with no
  music will draw comments in reviews. Plan on licensing or commissioning it.
- **Balance.** [NEXT.md](NEXT.md) holds the balance pass back until real
  playtesting. A Steam Playtest or a demo is a good source of it.

## Valve's process

Not verified against current Steamworks docs:

- The Steam Direct fee is $100 per game.
- There's a 30-day wait between paying and being allowed to release.
- The "Coming Soon" page must be live for at least 2 weeks, and longer helps
  wishlists.
- Build and store-page reviews take a few days each.
- The store needs capsule images, screenshots and a trailer: a few days of work.

## Suggested order

1. Electron wrapper and Steam build flag, run alongside the web version off the
   same codebase.
2. Store page up as "Coming Soon" early, so wishlists build while the art is
   painted.
3. Steamworks, Steam Deck pass and save export/import.
4. Release once the art and music are in.
