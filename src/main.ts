import { Renderer } from './renderer';
import { InteractionManager } from './interaction';
import { AnimationManager } from './animation';
import { HistoryManager } from './history';
import { VisualizationMode, Point } from './types';
import { CurveManager } from './managers/CurveManager';

import { FileManager } from './managers/FileManager';
import { NotificationManager } from './managers/NotificationManager';
import { StateManager } from './managers/StateManager';
import { DropdownManager } from './managers/DropdownManager';
import { UIControlManager } from './managers/UIControlManager';

class BezierApp {
  // Core managers
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private interaction: InteractionManager;
  private animation: AnimationManager;
  private curveManager: CurveManager;
  private history: HistoryManager;

  // New managers
  private fileManager: FileManager;
  private notificationManager: NotificationManager;
  private stateManager: StateManager;
  private dropdownManager: DropdownManager;
  private uiControlManager: UIControlManager;

  // App state
  private visualizationMode: VisualizationMode = 'default';
  private manualT = 0;

  constructor() {
    this.canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!this.canvas) throw new Error('Canvas not found');

    // Initialize core managers
    this.renderer = new Renderer(this.canvas);
    this.curveManager = new CurveManager();
    this.history = new HistoryManager({
      curves: this.curveManager.getAllCurves(),
    });
    this.animation = new AnimationManager(() => this.render());

    // Initialize NotificationManager (no dependencies)
    this.notificationManager = new NotificationManager();

    // Create a placeholder interaction manager first
    this.interaction = new InteractionManager(this.canvas, () => {});

    // Initialize StateManager (uses core managers)
    this.stateManager = new StateManager(this.curveManager, this.interaction, this.history, {
      onRender: () => this.render(),
      onUpdateCurveSelector: () => this.dropdownManager.updateCurveSelector(),
    });

    // Re-initialize InteractionManager with StateManager callback
    this.interaction = new InteractionManager(this.canvas, action => {
      this.stateManager.syncCurveWithInteraction(action);
      this.render();
    });

    // Initialize FileManager
    this.fileManager = new FileManager(
      this.curveManager,
      this.interaction,
      this.canvas,
      this.history,
      {
        onCurvesLoaded: () => {
          this.stateManager.syncStateFromHistory(null);
        },
        onRender: () => this.render(),
        onUpdateCurveSelector: () => this.dropdownManager.updateCurveSelector(),
      }
    );

    // Initialize DropdownManager (uses StateManager)
    this.dropdownManager = new DropdownManager(this.curveManager, this.history, this.stateManager, {
      onRender: () => this.render(),
      onUpdateButtonStates: () => this.uiControlManager.updateButtonStates(),
    });

    // Initialize UIControlManager (uses all managers)
    this.uiControlManager = new UIControlManager(
      this.curveManager,
      this.animation,
      this.history,
      this.stateManager,
      this.fileManager,
      this.notificationManager,
      {
        onRender: () => this.render(),
        onUpdateButtonStates: () => this.uiControlManager.updateButtonStates(),
        onClearAnimationArtifacts: () => this.clearAnimationArtifacts(),
        onVisualizationModeChange: mode => {
          this.visualizationMode = mode;
          this.render();
        },
        onManualTChange: t => {
          this.manualT = t;
          this.render();
        },
      }
    );

    this.setupResizeHandler();
    this.render();
  }

  private setupResizeHandler(): void {
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.render();
    });
  }

  private clearAnimationArtifacts(): void {
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

  private render(): void {
    const allCurves = this.curveManager.getAllCurves();
    const curves = allCurves.filter(c => c.points.length > 0);
    const activeCurve = this.curveManager.getActiveCurve();

    let animatedPoints: Map<string, Point>;
    let animationProgress: number;

    if (this.visualizationMode === 'tslider') {
      animatedPoints = new Map();
      if (activeCurve && activeCurve.points.length >= 2) {
        const point = this.animation.getAnimatedPoint(activeCurve.points, this.manualT);
        if (point) {
          animatedPoints.set(activeCurve.id, point);
        }
      }
      animationProgress = this.manualT;
    } else {
      animatedPoints = this.animation.getAnimatedPoints(curves);
      animationProgress = this.animation.isAnimating() ? this.animation.getProgress() : 0;
    }

    this.renderer.renderMultipleCurves(
      curves,
      activeCurve?.id || null,
      animatedPoints,
      this.visualizationMode,
      animationProgress
    );
    this.uiControlManager.updateButtonStates();
  }
}

new BezierApp();
