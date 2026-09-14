# Held art style

The held set uses compact dungeon pixel art: warm skin, brown leather, muted
brass and cool faceted metal. Author the motifs in `src/art/viewmodels.ts`.

- Use 48×80 for one-handed weapons, fists and casting; 48×88 for the maul and
  halberd; 48×112 for the claymore; 48×48 for the open left hand and buckler;
  48×64 for the kite and tower shields. The renderer scales by
  canvas height, so keep the transparent space above fists and casting hands.
- Light from the upper left. Use connected colour clusters, a one-pixel dark
  silhouette, and restrained highlights. Avoid alternating bright stripes on
  blades, black finger divisions, and noise in the wood grain.
- Draw the grip sideways: curled fingers stack across the vertical hilt with
  short brown creases. The right forearm approaches from the lower right,
  opposite the asymmetric cutting edges. Reuse HAND and its diagonal brass
  cuff. FAR_HAND is smaller and exits left through a visible wrist. Casting
  uses a separate cupped hand; the retrieval hand shows its back and side,
  open with slightly curled fingers and its thumb separated to receive shafts.
- Keep weapon identities in their silhouettes: swept axe edge, curved pick,
  flanged mace, leaf spear, rectangular maul, hooked halberd and slim sword.
  Dagger, short sword and long sword have separate viewmodel IDs. Keep their
  canvas heights and grip positions identical so blade length survives the
  renderer's height normalisation.
- The claymore has a long blade and downward-sloping quillons with decorative
  terminals. Shields use separate per-base viewmodels: round buckler, pointed
  kite and broad rectangular tower. The viewer and renderer use the same mapping.
- Reserve palette indices 1–4 for recolorable metal. Skin, wood and brass stay
  fixed. Alpha 250 is reserved for the lit sigil carving and sparks.

After editing, regenerate just the affected overrides:

```sh
npm run art:sync -- --ids vm_blade,vm_axe
npm run art:check -- --ids vm_blade,vm_axe
```

Reload the dev game, open F2 → Viewmodels and compare at 1× and 3× on dark and
stone backgrounds. Check material tiers too. Then inspect the held silhouette
in the lab, including two-handed attacks, casting, blocking and retrieving.
Source sheets alone do not show the game's lighting or pose scale.
