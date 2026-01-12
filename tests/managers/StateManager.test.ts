import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateManager } from '../../src/managers/StateManager';
import { CurveManager } from '../../src/managers/CurveManager';
import { InteractionManager } from '../../src/interaction';
import { HistoryManager } from '../../src/history';
import { Point } from '../../src/types';

// Mock canvas for InteractionManager
const createMockCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  return canvas;
};

describe('StateManager', () => {
  let stateManager: StateManager;
  let curveManager: CurveManager;
  let interaction: InteractionManager;
  let history: HistoryManager;
  let onRender: ReturnType<typeof vi.fn>;
  let onUpdateCurveSelector: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    curveManager = new CurveManager();
    const canvas = createMockCanvas();
    interaction = new InteractionManager(canvas, () => {});
    history = new HistoryManager(curveManager);
    onRender = vi.fn();
    onUpdateCurveSelector = vi.fn();

    stateManager = new StateManager(curveManager, interaction, history, {
      onRender,
      onUpdateCurveSelector,
    });
  });

  describe('syncCurveWithInteraction', () => {
    it('should sync points from interaction to curve when no action', () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ];
      interaction['points'] = points;

      stateManager.syncCurveWithInteraction();

      expect(curveManager.getActiveCurvePoints()).toEqual(points);
      expect(onUpdateCurveSelector).toHaveBeenCalled();
    });

    it('should execute add point command', () => {
      const point: Point = { x: 50, y: 60 };
      const activeCurve = curveManager.getActiveCurve()!;

      stateManager.syncCurveWithInteraction({
        type: 'add',
        point,
      });

      expect(activeCurve.points).toContainEqual(point);
      expect(history.canUndo()).toBe(true);
    });

    it('should execute remove point command', () => {
      const point1: Point = { x: 10, y: 20 };
      const point2: Point = { x: 30, y: 40 };
      curveManager.setActiveCurvePoints([point1, point2]);

      stateManager.syncCurveWithInteraction({
        type: 'remove',
        index: 0,
        point: point1,
      });

      const remainingPoints = curveManager.getActiveCurvePoints();
      expect(remainingPoints).toHaveLength(1);
      expect(remainingPoints[0]).toEqual(point2);
    });

    it('should execute move point command', () => {
      const oldPoint: Point = { x: 10, y: 20 };
      const newPoint: Point = { x: 15, y: 25 };
      curveManager.setActiveCurvePoints([oldPoint, { x: 30, y: 40 }]);

      stateManager.syncCurveWithInteraction({
        type: 'move',
        index: 0,
        oldPoint,
        point: newPoint,
      });

      const points = curveManager.getActiveCurvePoints();
      expect(points[0]).toEqual(newPoint);
    });

    it('should not execute remove command if index is undefined', () => {
      curveManager.setActiveCurvePoints([{ x: 10, y: 20 }]);
      const initialLength = curveManager.getActiveCurvePoints().length;

      stateManager.syncCurveWithInteraction({
        type: 'remove',
        point: { x: 10, y: 20 },
      });

      expect(curveManager.getActiveCurvePoints()).toHaveLength(initialLength);
    });

    it('should not execute move command if index or oldPoint is undefined', () => {
      const initialPoints = [{ x: 10, y: 20 }];
      curveManager.setActiveCurvePoints(initialPoints);

      stateManager.syncCurveWithInteraction({
        type: 'move',
        point: { x: 15, y: 25 },
      });

      expect(curveManager.getActiveCurvePoints()).toEqual(initialPoints);
    });
  });

  describe('syncStateFromHistory', () => {
    it('should sync points from curve to interaction', () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ];
      curveManager.setActiveCurvePoints(points);

      stateManager.syncStateFromHistory();

      expect(interaction.getPoints()).toEqual(points);
      expect(onUpdateCurveSelector).toHaveBeenCalled();
    });

    it('should set active curve if affectedCurveId exists', () => {
      const newCurveId = curveManager.addCurve();
      const points: Point[] = [{ x: 50, y: 60 }];
      curveManager.setActiveCurvePoints(points);

      stateManager.syncStateFromHistory(newCurveId);

      expect(curveManager.getActiveCurve()?.id).toBe(newCurveId);
    });

    it('should set first curve as active if affected curve does not exist', () => {
      const firstCurveId = curveManager.getAllCurves()[0].id;
      curveManager.addCurve();

      stateManager.syncStateFromHistory('nonexistent-id');

      expect(curveManager.getActiveCurve()?.id).toBe(firstCurveId);
    });

    it('should not change active curve if affectedCurveId is null', () => {
      const currentActive = curveManager.getActiveCurve()?.id;

      stateManager.syncStateFromHistory(null);

      expect(curveManager.getActiveCurve()?.id).toBe(currentActive);
    });
  });

  describe('undo', () => {
    it('should undo last action', () => {
      const point: Point = { x: 10, y: 20 };
      stateManager.syncCurveWithInteraction({ type: 'add', point });

      expect(curveManager.getActiveCurvePoints()).toHaveLength(1);

      stateManager.undo();

      expect(curveManager.getActiveCurvePoints()).toHaveLength(0);
      expect(onRender).toHaveBeenCalled();
    });

    it('should sync state after undo', () => {
      const point: Point = { x: 10, y: 20 };
      stateManager.syncCurveWithInteraction({ type: 'add', point });

      stateManager.undo();

      expect(interaction.getPoints()).toEqual(curveManager.getActiveCurvePoints());
    });

    it('should do nothing if nothing to undo', () => {
      const initialPoints = curveManager.getActiveCurvePoints();
      onRender.mockClear();

      stateManager.undo();

      expect(curveManager.getActiveCurvePoints()).toEqual(initialPoints);
      expect(onRender).toHaveBeenCalled(); // Still called even if no change
    });
  });

  describe('redo', () => {
    it('should redo undone action', () => {
      const point: Point = { x: 10, y: 20 };
      stateManager.syncCurveWithInteraction({ type: 'add', point });
      stateManager.undo();

      expect(curveManager.getActiveCurvePoints()).toHaveLength(0);

      stateManager.redo();

      expect(curveManager.getActiveCurvePoints()).toHaveLength(1);
      expect(curveManager.getActiveCurvePoints()[0]).toEqual(point);
      expect(onRender).toHaveBeenCalled();
    });

    it('should sync state after redo', () => {
      const point: Point = { x: 10, y: 20 };
      stateManager.syncCurveWithInteraction({ type: 'add', point });
      stateManager.undo();
      stateManager.redo();

      expect(interaction.getPoints()).toEqual(curveManager.getActiveCurvePoints());
    });

    it('should do nothing if nothing to redo', () => {
      const initialPoints = curveManager.getActiveCurvePoints();
      onRender.mockClear();

      stateManager.redo();

      expect(curveManager.getActiveCurvePoints()).toEqual(initialPoints);
      expect(onRender).toHaveBeenCalled();
    });
  });

  describe('integration with history', () => {
    it('should maintain history across multiple operations', () => {
      const p1: Point = { x: 10, y: 20 };
      const p2: Point = { x: 30, y: 40 };
      const p3: Point = { x: 50, y: 60 };

      stateManager.syncCurveWithInteraction({ type: 'add', point: p1 });
      stateManager.syncCurveWithInteraction({ type: 'add', point: p2 });
      stateManager.syncCurveWithInteraction({ type: 'add', point: p3 });

      expect(curveManager.getActiveCurvePoints()).toHaveLength(3);

      stateManager.undo();
      expect(curveManager.getActiveCurvePoints()).toHaveLength(2);

      stateManager.undo();
      expect(curveManager.getActiveCurvePoints()).toHaveLength(1);

      stateManager.redo();
      expect(curveManager.getActiveCurvePoints()).toHaveLength(2);
    });

    it('should handle curve switching in history', () => {
      const p1: Point = { x: 10, y: 20 };
      stateManager.syncCurveWithInteraction({ type: 'add', point: p1 });

      const curve2Id = curveManager.addCurve();
      curveManager.setActiveCurve(curve2Id);
      const p2: Point = { x: 30, y: 40 };
      stateManager.syncCurveWithInteraction({ type: 'add', point: p2 });

      // After undo on curve 2, should still be on curve 2
      stateManager.undo();
      const curve2 = curveManager.getAllCurves().find(c => c.id === curve2Id);
      expect(curve2?.points).toHaveLength(0);
    });
  });
});
