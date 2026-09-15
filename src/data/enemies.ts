import { ELEMENTAL_VARIANTS, elementalVariant } from './elemental-variants';
import { EnemyDef } from '../types';

/*
 * Physical damage is a triangle, not a ladder. Blunt crushes bone and rigid
 * things, slash opens unarmoured flesh, pierce punches through plate and hide.
 * Each type has enemies weak to it; blunt used to be the only one that did.
 */
const UNDEAD_RESIST = { pierce: 0.55, slash: 0.6, blunt: 1.5, holy: 2, shadow: 0.5 };

export const ENEMIES: EnemyDef[] = [
  {
    id: 'drowned_bones', name: 'Drowned Bones', sprite: 'drowned', scale: 0.95,
    hp: 34, attack: 8, defense: 3, damageType: 'blunt', resist: { ...UNDEAD_RESIST, frost: 0.6, fire: 1.4 }, undead: true,
    behavior: 'melee', step: 0.7, windup: 0.7, recovery: 1, sight: 6,
    minDepth: 1, maxDepth: 3, weight: 0.8,
    loot: [{ id: 'bone', chance: 0.5, min: 1, max: 2 }], gold: [0, 5], itemChance: 0.025,
    description: 'Waterlogged bones swing slowly, but the weight of the blow lingers.',
  },
  {
    id: 'tunnel_stalker', name: 'Tunnel Stalker', sprite: 'stalker', scale: 0.65,
    hp: 25, attack: 9, defense: 1, damageType: 'pierce', resist: { fire: 1.5, slash: 1.35 },
    behavior: 'skittish', step: 0.26, windup: 0.4, recovery: 0.75, sight: 5,
    minDepth: 2, maxDepth: 4, weight: 0.8,
    loot: [{ id: 'spider_silk', chance: 0.35, min: 1, max: 1 }], gold: [0, 3], itemChance: 0.01,
    description: 'A quick bite, then it vanishes into the dark.',
  },
  {
    id: 'cinder_raider', name: 'Ember Archer', sprite: 'cinder', scale: 0.95,
    hp: 39, attack: 12, defense: 4, damageType: 'fire', element: 'fire', resist: { fire: 0.5, frost: 1.6, pierce: 1.2 },
    behavior: 'ranged', step: 0.4, windup: 0.8, recovery: 1.5, sight: 8, range: 4,
    projectile: { sprite: 'proj_arrow_fire', speed: 6, damageType: 'fire', light: '#ff8030' },
    minDepth: 3, maxDepth: 5, weight: 0.7,
    loot: [{ id: 'flame_shard', chance: 0.22, min: 1, max: 1 }, { id: 'iron', chance: 0.2, min: 1, max: 1 }],
    gold: [4, 13], itemChance: 0.04,
    description: 'A hooded archer with an ember-bright arrow. Its shafts burn; frost quenches them.',
  },
  {
    id: 'elemental_frost', name: 'Rime Archer', sprite: 'rime', scale: 0.95,
    hp: 39, attack: 12, defense: 4, damageType: 'frost', element: 'frost', resist: { frost: 0.5, fire: 1.6, pierce: 1.2 },
    behavior: 'ranged', step: 0.4, windup: 0.8, recovery: 1.5, sight: 8, range: 4,
    projectile: { sprite: 'proj_arrow_frost', speed: 6, damageType: 'frost', light: '#80cfff' },
    minDepth: 3, maxDepth: 5, weight: 0.6,
    loot: [{ id: 'frost_shard', chance: 0.22, min: 1, max: 1 }, { id: 'iron', chance: 0.2, min: 1, max: 1 }],
    gold: [4, 13], itemChance: 0.04,
    description: 'Its blue arrow freezes on impact. Fire cracks the rime around it.',
  },
  {
    id: 'elemental_shadow', name: 'Gloom Archer', sprite: 'gloom', scale: 0.95,
    hp: 43, attack: 13, defense: 4, damageType: 'shadow', resist: { shadow: 0.5, holy: 1.7, pierce: 1.2 },
    behavior: 'ranged', step: 0.42, windup: 0.85, recovery: 1.55, sight: 8, range: 4,
    projectile: { sprite: 'proj_arrow_shadow', speed: 6, damageType: 'shadow', light: '#af75ee' },
    minDepth: 4, maxDepth: 5, weight: 0.5,
    loot: [{ id: 'shadow_essence', chance: 0.12, min: 1, max: 1 }, { id: 'iron', chance: 0.2, min: 1, max: 1 }],
    gold: [5, 15], itemChance: 0.045,
    description: 'A violet point marks the shaft. Holy light scatters its shadow.',
  },
  {
    id: 'elemental_holy', name: 'Dawn Archer', sprite: 'dawn', scale: 0.95,
    hp: 43, attack: 13, defense: 4, damageType: 'holy', resist: { holy: 0.5, shadow: 1.5, pierce: 1.2 },
    behavior: 'ranged', step: 0.42, windup: 0.85, recovery: 1.55, sight: 8, range: 4,
    projectile: { sprite: 'proj_arrow_holy', speed: 6, damageType: 'holy', light: '#ffe083' },
    minDepth: 4, maxDepth: 5, weight: 0.5,
    loot: [{ id: 'sunstone', chance: 0.08, min: 1, max: 1 }, { id: 'iron', chance: 0.2, min: 1, max: 1 }],
    gold: [5, 15], itemChance: 0.045,
    description: 'A gold-tipped arrow carries dawn into the deepest rooms.',
  },
  {
    id: 'icebound_guard', name: 'Icebound Guard', sprite: 'iceguard', scale: 1,
    hp: 66, attack: 13, defense: 10, damageType: 'frost', element: 'frost', resist: { ...UNDEAD_RESIST, frost: 0.4, fire: 1.7 }, undead: true,
    behavior: 'melee', step: 0.65, windup: 0.7, recovery: 1.1, sight: 7,
    shield: { block: 0.7, stun: 1 }, minDepth: 3, maxDepth: 5, weight: 0.6,
    loot: [{ id: 'frost_shard', chance: 0.25, min: 1, max: 1 }, { id: 'iron', chance: 0.3, min: 1, max: 2 }],
    gold: [2, 9], itemChance: 0.04,
    description: 'The shield is frozen to its arm. Fire loosens both.',
  },
  {
    id: 'spore_hunter', name: 'Spore Hunter', sprite: 'spore', scale: 0.9,
    hp: 63, attack: 14, defense: 5, damageType: 'pierce', resist: { fire: 1.7, slash: 1.2, shadow: 0.7 },
    behavior: 'skittish', step: 0.42, windup: 0.55, recovery: 0.9, sight: 6,
    minDepth: 3, maxDepth: 5, weight: 0.7,
    loot: [{ id: 'leather', chance: 0.3, min: 1, max: 2 }, { id: 'crystal', chance: 0.13, min: 1, max: 1 }],
    gold: [2, 10], itemChance: 0.035,
    description: 'A hungry mushroom with a whipping tongue. It fears open flame.',
  },
  {
    id: 'rat', name: 'Giant Rat', sprite: 'rat', scale: 0.55,
    hp: 14, attack: 5, defense: 0, damageType: 'pierce', resist: { slash: 1.4, pierce: 1.3 },
    behavior: 'melee', step: 0.3, windup: 0.38, recovery: 0.65, sight: 6,
    minDepth: 1, maxDepth: 3, weight: 3,
    loot: [{ id: 'rat_hide', chance: 0.42, min: 1, max: 2 }, { id: 'bone', chance: 0.35, min: 1, max: 1 }],
    gold: [0, 2], itemChance: 0,
    description: 'Big as a dog, twice as hungry.',
  },
  {
    id: 'goblin', name: 'Goblin Cutpurse', sprite: 'goblin', scale: 0.8,
    hp: 28, attack: 8, defense: 2, damageType: 'slash', resist: { slash: 1.4, pierce: 1.25 },
    behavior: 'skittish', step: 0.4, windup: 0.45, recovery: 0.7, sight: 7,
    minDepth: 1, maxDepth: 4, weight: 3,
    loot: [
      { id: 'copper', chance: 0.35, min: 1, max: 2 },
      { id: 'linen', chance: 0.28, min: 1, max: 2 },
      { id: 'timber', chance: 0.21, min: 1, max: 1 },
      { id: 'bone_idol', chance: 0.14, min: 1, max: 1 },
      { id: 'bone', chance: 0.35, min: 1, max: 1 },
    ],
    gold: [3, 12], itemChance: 0.05,
    description: 'Runs when hurt. Always carrying something that isn\'t theirs.',
  },
  {
    id: 'goblin_archer', name: 'Goblin Archer', sprite: 'gobarcher', scale: 0.8,
    hp: 20, attack: 8, defense: 1, damageType: 'pierce', resist: { slash: 1.4, pierce: 1.25 },
    behavior: 'ranged', step: 0.35, windup: 0.7, recovery: 1.3, sight: 8, range: 4,
    projectile: { sprite: 'proj_arrow', speed: 6.5, damageType: 'pierce' },
    minDepth: 2, maxDepth: 4, weight: 2,
    loot: [
      { id: 'copper', chance: 0.28, min: 1, max: 2 },
      { id: 'linen', chance: 0.21, min: 1, max: 2 },
      { id: 'timber', chance: 0.21, min: 1, max: 1 },
      { id: 'yew', chance: 0.14, min: 1, max: 1 },
      { id: 'bone', chance: 0.35, min: 1, max: 1 },
    ],
    gold: [2, 8], itemChance: 0.035,
    description: 'Small bow, short temper. Close the distance or sidestep the shaft.',
  },
  {
    id: 'goblin_shield', name: 'Goblin Shieldbearer', sprite: 'gobshield', scale: 0.8,
    hp: 40, attack: 8, defense: 6, damageType: 'slash', resist: { slash: 1.4, pierce: 1.25 },
    behavior: 'melee', step: 0.45, windup: 0.5, recovery: 0.8, sight: 6,
    shield: { block: 0.75, stun: 1 },
    minDepth: 2, maxDepth: 4, weight: 1.5,
    loot: [
      { id: 'copper', chance: 0.35, min: 1, max: 2 },
      { id: 'timber', chance: 0.28, min: 1, max: 2 },
      { id: 'iron', chance: 0.17, min: 1, max: 1 },
      { id: 'bone', chance: 0.35, min: 1, max: 1 },
    ],
    gold: [3, 10], itemChance: 0.04,
    description: 'Hides behind a door of a shield. Turn two blows and it bashes back — circle it.',
  },
  {
    id: 'bat', name: 'Cave Bat', sprite: 'bat', scale: 0.45, floats: true,
    hp: 16, attack: 6, defense: 0, damageType: 'pierce',
    // Small, fast and soft: a blade opens it, a club swings through the air it
    // just left. It is the first floor's argument for carrying something quick.
    resist: { slash: 1.4, pierce: 1.3, blunt: 0.85 },
    behavior: 'melee', step: 0.2, windup: 0.24, recovery: 0.4, sight: 5,
    minDepth: 1, maxDepth: 3, weight: 2.5,
    loot: [{ id: 'bone', chance: 0.35, min: 1, max: 1 }, { id: 'leather', chance: 0.15, min: 1, max: 1 }],
    gold: [0, 3], itemChance: 0.015,
    description: 'It moves before you decide to swing.',
  },
  {
    id: 'skeleton', name: 'Skeleton', sprite: 'skeleton', scale: 0.95,
    hp: 30, attack: 9, defense: 4, damageType: 'slash', resist: UNDEAD_RESIST, undead: true,
    behavior: 'melee', step: 0.55, windup: 0.55, recovery: 0.9, sight: 7,
    // Weight 2 rather than 3: a new player is handed a slash weapon and the
    // skeleton is the one thing on the first floor that shrugs slash off. The
    // lesson ("bring a mace") is the point and stays; three of them in the
    // first two rooms was not a lesson, it was a wall.
    minDepth: 1, maxDepth: 4, weight: 2,
    loot: [{ id: 'bone', chance: 0.49, min: 1, max: 3 }, { id: 'iron', chance: 0.24, min: 1, max: 2 }],
    gold: [0, 6], itemChance: 0.04,
    description: 'Arrows pass between its ribs. Bring a hammer.',
  },
  {
    id: 'skeleton_archer', name: 'Skeleton Archer', sprite: 'archer', scale: 0.95,
    hp: 26, attack: 9, defense: 4, damageType: 'pierce', resist: UNDEAD_RESIST, undead: true,
    behavior: 'ranged', step: 0.5, windup: 0.75, recovery: 1.4, sight: 8, range: 5,
    projectile: { sprite: 'proj_arrow', speed: 7, damageType: 'pierce' },
    minDepth: 2, maxDepth: 5, weight: 2,
    loot: [
      { id: 'bone', chance: 0.42, min: 1, max: 2 },
      { id: 'yew', chance: 0.17, min: 1, max: 1 },
      { id: 'timber', chance: 0.21, min: 1, max: 1 },
    ],
    gold: [0, 8], itemChance: 0.035,
    description: 'Keeps its distance. Step aside when it draws.',
  },
  {
    id: 'skeleton_shield', name: 'Skeleton Shieldguard', sprite: 'skelshield', scale: 0.95,
    hp: 50, attack: 11, defense: 9, damageType: 'slash', resist: UNDEAD_RESIST, undead: true,
    behavior: 'melee', step: 0.55, windup: 0.6, recovery: 0.9, sight: 7,
    shield: { block: 0.75, stun: 1 },
    minDepth: 3, maxDepth: 5, weight: 1.5,
    loot: [{ id: 'bone', chance: 0.49, min: 1, max: 3 }, { id: 'iron', chance: 0.28, min: 1, max: 2 }],
    gold: [2, 8], itemChance: 0.04,
    description: 'Old bones behind a white wall. Flank it — the shield only faces you.',
  },
  {
    id: 'spider', name: 'Cave Spider', sprite: 'spider', scale: 0.6,
    hp: 36, attack: 11, defense: 3, damageType: 'pierce', resist: { fire: 1.5, slash: 1.3, pierce: 1.35 },
    // The shortest attack cycle of any melee in the game, which made it the
    // single deadliest thing in the dungeon once every other fight got longer:
    // it out-damaged the Barrow Champion by simply swinging more often. Still
    // the quickest thing you will trade blows with, now with a wind-up you can
    // actually read and answer.
    behavior: 'melee', step: 0.28, windup: 0.42, recovery: 0.8, sight: 5,
    minDepth: 3, maxDepth: 5, weight: 3,
    loot: [{ id: 'spider_silk', chance: 0.42, min: 1, max: 2 }, { id: 'crystal', chance: 0.06, min: 1, max: 1 }, { id: 'bone', chance: 0.35, min: 1, max: 1 }],
    gold: [0, 4], itemChance: 0.02,
    description: 'You hear it before you see it. Then you don\'t hear it.',
  },
  {
    id: 'ghoul', name: 'Ghoul', sprite: 'ghoul', scale: 1.0,
    hp: 72, attack: 16, defense: 8, damageType: 'slash', resist: { holy: 2, shadow: 0.5, fire: 1.3, slash: 1.35, pierce: 1.3 }, undead: true,
    behavior: 'melee', step: 0.75, windup: 0.65, recovery: 1.0, sight: 6,
    minDepth: 3, maxDepth: 6, weight: 2,
    loot: [
      { id: 'leather', chance: 0.35, min: 1, max: 2 },
      { id: 'bone', chance: 0.42, min: 1, max: 3 },
      { id: 'silver_chalice', chance: 0.14, min: 1, max: 1 },
    ],
    gold: [5, 20], itemChance: 0.07,
    description: 'Slow. Very, very strong.',
  },
  {
    id: 'ember_wisp', name: 'Ember Wisp', sprite: 'ember', scale: 0.55, floats: true,
    hp: 30, attack: 11, defense: 2, damageType: 'fire', element: 'fire', resist: { fire: 0, frost: 2, blunt: 0.7, slash: 0.8, pierce: 0.6 },
    behavior: 'ranged', step: 0.42, windup: 0.7, recovery: 1.45, sight: 8, range: 4,
    projectile: { sprite: 'proj_fire', speed: 5.5, damageType: 'fire', light: '#ff8030' },
    // The shallow half of the pair: it introduces elemental damage a floor
    // before the Frost Wisp, and depth 3 had nothing elemental at all.
    minDepth: 3, maxDepth: 5, weight: 2, glow: '#ff8a3a',
    loot: [
      { id: 'flame_shard', chance: 0.21, min: 1, max: 1 },
      { id: 'crystal', chance: 0.24, min: 1, max: 2 },
      { id: 'sunstone', chance: 0.06, min: 1, max: 1 },
    ],
    gold: [0, 5], itemChance: 0.03,
    description: 'A warm light. It would like you to be warmer.',
  },
  {
    id: 'frost_wisp', name: 'Frost Wisp', sprite: 'wisp', scale: 0.6, floats: true,
    hp: 36, attack: 13, defense: 2, damageType: 'frost', element: 'frost', resist: { frost: 0, fire: 2, blunt: 0.7, slash: 0.8, pierce: 0.6 },
    behavior: 'ranged', step: 0.45, windup: 0.8, recovery: 1.6, sight: 8, range: 4,
    projectile: { sprite: 'proj_frost', speed: 5, damageType: 'frost', light: '#80c0ff' },
    minDepth: 4, maxDepth: 6, weight: 2, glow: '#6aa8ff',
    loot: [
      { id: 'frost_shard', chance: 0.32, min: 1, max: 1 },
      { id: 'crystal', chance: 0.24, min: 1, max: 2 },
      { id: 'moonstone', chance: 0.06, min: 1, max: 1 },
    ],
    gold: [0, 5], itemChance: 0.03,
    description: 'A cold light that wants you to be cold too.',
  },
  {
    id: 'hollow_knight', name: 'Hollow Knight', sprite: 'knight', scale: 1.05,
    hp: 135, attack: 21, defense: 20, damageType: 'slash', resist: { holy: 1.6, pierce: 1.25, slash: 0.7, blunt: 1.2, shadow: 0.5 }, undead: true,
    behavior: 'melee', step: 0.65, windup: 0.7, recovery: 1.0, sight: 7,
    shield: { block: 0.75, stun: 1 },
    minDepth: 5, maxDepth: 6, weight: 1.5,
    loot: [
      { id: 'iron', chance: 0.56, min: 2, max: 3 },
      { id: 'silver', chance: 0.28, min: 1, max: 2 },
      { id: 'moonsilver', chance: 0.06, min: 1, max: 1 },
      { id: 'wardstone', chance: 0.06, min: 1, max: 1 },
      { id: 'gilded_candelabra', chance: 0.07, min: 1, max: 1 },
    ],
    gold: [10, 40], itemChance: 0.16,
    description: 'The armour kept walking after the knight stopped. Watch the shield, not the sword.',
  },
  {
    id: 'barrow_champion', name: 'Barrow Champion', sprite: 'champion', scale: 1.25,
    hp: 170, attack: 24, defense: 14, damageType: 'blunt',
    // Bone and nothing else, so blades glance and a spike finds no organ — but
    // it caves in. Depth 6 had no such target, which left the club line with
    // nothing to say on the last floor.
    resist: { blunt: 1.5, slash: 0.55, pierce: 0.5, holy: 2, shadow: 0.5 }, undead: true,
    behavior: 'melee', step: 0.8, windup: 0.85, recovery: 1.2, sight: 7,
    minDepth: 5, maxDepth: 6, weight: 1.5,
    loot: [
      { id: 'bone', chance: 0.63, min: 2, max: 4 },
      { id: 'silver', chance: 0.32, min: 1, max: 2 },
      { id: 'moonsilver', chance: 0.08, min: 1, max: 1 },
      { id: 'wardstone', chance: 0.06, min: 1, max: 1 },
      { id: 'ancient_tome', chance: 0.07, min: 1, max: 1 },
    ],
    gold: [10, 34], itemChance: 0.08,
    description: 'Whatever it was buried with, it kept the hammer.',
  },
  {
    id: 'flame_wraith', name: 'Flame Wraith', sprite: 'wraith', scale: 0.95, floats: true,
    hp: 82, attack: 19, defense: 6, damageType: 'fire', element: 'fire', resist: { fire: 0, frost: 2, blunt: 0.7, slash: 0.8, pierce: 0.6 },
    behavior: 'ranged', step: 0.5, windup: 0.75, recovery: 1.4, sight: 8, range: 4,
    projectile: { sprite: 'proj_fire', speed: 5.5, damageType: 'fire', light: '#ff8030' },
    minDepth: 5, maxDepth: 6, weight: 1.5, glow: '#ff7a2a',
    loot: [
      { id: 'flame_shard', chance: 0.32, min: 1, max: 1 },
      { id: 'gold', chance: 0.14, min: 1, max: 1 },
      { id: 'emerald', chance: 0.06, min: 1, max: 1 },
      { id: 'shadow_essence', chance: 0.04, min: 1, max: 1 },
      { id: 'wardstone', chance: 0.05, min: 1, max: 1 },
      { id: 'ancient_tome', chance: 0.06, min: 1, max: 1 },
    ],
    gold: [5, 25], itemChance: 0.09,
    description: 'Someone burned down here once. They never stopped.',
  },
  {
    id: 'mimic', name: 'Mimic', sprite: 'mimic', scale: 0.85,
    hp: 58, attack: 17, defense: 8, damageType: 'pierce', resist: { blunt: 1.25, pierce: 1.1, fire: 1.35 },
    behavior: 'melee', step: 0.32, windup: 0.52, recovery: 0.8, sight: 8,
    minDepth: 1, maxDepth: 6, weight: 0,
    loot: [], gold: [0, 0], itemChance: 0,
    description: 'The lock was a tooth. The hinges were not hinges.',
  },
  {
    id: 'ashen_king', name: 'The Ashen King', sprite: 'king', scale: 1.4,
    // Lower than it was: the fight is three phases now, and the threat is meant
    // to come from what he does rather than from how long the bar is.
    hp: 330, attack: 32, defense: 22, damageType: 'shadow', resist: { holy: 1.5, shadow: 0, pierce: 0.95 }, undead: true,
    behavior: 'boss', step: 0.8, windup: 0.8, recovery: 1.0, sight: 12, range: 3,
    projectile: { sprite: 'proj_shadow', speed: 4.5, damageType: 'shadow', light: '#b060ff' },
    volley: [0, -1, 1],
    minDepth: 6, maxDepth: 6, weight: 0, glow: '#8a40ff',
    // Guaranteed, and staying guaranteed. Killing the King is the one thing in
    // the game that is allowed to pay out reliably; the general trim to drop
    // rates elsewhere deliberately does not reach in here.
    loot: [
      { id: 'star_iron', chance: 1, min: 1, max: 2 },
      { id: 'shadow_essence', chance: 1, min: 1, max: 2 },
      { id: 'dragon_scale', chance: 0.5, min: 1, max: 1 },
      { id: 'jeweled_skull', chance: 1, min: 1, max: 1 },
    ],
    gold: [150, 300], itemChance: 1,
    description: 'He rules what is left.',
  },
];

// Added after the base roster so balancing a base updates every themed relative.
ENEMIES.push(...ELEMENTAL_VARIANTS.map((variant) => {
  const base = ENEMIES.find((e) => e.id === variant.base)!;
  const shard = variant.element === 'fire' ? 'flame_shard' : 'frost_shard';
  return elementalVariant(base, {
    id: variant.id, name: variant.name, sprite: variant.sprite, element: variant.element,
    damageType: variant.element, description: variant.description,
    resist: { ...base.resist, [variant.element]: 0.45, [variant.element === 'fire' ? 'frost' : 'fire']: 1.6 },
    loot: base.loot.map((drop, i) => i === 0 ? { ...drop, id: shard } : { ...drop }),
  });
}));
ENEMIES.push({
  id: 'mole', name: 'Delver Mole', sprite: 'mole', scale: 0.75,
  hp: 32, attack: 9, defense: 3, damageType: 'blunt', resist: { blunt: 0.65, pierce: 1.4, slash: 1.3 },
  behavior: 'skittish', step: 0.65, windup: 0.8, recovery: 1, sight: 5,
  shield: { block: 0.55, stun: 0.6 }, minDepth: 1, maxDepth: 3, weight: 1,
  loot: [{ id: 'rat_hide', chance: 0.42, min: 1, max: 2 }, { id: 'bone', chance: 0.35, min: 1, max: 1 }, { id: 'copper', chance: 0.25, min: 1, max: 2 }],
  gold: [0, 4], itemChance: 0.02,
  description: 'It folds its digging claws over its snout when threatened. Strike from behind; those shovels were made to split rock.',
});

// ---------------------------------------------------------------------------
// The King's phases
// ---------------------------------------------------------------------------

/**
 * What the Ashen King is during one stretch of his health bar.
 *
 * He stays a single `EnemyDef` — his id is load-bearing for the codex, for slay
 * contracts and for the one guaranteed relic in the game, so splitting him into
 * three creatures would quietly break all three. These are the handful of
 * properties that change instead, read through `kingPhase()` at the few call
 * sites that care.
 */
export interface BossPhase {
  /** Art id prefix, so a phase can look different without being a different creature. */
  sprite: string;
  glow: string;
  windup: number;
  recovery: number;
  /** Lateral offsets of the shadow volley. More offsets, wider wall of bolts. */
  shots: number[];
  /** A carried guard, if this phase has one. Absent means no guard at all. */
  shield?: { block: number; stun: number };
  /** What the log says when he enters it. */
  entry: string;
}

/**
 * Three phases, each asking a different question. The first is the fight exactly
 * as it was; the other two are earned by taking him apart.
 */
export const KING_PHASES: BossPhase[] = [
  {
    // The Throne. Read the telegraph, step off the tile.
    sprite: 'king', glow: '#8a40ff', windup: 0.8, recovery: 1.0, shots: [0, -1, 1],
    entry: '',
  },
  {
    // The Dark. He puts the room out and calls his guard back up. The volley is
    // a wall now, and the wind-up is quicker, but the real change is that you
    // cannot see him coming — only the two coals where his eyes were.
    // The volley stays three wide. The throne room is nine across and he stands
    // on its centre line, so five bolts would cover every tile you could step
    // to — and a dodge you cannot perform is not a mechanic, it is a tax. The
    // glow goes UP, not down: once the sconces are out he and your lantern are
    // the only things lighting the room, and a darker king is a black screen.
    sprite: 'king_dark', glow: '#b070ff', windup: 0.68, recovery: 0.9, shots: [0, -1, 1],
    entry: 'The torches gutter and die. Two coals watch you from the dark.',
  },
  {
    // The Last Stand. Cornered, faster, and behind a guard — which makes the
    // parry the only reliable way in. Everything he has left, at once.
    sprite: 'king_last', glow: '#ff5a20', windup: 0.55, recovery: 0.75, shots: [0, -1, 1],
    shield: { block: 0.6, stun: 1 },
    entry: 'The crown splits. What is left of him burns, and comes on.',
  },
];

/** Health fractions at or below which each phase begins. */
const PHASE_AT = [0.65, 0.3];

/**
 * Which phase a boss at this much health belongs in, 1-based. Derived from the
 * bar rather than stored, so it cannot drift out of step with it and so a King
 * halfway through a fight in an old save resolves correctly on the next tick.
 */
export function phaseForHp(frac: number): number {
  let phase = 1;
  for (const at of PHASE_AT) if (frac <= at) phase++;
  return phase;
}

/** The profile for a phase, clamped so an out-of-range number cannot throw. */
export function kingPhase(phase: number): BossPhase {
  return KING_PHASES[Math.max(0, Math.min(KING_PHASES.length - 1, phase - 1))];
}

/**
 * The phase profile for a creature at this much health, or null if it is not a
 * boss. Takes plain numbers rather than an `EnemyState` so this file stays free
 * of a cycle back through the dungeon module, and so the renderer can ask the
 * same question the world does without either of them owning the answer.
 */
export function bossPhase(def: EnemyDef, hp: number, maxHp: number): BossPhase | null {
  if (def.behavior !== 'boss') return null;
  return kingPhase(phaseForHp(maxHp > 0 ? hp / maxHp : 1));
}

const VIEW_CACHE = new Map<string, EnemyDef>();

/**
 * The creature as it is *right now* — the stat block for everything ordinary,
 * and the stat block with this phase's handful of overrides folded in for the
 * King.
 *
 * This exists so that nothing downstream has to know phases are a thing. The
 * guard rhythm, the sprite picker, the wind-up and the volley all read the
 * fields they always read; they just get a different answer on the last floor.
 * Returns the def itself when there is nothing to change, so the per-frame path
 * allocates nothing, and memoises the merged views because there are six of them
 * in the whole game.
 *
 * The merge is explicit rather than a spread of the phase: `id`, `name`,
 * `behavior`, `resist`, `loot` and `hp` must never move, because the codex, the
 * guaranteed relic and the field notes are all keyed off them.
 */
export function enemyView(def: EnemyDef, hp: number, maxHp: number): EnemyDef {
  const phase = bossPhase(def, hp, maxHp);
  if (!phase || phase === KING_PHASES[0]) return def;
  const key = `${def.id}:${phase.sprite}`;
  let view = VIEW_CACHE.get(key);
  if (!view) {
    view = {
      ...def,
      sprite: phase.sprite,
      glow: phase.glow,
      windup: phase.windup,
      recovery: phase.recovery,
      shield: phase.shield,
      volley: phase.shots,
    };
    VIEW_CACHE.set(key, view);
  }
  return view;
}

const BY_ID = new Map(ENEMIES.map((e) => [e.id, e]));

export function enemyDef(id: string): EnemyDef {
  const e = BY_ID.get(id);
  if (!e) throw new Error(`unknown enemy ${id}`);
  return e;
}

export const BOSS_ID = 'ashen_king';
