import './style.css';
import { GameState } from './state/game-state';
import { Market } from './systems/market';
import { RunManager, NodeOutcome } from './systems/run-manager';
import { ItemRenderer } from './renderer/item-renderer';
import { craft } from './systems/crafting';
import { saveGame, loadGame } from './state/persistence';
import { RECIPES } from './data/recipes';
import { Item } from './types';
import { createLayout } from './ui/panels';
import { HUD } from './ui/hud';
import { InventoryView } from './ui/inventory-view';
import { DungeonMapView } from './ui/dungeon-map-view';
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
const hud = new HUD(panels.rightPanel);

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

// Right panel: HUD + market
const hudContainer = document.createElement('div');
hudContainer.id = 'hud-container';
panels.rightPanel.appendChild(hudContainer);

const marketContainer = document.createElement('div');
marketContainer.id = 'market-container';
panels.rightPanel.appendChild(marketContainer);

const hudView = new HUD(hudContainer);
const marketView = new MarketView(marketContainer);

// Center panel: dungeon map / viewport / idle / meta
const dungeonContainer = document.createElement('div');
dungeonContainer.id = 'dungeon-container';
panels.centerPanel.appendChild(dungeonContainer);

const dungeonMapView = new DungeonMapView(dungeonContainer);

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
idleView.innerHTML = '<button id="btn-start-run" class="btn-primary">Start Dungeon Run</button>';
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
  updateCenterView();
}

backBtn.addEventListener('click', hideItemViewport);

// --- Game Actions ---
function handleStartRun(): void {
  runManager.startRun(state);
  updateUI();
}

function handleMoveToNode(nodeId: string): void {
  const outcome = runManager.moveToNode(state, nodeId);
  showOutcome(outcome);

  // Check if run ended due to death or boss victory
  const isRunEnded = !state.runState?.isActive;
  if (isRunEnded) {
    saveGame(state);
    // Delay meta view to let outcome toast display first
    setTimeout(() => {
      showMetaView();
      updateUI();
    }, 500);
  } else {
    updateUI();
  }
}

function handleExtract(): void {
  runManager.extractRun(state);
  saveGame(state);
  showMetaView();
  updateUI();
}

function handleBuyMaterial(materialId: string): void {
  const result = market.buyMaterial(materialId, 1);
  if (result && state.gold >= result.cost) {
    state.gold -= result.cost;
    state.stash.addMaterial(materialId, 1);
    updateUI();
  }
}

function handleSellMaterial(materialId: string): void {
  const count = state.stash.getMaterialCount(materialId);
  if (count > 0) {
    const revenue = market.sellMaterial(materialId, 1);
    state.stash.removeMaterial(materialId, 1);
    state.gold += revenue;
    updateUI();
  }
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
      text = outcome.result.victory ? 'Victory!' : 'Defeated! Run lost.';
      break;
    case 'boss':
      text = outcome.result.victory ? `Boss defeated! +${outcome.metaReward} meta` : 'Boss defeated you! Run lost.';
      break;
    case 'shop':
      text = 'A shop appears. (Use market panel)';
      break;
    case 'trap':
      text = `Trap! Took ${outcome.damage} damage.`;
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

  if (state.runState?.isActive) {
    dungeonContainer.style.display = '';
    idleView.style.display = 'none';
    extractBtn.style.display = 'block';
    dungeonMapView.show();
    dungeonMapView.update(state.runState, handleMoveToNode);
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
  marketView.update(market, state, handleBuyMaterial, handleSellMaterial);
  updateCenterView();
}

// --- Event Listeners ---
idleView.querySelector('#btn-start-run')!.addEventListener('click', handleStartRun);
extractBtn.addEventListener('click', handleExtract);

// --- Game Loop ---
setInterval(() => {
  market.tick();
  updateUI();
}, 5000);

// --- Save/Load ---
window.addEventListener('beforeunload', () => saveGame(state));

// --- Init ---
updateUI();
