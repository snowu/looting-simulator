# Altar variety — Risk of Rain 2 brainstorm

*Design spec + brainstorm log. Companion to [MECHANICS.md](../MECHANICS.md)
and the [gold/renown balancing doc](./gold-renown-balancing.md).*

The dungeon has three gods (font, idol, coffer) and every shrine room feels
the same after a dozen delves. Risk of Rain 2 solves the same problem with a
family of shrines that each ask a different question: gold, health, or nerve.
Below is the full RoR2 mapping, what fits this game, and what shipped.

## 1. The RoR2 shelf, mapped

| RoR2 shrine | Asks | Gives | Verdict for Bleakmere |
|---|---|---|---|
| Shrine of Combat | nothing up front | waves of enemies + their loot | **SHIPPED** as the Shrine of Strife — the mob-spawning altar |
| Shrine of Blood | 50% current HP | gold | **SHIPPED** as the Sanguine Altar — HP is a currency now |
| Shrine of Chance | escalating gold | random pulls, rising fail chance | Parked: overlaps the coffer's escalating-price+fizzle loop too closely |
| Shrine of the Mountain | harder bosses | double boss loot | Parked: needs an elite/champion system first (see §4) |
| Halcyon Shrine / Altar of Gold | big gold | an elite boss + its hoard | Parked: same reason — no elites yet, and it wants a set-piece arena |
| Newt Altar | — | a portal somewhere else | Parked: there is nowhere else *to* go yet (no second scene) |
| Shrine of Order | your whole build | a standardized build | Rejected: the game's promise is the weird build you dragged home |

Two shipped now, three parked behind the elite system, one behind a second
scene, one rejected on philosophy. That is a healthy ratio for one PR.

## 2. Shipped: Sanguine Altar (Shrine of Blood)

- **Look:** cold crimson light (`#ff4a5a`), red-stoned sprite, same pedestal.
- **Prompt:** *Bleed at the red altar*.
- **Price:** half your current HP, rounded down, single use. Refused at 1 HP
  ("You have nothing left to give") — the altar cannot kill you.
- **Prize:** `40 + 30 × depth + pay` gold, straight into the purse. D1 at full
  70 HP: pay 35 → 105g. D6 at 135: pay 67 → 287g.
- **Why it works here:** it turns HP into a currency, which plugs straight
  into the rest of this branch — bleed at the altar, mend at the font.
  (A paid town heal was tried and scrapped: with the other sinks in place it
  was unnecessary, and a mid-delve full mend for gold would have ended
  attrition as a mechanic.) The loop is the content.

## 3. Shipped: Shrine of Strife (Shrine of Combat)

- **Look:** ember-orange light (`#ff7a30`), fire-stoned sprite.
- **Prompt:** *Challenge the ember shrine*. Free to invoke, single use.
- **Trial:** `2 + ceil(depth/2)` depth-appropriate enemies (D1: 3, D6: 5 —
  same pool and weights as the floor itself, never the boss) rise on free
  tiles around the shrine, already alerted and coming. They are ordinary
  enemies otherwise: they drop their ordinary loot.
- **Prize:** when the last trial-marked kill lands, `60 + 40 × depth` gold
  drops at your feet (D1: 100, D6: 300), with a message and a float.
- **Rules:** one trial at a time per run — a second strife shrine stays usable
  but answers "The yard is already bloodied. Finish the trial first." Trial
  marks live on `run.trial` (optional, save-safe); leaving the floor,
  portalling home, dying or extracting all behave sanely because the check
  runs in the normal kill path.
- **Why it works here:** RoR2's combat shrine is a difficulty slider the
  player opts into. Here it is also a loot accelerator for strong builds and
  a death trap for weak ones — the decision reads at a glance.

## 4. Parked: what the elite system unlocks

Shrine of the Mountain and Halcyon both want *champions*: named, tougher
versions of ordinary enemies with bonus drops. The day `EnemyState` grows an
`elite` flag (×2 HP, +25% damage, gold-material cache on death), both shrines
fall out naturally:

- **Mountain:** all un-killed enemies on the floor go elite; chests on the
  floor roll twice. A whole-floor gamble instead of a single-room one.
- **Halcyon:** pay `200 + 100 × depth` gold to wake one elite guard beside a
  vault-quality cache. The set-piece version of the strife trial.

Deliberately not in this PR: elites touch combat math, the bestiary, and the
golden HP fixture. That is its own branch.

## 5. Generation & odds

Flavor weights move from font 4 / idol 4 / coffer 3 to **font 4 / idol 4 /
coffer 3 / blood 2 / combat 2**. New kinds ride the same 55% base rate, the
same one-per-floor cap, and the same pity guarantees — a shrine room is a
shrine room; only the god inside varies. Pity counts roles, not flavors, so
it is untouched.

---
*Files: `src/systems/dungeon.ts` (`ShrineKind`, `shrineKindFor`),
`src/world/world.ts` (`SHRINE_PROMPT`, `pray`, trial hooks in `killEnemy`),
`src/art/props.ts` (palettes + sprite defs), `src/render/dungeon-renderer.ts`
(`SHRINE_LIGHT`), `src/state/game-state.ts` (`run.trial`).*
