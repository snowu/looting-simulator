# Looting Simulator: Replayability and Depth

## Diagnosis

The game is not short on systems or content objects. It already has a strong
foundation:

- Six persistent, backtrackable dungeon floors across eight biomes.
- Roughly twenty enemy families and variants, readable real-time combat,
  parrying, blocking, resistances, ranged attacks and a multi-phase boss.
- Weapons with distinct timing and roles, two-handers, retrievable thrown
  weapons and five mutually exclusive sigils.
- Loot rarity, affixes, named relics, durability, identification, material
  crafting, recipe mastery and flask upgrades/infusions.
- Shrines, curses, secrets, vaults, traps, mimics, contracts, a shifting
  market, renown and permanent Warden upgrades.
- A meaningful extraction decision in which equipped gear is safe but the
  backpack remains at risk.

The weakness is that most of these systems ultimately serve the same run-level
question: **how far can I safely descend before extracting?** A different biome
or weapon changes the texture of that journey, but it does not often give the
run a different purpose or force a fundamentally different plan.

Adding more floors, enemies, affixes or recipes would increase breadth, but it
would not necessarily increase depth. It would also create an expensive content
treadmill. The six-floor structure is worth preserving: it gives a delve a
clear, digestible dramatic arc.

The best route to replayability is to make the existing systems collide in new
combinations through player commitments, changing dungeon rules and build
synergies.

## Design north star

> Every delve should force the player to form a plan, then give them enough
> unexpected opportunities to reconsider it.

A memorable run should be describable as a story: “I took the Ember road
because I had frost damage, accepted Brittle for a forge boon, hunted the floor
lieutenant, and nearly lost the Oath by breaking my shield.”

## 1. Delve Oaths: the highest-leverage addition

Before entering the dungeon, offer three generated Oaths. An Oath is optional
and has four parts:

| Part | Purpose |
| --- | --- |
| Rule mutation | Makes familiar rooms play differently |
| Objective | Gives the delve a purpose besides reaching depth 6 |
| Pressure | Disrupts the safest default routine |
| Distinctive reward | Enables a future build instead of merely paying more gold |

Examples:

### Oath of the Butcher

- Elite enemies appear more often.
- Flask healing is reduced.
- Kill three marked champions.
- Reward: choose one of three weapon-oriented powers or items.

### Oath of the Miser

- Recall cannot be used.
- Gold is bundled into increasingly bulky purses that consume pack space.
- Extract with a specified amount of gold.
- Reward: a treasure map, valuable catalyst or temporary market privilege.

### Oath of Broken Iron

- Equipment wears twice as quickly.
- Dungeon repair opportunities become stronger or more common.
- Reach a target depth without an equipped item breaking.
- Reward: recipe mastery or a special smithing modifier.

### Oath of Silence

- Monsters initially have shorter sight.
- Noise propagates farther; Wardcry may alert much of a floor.
- Complete objectives without triggering a general alarm.
- Reward: stealth, ambush or movement-oriented gear.

### Oath of the Pilgrim

- Shrines offer stronger blessings paired with harsher curses.
- Accept a required number of bargains and extract.
- Reward: carry a weakened blessing into the next delve or unlock a new shrine
  result.

Oaths multiply the value of systems that already exist: difficulty snapshots,
run curses and blessings, durability, portal use, pack pressure, elite enemies,
contracts, sigils, loot generation and crafting rewards. They should be opt-in
so the ordinary delve remains the clean authored experience.

## 2. Player-authored routes

Dungeon generation currently makes many decisions before the player arrives.
The player explores those decisions but rarely determines what comes next.

Add mutually exclusive route choices, initially after depths 2 and 4. This need
not require a branching world map: two sealed stairs, gates or altars can select
the next floor's biome and modifier.

Each route should communicate:

- Its biome or theme.
- Its primary danger.
- Its likely reward family.
- Any special rule it introduces.

Example:

| The Sunken Road | The Barrow Road |
| --- | --- |
| Flooded rooms and Drowned enemies | More elites and locked rooms |
| More consumables | Scarce healing |
| Flask/healing reward | Weapon/armour reward |

Choosing one removes the other. The best choice should depend upon the current
equipment, Oath, contracts, remaining supplies and emerging build rather than
one route being universally stronger.

## 3. One gameplay law per biome

Biomes need a mechanical identity beyond visuals, resident weighting and
resistances. Each should have one understandable systemic law and one way for
the player to exploit it.

Possible directions:

- **Ossuary:** some defeated undead reassemble unless their remains are
  shattered or sanctified.
- **Sunken Catacombs:** water conducts frost or holy effects and suppresses
  fire, affecting both player and enemies.
- **Vermin Burrows:** noise attracts roaming packs; root caches can also be
  broken or baited to redirect them.
- **Deep Mines:** unstable walls can be collapsed onto enemies or opened as
  risky shortcuts.
- **Frost Vault:** movement creates dangerous slick paths; fire can permanently
  alter small areas.
- **Emberworks:** heat accumulates under certain conditions, while overheated
  weapons gain a temporary offensive benefit.
- **Sporegrove:** spore clouds affect everyone, allowing environmental traps,
  denial and monster manipulation.

A biome law should create agency. Passive periodic damage is merely a tax;
luring an enemy over a vent while knowing the player must later cross it is a
decision.

## 4. Floor lieutenants

Give some or all ordinary floors a named lieutenant whose presence changes the
floor until it dies. This creates a local arc without turning every floor into
a formal boss fight.

Examples:

- An Ossuary necromancer allows some enemies to rise again.
- A goblin quartermaster strengthens shieldbearers and improves guarded caches.
- A fungal heart produces restorative clouds for Sporegrove creatures.
- A frost herald periodically seals opened doors with ice.
- A treasure beast collects unattended floor loot and carries it away.

The player should be able to observe the abnormal behavior, find clues to the
source, decide whether hunting it is worthwhile, and feel the floor change
immediately when it dies. Its reward should relate to the rule it imposed.

## 5. Build-defining properties

Weapon bases already have meaningful identities, but much of the remaining
equipment can still be evaluated vertically by comparing useful stat totals.
Add a small, curated set of properties that interact with combat verbs and
other systems. Avoid a large pool of opaque percentage affixes.

Candidate properties:

- **Riposte:** after a parry, the next blade or dagger strike costs no stamina.
- **Execution:** killing a staggered enemy partially refreshes Wardcry.
- **Retrieval:** called shafts damage enemies they pass through.
- **Bulwark:** absorbing a large hit empowers the next blunt strike or shield
  action.
- **Kindling:** fire damage against a wounded target spreads to an adjacent
  enemy.
- **Pilgrim:** shrine curses also amplify their paired blessings.
- **Scavenger:** breaking an item grants a temporary effect based on its
  material.
- **Last Flask:** morsels and life leech become stronger while the flask is
  empty.

Two interacting properties are enough to create a recognizable build. Players
should be able to talk about a “retrieval build,” “cursed shrine build” or
“riposte build,” not merely an item with eleven more Attack.

High-rank crafting could participate through one irreversible specialization:

- **Tempered:** dependable base-stat improvement.
- **Barbed:** offensive conditional property.
- **Hollow:** sigil or cooldown property.
- **Consecrated:** shrine or elemental property.

This turns crafting into build authorship rather than only a vertical power
ladder.

## 6. Contracts that change play

Current delivery, slaying and depth contracts support the economy, but often
reward behavior the player would perform anyway. Add authored contract
templates that place an object, target, restriction or dilemma in the dungeon.

Examples:

- Recover a body from depth 4; it occupies several pack slots.
- Return an intact cursed item; identifying or equipping it fails the contract.
- Kill a marked enemy with reflected damage.
- Extract without using the flask.
- Map most of a specified floor.
- Carry an Emberworks relic to town without routing through the Frost Vault.
- Lure a creature onto a binding seal rather than killing it.
- Recover a ledger, then choose between the guild and the person named in it.

These should remain concrete dungeon situations, not a long list of
achievement-style chores.

## 7. Horizontal long-term progression

The existing Warden board mostly grants permanent strength or convenience.
Future progression should favor possibility over raw power so that Hard mode's
balance does not have to chase the player forever.

Good permanent unlocks include:

- New Oaths entering the offer pool.
- New route and lieutenant families.
- Alternative shrine outcomes.
- Crafting specializations.
- New contract patrons and templates.
- Starting-loadout sidegrades.
- A costly ability to reroll one route offer.
- Relics becoming eligible to drop rather than being granted immediately.

## 8. Post-King endgame: Ashen Seals

After defeating the King, unlock selectable clauses that let players author a
harder delve. Each clause adds a known complication and increases reward or
score.

Possible clauses:

- Enemies recover from stagger faster.
- Two lieutenants inhabit each floor.
- Shrines always pair blessings with curses.
- The extraction portal requires a sacrifice.
- Elites inherit an additional trait.
- The King inherits one surviving lieutenant's ability.
- The route contains fewer floors, but each is denser and more dangerous.

This is preferable to a generic New Game+ based on health and damage inflation.
Hard remains the authored game; Sealed delves become the configurable mastery
layer.

## Recommended cohesive expansion

The strongest package is:

1. Delve Oaths at the town gate.
2. Route choices after depths 2 and 4.
3. One gameplay law per biome.
4. A small family of floor lieutenants.
5. Roughly twelve build-defining properties.
6. Ashen Seal clauses after the first King kill.

The systems reinforce one another:

```text
Town build
    -> choose an Oath
    -> choose routes during the descent
    -> respond to biome laws and lieutenants
    -> let discoveries form or redirect the build
    -> decide whether the Oath reward justifies continuing
```

Replayability comes from combinations rather than an unsustainable volume of
handmade content.

## First prototype

Test the thesis with three Oaths that mostly reuse existing hooks:

### Blood Price

- Begin with Frailty.
- Extract at least 250 dungeon gold.
- Reward: increased contract renown or a choice of catalysts.

### Unbroken

- Equipment wear is doubled.
- Reach depth 4 without an equipped item breaking.
- Reward: a chosen structural material or recipe mastery.

### Hunter

- Enemy sight is increased.
- Three marked elites are placed across the delve.
- Kill all three and extract.
- Reward: choose one of three identified Rare items.

The prototype needs an Oath offer in town, a run-state snapshot, objective
tracking, marked-enemy presentation, completion/failure feedback and reward
selection. It should not initially require new enemy AI, biome art or a new
combat subsystem.

### What to measure

- Oath acceptance rate after players understand the feature.
- Completion and abandonment rate per Oath and target depth.
- Whether Oaths change loadouts, sigil choice and extraction depth.
- Whether players can explain why they succeeded or failed.
- Whether players describe runs by their Oath or story afterward.
- Whether the optimal strategy differs meaningfully among Oaths.

The most important qualitative signal is players saying “my Hunter run” or “my
Unbroken run.” That would show that individual delves have acquired identities.

## Suggested rollout

### Phase 1: validate run identity

- Implement three Oaths.
- Use existing curses, durability, elite generation and reward machinery.
- Tune rewards so an Oath is desirable but never mandatory for baseline
  progression.
- Playtest on Hard before expanding the pool.

### Phase 2: add decisions within a run

- Add a single route decision at depth 3.
- Give three biomes one gameplay law each.
- Add two lieutenant templates.
- Confirm that route information influences preparation and mid-run choices.

### Phase 3: enable emergent builds

- Add six carefully selected build properties.
- Put them on a mixture of relics, crafted specializations and Oath rewards.
- Expand only after combinations produce distinct play styles without making
  combat unreadable.

### Phase 4: create the mastery endgame

- Unlock Ashen Seals after the first King defeat.
- Start with a small, clearly scored clause set.
- Add clauses alongside future content so each addition multiplies the existing
  possibility space.

## Lower-priority directions

Do not prioritize these until the run-identity prototype has been tested:

- **More than six floors:** longer runs may become exhausting without becoming
  more strategically varied.
- **A much larger enemy roster:** expensive to create and only moderately
  valuable unless encounter composition and floor rules also change.
- **Hundreds of randomized affixes:** likely to obscure the game's readable
  combat and equipment decisions.
- **More permanent stat upgrades:** risks eroding the carefully tuned Hard
  experience.
- **Procedural quests dominated by text:** high presentation cost with limited
  mechanical impact.
- **Generic New Game+:** larger health and damage numbers reproduce the same
  decisions in slower fights.

## Final recommendation

Build and playtest Delve Oaths first. They are the smallest addition capable of
testing the central diagnosis, and they reuse the greatest number of existing
systems. If they make players prepare differently, take unusual risks and tell
stories about particular runs, proceed to route choices, biome laws and
lieutenants. Those layers together can make six floors feel like a broad
possibility space instead of a short fixed content track.
