# Oddities: attack moves, strange floors, and weapons nobody asked for

Written 2026-09-20, after the run-identity rework (#18–#31) landed. That work
answered *why is this delve different from the last one* — oaths, roads, laws,
lieutenants, seals. This one answers two questions it left alone:

1. **Why is this fight different from the last one?** Every monster in the game
   swings on exactly one rhythm. Learn a skeleton once and you have learned it
   for ever, on every floor, at every depth.
2. **Why would I keep going down when I have what I came for?** Because the
   dungeon is occasionally, unpredictably, deeply stupid, and you want to see
   what it does next.

The two halves are not as unrelated as they look. Combat readability is what
makes a joke floor survivable, and a joke floor is where a weird attack pattern
can be introduced without ruining a serious one.

## Part 1 — Attack moves

### The problem

`EnemyDef` carries one `windup` and one `recovery`. `beginWindup` sets
`timer = def.windup`; `enemyStrike` deals `def.attack` to the tile in front and
sets `attackCd = def.recovery + 0.2`. That is the entire vocabulary of every
melee creature in the game, from a rat to the Barrow Champion. The only
variation between two monsters is *how long* the one beat lasts.

The result is that the correct answer to every melee enemy is the same answer:
stand at range one, watch for the lean, meet it or step out. A player who can
do that against a skeleton can do it against everything, and a deeper floor is
only a bigger number attached to the same beat.

### The shape of the fix

A creature gets a **move set**: a small weighted list of attacks, each with its
own timing, reach and consequence. It picks one when it commits, and the move
— not the def — decides the beat.

```ts
interface AttackMove {
  id: string;
  name: string;
  windup: number;    // × the creature's base windup
  recovery: number;  // × the creature's base recovery
  power: number;     // × the creature's attack
  reach?: number;    // tiles; 1 is adjacent, 2 reaches over a gap
  sweep?: boolean;   // also strikes the tiles either side of the target
  combo?: number;    // extra strikes after this one, on a short beat
  tell: string;      // the colour the wind-up glows
}
```

Nothing is taken away. An enemy with no `moves` gets the implicit `basic` move,
whose multipliers are all 1 — which is byte-for-byte what it does today. Every
existing monster keeps its exact feel until it is deliberately given a set.

### The moves

| Move | Windup | Recovery | Power | Shape | Rel. DPS | What it asks of you |
|---|---|---|---|---|---|---|
| `basic` | 1× | 1× | 1× | adjacent | 1.00 | The beat you already know |
| `jab` | 0.55× | 0.7× | 0.65× | adjacent | 1.04 | Too fast to walk out of; block or eat it |
| `flurry` | 0.8× | 1.8× | 0.44× | adjacent, ×2 more | 1.02 | One parry is not enough. The gap after is long |
| `thrust` | 1.15× | 1.1× | 1.1× | reach 2 | 0.98 | Backing off one tile no longer works |
| `sweep` | 1.3× | 1.25× | 1.15× | adjacent + both flanks | 0.90 | Sidestepping into a flank is punished |
| `slam` | 2.1× | 1.8× | 1.9× | adjacent | 0.97 | Enormous tell, enormous cost. Leave, or meet it |
| `feint` | 1.6× | 0.8× | 1.35× | adjacent | 0.98 | The lean stutters. Bite on it and it hurts |

Seven moves is the whole vocabulary, on purpose. The readable-combat rule in
MECHANICS.md still holds: a player should be able to name what just hit them.

The "Rel. DPS" column is `relativeDps()`, damage over a whole cycle against a
creature throwing plain blows for ever. Everything sits within 4% of neutral
except `sweep`, which is deliberately 10% under: what a sweep sells is taking
a dodge away, and charging for that in damage as well would make circling a
big thing simply wrong rather than risky. `attacks.test.ts` holds the whole
table to 0.89–1.10, so a later addition cannot smuggle difficulty in as
variety.

### Telegraphs

A move that cannot be read before it lands is not variety, it is noise. Each
move states a `tell` colour, and the renderer tints the creature's wind-up with
it — faint at the start of the wind-up, full by `TELL_AT`, which is already the
point at which `enemy-pose` brings the weapon up. `slam` also grows: the sprite
scales up as it gathers, so the big one is legible in peripheral vision.

`feint` is the deliberate exception, and it is honest about it: the tell is
there the whole time, but the *lean* stalls at 60% and restarts. The
information is "this creature feints"; the skill is not biting on the stall.

### Who gets what

Move sets are assigned by what a creature *is*, not by depth. Twenty creatures
have one; the rest keep the plain blow until somebody decides otherwise.

- **`vermin`** — rat, bat, tunnel stalker, Delver Mole. Jab-heavy. Small fast
  things should be small and fast, not slow things with less health.
- **`frenzied`** — spider, ceiling crawler, ghoul, spore hunter, mimic.
  Flurries. The long recovery afterwards is the window the fight turns on.
- **`drilled`** — skeleton, goblin shieldbearer, your Shade. Two crisp blows,
  then back behind the guard.
- **`guardian`** — skeleton shieldguard, icebound guard, Goblin Quartermaster.
  Reach and width, never speed.
- **`cunning`** — the Goblin Cutpurse. It knows you are watching for the lean.
- **`brute`** — Drowned Bones, Bog Seraph, Wandering Heifer. Sweeps and the
  occasional slam.
- **`champion`** — Hollow Knight, Barrow Champion, the Prize Bull. Everything,
  and it commits to the big one more often.
- **`reaching`** — the Bull. Horns are for reaching with.

Archers and casters are left alone: their beat is the projectile's, and a move
set on top of that would be a second system fighting the first. **The Ashen
King** keeps his authored phase script; bosses are not touched, and
`attacks.test.ts` pins that.

### Balance intent, and what the harness said

Every non-basic move trades in the same currency: a move that hits harder or
further pays for it in wind-up or recovery. This is a *variety* change, not a
difficulty change.

Measured rather than asserted. `npm run playtest` was run twice over the same
seeds — once with the move sets stripped out, once with them in — across all
seven bot profiles:

| Profile | Damage taken, no moves | With moves | Hits taken |
|---|---|---|---|
| fresh, parry | 132 | 138 | 13.5 → 17.5 |
| fresh, no parry | 128 | 135 | 12.9 → 16.9 |
| iron, reckless | 219 | 214 | 24.4 → 30.2 |
| iron, careful | 202 | 202 | 21.3 → 27.9 |
| epic, reckless | 307 | 291 | 39.5 → 45.4 |
| epic, careful | 273 | 274 | 36.2 → 44.8 |
| prepared expedition | 538 | 539 | 42.7 → 51.2 |

Total damage taken is flat — every profile within 5%, four of them within 1%.
Hits taken is up about 28% everywhere, which is precisely what jabs and
flurries are: the same damage arriving in more, smaller pieces.

Average depth reached barely moves (1.71→1.88, 2.83→2.88, 4.25→4.13,
5.50→5.63). Per-profile death rates wander by up to 25 points in both
directions, which at 24 runs a profile is noise rather than signal.

The one number that moved in a direction worth naming is the bot's parry
count, which fell slightly on every profile that parries (5.8→4.9 on the iron
kit). That is the feature working: a bot that had memorised one rhythm is
worse against seven.

## Part 2 — Strange floors

### How you find one

Not a branch, not a new depth index, not a key. A floor **rolls strange** when
it is generated: a low chance, never on depth 1 (too early to be a surprise)
and never on depth 6 (the throne is the throne). You find out by walking down
the stairs into it.

This is the cheapest possible implementation — `Floor.quirk?: string`, an
optional field on a structure that already round-trips through saves — and it
is also the right design. A secret floor you can *plan* for is a destination. A
secret floor you cannot plan for is a story.

Deeper floors are slightly likelier to be strange, because by depth 4 you have
something to lose and the interruption means more.

### The Forbidden Pasture

> *The stairs end in grass. The sky is underneath you.*

The floor is upside down. The camera rolls 180° over about a second — which
puts the real ceiling below you and the real floor overhead, so no texture
swap is needed or wanted. Turning left looks like turning right, and that is
the joke and the whole difficulty of the floor; nothing here hits very hard,
because being upside down is the tax.

Sprites are billboarded about the camera's *yaw* only, so the cattle turn over
with the walls rather than standing upright in a tilted world. The viewmodel
lives in its own upright orthographic scene, so your own hands stay where you
left them — and with them your bearings.

It is populated entirely by cattle:

- **Calf** — small, quick, and has not decided whether you are frightening.
- **Wandering Heifer** — enormous, slow, mostly uninterested. Mostly.
- **Bull** — `thrust`. It charges. Do not be in the line.
- **The Prize Bull** — the floor's champion, in a rosette.

Which monster becomes which is matched on **health**, not on a list of names,
so a pasture is exactly as dangerous as the depth it sits at and any monster
added later is already covered.

Cattle are weak to blunt and slash and awkward to skewer — the right way round
for a large soft animal, and the merciful way round too: the early game's
common weapon is a mace, and cattle that shrugged off blunt made the Pasture a
wall rather than a joke. Every cow leaves a morsel, and every container on the
floor is promoted two tiers (an urn becomes a chest, a chest becomes a vault),
which is what stops the floor being only a joke.

Measured on the ladder bench: at depth 2 against the copper mace it is meant to
be met with, the Prize Bull takes 11 hits and kills you in 4 — alongside the
mimic. At depth 5 it is 11 hits and 5, alongside the Barrow Champion. The rank
and file are *easier* than the ordinary roster at the same depth, which is the
intent: being upside down is the tax.

Drops here, and only here: **The Prize Bull's Horn**.

### The Silent Picture

> *The colour goes out of the walls. Somewhere, a piano starts.*

Black and white — a luminance pass in the post shader, contrast pushed, the
dither left on so it grains like nitrate. The **simulation** runs at **1.25×**: you,
the monsters, the shafts in flight and the run clock. It is scaled once, at the
top of the world update, so nothing can fall out of step with anything else —
and the renderer is deliberately left alone, so the torches gutter at their
usual rate. A synthesised piano rag loops.

And everyone is dressed for the evening. Every creature on the floor wears a
**top hat and a monocle**, and whatever melee weapon is actually in your hands
is drawn as a **lacquered cane** — the greatsword's damage, reach and timing,
unchanged, in the shape of a cane. The pack still says greatsword. Only the
picture is a cane.

Both accessories are billboard sprites drawn over the creature rather than a
repaint of sixty enemy frames, so they work on anything — a mimic, a bat,
whatever gets added next year. Two details make them land:

- The hat sits on the creature's **drawn crown**, not the top of its 32×32
  canvas. Almost nothing fills its canvas, so hanging the hat off the canvas
  top floated it a head's height above a bat. The opaque top row is measured
  from the ArtDef and cached.
- The hat is **charcoal, not black**. A black top hat in a black-and-white
  scene on a dark ceiling read as two grey stripes floating over a skull.
- The monocle is offset along the **billboard's own right**, so it stays over
  the same eye as you circle, and its lens is transparent so you can see the
  eye being monocled.

Mechanically the speed-up is the floor's whole content. A `flurry` at 1.25× is
a genuinely different problem, which is Part 1 paying for Part 2. Damage is
unchanged; only time moves.

Drops here, and only here: **The Impresario's Cane**.

### What a quirk may and may not do

May: change the enemy pool, the lighting, the post pass, the time scale, the
loot rarity, the music, the messages.

May not: change the floor's shape, its stair placement, its seed, or anything
another system reads. A strange floor is generated exactly like an ordinary one
and then dressed. That is what keeps golden-hash fixtures stable and saves
loadable — a save written on a strange floor opens fine in a build that has
never heard of quirks, because `quirk` is one optional string.

## Part 3 — Weapons nobody asked for

Three oddities, each hooking a system that already runs.

### The Big Toe

A blunt two-hander that is, unmistakably, a preserved toe the size of a man.
Found anywhere, from depth 2.

- Miserable reach (0.8 tiles — you must be *on* them).
- Enormous stagger and cleave. It does not cut, it *shoves*.
- Every kill with it has a 1-in-6 chance of leaving a second morsel, because
  the toe knows where the meat is.

It is a real weapon with a real niche — crowd control in corridors — that
happens to be a toe. Whose toe is never established.

### The Prize Bull's Horn

From the Pasture. A spear-class weapon that keeps a spear's reach of 2 and
pays **flat +4 Attack for each consecutive blow landed without one landing on
you**, to a maximum of six. A charge weapon for a charging animal.

Flat rather than a multiplier on purpose: a charge weapon whose payoff scales
with your damage only ever pays off once you have already won the fight. Flat
Attack means the first blows of a fight are worth something too.

A blow you *blocked* still clears it, which is harsher than the parry-feeding
blade's rule. It is a charge, and you stopped.

### The Impresario's Cane

From the Silent Picture. A blunt weapon that is worth very little on its own
and makes **everything you do 8% faster** — swing, recovery, step, flask. The
floor's gimmick, bottled, permanently, at the cost of a weapon slot's damage.

## Order of work

1. Attack moves, with the default path proving nothing changed.
2. Telegraphs, because moves without them are worse than no moves.
3. Move-set assignment across the roster, with the harness run before and after.
4. `Floor.quirk` plumbing and the post-pass/time-scale hooks.
5. The Forbidden Pasture.
6. The Silent Picture.
7. The three weapons.
8. Balance pass, MECHANICS.md, patch notes.

## Open questions

- Should a strange floor be *recorded* — a per-save tally of which ones you
  have seen? Leaning yes, as a codex line, but not in the first cut.
- Does the Pasture need a way out for a player who genuinely cannot play
  upside down? Leaning no: the stairs are where the stairs always are, and the
  automap is not rolled.
- **Answered by running it: the bot does walk onto strange floors**, and often.
  At 5–9.5% a floor across 168 floors per profile it meets both regularly, and
  retuning the cattle visibly moved the prepared expedition's death rate. So
  the harness *does* cover the Pasture's monsters.

  What it does not cover is the Pasture's actual difficulty, which is a camera
  roll the bot has no equivalent of. Its numbers for that floor are therefore
  an underestimate by an unknown amount, and the only honest reading is "the
  cattle are priced correctly and the disorientation is untested". If that
  matters later, the lever is a bot penalty standing in for it — a chance to
  step the wrong way — rather than a change to the cattle.
- Does the Silent Picture's ×1.25 belong in the harness's difficulty snapshot?
  It is a floor property rather than a run property today, which is right, but
  it means a delve's recorded difficulty does not mention that one of its
  floors ran fast.
