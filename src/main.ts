import { Renderer } from './renderer';
import { InteractionManager } from './interaction';
import { AnimationManager } from './animation';
import { HistoryManager } from './history';
import { VisualizationMode, Point, User } from './types';
import { CurveManager } from './managers/CurveManager';

import { FileManager } from './managers/FileManager';
import { NotificationManager } from './managers/NotificationManager';
import { StateManager } from './managers/StateManager';
import { DropdownManager } from './managers/DropdownManager';
import { UIControlManager } from './managers/UIControlManager';
import { CollaborationManager } from './collaboration/CollaborationManager';
import { PresenceRenderer } from './collaboration/PresenceRenderer';
import { CollaborationUIManager } from './managers/CollaborationUIManager';

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

  // Collaboration
  private collaborationManager: CollaborationManager;
  private collaborationUIManager: CollaborationUIManager;
  private presenceRenderer: PresenceRenderer;
  private remoteUsers: User[] = [];

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

    // Initialize Collaboration
    const WS_SERVER_URL =
      (import.meta as unknown as { env: { VITE_WS_SERVER_URL?: string } }).env
        ?.VITE_WS_SERVER_URL || 'ws://localhost:8080';
    this.collaborationManager = new CollaborationManager(
      WS_SERVER_URL,
      this.curveManager.getAllCurves(),
      {
        onRemoteChange: curves => {
          this.stateManager.applyRemoteChanges(curves);
        },
        onUsersUpdate: users => {
          const myId = this.collaborationManager.getUserId();
          this.remoteUsers = users.filter(u => u.id !== myId);
          if (this.collaborationUIManager) {
            // Pass all users but indicate which is the local user
            this.collaborationUIManager.updateUsers(users, myId);
          }
          this.render();
        },
        onConnectionStatusChange: connected => {
          this.notificationManager.showNotification(
            connected ? 'Connected to collaboration' : 'Disconnected',
            connected ? 'success' : 'error'
          );
        },
        onHistoryChange: history => {
          console.log('[Main] Shared history changed, reconstructing state from history');
          // TODO: Implement state reconstruction from shared history
          // For now, just log it
          console.log('[Main] Current node:', history.currentNodeId);
          console.log('[Main] Total nodes:', Object.keys(history.nodes).length);
        },
      }
    );

    // Initialize collaboration UI manager
    this.collaborationUIManager = new CollaborationUIManager(
      this.collaborationManager,
      this.curveManager
    );

    // Wire collaboration callbacks
    this.history.setCollaborationCallback((command, state) => {
      this.collaborationManager.onLocalCommand(command, state);
    });
    this.stateManager.setCollaborationManager(this.collaborationManager);

    // Initialize presence renderer
    this.presenceRenderer = new PresenceRenderer(this.canvas);

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

    // Render remote user presence if collaboration enabled
    if (this.collaborationManager.isEnabled()) {
      this.presenceRenderer.render(this.remoteUsers, allCurves);
    }

    this.uiControlManager.updateButtonStates();
  }
}

new BezierApp();
