import { CurveManager } from './CurveManager';
import { HistoryManager } from '../history';
import { StateManager } from './StateManager';

export interface DropdownManagerCallbacks {
  onRender: () => void;
  onUpdateButtonStates: () => void;
}

export class DropdownManager {
  constructor(
    private curveManager: CurveManager,
    private history: HistoryManager,
    private stateManager: StateManager,
    private callbacks: DropdownManagerCallbacks
  ) {
    this.setupFileDropdown();
    this.setupHistoryDropdown();
    this.setupCurveDropdown();
  }

  updateCurveSelector(): void {
    const dropdownMenu = document.getElementById('curve-dropdown-menu');
    const currentNameSpan = document.getElementById('curve-current-name');
    const currentDot = document.querySelector(
      '#curve-dropdown-button .curve-color-dot'
    ) as HTMLElement;

    if (!dropdownMenu || !currentNameSpan || !currentDot) return;

    const allCurves = this.curveManager.getAllCurves();
    const curves = allCurves.filter(c => c.points.length > 0);
    const activeCurve = this.curveManager.getActiveCurve();

    const colorCounts = new Map<string, number>();
    curves.forEach(curve => {
      const count = colorCounts.get(curve.color) || 0;
      colorCounts.set(curve.color, count + 1);
    });

    const colorIndices = new Map<string, number>();

    dropdownMenu.innerHTML = '';
    curves.forEach(curve => {
      const item = document.createElement('div');
      item.className = 'curve-dropdown-item';
      if (curve.id === activeCurve?.id) {
        item.classList.add('active');
      }

      const pointCount = curve.points.length;
      const colorName = this.getColorName(curve.color);
      const hasMultipleOfColor = (colorCounts.get(curve.color) || 0) > 1;

      let displayName = colorName;
      if (hasMultipleOfColor) {
        const currentIndex = (colorIndices.get(curve.color) || 0) + 1;
        colorIndices.set(curve.color, currentIndex);
        displayName = `${colorName} ${currentIndex}`;
      }

      const dot = document.createElement('span');
      dot.className = 'curve-color-dot';
      dot.style.backgroundColor = curve.color;

      const text = document.createElement('span');
      text.textContent = `${displayName} (${pointCount} points)`;

      item.appendChild(dot);
      item.appendChild(text);

      item.addEventListener('click', () => {
        this.curveManager.setActiveCurve(curve.id);
        this.stateManager.syncStateFromHistory(null);
        dropdownMenu.classList.remove('open');
        this.updateCurveSelector();
        this.callbacks.onRender();
      });

      dropdownMenu.appendChild(item);

      if (curve.id === activeCurve?.id) {
        currentNameSpan.textContent = `${displayName} (${pointCount} points)`;
        currentDot.style.backgroundColor = curve.color;
      }
    });

    if (activeCurve && activeCurve.points.length === 0) {
      currentNameSpan.textContent = 'No active curve';
      currentDot.style.backgroundColor = '#555';
    }
  }

  updateHistoryDropdown(): void {
    const dropdownContent = document.getElementById('history-dropdown-content');
    if (!dropdownContent) return;

    const branches = this.history.getBranches();
    dropdownContent.innerHTML = '';

    // Add jump navigation buttons
    const canJumpForward = this.history.canJumpForward();
    const canJumpBackward = this.history.canJumpBackward();

    if (canJumpForward) {
      const jumpForwardBtn = document.createElement('button');
      jumpForwardBtn.textContent = '⇥ Jump to Next Branch / End';
      jumpForwardBtn.style.textAlign = 'left';
      jumpForwardBtn.style.color = '#4a9eff';
      jumpForwardBtn.style.borderBottom = '1px solid #444';
      jumpForwardBtn.addEventListener('click', () => {
        const affectedCurveId = this.history.jumpToNextIntersectionOrEnd();
        this.stateManager.syncStateFromHistory(affectedCurveId);
        this.callbacks.onRender();
        this.callbacks.onUpdateButtonStates();
        document.getElementById('history-dropdown')?.classList.remove('open');
      });
      dropdownContent.appendChild(jumpForwardBtn);
    }

    if (canJumpBackward) {
      const jumpBackwardBtn = document.createElement('button');
      jumpBackwardBtn.textContent = '⇤ Jump to Previous Branch / Start';
      jumpBackwardBtn.style.textAlign = 'left';
      jumpBackwardBtn.style.color = '#4a9eff';
      jumpBackwardBtn.style.borderBottom = '1px solid #444';
      jumpBackwardBtn.addEventListener('click', () => {
        const affectedCurveId = this.history.jumpToPreviousIntersectionOrStart();
        this.stateManager.syncStateFromHistory(affectedCurveId);
        this.callbacks.onRender();
        this.callbacks.onUpdateButtonStates();
        document.getElementById('history-dropdown')?.classList.remove('open');
      });
      dropdownContent.appendChild(jumpBackwardBtn);
    }

    if (branches.length === 0) {
      if (!canJumpForward && !canJumpBackward) {
        const emptyItem = document.createElement('div');
        emptyItem.style.padding = '0.5rem 0.8rem';
        emptyItem.style.color = '#888';
        emptyItem.textContent = 'No branches';
        dropdownContent.appendChild(emptyItem);
      }
      return;
    }

    // Add separator if we have jump buttons
    if (canJumpForward || canJumpBackward) {
      const separator = document.createElement('div');
      separator.style.padding = '0.25rem 0.8rem';
      separator.style.color = '#666';
      separator.style.fontSize = '12px';
      separator.style.borderBottom = '1px solid #444';
      separator.textContent = 'Available Branches:';
      dropdownContent.appendChild(separator);
    }

    branches.forEach(branch => {
      const item = document.createElement('button');
      item.textContent = `${branch.isCurrent ? '● ' : '○ '}${branch.description}`;
      item.style.textAlign = 'left';

      if (branch.isCurrent) {
        item.style.fontWeight = 'bold';
        item.style.color = '#4a9eff';
      }

      item.addEventListener('click', () => {
        const affectedCurveId = this.history.switchToBranch(branch.node);
        this.stateManager.syncStateFromHistory(affectedCurveId);
        this.callbacks.onRender();
        this.callbacks.onUpdateButtonStates();
        document.getElementById('history-dropdown')?.classList.remove('open');
      });

      dropdownContent.appendChild(item);
    });
  }

  private setupFileDropdown(): void {
    const dropdown = document.getElementById('file-dropdown');
    const dropdownButton = dropdown?.querySelector('.dropdown-button');

    dropdownButton?.addEventListener('click', e => {
      e.stopPropagation();
      dropdown?.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      dropdown?.classList.remove('open');
    });

    dropdown?.querySelector('.dropdown-content')?.addEventListener('click', e => {
      e.stopPropagation();
      dropdown.classList.remove('open');
    });
  }

  private setupHistoryDropdown(): void {
    const dropdown = document.getElementById('history-dropdown');
    const dropdownButton = document.getElementById('history-dropdown-button');

    dropdownButton?.addEventListener('click', e => {
      e.stopPropagation();
      dropdown?.classList.toggle('open');
      if (dropdown?.classList.contains('open')) {
        this.updateHistoryDropdown();
      }
    });

    document.addEventListener('click', () => {
      dropdown?.classList.remove('open');
    });
  }

  private setupCurveDropdown(): void {
    const dropdownButton = document.getElementById('curve-dropdown-button');
    const dropdownMenu = document.getElementById('curve-dropdown-menu');

    dropdownButton?.addEventListener('click', e => {
      e.stopPropagation();
      dropdownMenu?.classList.toggle('open');
    });

    document.addEventListener('click', e => {
      if (!(e.target as HTMLElement).closest('.curve-selector')) {
        dropdownMenu?.classList.remove('open');
      }
    });

    this.updateCurveSelector();
  }

  private getColorName(hex: string): string {
    const colorMap: { [key: string]: string } = {
      '#4a9eff': 'Blue',
      '#ff4a9e': 'Pink',
      '#4aff9e': 'Green',
      '#ff9e4a': 'Orange',
      '#9e4aff': 'Purple',
      '#4afff9': 'Cyan',
    };
    return colorMap[hex] || 'Unknown';
  }
}
