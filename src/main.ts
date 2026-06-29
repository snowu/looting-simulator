import './style.css';
import { GameState } from './state/game-state';
import { Market } from './systems/market';
import { RunManager, NodeOutcome, MoveAction } from './systems/run-manager';
import { ItemRenderer } from './renderer/item-renderer';
import { craft } from './systems/crafting';
import { saveGame, loadGame } from './state/persistence';
import { RECIPES } from './data/recipes';
import { Item } from './types';
import { createLayout } from './ui/panels';
import { HUD } from './ui/hud';
import { InventoryView } from './ui/inventory-view';
import { DungeonGridView } from './ui/dungeon-grid-view';
import { MarketView } from './ui/market-view';
import { CraftingView } from './ui/crafting-view';
import { MetaView } from './ui/meta-view';
import { META_UPGRADES } from './systems/meta';

// --- State ---
const saved = loadGame();
const state: GameState = saved ?? new GameState();
const market = new Market();
const runManager = new RunManager();

// --- Layout ---
const app = document.getElementById('app')!;
const panels = createLayout(app);

// --- Views ---
// Panels are hidden by default and toggled with keybinds (I / P).
// NOTE: do NOT use display:none — removing a grid item shifts the remaining
// items into the wrong tracks (center collapses into the 0px track). Collapse
// the grid track via the class instead; panel content is clipped by overflow.
app.classList.add('panels-collapsed-left', 'panels-collapsed-right');

// Left panel: tabs for inventory and crafting
const leftTabs = document.createElement('div');
leftTabs.className = 'tab-bar';
leftTabs.innerHTML = '<button class="tab active" data-tab="inventory">Inventory</button><button class="tab" data-tab="crafting">Crafting</button>';
panels.leftPanel.appendChild(leftTabs);

const inventoryContainer = document.createElement('div');
inventoryContainer.id = 'inventory-container';
panels.leftPanel.appendChild(inventoryContainer);

const craftingContainer = document.createElement('div');
craftingContainer.id = 'crafting-container';
craftingContainer.style.display = 'none';
panels.leftPanel.appendChild(craftingContainer);

leftTabs.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (!target.dataset.tab) return;
  leftTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  target.classList.add('active');
  inventoryContainer.style.display = target.dataset.tab === 'inventory' ? '' : 'none';
  craftingContainer.style.display = target.dataset.tab === 'crafting' ? '' : 'none';
});

const inventoryView = new InventoryView(inventoryContainer);
const craftingView = new CraftingView(craftingContainer);

// Right panel: Status / personal (HUD)
const hudContainer = document.createElement('div');
hudContainer.id = 'hud-container';
panels.rightPanel.appendChild(hudContainer);

const hudView = new HUD(hudContainer);

// Market: shown as an end-of-dungeon merchant event overlay in the center panel.
const marketContainer = document.createElement('div');
marketContainer.id = 'market-container';
marketContainer.style.display = 'none';
panels.centerPanel.appendChild(marketContainer);
const marketView = new MarketView(marketContainer);

// Center panel: dungeon map / viewport / idle / meta
const dungeonContainer = document.createElement('div');
dungeonContainer.id = 'dungeon-container';
panels.centerPanel.appendChild(dungeonContainer);

const dungeonMapView = new DungeonGridView(dungeonContainer);

const metaContainer = document.createElement('div');
metaContainer.id = 'meta-container';
metaContainer.style.display = 'none';
panels.centerPanel.appendChild(metaContainer);

const metaView = new MetaView(metaContainer);

const outcomeToast = document.createElement('div');
outcomeToast.id = 'outcome-toast';
outcomeToast.className = 'toast';
panels.centerPanel.appendChild(outcomeToast);

// Idle view
const idleView = document.createElement('div');
idleView.id = 'idle-view';
idleView.innerHTML = '<div style="text-align:center"><button id="btn-start-run" class="btn-primary">Start Dungeon Run</button><p style="margin-top:16px;color:#888;font-size:19px">Press <b>I</b> for Inventory &amp; Crafting · <b>P</b> for Status</p></div>';
panels.centerPanel.appendChild(idleView);

// Extract button
const extractBtn = document.createElement('button');
extractBtn.id = 'btn-extract';
extractBtn.className = 'btn-primary';
extractBtn.textContent = 'Extract (Keep Loot)';
extractBtn.style.display = 'none';
panels.centerPanel.appendChild(extractBtn);

// Back to map button (from item viewport)
const backBtn = document.createElement('button');
backBtn.id = 'btn-back';
backBtn.className = 'btn-secondary';
backBtn.textContent = 'Back';
backBtn.style.display = 'none';
panels.centerPanel.appendChild(backBtn);

// --- Item Renderer ---
let itemRenderer: ItemRenderer | null = null;
let viewingItem = false;

// --- Meta View State ---
let showingMeta = false;

function showItemViewport(item: Item): void {
  viewingItem = true;
  dungeonContainer.style.display = 'none';
  idleView.style.display = 'none';
  extractBtn.style.display = 'none';
  panels.itemViewport.style.display = 'block';
  backBtn.style.display = 'block';

  if (!itemRenderer) {
    itemRenderer = new ItemRenderer(panels.itemViewport);
  }
  itemRenderer.showItem(item);
}

function hideItemViewport(): void {
  viewingItem = false;
  panels.itemViewport.style.display = 'none';
  backBtn.style.display = 'none';
  if (itemRenderer) {
    itemRenderer.clear();
  }
  updateCenterView();
}

function showMetaView(): void {
  showingMeta = true;
  dungeonContainer.style.display = 'none';
  idleView.style.display = 'none';
  extractBtn.style.display = 'none';
  metaContainer.style.display = 'flex';

  metaView.update(state, (upgradeId: string) => {
    const upgrade = META_UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) return;

    const currentLevel = state.meta.upgradeLevels[upgradeId] ?? 0;
    if (currentLevel >= upgrade.maxLevel) return;
    if (state.meta.metaCurrency < upgrade.cost) return;

    state.meta.metaCurrency -= upgrade.cost;
    state.meta.upgradeLevels[upgradeId] = currentLevel + 1;
    saveGame(state);
    updateUI();
  });

  // Wire continue button
  const continueBtn = metaContainer.querySelector('#btn-continue');
  if (continueBtn) {
    continueBtn.addEventListener('click', hideMetaView);
  }
}

function hideMetaView(): void {
  showingMeta = false;
  metaContainer.style.display = 'none';
  if (state.runState && !state.runState.isActive) {
    state.runState = null;
  }
  saveGame(state);
  updateCenterView();
}

// --- Market Event (end-of-dungeon merchant) ---
let showingMarket = false;

function showMarketEvent(): void {
  showingMarket = true;
  dungeonContainer.style.display = 'none';
  idleView.style.display = 'none';
  extractBtn.style.display = 'none';
  marketContainer.style.display = 'flex';
  renderMarketEvent();
}

function renderMarketEvent(): void {
  marketView.update(market, state, handleBuyMaterial, handleSellMaterial);
  // Append a banner + continue button into the market overlay.
  const banner = document.createElement('div');
  banner.className = 'market-event-banner';
  banner.textContent = 'A wandering merchant waits at the dungeon exit. Trade your haul before returning.';
  marketContainer.insertBefore(banner, marketContainer.firstChild);

  const cont = document.createElement('button');
  cont.className = 'btn-continue';
  cont.textContent = 'Leave the merchant →';
  cont.addEventListener('click', hideMarketEvent);
  marketContainer.appendChild(cont);
}

function hideMarketEvent(): void {
  showingMarket = false;
  marketContainer.style.display = 'none';
  showMetaView();
  updateUI();
}

backBtn.addEventListener('click', hideItemViewport);

// --- Game Actions ---
function handleStartRun(): void {
  runManager.startRun(state);
  updateUI();
}

function handleMove(action: MoveAction): void {
  const outcome = runManager.move(state, action);
  if (outcome.type !== 'none') showOutcome(outcome);

  // Run ends on death or boss victory (auto-extract sets isActive false).
  const isRunEnded = !state.runState?.isActive;
  if (isRunEnded) {
    saveGame(state);
    // Survived a boss win = reached the merchant; death = no merchant.
    const survived = outcome.type === 'boss' && outcome.result.victory;
    setTimeout(() => {
      if (survived) showMarketEvent();
      else showMetaView();
      updateUI();
    }, 500);
  } else {
    saveGame(state);
    updateUI();
  }
}

function handleExtract(): void {
  runManager.extractRun(state);
  saveGame(state);
  // Extracting alive = you reach the dungeon-exit merchant.
  showMarketEvent();
  updateUI();
}

function handleBuyMaterial(materialId: string): void {
  const result = market.buyMaterial(materialId, 1);
  if (result && state.gold >= result.cost) {
    state.gold -= result.cost;
    state.stash.addMaterial(materialId, 1);
    refreshAfterTrade();
  }
}

function handleSellMaterial(materialId: string): void {
  const count = state.stash.getMaterialCount(materialId);
  if (count > 0) {
    const revenue = market.sellMaterial(materialId, 1);
    state.stash.removeMaterial(materialId, 1);
    state.gold += revenue;
    refreshAfterTrade();
  }
}

function refreshAfterTrade(): void {
  saveGame(state);
  updateUI();
  if (showingMarket) renderMarketEvent();
}

function handleCraft(recipe: typeof RECIPES[number]): void {
  const item = craft(state.stash, recipe);
  if (item) {
    state.stash.addItem(item);
    updateUI();
  }
}

function handleSelectItem(item: Item): void {
  showItemViewport(item);
}

// --- Outcome Toast ---
function showOutcome(outcome: NodeOutcome): void {
  let text = '';
  switch (outcome.type) {
    case 'loot':
      text = 'Treasure! Found: ' + outcome.materials.map(m => `${m.materialId} x${m.quantity}`).join(', ');
      break;
    case 'combat':
      text = outcome.result.victory
        ? `Victory! (-${outcome.result.playerDamage} HP)`
        : `Defeated! Lost 25% gold. Run over.`;
      break;
    case 'boss':
      text = outcome.result.victory
        ? `Boss defeated! Run won! +${outcome.metaReward} meta — loot extracted.`
        : `Boss crushed you! Lost 25% gold.`;
      break;
    case 'descend':
      text = `Descended to depth ${outcome.depth}. The dungeon deepens...`;
      break;
    case 'door':
      text = 'You heave the wooden door open.';
      break;
    case 'none':
      break;
    case 'shop':
      text = 'A merchant cache! The real market awaits at the dungeon exit.';
      break;
    case 'trap':
      text = state.runState?.isActive === false
        ? `Trap! ${outcome.damage} damage — you died! Lost 25% gold.`
        : `Trap! Took ${outcome.damage} HP damage.`;
      break;
    case 'event':
      text = outcome.text;
      break;
  }
  outcomeToast.textContent = text;
  outcomeToast.style.display = 'block';
  setTimeout(() => { outcomeToast.style.display = 'none'; }, 3000);
}

// --- UI Update ---
function updateCenterView(): void {
  if (viewingItem) return;
  if (showingMeta) return;
  if (showingMarket) return;

  if (state.runState?.isActive) {
    dungeonContainer.style.display = '';
    idleView.style.display = 'none';
    extractBtn.style.display = 'block';
    dungeonMapView.show();
    dungeonMapView.update(state.runState, handleMove);
  } else {
    dungeonContainer.style.display = 'none';
    idleView.style.display = 'flex';
    extractBtn.style.display = 'none';
    dungeonMapView.hide();
  }
}

function updateUI(): void {
  hudView.update(state);
  inventoryView.update(state, handleSelectItem);
  craftingView.update(state, RECIPES, handleCraft);
  updateCenterView();
}

// --- Event Listeners ---
idleView.querySelector('#btn-start-run')!.addEventListener('click', handleStartRun);
extractBtn.addEventListener('click', handleExtract);

// --- Panel Toggles (keybinds) ---
function togglePanel(collapsedClass: string): void {
  const collapsed = app.classList.toggle(collapsedClass); // true when class now present
  if (!collapsed) updateUI(); // panel just opened -> refresh its contents
}

window.addEventListener('keydown', (e) => {
  // Ignore if typing in an input.
  if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
  switch (e.key) {
    case 'i':
    case 'I':
      e.preventDefault();
      togglePanel('panels-collapsed-left');
      break;
    case 'p':
    case 'P':
      e.preventDefault();
      togglePanel('panels-collapsed-right');
      break;
  }
});

// --- Game Loop ---
// Market prices drift over time so each merchant visit differs.
setInterval(() => {
  market.tick();
}, 5000);

// --- Save/Load ---
window.addEventListener('beforeunload', () => saveGame(state));

// --- Init ---
updateUI();
