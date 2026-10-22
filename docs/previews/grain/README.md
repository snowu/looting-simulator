# Grain filter comparison

These screenshots compare the previous filter against the proposed filter in
identical scratch scenes. Brightness is 100%; camera, world seed and torch
animation are fixed. Both treatments include the same current title menu and
HUD. These are viewport emulations captured with Chromium 131, not photographs
of physical displays.

- Desktop: 1440 × 900 CSS pixels, device scale 1.
- Tablet: iPad Mini landscape, 1024 × 768 CSS pixels, device scale 2.
- Phone: iPhone 13 landscape, 844 × 390 CSS pixels, device scale 3.

Each folder contains title, dark Ossuary and bright Frost Vault scenes, with
`before` and `after` PNGs. The Playwright suite also includes a phone WebKit
profile, which runs in CI. See `tests/visual/README.md` for capture commands.
