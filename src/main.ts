import { Renderer } from './renderer';
import { InteractionManager } from './interaction';
import { AnimationManager } from './animation';
import { CurveManager } from './curveManager';
import { exportToSVG } from './bezier';
import { VisualizationMode, Point } from './types';
import { validatePointsArray, validateCurvesData } from './fileUtils';

class BezierApp {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private interaction: InteractionManager;
  private animation: AnimationManager;
  private curveManager: CurveManager;
  private visualizationMode: VisualizationMode = 'default';
  private manualT = 0;

  constructor() {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!this.canvas) throw new Error('Canvas not found');

    this.renderer = new Renderer(this.canvas);
    this.curveManager = new CurveManager();
    this.animation = new AnimationManager(() => this.render());
    this.interaction = new InteractionManager(this.canvas, () => {
      this.syncCurveWithInteraction();
      this.render();
    });

    this.setupCurveSelection();
    this.setupControls();
    this.setupFileDropdown();
    this.setupDragAndDrop();
    this.setupResizeHandler();
    this.setupKeyboardShortcuts();
    this.render();
  }

  private setupDragAndDrop() {
    const dropOverlay = document.getElementById('drop-overlay');
    const appContainer = document.getElementById('app');

    if (!dropOverlay || !appContainer) return;

    let dragCounter = 0;

    appContainer.addEventListener('dragenter', e => {
      e.preventDefault();
      dragCounter++;
      dropOverlay.classList.add('active');
    });

    appContainer.addEventListener('dragleave', () => {
      dragCounter--;
      if (dragCounter === 0) {
        dropOverlay.classList.remove('active');
      }
    });

    appContainer.addEventListener('dragover', e => {
      e.preventDefault();
    });

    appContainer.addEventListener('drop', e => {
      e.preventDefault();
      dragCounter = 0;
      dropOverlay.classList.remove('active');

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file.name.endsWith('.json')) {
        alert('Please drop a JSON file');
        return;
      }

      this.loadJSONFromFile(file);
    });
  }

  private setupFileDropdown() {
    const dropdown = document.getElementById('file-dropdown');
    const dropdownButton = dropdown?.querySelector('.dropdown-button');

    dropdownButton?.addEventListener('click', e => {
      e.stopPropagation();
      dropdown?.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      dropdown?.classList.remove('open');
    });

    dropdown
      ?.querySelector('.dropdown-content')
      ?.addEventListener('click', e => {
        e.stopPropagation();
        dropdown.classList.remove('open');
      });
  }

  private setupCurveSelection() {
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

  private updateCurveSelector() {
    const dropdownMenu = document.getElementById('curve-dropdown-menu');
    const currentNameSpan = document.getElementById('curve-current-name');
    const currentDot = document.querySelector(
      '#curve-dropdown-button .curve-color-dot'
    ) as HTMLElement;

    if (!dropdownMenu || !currentNameSpan || !currentDot) return;

    const curves = this.curveManager.getAllCurves();
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
        this.interaction.setPoints(this.curveManager.getActiveCurvePoints());
        dropdownMenu.classList.remove('open');
        this.render();
      });

      dropdownMenu.appendChild(item);

      if (curve.id === activeCurve?.id) {
        currentNameSpan.textContent = `${displayName} (${pointCount} points)`;
        currentDot.style.backgroundColor = curve.color;
      }
    });
  }

  private syncCurveWithInteraction() {
    const points = this.interaction.getPoints();
    this.curveManager.setActiveCurvePoints(points);
    this.updateCurveSelector();
  }

  private setupControls() {
    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');
    const clearBtn = document.getElementById('clear');
    const newCurveBtn = document.getElementById('new-curve');
    const deleteCurveBtn = document.getElementById('delete-curve');
    const animateBtn = document.getElementById('animate');
    const visualizationSelect = document.getElementById(
      'visualization-mode'
    ) as HTMLSelectElement;
    const speedContainer = document.getElementById('speed-container');
    const tSliderContainer = document.getElementById('t-slider-container');
    const tSlider = document.getElementById('t-slider') as HTMLInputElement;
    const tValue = document.getElementById('t-value');
    const speedSlider = document.getElementById('speed') as HTMLInputElement;
    const saveBtn = document.getElementById('save');
    const loadBtn = document.getElementById('load');
    const exportBtn = document.getElementById('export');

    undoBtn?.addEventListener('click', () => {
      this.interaction.undo();
      this.updateButtonStates();
    });

    redoBtn?.addEventListener('click', () => {
      this.interaction.redo();
      this.updateButtonStates();
    });

    clearBtn?.addEventListener('click', () => {
      this.curveManager.clearAllCurves();
      this.interaction.setPoints([]);
      this.animation.stop();
      this.updateCurveSelector();
      this.updateButtonStates();
    });

    newCurveBtn?.addEventListener('click', () => {
      this.curveManager.addCurve();
      this.interaction.setPoints([]);
      this.updateCurveSelector();
      this.render();
    });

    deleteCurveBtn?.addEventListener('click', () => {
      const activeCurve = this.curveManager.getActiveCurve();
      if (activeCurve) {
        this.curveManager.removeCurve(activeCurve.id);
        this.interaction.setPoints(this.curveManager.getActiveCurvePoints());
        this.updateCurveSelector();
        this.render();
      }
    });

    animateBtn?.addEventListener('click', () => {
      const curves = this.curveManager.getAllCurves();
      const hasValidCurve = curves.some(c => c.points.length >= 2);

      if (hasValidCurve) {
        this.animation.toggle();
        if (animateBtn) {
          animateBtn.textContent = this.animation.isAnimating()
            ? 'Stop'
            : 'Animate';
        }
      }
    });

    visualizationSelect?.addEventListener('change', () => {
      this.visualizationMode = visualizationSelect.value as VisualizationMode;

      if (this.visualizationMode === 'tslider') {
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

      this.render();
    });

    tSlider?.addEventListener('input', () => {
      const value = parseInt(tSlider.value) / 100;
      this.manualT = value;
      if (tValue) {
        tValue.textContent = value.toFixed(2);
      }
      this.render();
    });

    speedSlider?.addEventListener('input', () => {
      const speed = parseInt(speedSlider.value) * 0.001;
      this.animation.setSpeed(speed);
    });

    saveBtn?.addEventListener('click', () => {
      this.saveToJSON();
    });

    loadBtn?.addEventListener('click', () => {
      this.loadFromJSON();
    });

    exportBtn?.addEventListener('click', () => {
      const points = this.interaction.getPoints();
      if (points.length >= 2) {
        const svg = exportToSVG(
          points,
          this.canvas.width,
          this.canvas.height
        );
        this.downloadSVG(svg);
      }
    });
  }

  private setupKeyboardShortcuts() {
    window.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        this.interaction.undo();
        this.updateButtonStates();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        this.interaction.redo();
        this.updateButtonStates();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.clearAnimationArtifacts();
      }
    });
  }

  private clearAnimationArtifacts() {
    if (this.animation.isAnimating()) {
      this.animation.stop();
      const animateBtn = document.getElementById('animate');
      if (animateBtn) {
        animateBtn.textContent = 'Animate';
      }
    }
    this.animation.resetProgress();
    this.render();
  }

  private updateButtonStates() {
    const undoBtn = document.getElementById('undo') as HTMLButtonElement;
    const redoBtn = document.getElementById('redo') as HTMLButtonElement;

    if (undoBtn) {
      undoBtn.disabled = !this.interaction.canUndo();
    }
    if (redoBtn) {
      redoBtn.disabled = !this.interaction.canRedo();
    }
  }

  private setupResizeHandler() {
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.render();
    });
  }

  private render() {
    const curves = this.curveManager.getAllCurves();
    const activeCurve = this.curveManager.getActiveCurve();

    let animatedPoints: Map<string, Point>;
    let animationProgress: number;

    if (this.visualizationMode === 'tslider') {
      animatedPoints = new Map();
      if (activeCurve && activeCurve.points.length >= 2) {
        const point = this.animation.getAnimatedPoint(
          activeCurve.points,
          this.manualT
        );
        if (point) {
          animatedPoints.set(activeCurve.id, point);
        }
      }
      animationProgress = this.manualT;
    } else {
      animatedPoints = this.animation.getAnimatedPoints(curves);
      animationProgress = this.animation.isAnimating()
        ? this.animation.getProgress()
        : 0;
    }

    this.renderer.renderMultipleCurves(
      curves,
      activeCurve?.id || null,
      animatedPoints,
      this.visualizationMode,
      animationProgress
    );
    this.updateButtonStates();
  }

  private downloadSVG(svgContent: string) {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bezier-curve.svg';
    link.click();
    URL.revokeObjectURL(url);
  }

  private saveToJSON() {
    const data = this.curveManager.toJSON();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bezier-curves.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  private loadFromJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      this.loadJSONFromFile(file);
    };
    input.click();
  }

  private loadJSONFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const json = event.target?.result as string;
        const data = JSON.parse(json);

        if (data.curves) {
          if (!validateCurvesData(data.curves)) {
            alert('Improperly structured JSON file: Invalid curves data');
            return;
          }
          this.curveManager.fromJSON(data);
        } else if (data.points) {
          if (!validatePointsArray(data.points)) {
            alert('Improperly structured JSON file: Invalid points data');
            return;
          }
          this.curveManager.clearAllCurves();
          this.curveManager.setActiveCurvePoints(data.points);
        } else {
          alert('Improperly structured JSON file: Missing curves or points');
          return;
        }

        this.interaction.setPoints(this.curveManager.getActiveCurvePoints());
        this.updateCurveSelector();
        this.render();
      } catch (error) {
        if (error instanceof SyntaxError) {
          alert('Invalid JSON file: Syntax error');
        } else {
          alert('Error loading file: ' + (error as Error).message);
        }
      }
    };
    reader.readAsText(file);
  }
}

new BezierApp();
