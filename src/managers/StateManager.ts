import { CurveManager } from './CurveManager';
import { InteractionManager, PointAction } from '../interaction';
import {
  HistoryManager,
  AddPointCommand,
  RemovePointCommand,
  MovePointCommand,
  RemoteStateUpdateCommand,
} from '../history';
import { BezierCurve } from '../types';
import type { CollaborationManager } from '../collaboration/CollaborationManager';

export interface StateManagerCallbacks {
  onRender: () => void;
  onUpdateCurveSelector: () => void;
}

export class StateManager {
  private collaborationManager?: CollaborationManager;

  constructor(
    private curveManager: CurveManager,
    private interaction: InteractionManager,
    private history: HistoryManager,
    private callbacks: StateManagerCallbacks
  ) {}

  setCollaborationManager(manager: CollaborationManager): void {
    this.collaborationManager = manager;
  }

  applyRemoteChanges(curves: BezierCurve[]): void {
    console.log('[StateManager] Applying remote changes with', curves.length, 'curves');

    const command = new RemoteStateUpdateCommand(curves);
    this.history.executeRemoteCommand(command);

    // If there's no active curve but we have curves, set the first one as active
    const activeCurve = this.curveManager.getActiveCurve();
    if (!activeCurve && curves.length > 0) {
      console.log('[StateManager] No active curve, setting to first curve:', curves[0].id);
      this.syncStateFromHistory(curves[0].id);
    } else {
      this.syncStateFromHistory(null);
    }

    this.callbacks.onUpdateCurveSelector();
    this.callbacks.onRender();
  }

  syncCurveWithInteraction(action?: PointAction): void {
    const activeCurve = this.curveManager.getActiveCurve();
    if (!activeCurve || !action) {
      const points = this.interaction.getPoints();
      this.curveManager.setActiveCurvePoints(points);
      this.callbacks.onUpdateCurveSelector();
      return;
    }

    let affectedCurveId: string | null = null;

    switch (action.type) {
      case 'add':
        affectedCurveId = this.history.executeCommand(
          new AddPointCommand(activeCurve.id, action.point)
        );
        break;
      case 'remove':
        if (action.index !== undefined) {
          affectedCurveId = this.history.executeCommand(
            new RemovePointCommand(activeCurve.id, action.index, action.point)
          );
        }
        break;
      case 'move':
        if (action.index !== undefined && action.oldPoint) {
          affectedCurveId = this.history.executeCommand(
            new MovePointCommand(activeCurve.id, action.index, action.oldPoint, action.point)
          );
        }
        break;
    }

    this.syncStateFromHistory(affectedCurveId);

    // Update presence if collaboration is enabled
    if (this.collaborationManager && action) {
      const currentActiveCurve = this.curveManager.getActiveCurve();
      this.collaborationManager.updatePresence(action.point, currentActiveCurve?.id || null);
    }
  }

  syncStateFromHistory(affectedCurveId: string | null = null): void {
    if (affectedCurveId) {
      const curves = this.curveManager.getAllCurves();
      const curveExists = curves.some(c => c.id === affectedCurveId);

      if (curveExists) {
        this.curveManager.setActiveCurve(affectedCurveId);
      } else if (curves.length > 0) {
        this.curveManager.setActiveCurve(curves[0].id);
      }
    }
    this.interaction.setPoints(this.curveManager.getActiveCurvePoints());
    this.callbacks.onUpdateCurveSelector();
  }

  undo(): void {
    // Use shared undo if collaboration is enabled
    if (this.collaborationManager?.isEnabled() && this.collaborationManager?.isConnected()) {
      console.log('[StateManager] Using shared undo');
      const success = this.collaborationManager.undo();
      if (!success) {
        console.warn('[StateManager] Shared undo failed or not available');
      }
      // Note: state will be updated via onRemoteChange callback
      return;
    }

    // Local undo
    const affectedCurveId = this.history.undo();
    this.syncStateFromHistory(affectedCurveId);
    this.callbacks.onRender();
  }

  redo(): void {
    // Use shared redo if collaboration is enabled
    if (this.collaborationManager?.isEnabled() && this.collaborationManager?.isConnected()) {
      console.log('[StateManager] Using shared redo');
      const success = this.collaborationManager.redo();
      if (!success) {
        console.warn('[StateManager] Shared redo failed or not available');
      }
      // Note: state will be updated via onRemoteChange callback
      return;
    }

    // Local redo
    const affectedCurveId = this.history.redo();
    this.syncStateFromHistory(affectedCurveId);
    this.callbacks.onRender();
  }

  canUndo(): boolean {
    // Check collaboration manager first
    if (this.collaborationManager?.isEnabled() && this.collaborationManager?.isConnected()) {
      return this.collaborationManager.canUndo();
    }
    // Fall back to local history
    return this.history.canUndo();
  }

  canRedo(): boolean {
    // Check collaboration manager first
    if (this.collaborationManager?.isEnabled() && this.collaborationManager?.isConnected()) {
      return this.collaborationManager.canRedo();
    }
    // Fall back to local history
    return this.history.canRedo();
  }
}
