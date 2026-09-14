# Sigils — the utility spell system

Design brief, not built. Numbers here are proposals; every one is stated so it can be
argued with. Companion documents: [MECHANICS.md](../MECHANICS.md) (§2 parry, §4 boss,
§5 AI, §6a traps, §7 loot, §10 crafting, §13 renown), and the weapon overhaul's own
roster, which this document does not touch.

**Scope discipline.** Five spells. One button. One new `StatKey`. One new renown
upgrade. One new gem. One additive save revision. Nothing here deals damage worth
counting, and nothing here changes a Hard-mode difficulty knob.

---

## A. The pitch

A consumable is a thing you spend and a weapon is a thing you swing; neither ever
lets you **change the shape of the fight you are standing in**. A sigil does: it
moves a body off a tile, it puts out your own lamp, it reads a wall you have not
walked to, it makes one square of floor worth dying on. That is the King's Field
register — not a fireball, but a warden's charm that does one strange, specific,
expensive thing and then is quiet for a minute and a half.

The honest risk, stated up front: this game's whole spine is *read the telegraph, meet
the swing*. Anything that denies a blow without asking for timing is a tax on that
spine. The entire design below is arranged around one rule — **a sigil is never a
better answer than a parry; it is the answer when a parry is not available.**

---

## B. The roster

Five spells. **You carry one.** Attunement is a town decision (§D), which is the
single largest Hard-mode guard in this document: you can never hold both the escape
and the control, so every fight is played with the tool you guessed at in Bleakmere.

Shared rules for every cast:

| | |
|---|---|
| Cast is an action | Occupies a new `anim.cast` state. You cannot move, turn, swing, block or parry while it runs |
| Cost | Stamina, paid at the *start* of the cast, non-refundable |
| Interrupt | Any hit that lands during the cast cancels it. **The cooldown does not start** — you keep the charge and lose the stamina and the tempo |
| Cooldown | Starts when the spell resolves, not when it is begun |
| Clock rate | Ticks at **1× when nothing alert is within 8 tiles, 0.5× when something is** (§C) |
| Town | Does not tick in Bleakmere, including a town-portal visit |

Pseudocode below is written against the real `World`/`Floor` API (`frontTile`,
`enemyAt`, `blocksMove`, `stepEnemy`, `springTrap`, `EnemyState`, `PlayerAnim`).

---

### 1. Wardcry — control

> *The old wardens did not argue with the dead. They said one word and the dead stepped back.*

The spell the user asked for: push one tile, stun. It is also a **shout**, and that is
what keeps it honest.

| | |
|---|---|
| Base cooldown | **70s** |
| Cast | 0.35s, 30 stamina |
| Range / shape | Exactly one tile: `frontTile(1)`. Not a cone, not a burst |
| Stun | 1.2s (`ai='recover'`, `timer=max(timer,1.2)`, `attackCd=max(attackCd,1.4)`) |
| Noise | Every living enemy within **8 tiles**, through walls, gets `alert = max(alert, 8)` pointed at you — the alarm ward's behaviour at a smaller radius |
| Damage | Only on a wall slam (below), and only then |
| Grants no `vuln` | **Deliberate.** A parry opens a second of doubled damage. Wardcry never does |

```ts
cast_wardcry() {
  const t = this.frontTile(1);
  const e = enemyAt(this.floor, t.x, t.y);
  this.shout(8);                       // alert, like springTrap('alarm') at r=8
  if (!e) { this.msg('The word goes out over nothing.'); return; }
  const def = enemyDef(e.def);
  const boss = def.behavior === 'boss';

  // --- the stun -----------------------------------------------------------
  if (boss) {
    // He is never knocked out of a wind-up. The word only delays what comes next.
    e.attackCd = Math.max(e.attackCd, 0.5);
  } else {
    e.ai = 'recover';
    e.timer = Math.max(e.timer, WARDCRY_STUN);      // 1.2
    e.attackCd = Math.max(e.attackCd, WARDCRY_STUN + 0.2);
    if (def.shield) { e.guard = 'down'; e.guardT = GUARD_DOWN; e.blocks = 0; }
  }

  // --- the push -----------------------------------------------------------
  const d = this.frontTile(2);
  const open = !boss
    && !blocksMove(this.floor, d.x, d.y)
    && !enemyAt(this.floor, d.x, d.y)
    && !stairsAt(this.floor, d.x, d.y)
    && !this.floor.props.some(p => (p.kind === 'portal' || p.kind === 'town_portal') && p.x === d.x && p.y === d.y);

  if (open) {
    this.stepEnemy(e, d.x, d.y);       // reuses facing + trap springing for free
  } else if (!boss) {
    const other = enemyAt(this.floor, d.x, d.y);
    if (other) {                        // pinned by its own escort
      other.ai = 'recover';
      other.timer = Math.max(other.timer, 0.6);
      other.attackCd = Math.max(other.attackCd, 0.6);
    } else {                            // slammed into stone
      e.timer = Math.max(e.timer, WARDCRY_STUN * 1.5);   // 1.8s
      const slam = Math.min(25, Math.round(e.maxHp * 0.10) * (def.resist.blunt ?? 1));
      e.hp -= slam; e.hurtT = 0.3;
      if (e.hp <= 0) this.killEnemy(e);
    }
  }
}
```

**Every grid case, answered.**

| Tile behind the target | What happens |
|---|---|
| Open floor | Normal push, one tile, via `stepEnemy` — so facing updates and traps fire exactly as they do when it walks |
| **Wall, pillar, closed door, blocking prop** (`blocksMove`) | **No push. Wall slam:** stun ×1.5 (1.8s) and `min(25, 10% of maxHp)` blunt. A depth-6 Hollow Knight (529 HP) takes 25 — ×1.2 undead blunt = 30, about 5% of it. It is a stun extension, never a damage plan |
| **Open door tile** | Walkable → normal push. The door is not touched |
| **Another enemy** | No push. Target keeps its 1.2s; the blocker eats **0.6s**. This is Wardcry's best case and it is fair — a corridor queue is exactly what you spent 70 seconds on |
| **Armed trap** (found or not) | Pushed onto it and it springs: `springTrap(trap, e)` verbatim — 80% of listed damage, unmitigated. A depth-6 spike pit is **31**. Fun, and small |
| Spent trap | Nothing. Normal push |
| **Stairs alcove** | Treated as a wall (`canStep` already refuses stairs to enemies). Slam. No cross-floor state exists and none is being invented |
| **Pit** | There is no pit terrain in this game; spike pits are traps, handled above |
| **Portal / town portal tile** | Treated as a wall. Nothing is drawn on top of a portal, matching `freeTileNear`'s existing check |
| Loose loot / non-blocking prop (fungus, bones) | Normal push, straight over it |
| Out of bounds | `blocksMove` → wall. Slam |
| **Floating enemy** (bat, wisp, wraith) | Pushed normally, and springs traps **exactly as it does today when it walks**, because it goes through `stepEnemy`. Floaters arming pressure plates is an existing inconsistency; Wardcry should not be the place it gets fixed |
| Shieldbearer / Shieldguard / Hollow Knight | Pushed, and **the guard drops** (`guard='down'`, full `GUARD_DOWN`). This — not the damage — is why you take Wardcry into a knight |
| Enemy mid-wind-up | Cancelled. This is the dangerous case; see §F |
| Mimic mid-unfold | Pushed normally |
| **The Ashen King** | **Never moved. Never staggered. His wind-up is never interrupted.** He gets `attackCd = max(cd, 0.5)` and nothing else: half a second of quiet to get out of a corner |
| Risen guard (phase 2) | Full effect. Killing one still refunds nothing (§C) |

**When casting it is wrong.** It is a *shout*. In a corridor with an unopened room
beside you, Wardcry is how three more things learn where you are. It is also the wrong
move on anything you could simply parry — the parry is free, is off cooldown in 0.75s,
and pays double damage, all of which Wardcry does not. And a Wardcry that pushes a
ranged enemy is a Wardcry that puts it back into shooting range.

---

### 2. Snuff — escape

> *You pinch the wick. The dark you were carrying stops being yours and becomes everyone's.*

| | |
|---|---|
| Base cooldown | **90s** |
| Cast | 0.5s, 25 stamina |
| Range / shape | The whole floor, radius 12 |
| Effect | Every living enemy within 12 tiles that is **not currently in `windup`** drops to `alert = 0` and returns to `idle`. For **3s** afterwards nothing can newly acquire you. Your own light radius falls to **2.5** for **8s** |

```ts
cast_snuff() {
  for (const e of this.floor.enemies) {
    if (e.ai === 'dead' || e.ai === 'windup') continue;   // a committed blow still lands
    if (Math.abs(e.x - p.x) + Math.abs(e.y - p.y) > 12) continue;
    e.alert = 0;
    if (e.ai === 'chase') e.ai = 'idle';
  }
  this.anim.snuffT = 8;        // light radius override, unsaved, like anim.recall
  this.anim.unseenT = 3;       // sightPenalty -= 99 while > 0
}
```

**The cost is real and is not the cooldown.** For eight seconds you cannot see the
floor. Trap *spotting* still works (it is geometric, not lit) but you cannot read the
decal, the sconce, the seam in a chest lid, or where the corridor turns. Running blind
is how the escape kills you. And enemies **within 2 tiles re-acquire immediately
regardless** — torchlight is not your lamp; you have to actually break contact.

**When casting it is wrong.** Anywhere you have not already picked a direction. Snuff
does not buy distance, it buys three seconds of not being followed; if you spend them
deciding, they are gone. Also wrong when the floor is lit — the Ashen Throne has the
densest torches in the game, and a room that is already bright does not care that your
lamp went out.

---

### 3. Sounding — information

> *You set the sigil against the stone and listen to what it does not say back.*

| | |
|---|---|
| Base cooldown | **45s** — the lowest, because it has no combat power at all |
| Cast | 0.8s, 20 stamina |
| Range / shape | Radius 6, ignoring line of sight |
| Effect | Marks every tile within 6 as `explored`; sets `found = true` on every trap within 6; logs a direction line for any unfound secret within 6. **Reveals no enemies** |

```ts
cast_sounding() {
  const f = this.floor;
  for (let y = p.y - 6; y <= p.y + 6; y++)
    for (let x = p.x - 6; x <= p.x + 6; x++) {
      if (Math.abs(x - p.x) + Math.abs(y - p.y) > 6 || !inBounds(f, x, y)) continue;
      f.explored[y * f.width + x] = 1;
      const t = trapAt(f, x, y);
      if (t && !t.found) { t.found = true; this.msg(TRAPS[t.kind].spotted, '#e0c060'); }
    }
  for (const s of f.secrets)
    if (!s.found && dist(s) <= 6) this.msg(`Stone rings hollow to the ${bearing(s)}.`, '#e8d8a0');
}
```

Note what it does **not** do: it does not disarm (the disarm still costs a walk and an
[F]), it does not open the secret (you still push the wall), and it never draws a
creature. §6a's contract — *spotting is whether you were looking* — survives, because
Sounding is a deliberate 0.8s look that costs 45 seconds of charge.

**When casting it is wrong.** Any time something is hunting you: 0.8s rooted is a free
hit, and the map it draws does not tell you where the ghoul is. Also wrong on the way
*out* of a floor you have already walked.

---

### 4. Threshold — defence

> *One flagstone, one minute, and the promise that you will not step off it.*

| | |
|---|---|
| Base cooldown | **80s** |
| Cast | 0.5s, 25 stamina |
| Range / shape | The tile you are standing on. One tile, forever |
| Duration | **8s**, and it **ends the moment you step off** |
| Effect | While you stand on it: `PARRY_WINDOW` 0.22 → **0.44**, `PARRY_COOLDOWN` 0.75 → **0.45**. Nothing else. No damage reduction, no block bonus, no stamina change |

```ts
cast_threshold() { this.anim.ward = { x: p.x, y: p.y, t: 8 }; }

// in update(): the ward dies on the first step off it, not on the way back
if (a.ward) {
  a.ward.t -= dt;
  if (a.ward.t <= 0 || a.ward.x !== p.x || a.ward.y !== p.y) a.ward = null;
}
// where the constants are read:
const window   = a.ward ? PARRY_WINDOW * 2 : PARRY_WINDOW;
const cooldown = a.ward ? PARRY_COOLDOWN * 0.6 : PARRY_COOLDOWN;
```

This is the only spell that touches the parry, and it touches it in the direction that
keeps the game intact: it does not deny a blow for you, it **makes the thing you are
already doing more forgiving on one square of floor you promised not to leave.**
Nothing about the telegraph changes. Mistime it and it is still a block.

**When casting it is wrong.** Every fight whose answer is footwork. Ranged enemies will
simply line up on your lit tile and shoot — they sidestep to align, and you have sworn
not to move. A ghoul pack surrounds a stationary player. A spike pit you were about to
back over is worth more than the ward. And the moment you need to reposition, the 25
stamina and the 80 seconds are gone for nothing.

*Safe default if it measures too strong:* window ×1.6 instead of ×2, cooldown
unchanged. Say so in the tuning notes rather than removing the spell.

---

### 5. Temper — resource

> *Not a blessing. A whetstone with a prayer scratched into it.*

| | |
|---|---|
| Base cooldown | **90s** |
| Cast | **1.2s** — a long, defenceless channel, and the point of the spell |
| Cost | 15 stamina |
| Range / shape | Yourself |
| Effect | Restores **25% of the pool** to the equipped piece in the worst condition. If that piece was **broken, it is no longer broken** |

```ts
cast_temper() {
  const worst = EQUIP_SLOTS
    .map(s => [s, this.state.equipment[s]] as const)
    .filter(([, it]) => it && durability(it).max > 0)
    .sort((a, b) => durability(a[1]!).fraction - durability(b[1]!).fraction)[0];
  if (!worst) { this.msg('Nothing you carry is worn.'); return; }
  const d = durability(worst[1]!);
  worst[1]!.dur = Math.min(d.max, (worst[1]!.dur ?? d.max) + Math.round(d.max * 0.25));
  this.refreshDerived();
}
```

Zero combat power, and it is still the pick for a certain player. A six-floor delve
runs 150–350 landed blows against a weapon pool of 110–198; Temper is roughly one and
a half free repair bills a delve, and it is the difference between finishing the boss
with a weapon and finishing it at `BROKEN_STAT_FRACTION`.

**When casting it is wrong.** In a fight — 1.2s rooted is two free swings from a
Hollow Knight. And on a short run with a town portal open, where the forge is cheaper
than the slot.

---

### Why not a sixth

The obvious sixth is a terrain spell (jam a door, re-arm a trap, unlock a vault).
Doors already stop monsters, traps are one-shot by design, and vault keys are
guaranteed findable — so each of those is convenience, not a decision. The terrain axis
is served instead by Wardcry's push interacting with real trap tiles and by Sounding
reading walls. Five spells, five verbs, one button.

---

## C. The cooldown economy

### The resource model — and why there is no mana bar

Two models were weighed:

**(a) Pure cooldown per spell, cast paid in stamina.** ← **chosen**
**(b) A shared cast resource (a mana bar).**

(b) loses on four counts. First, screen: the HUD already carries health, stamina and a
recall bar, plus four quick-slots, a compass, a minimap, a target panel and a log, and
the target device is a phone. Second, loot: a mana bar wants mana potions, a `mana`
stat, mana affixes and a merchant line, which is a whole economy grown to support five
spells. Third, and decisively — **a mana bar makes the cost fungible**. You would top
it up in town and the spell would cost nothing in the moment it is cast. Fourth,
stamina is already the fight's rhythm resource; paying 30 stamina for a Wardcry means
you cannot swing three times and your next hits land at reduced `staminaPower`. That is
a cost you feel inside the fight rather than between them.

**On-screen buttons requested: one.** (§E.)

### Base cooldowns and why they are that long

| Spell | Base | Rationale |
|---|---|---|
| Sounding | 45s | No combat power. Should be usable roughly twice per floor |
| Wardcry | 70s | Target: **at most one per fight, and only in fights you chose it for**. A floor is ~4 minutes and 5–8 fights |
| Threshold | 80s | It edits the parry. Priced above Wardcry for that reason alone |
| Snuff | 90s | Escape is the strongest verb in a game with no healing regen. One per floor, at most |
| Temper | 90s | Paced against the repair economy, not the combat one: ~1.5 casts per delve |

### The clock runs slower in company

```ts
sigil.cd = Math.max(0, sigil.cd - dt * (this.hunted() ? 0.5 : 1));
// hunted(): any living enemy with alert > 0 within 8 tiles
```

Without this the kill economy is decorative: on depth 6 a fully committed build needs
five Hollow Knight kills (100–150 seconds of real fighting) against a 70-second clock,
and the clock wins every time — the economy would matter only on floors where the spell
does not. Halving the clock in combat makes Wardcry effectively **140s in a fight**,
which the kill path can beat. It also reads as flavour rather than as a rule: *the
charm fills in quiet, or on blood.*

### What a kill takes off

Based on the creature's **printed** health (`EnemyDef.hp`), not its depth-scaled
health. A rat is a rat wherever you meet it; the refund tracks how dangerous a kind of
thing is, so farming shallow trash is not a faucet.

```ts
killRefund = 2 + 8 * Math.min(1, enemyDef(e.def).hp / 140);   // seconds
multiplier = 1 + 0.25 * metaLevel(meta, 'attunement') + derived.stats.focus / 100;
refund     = Math.min(killRefund * multiplier, 0.20 * SPELLS[id].cooldown);
```

| Creature | Printed HP | Base refund |
|---|---|---|
| Giant Rat | 14 | 2.8s |
| Cave Bat | 16 | 2.9s |
| Goblin Cutpurse | 28 | 3.6s |
| Skeleton | 30 | 3.7s |
| Cave Spider | 36 | 4.1s |
| Mimic | 58 | 5.3s |
| Ghoul | 72 | 6.1s |
| Flame Wraith | 82 | 6.7s |
| Hollow Knight | 135 | 9.7s |
| Barrow Champion | 170 | 10.0s (capped) |
| The Ashen King | 330 | 10.0s (and he is the last thing you kill) |

**No refund for:** a `risen` guard (the King's phase-2 revivals — `killEnemy` already
returns early for these, so the hook sits after that guard and inherits it for free);
a kill made while the spell is already ready (no banking). A kill from a sprung trap or
a reflected bolt **does** refund: `killEnemy` is the single funnel and engineering a
death is still a kill.

### The Warden talent

```ts
{ id: 'attunement', name: "Warden's Vigil",
  description: 'Each kill takes 25% more off your sigil per level.',
  costs: [6, 12, 20] }
```

**38 renown** against a 333-renown tree. That puts it just below Treasure Sense (41)
and above Second Wind (22) — build-defining, but only for a player who owns a sigil,
which is why it is priced as a specialisation rather than as a staple. It does nothing
at all for a player with no spell attuned; the tree entry should grey out and sort last
until `state.spells` is non-empty, the same way an unbuyable upgrade already reads.

*Rejected:* giving L1 a flat base-cooldown reduction as well. It muddies the maths for
a fraction of a second per cast, and it would make the talent worth buying before you
have found a sigil.

### The item property

**Add one `StatKey`: `focus`, labelled "Spell Focus %".** It reads as a percentage
added to the kill refund multiplier.

*Weighed against reusing an existing stat.* `luck` is the tempting one — it is already
"the odd stat" — but crit and spell uptime would fuse into a single build, and combat
code caps `luck` at 60%, so a shared cap would be a permanent source of bugs. `find`
and `speed` are both load-bearing elsewhere. A new key it is.

**The migration story is: there isn't one.** `Stats` is never persisted — MECHANICS §7
is explicit that an item stores only base × material × rarity × affixes × quality, and
`itemStats()` derives the rest on every read. `emptyStats()` builds from `STAT_KEYS`, so
the new key materialises at 0 everywhere the moment it is added; `addStats` skips
absent keys. Grepping `STAT_KEYS` finds only `items.ts`, `town.ts`, `dom.ts` and
`types.ts`, all of which iterate it live. Verified: nothing in `game-state.ts` or
`market.ts` stores a `Stats` object. **No `MIGRATIONS` step is required for the stat
itself.** The one care point: `dom.ts:273` and `town.ts:104` iterate every key when
drawing a tooltip, so `focus` must be filtered when zero, or every item in the game
grows a dead line.

Two affixes, so the pool does not drown (the existing rule already forbids two affixes
on the same stat, so one item can carry at most one of these):

| Affix | Kind | Stat | Roll | Per level | Slots | Weight | From ilvl |
|---|---|---|---|---|---|---|---|
| **Graven** | prefix | focus | 3–6 | +0.5 | head, ring, amulet | 3 | 4 |
| **of the Vigil** | suffix | focus | 4–8 | +0.6 | head, ring, amulet | 4 | 3 |

Deliberately **not on weapons or offhand**: the spell build should cost jewellery and a
helm — Crit, Health, Find — not damage. Old saves see nothing: these are new affix ids
that never appear on already-rolled items, and the loader's "strip affixes that no
longer exist" pass only removes, never adds.

### The crafting hook

**A new gem: Wardstone.**

```ts
{ id: 'wardstone', name: 'Wardstone', category: 'gem', tier: 3, rarity: Rarity.Rare,
  value: 98, icon: 'ic_gem', ramp: ['#1a1a24', '#3c3a56', '#6e6a96', '#c0bce0'],
  mods: { focus: 4 }, catalystAffix: 'vigil',
  description: 'Catalyst: grants of the Vigil (+Spell Focus).' }
```

Tier 3 means `catalystAffixBonus` adds **+2** to the guaranteed roll, putting it in
line with Moonstone and Sunstone. Sources: Hollow Knight 6%, Barrow Champion 6%,
Flame Wraith 5%, plus the normal chest gem roll and the merchant's gem stock. A new
material id is save-neutral — a `{kind:'material', ref:'wardstone'}` simply never
appears in an existing save.

The natural build piece is a **Wardstone Pendant** (`r_pendant`, whose mandatory
`gem` "Stone" slot is already read as a catalyst by `catalystOf`). Note that the
pendant's gem slot contributes `catalystAffix` only, not `mods` — `buildCrafted`
sets `secondaryId` to `undefined` when slot 1 is a gem — so the `mods: { focus: 4 }`
above is market flavour and a hedge for future recipes, not the mechanism. **The
affix is the mechanism.**

### The stacking maths, and the worst case

Maximum plausible `focus`, at depth 6 (item level `depth × 2 + 0–2` = 12–14), one
focus affix per item, four eligible slots (head, ring1, ring2, amulet):

| Source | Max roll at ilvl 14 |
|---|---|
| of the Vigil × 4 | `8 + 0.6 × 14` = 16.4 each → **65.6** |
| (Graven is strictly worse: `6 + 0.5 × 14` = 13.0) | |

So **focus ≈ 66% absolute worst case** — four Epic-or-better pieces all rolling the
same suffix near maximum, each giving up a Health/Crit/Find roll to do it. A realistic
committed build lands nearer 30–40%.

Warden's Vigil L3: **+75%**.

**Worst-case multiplier: 1 + 0.75 + 0.66 = ×2.41.**

Applied, against Wardcry (70s base, cap `0.20 × 70` = **14.0s per kill**):

| Creature | Base refund | ×2.41 | After cap | Kills to reset |
|---|---|---|---|---|
| Hollow Knight | 9.7 | 23.4 | **14.0** | **5.0** |
| Ghoul | 6.1 | 14.7 | **14.0** | **5.0** |
| Skeleton | 3.7 | 8.9 | 8.9 | 7.8 |
| Giant Rat | 2.8 | 6.7 | 6.7 | 10.4 |

Uninvested (×1.00), for contrast: Hollow Knight 7.2 kills, Ghoul 11.5, Rat 25.

**The 20% cap is the fix, and it is the headline number: no build, ever, resets a
sigil in fewer than five kills.** Without it, a maxed build resets Wardcry on three
Hollow Knights and the brief's nightmare — *a 90s cooldown becomes 8s* — is exactly
what happens on the Ashen Throne, where the floor holds eleven of the biggest creatures
in the game.

With it, the real-world interval is `min(halved clock, time to make five kills)`:

- **Depth 6, maxed:** five Hollow Knights is ~2,600 effective HP and 100–150 seconds of
  genuine fighting, against a 140s in-combat clock. The two paths are deliberately
  neck and neck. Wardcry lands roughly **once per two real fights**.
- **Depth 6, uninvested:** 7.2 knights (~180s) loses to the 140s clock. You get the
  spell between fights, which is what not investing should feel like.
- **Depth 1, maxed:** 10.4 rats, maybe 60 seconds of killing, so Wardcry comes up about
  every minute — on a floor where a rat is not a threat and the spell is decoration.
  Accepted: the economy is loudest where the stakes are lowest.

Is the maxed build fair? It has spent **38 renown** (11% of the tree), four gear slots
of affix budget on a stat that deals no damage and adds no health, and one attunement
slot — and it gets one 1.2-second stun per two fights. Yes.

---

## D. Acquisition and save schema

### How you get one

**A sigil is a found object you have to carry home.** Not bought, not bought back, not
granted by renown.

Options weighed:

| Option | Verdict |
|---|---|
| Learned from the renown tree | Rejected. No discovery; renown is already the "spend to be stronger" axis and this would make sigils just another stat purchase |
| Bought in town | Rejected as a *source*. A spell you can buy is a spell you will own all five of by day 12 |
| Tied to an equipment slot | Rejected. Every slot is already a stat decision, and hanging a spell on the offhand collides with the weapon overhaul's two-handers |
| Reuse `ItemKind: 'lore'` | Tempting — lore is read where it lies and never enters the pack — but `lore.ref` indexes `ENEMIES` throughout `items.ts` and `bestiary.ts`. Two ref namespaces under one kind is a landmine |
| **New `ItemKind: 'sigil'`** | **Chosen.** Zero save cost (no existing save contains one, so no migration touches items at all) and it behaves like a blueprint, which the town UI already knows how to draw |

A **Sigil** is a pack item: it takes a slot, it can be stashed, it can be sold, and
**it is lost if you die carrying it.** That stake is the whole reason it feels like a
discovery in a game named after looting. In town, *inscribe* it at the forge beside the
blueprint pane — free, instant, consumes the stone, permanent for the playthrough.

Drop table (all rolls reject a sigil you already know, so duplicates never drop):

| Source | Chance |
|---|---|
| Vault / secret chest | **22%** for an unknown sigil |
| Ordinary chest | `3% × depthFactor` (0 at depth 1 → 1 at depth 5), matching Fight Milk's shape |
| The Ashen King | **100%**, one unknown sigil, on top of his existing hoard, while any remain unknown |
| Merchant | **Never.** Deliberate |

That puts the full set of five behind roughly four boss kills or a lot of vaults, which
is the right pace for a thing that reshapes how a delve is played.

### Attunement

One slot. Set in the **Stash & Gear** tab beside the Pack panel: a single chip listing
the sigils you have inscribed, plus *None*. Locked while a run is open, **except**
during a town-portal visit — and swapping there **does not reset the cooldown**: the
run's remaining seconds carry over to whatever you swap in. Without that, a Scroll of
Recall is a spell reset.

### Exact new fields

```ts
// game-state.ts
export interface GameState {
  // ...
  /** Sigils inscribed this playthrough. Permanent; absent means none. */
  spells?: string[];
  /** The sigil taken on the next delve, or null. */
  attuned?: string | null;
}

export interface RunState {
  // ...
  /** The sigil carried down and its remaining cooldown in seconds. */
  sigil?: { id: string; cd: number } | null;
}
```

Nothing else is saved. The Threshold ward, the Snuff darkness and the cast timer all
live on `PlayerAnim` — which is rebuilt in the `World` constructor and never
persisted — following the precedent `anim.recall` already sets: a channel in progress
is lost on reload, and that is fine.

### The migration step

`SAVE_VERSION` stays **2**. `SAVE_REVISION` goes **17 → 18**, and `MIGRATIONS` gains
one entry at index 17:

```ts
// 17 → 18: sigils. A save from before them knows no spells and has none attuned;
// a run in progress carries nothing, so the button never appears and the game is
// byte-for-byte the game it was.
(s) => {
  s.spells ??= [];
  s.attuned ??= null;
  if (s.run) s.run.sigil ??= null;
},
```

Idempotent, tolerates a half-built state, cannot throw.

**What an old save sees:** `spells` is `[]`, so the forge shows no inscribed sigils and
Warden's Vigil greys out; `attuned` is `null`, so no HUD glyph and no touch button
render, and `G` does nothing; `run.sigil` is `null`, so a player mid-delve resumes with
exactly the interface they left. The `focus` stat exists but reads 0 on every item and
is filtered from tooltips. `src/__tests__/persistence.test.ts`'s captured fixture
passes unchanged.

---

## E. UI and controls

**One key. One button. One HUD element.** That is the whole ask.

### Desktop

`1`–`4` are consumables, `R` belongs to the weapon overhaul. Reading the keydown
switch in `main.ts` and `handleKey` in `dungeon-ui.ts`, the taken set is
`w a s d q e space shift f enter i tab m escape h 1 2 3 4` plus arrows.

**Cast is `G`**, with `C` as an alias. Both are free, both are reachable from WASD
without moving the hand off the movement keys, and neither is claimed by an overlay.
The weapon agent's final keymap must be diffed against this before either lands.

Add to the hint line: `… · 1–4 use · G sigil · Esc menu`.

### The HUD

One new element: a **36px round glyph** placed immediately left of the four quick-slots,
sharing their row and their `.slot` styling, so it costs no vertical space on a phone.

- **Ready:** the sigil icon at full value, with a one-shot rim pulse the frame it
  becomes ready, and a soft chime.
- **On cooldown:** the icon at ~35% opacity under a **radial sweep** (a
  `conic-gradient` mask, no new DOM), with the remaining whole seconds in the
  quick-slot `qty` corner.
- **Unaffordable** (stamina below cost): the icon tints toward the "winded" colour so
  you can see at a glance that the answer is to back off, not to press.
- **Not attuned:** the element is not rendered at all. A player who never picks up a
  sigil sees the HUD they have now.

Explicitly **not a bar.** Health, stamina and recall are already three; a fourth would
crowd the phone, and a cooldown is a clock, which a ring reads better than a line.

### Touch

The right-hand `actions` cluster is currently `block` + `main`. Add a **third, 44px tap
button above the block button**, in the dead space left of `main`: the sigil glyph with
the same radial sweep on its face. It is a tap, not a hold (`hold()` is for block and
attack; use the existing `tap()` helper), so it cannot be leant on.

It renders only when a sigil is attuned, so the current three-button layout is
unchanged for everyone else. At 400px width the cluster is block (56) + sigil (44) +
main (72) with gaps — it fits, and the sigil sits furthest from the thumb's resting
arc, which is correct for the button you press least.

Cooldown seconds are not drawn on touch; the sweep is the readout. Casting logs a line
and plays a distinct sfx (a low struck-stone tone, synthesised like everything else).

---

## F. Hard-mode audit

The contract: **every knob in `DIFFICULTIES.hard` is exactly 1 or 0 and stays that
way.** Nothing in this document touches `difficulty.ts`. What follows is the harder
question — whether the *mechanics* soften Hard.

### Wardcry

- **The abuse:** a stun on demand is a parry you did not earn. Open every dangerous
  fight with it, get a free 1.2s, repeat.
- **The guards.** (1) It grants **no `vuln`** — a parry pays double damage for a
  second, Wardcry pays nothing, so it is strictly worse whenever a parry is available.
  (2) 30 stamina is three swings and drops you toward the `staminaPower` penalty, so
  the "free" second is spent hitting softer. (3) It **shouts**: 8 tiles through walls,
  which on a corridor floor routinely turns a 1v1 into a 1v3. (4) 70s base, and five
  kills minimum however you build. (5) It pushes ranged enemies *back into range*.
- **Residual risk:** the wall slam plus the trap push is the fun part and therefore the
  part to watch. Both are capped hard — 25 damage and one trap charge respectively —
  and both need geometry you do not usually have. If playtest shows corridors becoming
  a spike-pit conveyor, the knob is the slam cap (25 → 12), not the mechanic.
- **The boss.** He is never moved, never staggered, and **his wind-up is never
  interrupted**; he gets 0.5s of `attackCd` and nothing else. His escorts and his risen
  guards take the full effect, which is Wardcry's real job in the throne room: get a
  Hollow Knight off you so you can face the King. In **The Dark** the shout is a
  liability — the room is already full of things you cannot see. Risen guards refund no
  cooldown, so the phase cannot be farmed for charge.

### Snuff

- **The abuse:** disengage from every losing fight, heal up, re-enter. Attrition — the
  thing the shrine rework exists to protect — stops binding.
- **The guards.** (1) You can already walk away; doors block monsters, alert lasts 6
  seconds, and disengaging is a legitimate play the game supports today. Snuff makes it
  reliable, not new. (2) It does **not** heal — you still have no health regeneration,
  and the potion you drink after fleeing is the potion you do not have on depth 6. (3)
  Eight seconds of near-blindness in a dungeon whose traps are read by looking is a
  real chance of dying to the escape. (4) Anything within 2 tiles re-acquires you
  immediately. (5) It does not stop a committed wind-up.
- **Residual risk:** the one genuinely strong case is a bad Frost Vault pull at depth 5.
  Accepted — that is a fight you should be allowed to refuse once every 90 seconds at
  the cost of your only spell slot.
- **The boss.** In phases 1 and 3 the throne room has the densest torchlight in the
  game and the King's sight is 12 against an 11-tile room: he re-acquires almost
  anywhere. In **The Dark** it works, and that is correct — the answer it gives is
  *leave the room, drink, come back*, which walking already permits. It cannot win the
  fight, because his health does not reset.

### Sounding

- **The abuse:** trap-finding stops being a skill. §6a is explicit that spotting is
  whether you were looking.
- **The guards.** (1) Radius 6 out of a 47-tile floor, once every 45 seconds, at 0.8s
  rooted — that is a lantern, not a map. (2) It never disarms; the walk and the [F]
  still cost you. (3) It never draws a creature, so a corridor it declares free of
  traps can still hold a ghoul. (4) It costs your only attunement slot, which means
  going into depth 6 with no Wardcry and no Threshold.
- **Residual risk:** none worth a knob. This is the safe spell, and it is in the roster
  because a looting game should have one tool pointed at the loot.
- **The boss.** Reveals throne-room geometry, including in the dark. Worth almost
  nothing: `visibleEnemies()` is geometric and already shows the knights on the minimap
  within 8 tiles, lit or not, and phase 2's difficulty is the company, not the walls.
  The honest read is that Sounding is a dead slot on the boss floor.

### Threshold

- **The abuse:** the loudest one in the document. It edits `PARRY_WINDOW`, and the
  parry is the game.
- **The guards.** (1) It does not deny anything for you — you still have to meet the
  swing on the rising edge, and a mistime is still a plain block. (2) **One tile**, and
  stepping off ends it, which means it removes your other answer (dodging the committed
  tile) for its whole duration. (3) 8 seconds, once per 80. (4) Ranged enemies actively
  sidestep to align on a stationary target, so the ward is a beacon in any fight with a
  wisp in it. (5) The doubled window is 0.44s against wind-ups of 0.35–0.85s — still
  under half of most of them, so it forgives sloppiness, it does not remove timing.
- **Residual risk:** real. The safe default is stated in §B — ×1.6 rather than ×2, and
  drop the cooldown change — and it should be the first knob turned if depth-5 fights
  measure easier.
- **The boss.** This is the spell's reason to exist and its biggest risk. **The Last
  Stand** asks *can you parry under pressure*; Threshold answers *yes, on this square,
  for eight seconds*. At his phase-3 wind-up plus recovery that is about **four
  swings**, so up to four forgiving parries, each worth a second of doubled damage —
  call it a fifth to a quarter of his last phase, once. It buys that by surrendering
  the ability to step out of the tile he commits to, in the phase where he is fastest,
  with a depth-6 shadow blow waiting on every misread. That is a new answer to the
  fight, not a solution to it. **Watch this number in playtest above all others.**

### Temper

- **The abuse:** none available. It deals no damage, prevents none, and moves nothing.
  The worst it does is let a delve run longer, which costs the player a spell slot and
  the forge some gold.
- **The guard that matters is a bug guard, not a balance one:** it must call
  `refreshDerived()` after changing `dur`, or un-breaking a piece will not restore its
  stats.
- **The boss.** A weapon that breaks mid-King is a lost run, and Temper is the answer.
  The 1.2s channel is affordable in exactly one place — the **1.2s reel** when a phase
  breaks (`BOSS_PHASE_BEAT`). That is a lovely, exact fit and it should be left alone.

### Two economy-level guards, restated

1. **Risen guards refund nothing.** The hook goes *after* `killEnemy`'s existing
   `if (e.risen) return`, so it inherits the rule for free. Otherwise the throne room
   becomes the best place in the game to farm cooldown as well as moonsilver.
2. **The cooldown does not tick in town, and swapping attunement through a portal does
   not reset it.** Otherwise a Scroll of Recall is a spell charge.

---

## G. Art requirements

Everything is a palette-indexed character grid in `src/art/`, per §16. Seven new
assets; **no projectile sprite is needed**, because nothing in this roster throws
anything.

### Five 16×16 icons — `src/art/icons.ts`

Each is both the pack item and the HUD glyph, so it has to read at 36px *and* at
16px in a stash grid. Shared language: a **graven stone token**, roughly circular,
dark slate ground (ramp `1`/`2`), with a carved mark cut through to a lit inner colour.
Keep the mark to 6–8 lit pixels — anything busier turns to mud at HUD size. Use the
existing `k` outline and give each an alpha-`fa` accent so it glows faintly in the dark,
the way ward and portal art already does.

| Id | Mark | Accent |
|---|---|---|
| `ic_sig_wardcry` | An open palm, fingers up, facing the viewer — three short vertical strokes over a flat bar. Reads as *stop* | pale gold `#ffe8a0fa`, matching the parry flourish |
| `ic_sig_snuff` | A candle flame **inverted** — a teardrop pointing down — with two pinching strokes closing on it from the sides | cold violet `#8a70c0fa` |
| `ic_sig_sounding` | Three nested arcs radiating right from a struck point on the left edge, thinning outward | warm stone `#e0c060fa`, the trap-spotted colour |
| `ic_sig_threshold` | A doorway seen flat: two uprights, a lintel, and a single filled square on the floor between them | pale gold `#ffe8a0fa`, tying it to the parry |
| `ic_sig_temper` | A whetstone lozenge crossed by a blade edge, with two spark pixels above the contact point | ember orange `#ff9a40fa` |

The **Wardstone** gem needs no new art: gems already reuse `ic_gem` under a per-material
ramp, and the ramp is given in §C.

### One 24×40 viewmodel — `src/art/viewmodels.ts`

`vm_sigil` — the **left** hand (mirror the existing `HAND` silhouette horizontally;
every current viewmodel is right-handed and a cast should visibly come from the other
hand), rising from the bottom-**left** corner, holding the token pinched between thumb
and forefinger so the graven face is turned toward the viewer. Two frames:

- `vm_sigil` — hand raised, token dark, mark in ramp `2`.
- `vm_sigil_lit` — identical silhouette, mark in ramp `4` plus an `fa` glow colour, and
  three 1px sparks in the empty top-right. Drawn on the final ~0.12s of the cast.

The token face is a 6×6 area at roughly rows 8–13; the mark inside it is swapped per
attuned spell by reusing the icon's mark rows, so the artist draws the hand and the
blank token once.

### One 16×16 floor decal — `src/art/props.ts`

`ward_threshold`, drawn on the same 16×16 flat-tile grid as `trap_dart` /
`trap_alarm`, in that section of the file. A **complete ring** just inside the tile
edge (unlike `trap_alarm`'s broken ring), one pixel thick, with four short inward ticks
at the compass points and a small filled square dead centre. Palette: two alpha-`fa`
golds — `#8a6a20fa` for the ring, `#ffe8a0fa` for the ticks and centre — so it lights
the flagstone it sits on. It must be legible against the Ashen Throne's obsidian and
the Frost Vault's blue stone; test on both. Second variant `ward_threshold_dim` at
half value, drawn for the last 2 seconds of the ward's life as the warning that it is
going out.

### No new art needed for

- **Wardcry's shockwave** — a one-frame screen-space ring, done in the renderer with
  the existing `shake` and flash plumbing, plus the existing `parryFlourish` treatment
  in gold on the target tile. Cheaper than an asset and it reads better in motion.
- **Snuff's darkness** — the renderer already rebuilds its lights every frame from a
  list; the effect is a light-radius number.
- **Sounding** — automap plus log lines only.
- **The HUD ring** — a CSS `conic-gradient` over the icon.
