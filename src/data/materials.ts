import { MaterialDef, Rarity, Stats } from '../types';

export const MATERIALS: MaterialDef[] = [
  // --- Metals -------------------------------------------------------------
  {
    id: 'copper', name: 'Copper Ore', category: 'metal', tier: 1, rarity: Rarity.Common, value: 8,
    icon: 'ic_ore', ramp: ['#4a2414', '#8a4a24', '#c47a3c', '#f0b070'], mods: { defense: 1 },
    description: 'Soft reddish ore. Takes an edge, loses it fast.',
  },
  {
    id: 'iron', name: 'Iron Ore', category: 'metal', tier: 2, rarity: Rarity.Uncommon, value: 15,
    icon: 'ic_ore', ramp: ['#23242a', '#4c4f58', '#80848e', '#c4c8d0'], mods: { defense: 2 },
    description: 'The honest metal. Every smith wants more of it.',
  },
  {
    id: 'silver', name: 'Silver Ingot', category: 'metal', tier: 3, rarity: Rarity.Rare, value: 42,
    icon: 'ic_ingot', ramp: ['#3c4452', '#7c8898', '#b8c4d4', '#f4f8ff'], mods: { defense: 4, holy: 3 },
    description: 'Bright, resilient metal. Reinforces gear and burns the dead with holy power.',
  },
  {
    id: 'gold', name: 'Gold Nugget', category: 'metal', tier: 3, rarity: Rarity.Rare, value: 75,
    icon: 'ic_nugget', ramp: ['#5a3a08', '#a0700c', '#e0b020', '#fff08a'], mods: { defense: 4 },
    description: 'A costly alternative to silver: the same tier of reinforcement, worth more in trade.',
  },
  {
    id: 'moonsilver', name: 'Moonsilver', category: 'metal', tier: 4, rarity: Rarity.Epic, value: 190,
    icon: 'ic_ingot', ramp: ['#2c3450', '#5a70a0', '#9cb4e0', '#e8f0ff'], mods: { defense: 7, frost: 6 },
    description: 'Silver that remembers moonlight. Always cold to the touch.',
  },
  {
    id: 'star_iron', name: 'Star Iron', category: 'metal', tier: 5, rarity: Rarity.Legendary, value: 460,
    icon: 'ic_ingot', ramp: ['#140c20', '#3a2458', '#6a4a9a', '#c0a0ff'], mods: { defense: 12, shadow: 10 },
    description: 'Fell from the sky and kept falling, into the deep places.',
  },

  // --- Woods --------------------------------------------------------------
  {
    id: 'timber', name: 'Timber Plank', category: 'wood', tier: 1, rarity: Rarity.Common, value: 5,
    icon: 'ic_plank', ramp: ['#3a2410', '#6a4420', '#9a6a36', '#c89a5a'], mods: { speed: 1 },
    description: 'Rough-cut pine from old mine supports.',
  },
  {
    id: 'yew', name: 'Yew Stave', category: 'wood', tier: 2, rarity: Rarity.Uncommon, value: 22,
    icon: 'ic_plank', ramp: ['#40200c', '#7a3c1a', '#b0602c', '#e09050'], mods: { speed: 2 },
    description: 'Springy, dense grain. Balances a weapon well.',
  },
  {
    id: 'ironwood', name: 'Ironwood', category: 'wood', tier: 3, rarity: Rarity.Rare, value: 64,
    icon: 'ic_plank', ramp: ['#141414', '#2e2a26', '#4c463e', '#7a7064'], mods: { speed: 4 },
    description: 'Black wood that turns a blade. Grows only near the deep water.',
  },

  // --- Hides --------------------------------------------------------------
  {
    id: 'rat_hide', name: 'Rat Hide', category: 'hide', tier: 1, rarity: Rarity.Common, value: 4,
    icon: 'ic_hide', ramp: ['#2e2420', '#54443a', '#7a665a', '#a08c7c'], mods: { health: 3 },
    description: 'Mangy, but it holds a stitch.',
  },
  {
    id: 'leather', name: 'Leather', category: 'hide', tier: 2, rarity: Rarity.Uncommon, value: 13,
    icon: 'ic_hide', ramp: ['#3a1c0c', '#6a3818', '#9a5a2a', '#c88a4e'], mods: { health: 6 },
    description: 'Tanned and supple.',
  },
  {
    id: 'wyrm_leather', name: 'Wyrm Leather', category: 'hide', tier: 4, rarity: Rarity.Epic, value: 170,
    icon: 'ic_hide', ramp: ['#0c2414', '#1c4a2a', '#2e7a44', '#6ac080'], mods: { health: 24 },
    description: 'From the pale cave-wyrms. Tough enough to keep its wearer alive.',
  },
  {
    id: 'dragon_scale', name: 'Dragon Scale', category: 'hide', tier: 5, rarity: Rarity.Legendary, value: 520,
    icon: 'ic_scale', ramp: ['#3a0808', '#7a1410', '#c0301c', '#ff8a4a'], mods: { health: 40, fire: 10 },
    description: 'Still warm. It will never cool.',
  },

  // --- Cloth --------------------------------------------------------------
  {
    id: 'linen', name: 'Linen', category: 'cloth', tier: 1, rarity: Rarity.Common, value: 6,
    icon: 'ic_cloth', ramp: ['#4a4436', '#7a7260', '#aaa08a', '#dcd4bc'], mods: { stamina: 3 },
    description: 'Burial wrappings, mostly clean.',
  },
  {
    id: 'spider_silk', name: 'Spider Silk', category: 'cloth', tier: 3, rarity: Rarity.Rare, value: 36,
    icon: 'ic_cloth', ramp: ['#50506a', '#8a8aa4', '#c4c4d8', '#ffffff'], mods: { stamina: 10 },
    description: 'Stronger than rope, lighter than breath.',
  },
  {
    id: 'shadow_silk', name: 'Shadow Silk', category: 'cloth', tier: 4, rarity: Rarity.Epic, value: 155,
    icon: 'ic_cloth', ramp: ['#0a0612', '#241838', '#44305e', '#7a5aa0'], mods: { stamina: 18, shadow: 7 },
    description: 'Woven from the dark between torches.',
  },

  // --- Bone ---------------------------------------------------------------
  {
    id: 'bone', name: 'Bone', category: 'bone', tier: 1, rarity: Rarity.Common, value: 3,
    icon: 'ic_bone', ramp: ['#5a5040', '#968a70', '#cabea0', '#f4ecd8'], mods: { attack: 1 },
    description: 'There is a lot of it down there.',
  },

  // Complete structural material ladders so every primary category can grow.
  { id: 'deep_yew', name: 'Deep Yew', category: 'wood', tier: 4, rarity: Rarity.Epic, value: 160,
    icon: 'ic_plank', ramp: ['#252030', '#554860', '#9984ac', '#dfd0ef'], mods: { speed: 7 },
    description: 'Slow-grown beneath the roots. Holds a heavy head without splitting.' },
  { id: 'starwood', name: 'Starwood', category: 'wood', tier: 5, rarity: Rarity.Legendary, value: 420,
    icon: 'ic_plank', ramp: ['#252030', '#554860', '#9984ac', '#dfd0ef'], mods: { speed: 10 },
    description: 'Pale grain threaded with starlight. Strong enough for the deepest forge.' },
  { id: 'troll_hide', name: 'Troll Hide', category: 'hide', tier: 3, rarity: Rarity.Rare, value: 48,
    icon: 'ic_hide', ramp: ['#252030', '#554860', '#9984ac', '#dfd0ef'], mods: { health: 12 },
    description: 'Thick, stubborn hide. A useful step between leather and wyrm skin.' },
  { id: 'wool', name: 'Wool', category: 'cloth', tier: 2, rarity: Rarity.Uncommon, value: 14,
    icon: 'ic_cloth', ramp: ['#252030', '#554860', '#9984ac', '#dfd0ef'], mods: { stamina: 6 },
    description: 'Dense woven padding that keeps cold iron off the skin.' },
  { id: 'astral_silk', name: 'Astral Silk', category: 'cloth', tier: 5, rarity: Rarity.Legendary, value: 400,
    icon: 'ic_cloth', ramp: ['#252030', '#554860', '#9984ac', '#dfd0ef'], mods: { stamina: 30 },
    description: 'A shimmering weave that carries a spell as readily as a stitch.' },
  { id: 'dense_bone', name: 'Dense Bone', category: 'bone', tier: 2, rarity: Rarity.Uncommon, value: 12,
    icon: 'ic_bone', ramp: ['#252030', '#554860', '#9984ac', '#dfd0ef'], mods: { attack: 3 },
    description: 'Heavy cave-beast bone, clean enough to shape into a grip.' },
  { id: 'fossil_bone', name: 'Fossil Bone', category: 'bone', tier: 3, rarity: Rarity.Rare, value: 40,
    icon: 'ic_bone', ramp: ['#252030', '#554860', '#9984ac', '#dfd0ef'], mods: { attack: 6 },
    description: 'Stone-hard bone exposed by the deep mines.' },
  { id: 'wyrm_bone', name: 'Wyrm Bone', category: 'bone', tier: 4, rarity: Rarity.Epic, value: 150,
    icon: 'ic_bone', ramp: ['#252030', '#554860', '#9984ac', '#dfd0ef'], mods: { attack: 12 },
    description: 'Hollow, resilient bone from the pale things below.' },
  { id: 'titan_bone', name: 'Titan Bone', category: 'bone', tier: 5, rarity: Rarity.Legendary, value: 410,
    icon: 'ic_bone', ramp: ['#252030', '#554860', '#9984ac', '#dfd0ef'], mods: { attack: 20 },
    description: 'A fragment of something too large to imagine. It will not bend.' },

  // --- Gems (catalysts) ---------------------------------------------------
  {
    id: 'jade', name: 'Jade', category: 'gem', tier: 2, rarity: Rarity.Uncommon, value: 46,
    icon: 'ic_gem', ramp: ['#0c3a24', '#1a6a40', '#34a060', '#8ae0a8'], mods: { health: 6 },
    catalystAffix: 'vital', description: 'Catalyst: grants Vital (+Health).',
  },
  {
    id: 'crystal', name: 'Crystal Shard', category: 'gem', tier: 2, rarity: Rarity.Uncommon, value: 40,
    icon: 'ic_shard', ramp: ['#34506a', '#5a8ab0', '#9ccae8', '#f0ffff'], mods: { stamina: 8 },
    catalystAffix: 'tireless', description: 'Catalyst: grants Tireless (+Stamina).',
  },
  {
    id: 'moonstone', name: 'Moonstone', category: 'gem', tier: 3, rarity: Rarity.Rare, value: 92,
    icon: 'ic_gem', ramp: ['#3a3a5a', '#7070a0', '#b0b0d8', '#f0f0ff'], mods: { luck: 3 },
    catalystAffix: 'lucky', description: 'Catalyst: grants Lucky (+Crit).',
  },
  {
    id: 'emerald', name: 'Emerald', category: 'gem', tier: 3, rarity: Rarity.Rare, value: 110,
    icon: 'ic_gem', ramp: ['#04301a', '#0a6030', '#10a050', '#70f0a0'], mods: { find: 8 },
    catalystAffix: 'plunder', description: 'Catalyst: grants of Plunder (+Loot Find).',
  },
  {
    id: 'frost_shard', name: 'Frost Shard', category: 'gem', tier: 3, rarity: Rarity.Rare, value: 96,
    icon: 'ic_shard', ramp: ['#1a3a6a', '#3a70c0', '#80b8f0', '#e8f8ff'], mods: { frost: 3 },
    catalystAffix: 'rimed', description: 'Catalyst: grants Rimed (+Frost damage).',
  },
  {
    id: 'sunstone', name: 'Sunstone', category: 'gem', tier: 3, rarity: Rarity.Rare, value: 104,
    icon: 'ic_gem', ramp: ['#4a2c08', '#9a6418', '#e8b840', '#fff2a0'], mods: { holy: 3 },
    catalystAffix: 'blessed', description: 'Catalyst: grants Blessed (+Holy damage).',
  },
  {
    id: 'wardstone', name: 'Wardstone', category: 'gem', tier: 3, rarity: Rarity.Rare, value: 98,
    icon: 'ic_gem', ramp: ['#1a1a24', '#3c3a56', '#6e6a96', '#c0bce0'], mods: { focus: 4 },
    catalystAffix: 'vigil', description: 'Catalyst: grants of the Vigil (+Spell Focus).',
  },
  {
    id: 'flame_shard', name: 'Flame Shard', category: 'gem', tier: 4, rarity: Rarity.Epic, value: 205,
    icon: 'ic_shard', ramp: ['#6a1004', '#c03008', '#ff7a10', '#fff070'], mods: { fire: 4 },
    catalystAffix: 'blazing', description: 'Catalyst: grants Blazing (+Fire damage).',
  },
  {
    id: 'shadow_essence', name: 'Shadow Essence', category: 'gem', tier: 4, rarity: Rarity.Epic, value: 230,
    icon: 'ic_essence', ramp: ['#08040e', '#2a1446', '#5a2a8a', '#b070ff'], mods: { shadow: 3 },
    catalystAffix: 'leeching', description: 'Catalyst: grants of the Leech (+Life Leech).',
  },

  // --- Valuables (trade goods; sell them) --------------------------------
  {
    id: 'bone_idol', name: 'Bone Idol', category: 'valuable', tier: 1, rarity: Rarity.Common, value: 26,
    icon: 'ic_idol', ramp: ['#5a5040', '#968a70', '#cabea0', '#f4ecd8'], mods: {},
    description: 'A crude god. Collectors pay for the ugliest ones.',
  },
  {
    id: 'silver_chalice', name: 'Silver Chalice', category: 'valuable', tier: 2, rarity: Rarity.Uncommon, value: 58,
    icon: 'ic_chalice', ramp: ['#3c4452', '#7c8898', '#b8c4d4', '#f4f8ff'], mods: {},
    description: 'Tarnished. The temple will ask no questions.',
  },
  {
    id: 'gilded_candelabra', name: 'Gilded Candelabra', category: 'valuable', tier: 3, rarity: Rarity.Rare, value: 96,
    icon: 'ic_candelabra', ramp: ['#5a3a08', '#a0700c', '#e0b020', '#fff08a'], mods: {},
    description: 'Heavy, ornate, and absolutely going on the market.',
  },
  {
    id: 'ancient_tome', name: 'Ancient Tome', category: 'valuable', tier: 3, rarity: Rarity.Rare, value: 125,
    icon: 'ic_tome', ramp: ['#2a0c0c', '#5a1a14', '#8a3020', '#c8a060'], mods: {},
    description: 'Written in a language that makes your eyes water.',
  },
  {
    id: 'jeweled_skull', name: 'Jeweled Skull', category: 'valuable', tier: 5, rarity: Rarity.Epic, value: 280,
    icon: 'ic_skull', ramp: ['#5a5040', '#968a70', '#cabea0', '#f4ecd8'], mods: {},
    description: 'Somebody important. Their eyes are rubies now.',
  },
];

const BY_ID = new Map(MATERIALS.map((m) => [m.id, m]));

export function material(id: string): MaterialDef {
  const m = BY_ID.get(id);
  if (!m) throw new Error(`unknown material ${id}`);
  return m;
}

export function findMaterial(id: string): MaterialDef | undefined {
  return BY_ID.get(id);
}

/** Structural materials grant the same family bonus in either recipe role. */
export function secondaryMaterialMods(def: MaterialDef): Partial<Stats> {
  return def.category === 'gem' || def.category === 'valuable' ? {} : { ...def.mods };
}

/** Extra strength on the guaranteed affix from scarce catalyst tiers. */
export function catalystAffixBonus(def: MaterialDef): number {
  return def.category === 'gem' ? [0, 0, 0, 2, 5][def.tier] ?? 0 : 0;
}
