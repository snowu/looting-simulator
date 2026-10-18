# Native port assessment

Assessment date: 2026-10-18. Source snapshots: Looting Simulator `40f7b79`; sibling `zig-game-lab` `57cea52`. This is a source-based engineering estimate, not a port implementation or a native performance benchmark.

## Recommendation and expected effort

Porting Looting Simulator to the Zig/SDL_GPU approach used by `zig-game-lab` is feasible. It would produce native executables without Electron and could retain a browser edition built from the same Zig gameplay code. It is a substantial rewrite of implementation, while preserving the existing game design, content, art and save contract.

Use the lab's platform/build foundation, then build the dungeon renderer and game UI this game needs. Keep this repository as the game's home and keep `public/art` as its sole editable sprite source. Do not move the game into the swarm survivor's simulation or treat its 2D renderer as a ready-made dungeon engine.

The execution model should be agent-assisted development with human direction and play review. Existing source, shaders, art, tests and a working Zig host give agents concrete implementations to translate and compare. This removes much of the discovery and manual transcription work implicit in conventional staffing estimates. Independent implementation work can also overlap once the shared types and interfaces are settled.

**The earlier 18–30 engineer-week / 4–7 month forecast is withdrawn.** It was not calibrated to this workflow or measured porting throughput. Source line counts establish scope, not calendar duration. Applying an arbitrary agent speed multiplier would not fix that mistake either.

Use short experimental budgets and measurable completion gates:

| Milestone | Initial planning budget | Required result |
| --- | --- | --- |
| First native dungeon rendering | One focused working day | Reuse the lab host, load existing art and a fixed floor fixture, draw perspective geometry and a billboard with depth and basic lighting |
| Representative playable slice | 2–3 focused working days total, including the first checkpoint | Movement, one melee enemy, attack/guard, a small inventory interaction, sample save import/resume, Linux/Windows builds and the corresponding browser rendering path |
| Desktop/browser feature parity | Forecast after measuring the slice | All gameplay, UI, effects, audio, saves, cloud features and browser/offline behavior pass an explicit feature checklist |
| macOS | Estimate after a build/render probe | Metal shader path, pinned dependency integration, packaging/signing and hardware testing |
| Android / iOS | Estimate after a minimal device build for each | Working graphics, input, suspend/resume and storage before expanding to full game testing |

The day counts are proposed timeboxes for an experiment, **not measured completion estimates or promises**. They assume sustained agent work, prompt human review, working toolchains and available desktop test hosts. At each checkpoint, report what actually runs, what remains, and where time went. A failed timebox should produce a specific blocker and revised scope, rather than silently expanding into weeks.

This assessment supports starting with a small commitment measured in days. It does not yet support a reliable full-release date. Establish that from completed, integrated features and remaining dependency chains; separately track time waiting for devices, credentials, signing or store review. Console ports, redesign, localization and new accessibility features are outside this assessment.

Changing only the web host to Cloudflare is a small configuration task using an existing deployment pattern. Save transfer and rollout verification are separate completion gates. Hosting changes do not produce native applications.

## What the lab already provides

The implementation confirms three distinct paths:

- Native: Zig, SDL3 window/input/audio, SDL_GPU, Slang compiled to SPIR-V. `src/main.zig` requests only `SDL_GPU_SHADERFORMAT_SPIRV`; `src/gfx.zig` loads only that format. This currently selects the Vulkan path.
- Browser: `src/web.zig` compiles to `wasm32-freestanding`; `web/main.js` supplies WebGL2, Web Audio, input and localStorage. The browser does not run the native SDL/Vulkan renderer. Its GLSL sprite shader is a separate implementation of the native shader.
- Delivery: `tools/site.sh` assembles the browser build and Linux/Windows downloads. The release workflow uploads that static site to a Cloudflare assets Worker.

Useful reusable work includes build tasks, embedded PNG decoding, texture upload, audio hosting, gamepad mapping, screenshots, packaging and the browser/Wasm bridge. However, the lab's roughly 10,944 lines of Zig include its own game, not just reusable platform infrastructure. Its `draw.zig` and shader render screen-space sprite quads into three layers. They do not implement this game's perspective camera, depth-tested dungeon geometry, point lighting or post-processing. Its bitmap text and hand-built menus also do not supply a general replacement for HTML forms and layout.

Linux x86_64, Windows x86_64 and browser builds are represented in its checked-in release scripts. macOS, Android and iOS release paths are not. SDL supports the relevant underlying graphics backends, but each backend needs suitable shader formats; Android GPU compatibility also varies by device. Apple support needs a Metal path and cannot be inferred from the current SPIR-V-only build. See the [SDL GPU documentation](https://wiki.libsdl.org/SDL3/CategoryGPU), [Android integration guide](https://wiki.libsdl.org/SDL3/README-android) and [iOS integration guide](https://wiki.libsdl.org/SDL3/README-ios).

The exact pinned SDL Zig package and its build integration must be tested for each additional target. Upstream SDL support alone is not evidence that this package cross-compiles and packages that target successfully. Console feasibility needs a separate investigation with the relevant SDK access.

## What has to move

Counts below are physical source lines, including comments and whitespace, measured from the inspected checkout. They indicate scope, not an effort formula.

| Area | Existing size | Port treatment |
| --- | ---: | --- |
| `src/core`, `src/data`, `src/systems`, `src/world`, `src/state` | 17,553 lines | Translate rules, data and state into Zig; extract browser persistence behind a host interface |
| `src/ui` plus `src/style.css` | 8,001 lines | Rebuild UI behavior, layout, navigation and styling |
| `src/render` | 3,112 lines | Replace Three.js integration with a dungeon renderer; translate visual algorithms |
| `src/main.ts` | 1,751 lines | Separate mode transitions, input, host lifecycle and simulation orchestration |
| Audio and cloud | 1,434 lines | Port synthesis and sync behavior; replace browser/SDK-specific services |
| `src/art` | 8,389 lines | Retain as authoring/build tooling where useful; export runtime metadata instead of translating every sprite generator |
| `public/art` | 397 PNGs | Reuse the original artwork |
| `src/__tests__` | 84 files, 14,712 lines | Reuse scenarios and fixtures as the correctness reference; translate or drive them across a test bridge |

**Gameplay is the most favorable part.** The rules and `World` largely avoid DOM, Three.js and browser APIs. They can become a platform-independent Zig core. They still require translation: TypeScript classes, dynamic objects, string identifiers and arrays do not become Zig simply by changing the build. `world.ts` alone is 6,637 lines, covering much more than movement and basic attacks. Content modules also contain executable calculations, so a JSON export cannot replace all of them.

**The UI is a major workstream.** Town includes the market, forge, material selection, infusions, repairs, spells, oaths, seals, contracts, stash, bestiary, relics and Warden upgrades. There are also save cards, account dialogs, tooltips, settings, dungeon overlays, the automap and touch controls. Native rendering needs scrolling, clipping, focus, text input, selection, controller navigation, layout and font handling. The lab's small ASCII bitmap font is not a drop-in replacement for this game's typefaces and text. Some gameplay actions currently live in UI handlers and must move into reusable commands.

**The renderer is bounded but new.** `level-mesh.ts` already constructs simple geometry, and the game uses sprite enemies rather than a skeletal animation pipeline. That helps. Still required: camera and matrix math, mesh buffers, depth attachments, billboards, doors, weapon/shield views, material recoloring, fog, up to twelve lights, PS1 vertex snapping/texture warping, dithering and the other post effects. Fog gates, lava, rite fire and title ambience need their own parity checks. Coordinate/depth conventions and shader resource layouts must be checked across native and WebGL hosts.

**Art survives; its semantics must survive too.** Preserve alpha-250 emissive pixels, painted sprite overrides, material ramps and recoloring behavior. Generate embedded assets or build output from `public/art`; do not establish a second artist-maintained copy. Keep the current art sync/check workflow. Export required palette/registry metadata from the existing source during the transition.

**Audio and online features are adapters plus behavior.** The existing effects use Web Audio oscillators, filters and noise. The lab provides an SDL/PCM approach, but these sounds still need porting or offline baking and review. Supabase email-code authentication, session refresh, cloud conflict handling and bug reports need native HTTP/session/screenshot implementations. The existing backend can remain; the JavaScript SDK cannot simply be imported into Zig.

## Save compatibility is a release gate

The current contract is `SAVE_VERSION = 2`, `SAVE_REVISION = 31`, three slots, stable save identities, and stored floors plus RNG state. The new implementation must read existing JSON and reproduce all required migrations without regenerating a player's saved dungeon. Merely retaining the character's level and inventory would not satisfy the repository's save rule.

Specific requirements:

- Keep format version 2. Add fields only through forward migrations when necessary; the port itself does not require a format bump.
- Preserve unknown fields and newer revision numbers. The current serializer intentionally retains them. A strict Zig struct decoder that silently drops unfamiliar fields would regress this behavior; retain an extension representation or the source JSON tree for round trips.
- Preserve cloud save identity, generation-based compare-and-swap, conflict selection and restrictions on uploading future-revision saves. Verify canonical JSON/hash behavior across implementations, including numeric serialization and UTF-16-based string hashing where applicable.
- Reproduce Mulberry32/FNV integer wrapping and random call order. Use JavaScript-compatible numeric behavior where it affects generation or combat; defaulting simulation numbers to `f32` or changing rounding can change results. Keep rendering precision decisions separate.
- Test the same input and `dt` sequences. The current game uses a capped variable delta; the lab uses a fixed simulation step. Adopting the lab's clock without a behavior review can change combat timing.
- Use native per-user storage with atomic writes/backups, preserve scratch-mode protection, and provide explicit import/export for existing players.

Browser storage is scoped to an origin. A new Cloudflare domain cannot directly access the existing GitHub Pages localStorage, and native executables cannot assume access to it either. Keep the old site available with a transfer/export route; support import into the new build and cloud retrieval for players who already use it. A redirect alone does not transfer saves. This follows the [localStorage origin model](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

## Agent-assisted implementation sequence

| Workstream | How agents can accelerate it | Completion evidence |
| --- | --- | --- |
| Host/core boundaries, fixtures, asset export and builds | Adapt the lab's existing files; generate bindings and asset metadata | Headless core scaffold and native/browser builds using the existing art source |
| Gameplay, content, state and migrations | Translate bounded modules against the TypeScript reference; generate differential test drivers | Generation/loot fixtures, combat traces and old-save round trips agree |
| Dungeon renderer and visual effects | Translate existing mesh/shader algorithms; use fixed scene captures for iteration | Representative scenes match on native and browser targets |
| UI, text, input and screen flows | Establish shared widgets first, then implement independent screens against explicit commands | Full town/dungeon flows work with mouse, keyboard, controller and browser touch |
| Audio, cloud, reports and persistence | Adapt the lab's audio host and existing service contracts; automate failure/conflict cases | Offline play, sign-in, conflict resolution, resume and reports work |
| Browser host and delivery | Extend the existing Wasm/WebGL bridge and deployment scripts | Shared Zig game runs in Wasm with offline/update behavior and downloads |
| Integration and device review | Automate builds, traces, save comparisons and captures; keep human play review focused on differences | Save transfer and representative playthroughs pass on target hardware |

Do not add these rows as sequential calendar blocks. Settle core types, command/event interfaces and the save representation first; gameplay translation, rendering and UI work can then proceed concurrently against fixtures. Integrate small working increments continuously. Shared-file conflicts, changing interfaces and unreviewed generated code can erase concurrency gains, so divide work by stable module ownership.

The main uncertainty is how many integration and correction cycles are needed. Compilation and fixture comparisons provide fast feedback on translation. Visual feel, controller navigation, complete save preservation and platform lifecycle behavior need different evidence. Neither all coding nor all verification has to be manual, but passing builds alone does not establish feature parity.

During the slice, record elapsed active work, review/wait time, modules completed, parity failures and integration fixes. Use that evidence to forecast the remaining workstream dependencies. Do not extrapolate from one easy data-table translation to all UI or rendering work. Building a universal engine or editor is outside scope.

Recommended architecture: a Zig gameplay/state core accepts explicit input commands and emits gameplay events; presentation code consumes its state and creates mesh/sprite/UI draw data. Native SDL_GPU and browser WebGL2 hosts render that data and provide input, audio, storage, networking and lifecycle services. Share mode-transition and timing policy rather than duplicating the lab's two host loops wholesale. Retaining a small JavaScript browser adapter is compatible with fully native desktop/mobile executables.

Keep the TypeScript edition working while the port develops. Export fixtures and content metadata from it, and use it as a reference. A Zig core can temporarily run behind the current browser presentation through a Wasm bridge, but that only stages the migration: native UI and rendering still have to be built. Once the port is accepted, converge gameplay changes on one implementation to avoid maintaining two games indefinitely.

## First slice: what it should prove

Use the 2–3 focused-day experimental budget above, with a first-day rendering checkpoint. Include the expensive uncertainties, not just a window containing sprites:

1. Load a copied current-format mid-delve save into Zig, preserve its floor and RNG state, write it back, and load the result in the TypeScript edition. Include an older-revision fixture and an unknown-field fixture. Never use a player's live slot for this work.
2. Render an existing dungeon scene with perspective, depth, a door, an enemy, the held weapon, emissive pixels, lighting and PS1 post effects on Linux, Windows and the browser.
3. Support movement, one melee attack/guard exchange, loot pickup and a small inventory panel with scrolling, tooltip text and controller selection.
4. Compare seeded generation/loot and scripted combat traces against TypeScript. Separate rendering tolerances from exact gameplay invariants.
5. Measure frame time, memory and startup on stated hardware, including a constrained device. Smaller bundles, faster startup or better performance are goals to measure, not results established by this assessment.

Re-estimate from the work completed during this slice, even if some gates remain unmet at the checkpoint. If the renderer works but UI construction is slow, revise the UI approach before translating every screen. If save or numerical parity fails, resolve it before expanding content. Target Windows/Linux first, then macOS, then Android/iOS while retaining browser support throughout.

## Verification and limits

Inspected both local repositories, their build/deploy scripts, rendering/input/audio boundaries, game-state/migration code, cloud save behavior and test fixtures. Consulted the upstream SDL platform/GPU documentation and browser storage documentation linked above.

The existing Looting Simulator baseline passed `npm test -- --maxWorkers=2`: **84 test files, 982 tests**. `npm run build`, `npm run patches` and `npm run art:check` also passed; the build reported its large-chunk warning. Those tests establish a usable reference suite, not that a future Zig port is correct. Existing golden tests cover seeded floor generation, loot and balance; the port also needs cross-implementation save and input-trace coverage.

No native port was implemented or benchmarked, no Cloudflare deployment was changed, and the lab's platform builds were not rerun for this assessment. macOS/mobile feasibility at the pinned dependency level remains a prototype task. This change contains only this report.
