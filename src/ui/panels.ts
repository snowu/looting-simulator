export interface Panels {
  leftPanel: HTMLElement;
  centerPanel: HTMLElement;
  rightPanel: HTMLElement;
  itemViewport: HTMLElement;
}

export function createLayout(app: HTMLElement): Panels {
  app.innerHTML = '';

  const leftPanel = document.createElement('div');
  leftPanel.id = 'left-panel';
  leftPanel.className = 'panel';

  const centerPanel = document.createElement('div');
  centerPanel.id = 'center-panel';
  centerPanel.className = 'panel';

  const itemViewport = document.createElement('div');
  itemViewport.id = 'item-viewport';
  itemViewport.style.display = 'none';
  itemViewport.style.width = '100%';
  itemViewport.style.height = '100%';
  centerPanel.appendChild(itemViewport);

  const rightPanel = document.createElement('div');
  rightPanel.id = 'right-panel';
  rightPanel.className = 'panel';

  app.appendChild(leftPanel);
  app.appendChild(centerPanel);
  app.appendChild(rightPanel);

  return { leftPanel, centerPanel, rightPanel, itemViewport };
}
