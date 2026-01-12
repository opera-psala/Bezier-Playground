import { CurveManager } from './CurveManager';
import { InteractionManager, PointAction } from '../interaction';
import { HistoryManager, AddPointCommand, RemovePointCommand, MovePointCommand } from '../history';

export interface StateManagerCallbacks {
  onRender: () => void;
  onUpdateCurveSelector: () => void;
}

export class StateManager {
  constructor(
    private curveManager: CurveManager,
    private interaction: InteractionManager,
    private history: HistoryManager,
    private callbacks: StateManagerCallbacks
  ) {}

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
    const affectedCurveId = this.history.undo();
    this.syncStateFromHistory(affectedCurveId);
    this.callbacks.onRender();
  }

  redo(): void {
    const affectedCurveId = this.history.redo();
    this.syncStateFromHistory(affectedCurveId);
    this.callbacks.onRender();
  }
}
