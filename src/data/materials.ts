import { MaterialDef, Rarity } from '../types';

export const MATERIALS: MaterialDef[] = [
  // --- Metals -------------------------------------------------------------
  {
    id: 'copper', name: 'Copper Ore', category: 'metal', tier: 1, rarity: Rarity.Common, value: 8,
    icon: 'ic_ingot', ramp: ['#4a2414', '#8a4a24', '#c47a3c', '#f0b070'], mods: {},
    description: 'Soft reddish ore. Takes an edge, loses it fast.',
  },
  {
    id: 'iron', name: 'Iron Ore', category: 'metal', tier: 2, rarity: Rarity.Common, value: 15,
    icon: 'ic_ingot', ramp: ['#23242a', '#4c4f58', '#80848e', '#c4c8d0'], mods: {},
    description: 'The honest metal. Every smith wants more of it.',
  },
  {
    id: 'silver', name: 'Silver Ingot', category: 'metal', tier: 3, rarity: Rarity.Uncommon, value: 42,
    icon: 'ic_ingot', ramp: ['#3c4452', '#7c8898', '#b8c4d4', '#f4f8ff'], mods: { holy: 3 },
    description: 'Bright and cold. The dead do not like it.',
  },
  {
    id: 'gold', name: 'Gold Nugget', category: 'metal', tier: 2, rarity: Rarity.Rare, value: 75,
    icon: 'ic_ingot', ramp: ['#5a3a08', '#a0700c', '#e0b020', '#fff08a'], mods: { luck: 3, find: 6 },
    description: 'Too soft for war. Rings and pendants sing with it.',
  },
  {
    id: 'moonsilver', name: 'Moonsilver', category: 'metal', tier: 4, rarity: Rarity.Epic, value: 190,
    icon: 'ic_ingot', ramp: ['#2c3450', '#5a70a0', '#9cb4e0', '#e8f0ff'], mods: { frost: 3, luck: 2 },
    description: 'Silver that remembers moonlight. Always cold to the touch.',
  },
  {
    id: 'star_iron', name: 'Star Iron', category: 'metal', tier: 5, rarity: Rarity.Legendary, value: 460,
    icon: 'ic_ingot', ramp: ['#140c20', '#3a2458', '#6a4a9a', '#c0a0ff'], mods: { shadow: 4, attack: 2 },
    description: 'Fell from the sky and kept falling, into the deep places.',
  },

  // --- Woods --------------------------------------------------------------
  {
    id: 'timber', name: 'Timber Plank', category: 'wood', tier: 1, rarity: Rarity.Common, value: 5,
    icon: 'ic_plank', ramp: ['#3a2410', '#6a4420', '#9a6a36', '#c89a5a'], mods: {},
    description: 'Rough-cut pine from old mine supports.',
  },
  {
    id: 'yew', name: 'Yew Stave', category: 'wood', tier: 2, rarity: Rarity.Uncommon, value: 22,
    icon: 'ic_plank', ramp: ['#40200c', '#7a3c1a', '#b0602c', '#e09050'], mods: { speed: 3 },
    description: 'Springy, dense grain. Balances a weapon well.',
  },
  {
    id: 'ironwood', name: 'Ironwood', category: 'wood', tier: 3, rarity: Rarity.Rare, value: 64,
    icon: 'ic_plank', ramp: ['#141414', '#2e2a26', '#4c463e', '#7a7064'], mods: { attack: 2, defense: 1 },
    description: 'Black wood that turns a blade. Grows only near the deep water.',
  },

  // --- Hides --------------------------------------------------------------
  {
    id: 'rat_hide', name: 'Rat Hide', category: 'hide', tier: 1, rarity: Rarity.Common, value: 4,
    icon: 'ic_hide', ramp: ['#2e2420', '#54443a', '#7a665a', '#a08c7c'], mods: {},
    description: 'Mangy, but it holds a stitch.',
  },
  {
    id: 'leather', name: 'Leather', category: 'hide', tier: 2, rarity: Rarity.Common, value: 13,
    icon: 'ic_hide', ramp: ['#3a1c0c', '#6a3818', '#9a5a2a', '#c88a4e'], mods: {},
    description: 'Tanned and supple.',
  },
  {
    id: 'wyrm_leather', name: 'Wyrm Leather', category: 'hide', tier: 4, rarity: Rarity.Epic, value: 170,
    icon: 'ic_hide', ramp: ['#0c2414', '#1c4a2a', '#2e7a44', '#6ac080'], mods: { health: 10, defense: 1 },
    description: 'From the pale cave-wyrms. Heals its own scratches.',
  },
  {
    id: 'dragon_scale', name: 'Dragon Scale', category: 'hide', tier: 5, rarity: Rarity.Legendary, value: 520,
    icon: 'ic_scale', ramp: ['#3a0808', '#7a1410', '#c0301c', '#ff8a4a'], mods: { fire: 5, health: 15 },
    description: 'Still warm. It will never cool.',
  },

  // --- Cloth --------------------------------------------------------------
  {
    id: 'linen', name: 'Linen', category: 'cloth', tier: 1, rarity: Rarity.Common, value: 6,
    icon: 'ic_cloth', ramp: ['#4a4436', '#7a7260', '#aaa08a', '#dcd4bc'], mods: {},
    description: 'Burial wrappings, mostly clean.',
  },
  {
    id: 'spider_silk', name: 'Spider Silk', category: 'cloth', tier: 3, rarity: Rarity.Uncommon, value: 36,
    icon: 'ic_cloth', ramp: ['#50506a', '#8a8aa4', '#c4c4d8', '#ffffff'], mods: { speed: 4 },
    description: 'Stronger than rope, lighter than breath.',
  },
  {
    id: 'shadow_silk', name: 'Shadow Silk', category: 'cloth', tier: 4, rarity: Rarity.Epic, value: 155,
    icon: 'ic_cloth', ramp: ['#0a0612', '#241838', '#44305e', '#7a5aa0'], mods: { shadow: 3, luck: 2 },
    description: 'Woven from the dark between torches.',
  },

  // --- Bone ---------------------------------------------------------------
  {
    id: 'bone', name: 'Bone', category: 'bone', tier: 1, rarity: Rarity.Common, value: 3,
    icon: 'ic_bone', ramp: ['#5a5040', '#968a70', '#cabea0', '#f4ecd8'], mods: {},
    description: 'There is a lot of it down there.',
  },

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
