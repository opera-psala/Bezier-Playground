import { CurveManager } from './CurveManager';
import { AnimationManager } from '../animation';
import { HistoryManager, AddCurveCommand, RemoveCurveCommand } from '../history';
import { StateManager } from './StateManager';
import { FileManager } from './FileManager';
import { NotificationManager } from './NotificationManager';
import { VisualizationMode } from '../types';

export interface UIControlManagerCallbacks {
  onRender: () => void;
  onUpdateButtonStates: () => void;
  onClearAnimationArtifacts: () => void;
  onVisualizationModeChange: (mode: VisualizationMode) => void;
  onManualTChange: (t: number) => void;
}

export class UIControlManager {
  constructor(
    private curveManager: CurveManager,
    private animation: AnimationManager,
    private history: HistoryManager,
    private stateManager: StateManager,
    private fileManager: FileManager,
    private notificationManager: NotificationManager,
    private callbacks: UIControlManagerCallbacks
  ) {
    this.setupControls();
    this.setupKeyboardShortcuts();
  }

  updateButtonStates(): void {
    const undoBtn = document.getElementById('undo') as HTMLButtonElement;
    const redoBtn = document.getElementById('redo') as HTMLButtonElement;
    const historyDropdown = document.getElementById('history-dropdown');

    if (undoBtn) {
      undoBtn.disabled = !this.stateManager.canUndo();
    }
    if (redoBtn) {
      redoBtn.disabled = !this.stateManager.canRedo();
    }
    if (historyDropdown) {
      const hasBranches = this.history.getBranches().length > 0;
      const canJump = this.history.canJumpForward() || this.history.canJumpBackward();
      historyDropdown.style.display = hasBranches || canJump ? 'block' : 'none';
    }
  }

  private setupControls(): void {
    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');
    const clearBtn = document.getElementById('clear');
    const newCurveBtn = document.getElementById('new-curve');
    const deleteCurveBtn = document.getElementById('delete-curve');
    const animateBtn = document.getElementById('animate') as HTMLButtonElement;
    const visualizationSelect = document.getElementById('visualization-mode') as HTMLSelectElement;
    const speedContainer = document.getElementById('speed-container');
    const tSliderContainer = document.getElementById('t-slider-container');
    const tSlider = document.getElementById('t-slider') as HTMLInputElement;
    const tValue = document.getElementById('t-value');
    const speedSlider = document.getElementById('speed') as HTMLInputElement;
    const saveBtn = document.getElementById('save');
    const loadBtn = document.getElementById('load');
    const exportBtn = document.getElementById('export');

    undoBtn?.addEventListener('click', () => {
      this.stateManager.undo();
      this.updateButtonStates();
    });

    redoBtn?.addEventListener('click', () => {
      this.stateManager.redo();
      this.updateButtonStates();
    });

    clearBtn?.addEventListener('click', () => {
      this.curveManager.clearAllCurves();
      this.animation.stop();
      this.history.clear();
      this.stateManager.syncStateFromHistory(null);
      this.updateButtonStates();
      this.callbacks.onRender();
    });

    newCurveBtn?.addEventListener('click', () => {
      const newCurve = {
        id: Math.random().toString(36).substr(2, 9),
        color: this.curveManager['colorPalette'][this.curveManager['nextColorIndex']],
        points: [],
      };
      this.curveManager['nextColorIndex'] =
        (this.curveManager['nextColorIndex'] + 1) % this.curveManager['colorPalette'].length;

      const affectedCurveId = this.history.executeCommand(new AddCurveCommand(newCurve));
      this.stateManager.syncStateFromHistory(affectedCurveId);
      this.callbacks.onRender();
    });

    deleteCurveBtn?.addEventListener('click', () => {
      const activeCurve = this.curveManager.getActiveCurve();
      if (activeCurve) {
        const curves = this.curveManager.getAllCurves();
        const index = curves.findIndex(c => c.id === activeCurve.id);
        if (index !== -1) {
          const affectedCurveId = this.history.executeCommand(
            new RemoveCurveCommand(activeCurve, index)
          );
          this.stateManager.syncStateFromHistory(affectedCurveId);
          this.callbacks.onRender();
        }
      }
    });

    animateBtn?.addEventListener('click', () => {
      const curves = this.curveManager.getAllCurves();
      const hasValidCurve = curves.some(c => c.points.length >= 2);

      if (hasValidCurve) {
        this.animation.toggle();
        if (animateBtn) {
          animateBtn.textContent = this.animation.isAnimating() ? 'Stop' : 'Animate';
        }
      }
    });

    visualizationSelect?.addEventListener('change', () => {
      const mode = visualizationSelect.value as VisualizationMode;
      this.callbacks.onVisualizationModeChange(mode);

      if (mode === 'tslider') {
        speedContainer!.style.display = 'none';
        tSliderContainer!.style.display = 'flex';
        this.animation.stop();
        if (animateBtn) {
          animateBtn.textContent = 'Animate';
          animateBtn.disabled = true;
        }
      } else {
        speedContainer!.style.display = 'flex';
        tSliderContainer!.style.display = 'none';
        if (animateBtn) {
          animateBtn.disabled = false;
        }
      }
    });

    tSlider?.addEventListener('input', () => {
      const value = parseInt(tSlider.value) / 100;
      this.callbacks.onManualTChange(value);
      if (tValue) {
        tValue.textContent = value.toFixed(2);
      }
    });

    speedSlider?.addEventListener('input', () => {
      const speed = parseInt(speedSlider.value) * 0.001;
      this.animation.setSpeed(speed);
    });

    saveBtn?.addEventListener('click', () => {
      this.fileManager.saveToJSON();
    });

    loadBtn?.addEventListener('click', () => {
      this.fileManager.loadFromJSON();
    });

    exportBtn?.addEventListener('click', () => {
      this.fileManager.exportToSVG();
    });
  }

  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        this.stateManager.undo();
        this.updateButtonStates();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        this.stateManager.redo();
        this.updateButtonStates();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'ArrowRight') {
        e.preventDefault();
        const affectedCurveId = this.history.jumpToNextIntersectionOrEnd();
        this.stateManager.syncStateFromHistory(affectedCurveId);
        this.callbacks.onRender();
        this.updateButtonStates();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        const affectedCurveId = this.history.jumpToPreviousIntersectionOrStart();
        this.stateManager.syncStateFromHistory(affectedCurveId);
        this.callbacks.onRender();
        this.updateButtonStates();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.history.isAtIntersection()) {
          this.history.switchToNextBranch();
          this.showBranchSwitchNotification();
        } else {
          this.notificationManager.showNotification(
            'Command failed - not at an intersection',
            'error'
          );
        }
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.history.isAtIntersection()) {
          this.history.switchToPreviousBranch();
          this.showBranchSwitchNotification();
        } else {
          this.notificationManager.showNotification(
            'Command failed - not at an intersection',
            'error'
          );
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.callbacks.onClearAnimationArtifacts();
      }
    });
  }

  private showBranchSwitchNotification(): void {
    const info = this.history.getIntersectionInfo();
    if (!info) return;

    this.notificationManager.showBranchSwitchNotification(
      info.currentBranch,
      info.totalBranches,
      info.description
    );
  }
}
