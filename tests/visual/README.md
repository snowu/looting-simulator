# Grain review

Install browsers once, then capture matching before/after scenes:

```sh
npx playwright install chromium webkit
npm run test:visual
```

On Linux, install browser system libraries with
`npx playwright install --with-deps chromium webkit` (requires administrator
access). Software WebGL must work on the host; the Chromium profiles explicitly
use SwiftShader for machines without GPUs. To run only Chromium captures:

```sh
npx playwright test --project=desktop-chromium --project=tablet-chromium --project=phone-chromium
node scripts/visual-review.mjs
```

If the bundled Chromium cannot initialize WebGL on your host, set
`VISUAL_CHROMIUM_PATH` to a compatible Chromium executable. The PR's local
Chromium captures use Chromium 131; CI uses Playwright's bundled browsers.

Open `visual-review/index.html` for side-by-side images. Full-resolution PNGs
and a Markdown table (`PR.md`) sit beside it. The Playwright HTML report also
contains both images for each test (`npx playwright show-report`).

The PR workflow uploads these files as the `grain-visual-review` artifact.
Download and extract it, then open the review page. For inline PR images,
upload the PNGs to the PR editor and use the generated table as a template.
The workflow does not post comments or publish images automatically.

Profiles cover desktop Chromium, tablet Chromium, phone Chromium and phone
WebKit, all in landscape. Each variant uses a fresh browser context, empty
saves, brightness at 100%, fixed seeded chambers and frozen torch animation.
The dev-only harness never simulates or saves these worlds. The title scene
includes its actual menu; the dungeon scenes include the HUD and viewmodel.
Before reproduces the old dither threshold and 0.9/1.1 grain/vignette values;
after uses the current shader defaults. This is a filter comparison within
the current code, rather than a comparison of arbitrary Git revisions.

The suite checks browser runtime errors and that the treatments differ.
For pixel regression checks, explicitly approve baselines on the same OS
and browser versions used for later checks:

```sh
npm run test:visual:update
npm run test:visual:check
```

Review and commit the generated `grain.spec.ts-snapshots` directory to enable
those checks for other developers. CI generates review artifacts without
enforcing unapproved baselines. Update baselines only after reviewing images.

Viewport emulation cannot reproduce a physical screen's brightness, contrast,
or GPU. Use the running preview on actual devices for the final readability
decision. Browser upgrades and OS/font differences can change pixel baselines.
