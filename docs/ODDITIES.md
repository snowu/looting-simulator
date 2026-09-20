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

| Move | Windup | Recovery | Power | Shape | What it asks of you |
|---|---|---|---|---|---|
| `basic` | 1× | 1× | 1× | adjacent | The beat you already know |
| `jab` | 0.55× | 0.7× | 0.7× | adjacent | Too fast to walk out of; block or eat it |
| `flurry` | 0.8× | 1.5× | 0.55× | adjacent, ×2 more | One parry is not enough. The gap after is long |
| `thrust` | 1.15× | 1.1× | 1.1× | reach 2 | Backing off one tile no longer works |
| `sweep` | 1.3× | 1.25× | 0.85× | adjacent + both flanks | Sidestepping into a flank is punished |
| `slam` | 2.1× | 1.8× | 2.2× | adjacent | Enormous tell, enormous cost. Leave, or meet it |
| `feint` | 1.6× | 0.8× | 0.9× | adjacent | The lean stutters. Parry on the stutter and you eat it |

Seven moves is the whole vocabulary, on purpose. The readable-combat rule in
MECHANICS.md still holds: a player should be able to name what just hit them.

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

Move sets are assigned by what a creature *is*, not by depth:

- **Rats, bats, spiders** — `jab`-heavy. Small fast things should be small and
  fast, not slow things with less HP.
- **Ghouls, spore hunters** — `flurry`. Frantic. The long recovery after is the
  window the whole fight turns on.
- **Skeleton spears, icebound guards** — `thrust`. Reach is their identity.
- **Goblins, cinder raiders** — `feint`. Cunning, not strong.
- **Champions, ogres, lieutenants** — `slam` and `sweep`. A big thing should
  make you move your feet.
- **The Ashen King** — keeps its authored phase script. Bosses are not touched.

### Balance intent

Every non-basic move trades in the same currency: a move that hits harder or
further pays for it in wind-up or recovery, and the DPS of a full move set is
held within ±8% of the same creature's basic-only DPS. This is a *variety*
change, not a difficulty change. The harness (`npm run tables`) gets a move-set
column so that claim is checkable rather than asserted.

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

The floor is upside down. The camera is rolled 180°, the floor and ceiling
textures trade places, and the fog goes pale green. Turning left looks like
turning right, and that is the joke and the whole difficulty of the floor;
nothing here hits very hard, because being upside down is the tax.

It is populated entirely by cattle:

- **Wandering Heifer** — enormous, slow, mostly uninterested. `basic` only.
- **Bull** — `slam` and `thrust`. It charges. Do not be in the line.
- **The Prize Bull** — the floor's lieutenant. Wears a rosette.

Everything moos. Every cow drops **Prime Cut** (the best morsel in the game) and
the floor's chests are two rarity rolls above their depth. It is a genuinely
good floor to find, which is what stops it being only a joke.

Drops here, and only here: **The Prize Bull's Horn**.

### The Silent Picture

> *The colour goes out of the walls. Somewhere, a piano starts.*

Black and white — a luminance pass in the post shader, contrast pushed, the
dither left on so it grains like nitrate. Everything runs at **1.25×**: you,
the monsters, the projectiles, the torches. A synthesised piano rag loops. And
every creature on the floor is wearing a top hat.

The hat is a billboard sprite drawn above the head, not a repaint of 60 enemy
frames, so it works on anything — including whatever gets added next year.

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

From the Pasture. A spear-class weapon that keeps the `thrust` reach even on a
step, and gains Attack for every consecutive hit without being hit, resetting
when you take a blow. A charge weapon for a charging animal.

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
- Can the headless bot play a strange floor? The Silent Picture yes, since it
  is only a time scale. The Pasture's roll is a camera concern, so the bot
  never notices it — which is the correct answer, but means the harness cannot
  tell us whether it is too hard.
