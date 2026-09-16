/**
 * Dev-only floating panel for the combat lab (`./lab-room`).
 *
 * Non-modal on purpose: the world keeps running while it is open, so swings,
 * parries and volleys can be felt live. Only ever imported behind an
 * `import.meta.env.DEV` guard, so none of this reaches a production bundle.
 *
 * Sections: quick spawn, named spawn configurations (save/share as JSON),
 * in-lab forge (town forge without the trip), quick weapon giver, utility.
 */
import { World } from '../world/world';
import { BIOMES } from '../data/biomes';
import { ENEMIES } from '../data/enemies';
import { ITEM_BASES, itemBase } from '../data/items';
import { MATERIALS } from '../data/materials';
import { MAX_RECIPE_RANK, RECIPE_LADDER, masteryBonus, recipe } from '../data/recipes';
import { metaLevel } from '../systems/meta';
import { buildCrafted, craft, materialsForSlot, selectionError } from '../systems/crafting';
import { itemName, itemStats, makeEquipment } from '../systems/items';
import { addItem } from '../state/inventory';
import { equipFrom } from '../systems/equip';
import { createRng, randomSeed } from '../core/rng';
import { Rarity } from '../types';
import {
  LAB_ILVL, loadLabLevel, clearLabMobs, killLabMobs, refurbish, restockLabMats, spawnLabConfig, spawnLabMob,
} from './lab-room';
import {
  LabConfig, LabMobEntry, deleteLabConfig, exportLabConfig, isBuiltinLabConfig,
  loadLabConfigs, parseLabConfig, saveLabConfig, summarizeLabConfig,
} from './lab-configs';
import { btn, h } from '../ui/dom';
import { giveMaterials } from './give-materials';

let el: HTMLElement | null = null;
let godTimer = 0;

function weaponBases(): typeof ITEM_BASES {
  return ITEM_BASES.filter((b) => b.slot === 'weapon' || b.slot === 'thrown');
}

function materialsFor(baseId: string): typeof MATERIALS {
  const base = ITEM_BASES.find((b) => b.id === baseId);
  if (!base) return MATERIALS;
  return MATERIALS.filter((m) => (base.primary as string[]).includes(m.category));
}

export function labPanelOpen(): boolean {
  return el !== null;
}

export function closeLabPanel(): void {
  if (godTimer) {
    clearInterval(godTimer);
    godTimer = 0;
  }
  el?.remove();
  el = null;
}

export function toggleLabPanel(
  parent: HTMLElement,
  getWorld: () => World | null,
  notify: (text: string, color?: string) => void,
): void {
  if (el) {
    closeLabPanel();
    return;
  }
  const world = getWorld();
  if (!world) {
    notify('Enter the lab first — no world to spawn into.', '#ff9070');
    return;
  }
  openLabPanel(parent, getWorld, notify);
}

function enemyOptions(sel: HTMLSelectElement, value: string): void {
  sel.replaceChildren();
  for (const e of ENEMIES) {
    const o = document.createElement('option');
    o.value = e.id;
    o.textContent = `${e.name} (${e.id})`;
    if (e.id === value) o.selected = true;
    sel.append(o);
  }
}

function openLabPanel(
  parent: HTMLElement,
  getWorld: () => World | null,
  notify: (text: string, color?: string) => void,
): void {
  const wrap = h('div', {
    class: 'frame',
    style: 'position:absolute;right:10px;top:10px;width:320px;max-height:88vh;overflow:auto;' +
      'background:#0e0c10f2;padding:10px;z-index:30;font-size:13px;',
  });

  wrap.append(h('div', { class: 'row', style: 'margin-bottom:6px' },
    h('b', { text: 'Lab console', style: 'color:#c080ff' }),
    h('span', { class: 'dim small right', text: 'F3 toggles' }),
  ));
  wrap.append(h('p', {
    class: 'dim small',
    style: 'margin:0 0 8px',
    text: 'I / Tab: pack & gear · all recipes Rank 5 · 999 mats in stash · forge below, no town trip needed.',
  }));

  buildLevelSection(wrap, getWorld, notify);
  buildSpawnSection(wrap, getWorld, notify);
  buildConfigSection(wrap, getWorld, notify);
  buildForgeSection(wrap, getWorld, notify);
  buildWeaponSection(wrap, getWorld, notify);
  buildUtilitySection(wrap, getWorld, notify);

  wrap.append(h('div', { class: 'row', style: 'gap:4px;margin-top:8px' },
    btn('Close [F3]', () => closeLabPanel(), 'small'),
  ));

  // Clicks in the panel must not swing / block / walk the world.
  wrap.addEventListener('pointerdown', (e) => e.stopPropagation());
  wrap.addEventListener('mousedown', (e) => e.stopPropagation());
  parent.append(wrap);
  el = wrap;
}

function buildLevelSection(
  wrap: HTMLElement,
  getWorld: () => World | null,
  notify: (text: string, color?: string) => void,
): void {
  wrap.append(h('h3', { text: 'Map', style: 'margin:6px 0 4px' }));
  const world = getWorld();
  const biomeSelect = h('select', { attrs: { 'aria-label': 'Lab biome' }, style: 'width:100%;margin-bottom:4px' }) as HTMLSelectElement;
  for (const biome of BIOMES) {
    const option = h('option', { attrs: { value: biome.id }, text: biome.name }) as HTMLOptionElement;
    option.selected = biome.id === world?.floor.biome;
    biomeSelect.append(option);
  }
  const depthSelect = h('select', { attrs: { 'aria-label': 'Lab level' }, style: 'width:100%;margin-bottom:4px' }) as HTMLSelectElement;
  const refreshDepths = (): void => {
    const previous = Number(depthSelect.value) || getWorld()?.run.depth;
    depthSelect.replaceChildren();
    for (const depth of BIOMES.find((b) => b.id === biomeSelect.value)!.depths) {
      const option = h('option', { attrs: { value: String(depth) }, text: `Depth ${depth}` }) as HTMLOptionElement;
      option.selected = depth === previous;
      depthSelect.append(option);
    }
  };
  biomeSelect.addEventListener('change', refreshDepths);
  refreshDepths();
  const seed = h('input', { attrs: { type: 'number', min: '0', max: '4294967295', step: '1', value: String((world?.run.seed ?? 0) >>> 0), 'aria-label': 'Lab map seed' }, style: 'width:100%;box-sizing:border-box;margin-bottom:4px' }) as HTMLInputElement;
  wrap.append(biomeSelect, depthSelect, h('label', { text: 'Map seed', class: 'small' }, seed));
  wrap.append(h('div', { class: 'row', style: 'gap:4px;margin-bottom:4px' },
    btn('Load map', () => {
      const world = getWorld();
      if (!world) return;
      const value = Number(seed.value);
      if (!seed.value.trim() || !Number.isInteger(value) || value < 0 || value > 0xffffffff) {
        notify('Enter a whole-number seed from 0 to 4294967295.', '#ff9070');
        return;
      }
      notify(loadLabLevel(world, biomeSelect.value, Number(depthSelect.value), value), '#c080ff');
    }, 'small primary'),
    btn('Random seed', () => { seed.value = String(randomSeed() >>> 0); }, 'small'),
  ));
  wrap.append(h('p', { class: 'dim small', style: 'margin:0 0 8px',
    text: 'Load a fresh map of the chosen biome. Same biome, depth and seed reproduce the layout. Gear stays with you.',
  }));
}

// ---------------------------------------------------------------------------
// Quick spawn
// ---------------------------------------------------------------------------

function buildSpawnSection(
  wrap: HTMLElement,
  getWorld: () => World | null,
  notify: (text: string, color?: string) => void,
): void {
  wrap.append(h('h3', { text: 'Spawn mobs', style: 'margin:6px 0 4px' }));
  const enemySel = h('select', { style: 'width:100%;margin-bottom:4px' }) as HTMLSelectElement;
  enemyOptions(enemySel, 'skeleton');
  const countSel = h('select', { style: 'width:100%;margin-bottom:4px' }) as HTMLSelectElement;
  for (const n of [1, 2, 3, 4, 5, 8, 10]) {
    const o = document.createElement('option');
    o.value = String(n);
    o.textContent = `×${n}`;
    if (n === 1) o.selected = true;
    countSel.append(o);
  }
  const spacingSel = h('select', { style: 'width:100%;margin-bottom:4px' }) as HTMLSelectElement;
  for (const [v, label] of [['near', 'Crowd me (melee)'], ['ranged', 'At range (archers)']] as const) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = label;
    spacingSel.append(o);
  }
  const primeSel = h('select', { style: 'width:100%;margin-bottom:6px' }) as HTMLSelectElement;
  for (const [v, label] of [['alert', 'Aware'], ['windup', 'Mid-swing (parry test)']] as const) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = label;
    primeSel.append(o);
  }
  wrap.append(enemySel, countSel, spacingSel, primeSel);
  wrap.append(h('div', { class: 'row', style: 'gap:4px;margin-bottom:4px' },
    btn('Spawn', () => {
      const w = getWorld();
      if (!w) return;
      const n = spawnLabMob(w, enemySel.value, {
        count: Number(countSel.value),
        spacing: spacingSel.value as 'near' | 'ranged',
        prime: primeSel.value as 'alert' | 'windup',
      });
      notify(n > 0 ? `Spawned ${n} × ${enemySel.value}.` : 'No free tiles around you.', n > 0 ? '#c080ff' : '#ff9070');
    }, 'small primary'),
    btn('Clear', () => {
      const w = getWorld();
      if (!w) return;
      notify(`Cleared ${clearLabMobs(w)} enemies.`, '#9ac0ff');
    }, 'small'),
    btn('Kill all', () => {
      const w = getWorld();
      if (!w) return;
      notify(`Slew ${killLabMobs(w)} enemies.`, '#9ac0ff');
    }, 'small'),
  ));
}

// ---------------------------------------------------------------------------
// Spawn configurations
// ---------------------------------------------------------------------------

function buildConfigSection(
  wrap: HTMLElement,
  getWorld: () => World | null,
  notify: (text: string, color?: string) => void,
): void {
  wrap.append(h('h3', { text: 'Configurations', style: 'margin:10px 0 4px' }));
  wrap.append(h('p', {
    class: 'dim small', style: 'margin:0 0 4px',
    text: 'Multi-mob setups. Save named ones, re-spawn anytime, share as JSON.',
  }));

  // Editor rows.
  let editor: LabMobEntry[] = [{ id: 'skeleton', count: 2, spacing: 'near', prime: 'alert' }];
  const rowsBox = h('div', {});
  const renderEditor = (): void => {
    rowsBox.replaceChildren();
    editor.forEach((row, i) => {
      const rowEl = h('div', { style: 'display:flex;gap:4px;margin-bottom:4px' });
      const eSel = h('select', { style: 'flex:1;min-width:0' }) as HTMLSelectElement;
      enemyOptions(eSel, row.id);
      eSel.addEventListener('change', () => { editor[i].id = eSel.value; });
      const cInput = h('input', { attrs: { type: 'number', min: '1', max: '20', value: String(row.count) }, style: 'width:44px' }) as HTMLInputElement;
      cInput.addEventListener('change', () => {
        editor[i].count = Math.max(1, Math.min(20, Math.floor(Number(cInput.value) || 1)));
        cInput.value = String(editor[i].count);
      });
      const sSel = h('select', { style: 'width:64px' }) as HTMLSelectElement;
      for (const v of ['near', 'ranged'] as const) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v === 'near' ? 'near' : 'ranged';
        if (row.spacing === v) o.selected = true;
        sSel.append(o);
      }
      sSel.addEventListener('change', () => { editor[i].spacing = sSel.value as 'near' | 'ranged'; });
      const pSel = h('select', { style: 'width:64px' }) as HTMLSelectElement;
      for (const v of ['alert', 'windup'] as const) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v;
        if (row.prime === v) o.selected = true;
        pSel.append(o);
      }
      pSel.addEventListener('change', () => { editor[i].prime = pSel.value as 'alert' | 'windup'; });
      const del = btn('✕', () => {
        editor = editor.filter((_, j) => j !== i);
        if (!editor.length) editor = [{ id: 'skeleton', count: 1, spacing: 'near', prime: 'alert' }];
        renderEditor();
      }, 'small');
      rowEl.append(eSel, cInput, sSel, pSel, del);
      rowsBox.append(rowEl);
    });
  };
  renderEditor();
  wrap.append(rowsBox);
  wrap.append(h('div', { class: 'row', style: 'gap:4px;margin-bottom:4px' },
    btn('+ mob', () => {
      if (editor.length >= 12) {
        notify('12 mobs max per config.', '#ff9070');
        return;
      }
      editor.push({ id: 'goblin_archer', count: 1, spacing: 'ranged', prime: 'alert' });
      renderEditor();
    }, 'small'),
    btn('Test spawn', () => {
      const w = getWorld();
      if (!w) return;
      const n = spawnLabConfig(w, editor);
      notify(n > 0 ? `Config test: ${n} mobs.` : 'No free tiles around you.', n > 0 ? '#c080ff' : '#ff9070');
    }, 'small'),
  ));

  // Save row.
  const nameInput = h('input', { attrs: { type: 'text', placeholder: 'Config name', maxlength: '40' }, style: 'flex:1;min-width:0' }) as HTMLInputElement;
  const savedBox = h('div', { style: 'margin-top:4px' });
  const renderSaved = (): void => {
    savedBox.replaceChildren();
    for (const cfg of loadLabConfigs()) {
      const line = h('div', { style: 'display:flex;gap:4px;align-items:center;margin-bottom:4px' });
      const label = h('span', {
        style: 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
        text: `${cfg.name} — ${summarizeLabConfig(cfg)}`,
        title: cfg.entries.map((e) => `${e.count}× ${e.id} (${e.spacing}, ${e.prime})`).join('\n'),
      });
      const spawnBtn = btn('Spawn', () => {
        const w = getWorld();
        if (!w) return;
        const n = spawnLabConfig(w, cfg.entries);
        notify(n > 0 ? `${cfg.name}: ${n} mobs.` : 'No free tiles around you.', n > 0 ? '#c080ff' : '#ff9070');
      }, 'small');
      const replaceBtn = btn('Replace', () => {
        const w = getWorld();
        if (!w) return;
        clearLabMobs(w);
        const n = spawnLabConfig(w, cfg.entries);
        notify(n > 0 ? `${cfg.name}: cleared + ${n} mobs.` : 'No free tiles around you.', n > 0 ? '#c080ff' : '#ff9070');
      }, 'small');
      line.append(label, spawnBtn, replaceBtn);
      if (!isBuiltinLabConfig(cfg.name)) {
        line.append(
          btn('⇪', () => void copyText(exportLabConfig(cfg), notify), 'small'),
          btn('✕', () => { deleteLabConfig(cfg.name); renderSaved(); }, 'small'),
        );
      } else {
        line.append(btn('⇪', () => void copyText(exportLabConfig(cfg), notify), 'small'));
      }
      savedBox.append(line);
    }
  };
  renderSaved();
  wrap.append(h('div', { style: 'display:flex;gap:4px;margin-bottom:4px' },
    nameInput,
    btn('Save', () => {
      const name = nameInput.value.trim() || 'Unnamed';
      const cfg: LabConfig = { name, entries: editor.map((e) => ({ ...e })) };
      if (!cfg.entries.length) return;
      saveLabConfig(cfg);
      nameInput.value = '';
      renderSaved();
      notify(`Saved "${name}".`, '#c080ff');
    }, 'small primary'),
  ));
  wrap.append(savedBox);

  // Import.
  const importBox = h('textarea', {
    attrs: { rows: '2', placeholder: 'Paste shared config JSON here to import' },
    style: 'width:100%;box-sizing:border-box;margin-top:2px',
  }) as HTMLTextAreaElement;
  wrap.append(importBox);
  wrap.append(h('div', { class: 'row', style: 'gap:4px;margin-top:4px' },
    btn('Import JSON', () => {
      const cfg = parseLabConfig(importBox.value);
      if (!cfg) {
        notify('That JSON is not a lab config.', '#ff9070');
        return;
      }
      editor = cfg.entries;
      renderEditor();
      saveLabConfig(cfg);
      renderSaved();
      importBox.value = '';
      notify(`Imported "${cfg.name}".`, '#c080ff');
    }, 'small'),
  ));
}

async function copyText(text: string, notify: (t: string, c?: string) => void): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    notify('Config JSON copied — share it anywhere.', '#9ac0ff');
  } catch {
    notify(text, '#9ac0ff');
  }
}

// ---------------------------------------------------------------------------
// In-lab forge
// ---------------------------------------------------------------------------

function previewStatsLine(baseId: string, sel: { recipeId: string; materials: (string | null)[] }, smith: number): string {
  if (!sel.materials[0]) return 'Pick a primary material to preview.';
  try {
    const item = buildCrafted(sel, smith, undefined, MAX_RECIPE_RANK);
    const s = itemStats(item);
    const parts: string[] = [];
    const dmg = (itemBase(baseId) as { damageType?: string }).damageType;
    if (s.attack) parts.push(`${s.attack} atk${dmg ? ` ${dmg}` : ''}`);
    if (s.defense) parts.push(`${s.defense} def`);
    if (s.health) parts.push(`${s.health} HP`);
    if (s.stamina) parts.push(`${s.stamina} ST`);
    if (s.speed) parts.push(`${s.speed}% spd`);
    if (s.luck) parts.push(`${s.luck}% crit`);
    if (s.fire) parts.push(`+${s.fire} fire`);
    if (s.frost) parts.push(`+${s.frost} frost`);
    if (s.shadow) parts.push(`+${s.shadow} shadow`);
    if (s.holy) parts.push(`+${s.holy} holy`);
    if (s.leech) parts.push(`+${s.leech}% leech`);
    if (s.find) parts.push(`+${s.find}% find`);
    return `${itemName(item)} · ${item.rarity} · ${parts.join(' · ') || 'no combat stats'}`;
  } catch {
    return 'Pick a primary material to preview.';
  }
}

function buildForgeSection(
  wrap: HTMLElement,
  getWorld: () => World | null,
  notify: (text: string, color?: string) => void,
): void {
  wrap.append(h('h3', { text: 'Forge (in-lab)', style: 'margin:10px 0 4px' }));
  wrap.append(h('p', {
    class: 'dim small', style: 'margin:0 0 4px',
    text: `Rank ${MAX_RECIPE_RANK} · +${Math.round(masteryBonus(MAX_RECIPE_RANK) * 100)}% core · draws from stash (999 each).`,
  }));

  let forgeRecipe = 'r_long_sword';
  let forgeMats: (string | null)[] = [];
  const box = h('div', {});
  wrap.append(box);

  const defaultMats = (recipeId: string): (string | null)[] => {
    const w = getWorld();
    const r = recipe(recipeId);
    if (!w) return r.slots.map((s) => (s.optional ? null : null));
    return r.slots.map((slot) => {
      if (slot.optional) return null;
      const opts = materialsForSlot(slot, w.state.stash).filter((o) => o.owned >= slot.qty);
      return opts.sort((a, b) => b.def.tier - a.def.tier)[0]?.def.id ?? null;
    });
  };

  const renderForge = (): void => {
    const w = getWorld();
    box.replaceChildren();
    if (!w) {
      box.append(h('p', { class: 'dim small', text: 'No world.' }));
      return;
    }
    const smith = metaLevel(w.state.meta, 'master_smith');
    const r = recipe(forgeRecipe);
    if (forgeMats.length !== r.slots.length) forgeMats = defaultMats(forgeRecipe);

    const recipeSel = h('select', { style: 'width:100%;margin-bottom:4px' }) as HTMLSelectElement;
    for (const cand of RECIPE_LADDER) {
      const o = document.createElement('option');
      o.value = cand.id;
      o.textContent = itemBase(cand.baseId).name;
      if (cand.id === forgeRecipe) o.selected = true;
      recipeSel.append(o);
    }
    recipeSel.addEventListener('change', () => {
      forgeRecipe = recipeSel.value;
      forgeMats = defaultMats(forgeRecipe);
      renderForge();
    });
    box.append(recipeSel);

    r.slots.forEach((slot, i) => {
      const row = h('div', { style: 'display:flex;gap:4px;align-items:center;margin-bottom:4px' });
      row.append(h('span', { class: 'dim small', style: 'width:64px', text: `${slot.label} ×${slot.qty}` }));
      const sel = h('select', { style: 'flex:1;min-width:0' }) as HTMLSelectElement;
      if (slot.optional) {
        const o = document.createElement('option');
        o.value = '';
        o.textContent = '— none —';
        if (!forgeMats[i]) o.selected = true;
        sel.append(o);
      }
      for (const { def, owned } of materialsForSlot(slot, w.state.stash)) {
        const o = document.createElement('option');
        o.value = def.id;
        o.textContent = `${def.name} (t${def.tier}, ×${owned})`;
        if (forgeMats[i] === def.id) o.selected = true;
        sel.append(o);
      }
      sel.addEventListener('change', () => {
        forgeMats[i] = sel.value || null;
        renderForge();
      });
      row.append(sel);
      box.append(row);
    });

    const sel = { recipeId: r.id, materials: forgeMats };
    box.append(h('p', { class: 'small', style: 'margin:4px 0', text: previewStatsLine(r.baseId, sel, smith) }));
    const err = selectionError(sel, w.state.stash);
    if (err) box.append(h('p', { class: 'dim small', style: 'margin:0 0 4px', text: err }));

    const forge = (equip: boolean): void => {
      const ww = getWorld();
      if (!ww) return;
      const sm = metaLevel(ww.state.meta, 'master_smith');
      const item = craft({ recipeId: r.id, materials: [...forgeMats] }, ww.state.stash, createRng(randomSeed()), sm, MAX_RECIPE_RANK);
      if (!item) {
        notify(selectionError({ recipeId: r.id, materials: forgeMats }, ww.state.stash) ?? 'Cannot forge that.', '#ff9070');
        return;
      }
      if (equip) {
        addItem(ww.run.backpack, item);
        const problem = equipFrom(ww.state.equipment, ww.run.backpack, item.uid);
        if (problem) {
          notify(`${itemName(item)} in pack — ${problem}`, '#ff9070');
        } else {
          ww.refreshDerived();
          notify(`Forged + equipped ${itemName(item)}.`, '#c080ff');
        }
      } else {
        const left = addItem(ww.run.backpack, item);
        notify(left > 0 ? 'Pack is full — drop something first.' : `Forged ${itemName(item)} to pack (I).`, left > 0 ? '#ff9070' : '#c080ff');
      }
      renderForge();
    };
    box.append(h('div', { class: 'row', style: 'gap:4px' },
      btn('Forge & Equip', () => forge(true), 'small primary', !!err),
      btn('To pack', () => forge(false), 'small', !!err),
      btn('Give all materials (+99)', () => {
        const ww = getWorld();
        if (!ww) return;
        const count = giveMaterials(ww.state);
        renderForge();
        notify(`Added 99 each of ${count} materials to the stash.`, '#9ac0ff');
      }, 'small'),
      btn('Restock', () => {
        const ww = getWorld();
        if (!ww) return;
        restockLabMats(ww.state);
        renderForge();
        notify('Materials topped to 999.', '#9ac0ff');
      }, 'small'),
    ));
  };
  renderForge();
}

// ---------------------------------------------------------------------------
// Quick weapon giver (fixed Epic roll — fastest way to feel a base)
// ---------------------------------------------------------------------------

function buildWeaponSection(
  wrap: HTMLElement,
  getWorld: () => World | null,
  notify: (text: string, color?: string) => void,
): void {
  wrap.append(h('h3', { text: 'Quick weapon', style: 'margin:10px 0 4px' }));
  const baseSel = h('select', { style: 'width:100%;margin-bottom:4px' }) as HTMLSelectElement;
  const matSel = h('select', { style: 'width:100%;margin-bottom:6px' }) as HTMLSelectElement;
  const refillMats = (): void => {
    matSel.replaceChildren();
    for (const m of materialsFor(baseSel.value)) {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = `${m.name} (t${m.tier})`;
      if (m.tier >= 4) o.selected = true;
      matSel.append(o);
    }
    if (![...matSel.options].some((o) => o.selected) && matSel.options.length) matSel.options[0].selected = true;
  };
  for (const b of weaponBases()) {
    const o = document.createElement('option');
    o.value = b.id;
    o.textContent = `${b.name}${b.twoHanded ? ' (2H)' : ''}`;
    if (b.id === 'long_sword') o.selected = true;
    baseSel.append(o);
  }
  baseSel.addEventListener('change', refillMats);
  refillMats();
  wrap.append(baseSel, matSel);
  const giveWeapon = (equip: boolean): void => {
    const w = getWorld();
    if (!w) return;
    const item = makeEquipment({
      baseId: baseSel.value, materialId: matSel.value,
      rarity: Rarity.Epic, ilvl: LAB_ILVL, quality: 1, identified: true,
    });
    if (equip) {
      addItem(w.run.backpack, item);
      const err = equipFrom(w.state.equipment, w.run.backpack, item.uid);
      if (err) {
        notify(err, '#ff9070');
      } else {
        w.refreshDerived();
        notify(`Equipped ${baseSel.value} (${matSel.value}).`, '#c080ff');
      }
    } else {
      const left = addItem(w.run.backpack, item);
      notify(left > 0 ? 'Pack is full — drop something first.' : `Stowed ${baseSel.value} in the pack (I).`, left > 0 ? '#ff9070' : '#c080ff');
    }
  };
  wrap.append(h('div', { class: 'row', style: 'gap:4px' },
    btn('Equip', () => giveWeapon(true), 'small primary'),
    btn('To pack', () => giveWeapon(false), 'small'),
  ));
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function buildUtilitySection(
  wrap: HTMLElement,
  getWorld: () => World | null,
  notify: (text: string, color?: string) => void,
): void {
  wrap.append(h('h3', { text: 'Utility', style: 'margin:10px 0 4px' }));
  wrap.append(h('div', { class: 'row', style: 'gap:4px;margin-bottom:4px' },
    btn('Heal + repair', () => {
      const w = getWorld();
      if (!w) return;
      refurbish(w);
      notify('Healed, stamina full, gear repaired, belts restocked.', '#9ac0ff');
    }, 'small'),
  ));
  const godLabel = h('label', { class: 'small', style: 'display:flex;gap:6px;align-items:center;margin-bottom:4px' });
  const godBox = h('input', { attrs: { type: 'checkbox' } }) as HTMLInputElement;
  godLabel.append(godBox, document.createTextNode('Godmode (top up HP continuously)'));
  godBox.addEventListener('change', () => {
    if (godTimer) {
      clearInterval(godTimer);
      godTimer = 0;
    }
    if (godBox.checked) {
      godTimer = window.setInterval(() => {
        const w = getWorld();
        if (!w) return;
        if (w.player.hp < w.derived.maxHp) {
          w.player.hp = w.derived.maxHp;
          w.player.stamina = w.derived.maxStamina;
        }
      }, 400);
      notify('Godmode on.', '#9ac0ff');
    } else {
      notify('Godmode off.', '#9ac0ff');
    }
  });
  wrap.append(godLabel);
}
