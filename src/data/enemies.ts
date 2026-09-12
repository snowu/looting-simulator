import { EnemyDef } from '../types';

/*
 * Physical damage is a triangle, not a ladder. Blunt crushes bone and rigid
 * things, slash opens unarmoured flesh, pierce punches through plate and hide.
 * Each type has enemies weak to it; blunt used to be the only one that did.
 */
const UNDEAD_RESIST = { pierce: 0.55, slash: 0.6, blunt: 1.5, holy: 2, shadow: 0.5 };

export const ENEMIES: EnemyDef[] = [
  {
    id: 'rat', name: 'Giant Rat', sprite: 'rat', scale: 0.55,
    hp: 10, attack: 4, defense: 0, damageType: 'pierce', resist: { slash: 1.4, pierce: 1.3 },
    behavior: 'melee', step: 0.3, windup: 0.38, recovery: 0.65, sight: 6,
    minDepth: 1, maxDepth: 3, weight: 3,
    loot: [{ id: 'rat_hide', chance: 0.6, min: 1, max: 2 }, { id: 'bone', chance: 0.25, min: 1, max: 1 }],
    gold: [0, 2], itemChance: 0,
    description: 'Big as a dog, twice as hungry.',
  },
  {
    id: 'goblin', name: 'Goblin Cutpurse', sprite: 'goblin', scale: 0.8,
    hp: 20, attack: 6, defense: 1, damageType: 'slash', resist: { slash: 1.4, pierce: 1.25 },
    behavior: 'skittish', step: 0.4, windup: 0.45, recovery: 0.7, sight: 7,
    minDepth: 1, maxDepth: 4, weight: 3,
    loot: [
      { id: 'copper', chance: 0.5, min: 1, max: 2 },
      { id: 'linen', chance: 0.4, min: 1, max: 2 },
      { id: 'timber', chance: 0.3, min: 1, max: 1 },
      { id: 'bone_idol', chance: 0.1, min: 1, max: 1 },
    ],
    gold: [3, 12], itemChance: 0.15,
    description: 'Runs when hurt. Always carrying something that isn\'t theirs.',
  },
  {
    id: 'bat', name: 'Cave Bat', sprite: 'bat', scale: 0.45, floats: true,
    hp: 12, attack: 5, defense: 0, damageType: 'pierce',
    // Small, fast and soft: a blade opens it, a club swings through the air it
    // just left. It is the first floor's argument for carrying something quick.
    resist: { slash: 1.4, pierce: 1.3, blunt: 0.85 },
    behavior: 'melee', step: 0.2, windup: 0.24, recovery: 0.4, sight: 5,
    minDepth: 1, maxDepth: 3, weight: 2.5,
    loot: [{ id: 'rat_hide', chance: 0.45, min: 1, max: 1 }, { id: 'bone', chance: 0.3, min: 1, max: 1 }],
    gold: [0, 3], itemChance: 0.04,
    description: 'It moves before you decide to swing.',
  },
  {
    id: 'skeleton', name: 'Skeleton', sprite: 'skeleton', scale: 0.95,
    hp: 22, attack: 7, defense: 2, damageType: 'slash', resist: UNDEAD_RESIST, undead: true,
    behavior: 'melee', step: 0.55, windup: 0.55, recovery: 0.9, sight: 7,
    minDepth: 1, maxDepth: 4, weight: 3,
    loot: [{ id: 'bone', chance: 0.7, min: 1, max: 3 }, { id: 'iron', chance: 0.35, min: 1, max: 2 }],
    gold: [0, 6], itemChance: 0.12,
    description: 'Arrows pass between its ribs. Bring a hammer.',
  },
  {
    id: 'skeleton_archer', name: 'Skeleton Archer', sprite: 'archer', scale: 0.95,
    hp: 18, attack: 7, defense: 2, damageType: 'pierce', resist: UNDEAD_RESIST, undead: true,
    behavior: 'ranged', step: 0.5, windup: 0.75, recovery: 1.4, sight: 8, range: 5,
    projectile: { sprite: 'proj_arrow', speed: 7, damageType: 'pierce' },
    minDepth: 2, maxDepth: 5, weight: 2,
    loot: [
      { id: 'bone', chance: 0.6, min: 1, max: 2 },
      { id: 'yew', chance: 0.25, min: 1, max: 1 },
      { id: 'timber', chance: 0.3, min: 1, max: 1 },
    ],
    gold: [0, 8], itemChance: 0.1,
    description: 'Keeps its distance. Step aside when it draws.',
  },
  {
    id: 'spider', name: 'Cave Spider', sprite: 'spider', scale: 0.6,
    hp: 24, attack: 9, defense: 2, damageType: 'pierce', resist: { fire: 1.5, slash: 1.3, pierce: 1.35 },
    behavior: 'melee', step: 0.28, windup: 0.35, recovery: 0.6, sight: 5,
    minDepth: 3, maxDepth: 5, weight: 3,
    loot: [{ id: 'spider_silk', chance: 0.6, min: 1, max: 2 }, { id: 'crystal', chance: 0.08, min: 1, max: 1 }],
    gold: [0, 4], itemChance: 0.05,
    description: 'You hear it before you see it. Then you don\'t hear it.',
  },
  {
    id: 'ghoul', name: 'Ghoul', sprite: 'ghoul', scale: 1.0,
    hp: 48, attack: 13, defense: 4, damageType: 'slash', resist: { holy: 2, shadow: 0.5, fire: 1.3, slash: 1.35, pierce: 1.3 }, undead: true,
    behavior: 'melee', step: 0.75, windup: 0.65, recovery: 1.0, sight: 6,
    minDepth: 3, maxDepth: 6, weight: 2,
    loot: [
      { id: 'leather', chance: 0.5, min: 1, max: 2 },
      { id: 'bone', chance: 0.5, min: 1, max: 3 },
      { id: 'silver_chalice', chance: 0.12, min: 1, max: 1 },
    ],
    gold: [5, 20], itemChance: 0.2,
    description: 'Slow. Very, very strong.',
  },
  {
    id: 'frost_wisp', name: 'Frost Wisp', sprite: 'wisp', scale: 0.6, floats: true,
    hp: 26, attack: 10, defense: 1, damageType: 'frost', resist: { frost: 0, fire: 2, blunt: 0.7, slash: 0.8, pierce: 0.6 },
    behavior: 'ranged', step: 0.45, windup: 0.8, recovery: 1.6, sight: 8, range: 4,
    projectile: { sprite: 'proj_frost', speed: 5, damageType: 'frost', light: '#80c0ff' },
    minDepth: 4, maxDepth: 6, weight: 2, glow: '#6aa8ff',
    loot: [
      { id: 'frost_shard', chance: 0.45, min: 1, max: 1 },
      { id: 'crystal', chance: 0.35, min: 1, max: 2 },
      { id: 'moonstone', chance: 0.08, min: 1, max: 1 },
    ],
    gold: [0, 5], itemChance: 0.08,
    description: 'A cold light that wants you to be cold too.',
  },
  {
    id: 'hollow_knight', name: 'Hollow Knight', sprite: 'knight', scale: 1.05,
    hp: 80, attack: 16, defense: 9, damageType: 'slash', resist: { holy: 1.6, pierce: 1.25, slash: 0.7, blunt: 1.2, shadow: 0.5 }, undead: true,
    behavior: 'melee', step: 0.65, windup: 0.7, recovery: 1.0, sight: 7,
    minDepth: 5, maxDepth: 6, weight: 1.5,
    loot: [
      { id: 'iron', chance: 0.8, min: 2, max: 3 },
      { id: 'silver', chance: 0.4, min: 1, max: 2 },
      { id: 'moonsilver', chance: 0.08, min: 1, max: 1 },
      { id: 'gilded_candelabra', chance: 0.1, min: 1, max: 1 },
    ],
    gold: [10, 40], itemChance: 0.45,
    description: 'The armour kept walking after the knight stopped.',
  },
  {
    id: 'barrow_champion', name: 'Barrow Champion', sprite: 'champion', scale: 1.25,
    hp: 110, attack: 18, defense: 7, damageType: 'blunt',
    // Bone and nothing else, so blades glance and a spike finds no organ — but
    // it caves in. Depth 6 had no such target, which left the club line with
    // nothing to say on the last floor.
    resist: { blunt: 1.5, slash: 0.55, pierce: 0.5, holy: 2, shadow: 0.5 }, undead: true,
    behavior: 'melee', step: 0.8, windup: 0.85, recovery: 1.2, sight: 7,
    minDepth: 5, maxDepth: 6, weight: 1.5,
    loot: [
      { id: 'bone', chance: 0.9, min: 2, max: 4 },
      { id: 'silver', chance: 0.45, min: 1, max: 2 },
      { id: 'moonsilver', chance: 0.12, min: 1, max: 1 },
      { id: 'ancient_tome', chance: 0.1, min: 1, max: 1 },
    ],
    gold: [10, 34], itemChance: 0.22,
    description: 'Whatever it was buried with, it kept the hammer.',
  },
  {
    id: 'flame_wraith', name: 'Flame Wraith', sprite: 'wraith', scale: 0.95, floats: true,
    hp: 50, attack: 14, defense: 2, damageType: 'fire', resist: { fire: 0, frost: 2, blunt: 0.7, slash: 0.8, pierce: 0.6 },
    behavior: 'ranged', step: 0.5, windup: 0.75, recovery: 1.4, sight: 8, range: 4,
    projectile: { sprite: 'proj_fire', speed: 5.5, damageType: 'fire', light: '#ff8030' },
    minDepth: 5, maxDepth: 6, weight: 1.5, glow: '#ff7a2a',
    loot: [
      { id: 'flame_shard', chance: 0.45, min: 1, max: 1 },
      { id: 'gold', chance: 0.2, min: 1, max: 1 },
      { id: 'emerald', chance: 0.08, min: 1, max: 1 },
      { id: 'shadow_essence', chance: 0.05, min: 1, max: 1 },
      { id: 'ancient_tome', chance: 0.08, min: 1, max: 1 },
    ],
    gold: [5, 25], itemChance: 0.25,
    description: 'Someone burned down here once. They never stopped.',
  },
  {
    id: 'mimic', name: 'Mimic', sprite: 'mimic', scale: 0.85,
    hp: 52, attack: 14, defense: 5, damageType: 'pierce', resist: { blunt: 1.25, pierce: 1.1, fire: 1.35 },
    behavior: 'melee', step: 0.32, windup: 0.52, recovery: 0.8, sight: 8,
    minDepth: 1, maxDepth: 6, weight: 0,
    loot: [], gold: [0, 0], itemChance: 0,
    description: 'The lock was a tooth. The hinges were not hinges.',
  },
  {
    id: 'ashen_king', name: 'The Ashen King', sprite: 'king', scale: 1.4,
    hp: 420, attack: 24, defense: 12, damageType: 'shadow', resist: { holy: 1.5, shadow: 0, pierce: 0.95 }, undead: true,
    behavior: 'boss', step: 0.8, windup: 0.8, recovery: 1.0, sight: 12, range: 3,
    projectile: { sprite: 'proj_shadow', speed: 4.5, damageType: 'shadow', light: '#b060ff' },
    minDepth: 99, maxDepth: 99, weight: 0, glow: '#8a40ff',
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

const BY_ID = new Map(ENEMIES.map((e) => [e.id, e]));

export function enemyDef(id: string): EnemyDef {
  const e = BY_ID.get(id);
  if (!e) throw new Error(`unknown enemy ${id}`);
  return e;
}

export const BOSS_ID = 'ashen_king';
