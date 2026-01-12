import { describe, it, expect, beforeEach } from 'vitest';
import { CurveManager } from '../../src/managers/CurveManager';
import { Point } from '../../src/types';

describe('CurveManager', () => {
  let curveManager: CurveManager;

  beforeEach(() => {
    curveManager = new CurveManager();
  });

  describe('initialization', () => {
    it('should create with one empty curve by default', () => {
      const curves = curveManager.getAllCurves();
      expect(curves).toHaveLength(1);
      expect(curves[0].points).toHaveLength(0);
    });

    it('should have an active curve set', () => {
      const activeCurve = curveManager.getActiveCurve();
      expect(activeCurve).not.toBeNull();
    });

    it('should assign first color from palette', () => {
      const activeCurve = curveManager.getActiveCurve();
      expect(activeCurve?.color).toBe('#4a9eff');
    });
  });

  describe('addCurve', () => {
    it('should add a new curve', () => {
      const initialCount = curveManager.getAllCurves().length;
      curveManager.addCurve();
      expect(curveManager.getAllCurves()).toHaveLength(initialCount + 1);
    });

    it('should set new curve as active', () => {
      const id = curveManager.addCurve();
      expect(curveManager.getActiveCurve()?.id).toBe(id);
    });

    it('should cycle through color palette', () => {
      const colors: string[] = [];
      for (let i = 0; i < 7; i++) {
        const id = curveManager.addCurve();
        const curve = curveManager.getAllCurves().find(c => c.id === id);
        colors.push(curve!.color);
      }
      // Should cycle back to first color after 6 colors
      expect(colors[0]).toBe(colors[6]);
    });

    it('should return unique IDs', () => {
      const id1 = curveManager.addCurve();
      const id2 = curveManager.addCurve();
      expect(id1).not.toBe(id2);
    });
  });

  describe('removeCurve', () => {
    it('should remove a curve by ID', () => {
      const id = curveManager.addCurve();
      const initialCount = curveManager.getAllCurves().length;
      curveManager.removeCurve(id);
      expect(curveManager.getAllCurves()).toHaveLength(initialCount - 1);
    });

    it('should set active curve to first curve if removed curve was active', () => {
      const id1 = curveManager.getAllCurves()[0].id;
      const id2 = curveManager.addCurve();
      curveManager.setActiveCurve(id2);
      curveManager.removeCurve(id2);
      expect(curveManager.getActiveCurve()?.id).toBe(id1);
    });

    it('should always maintain at least one curve', () => {
      const curves = curveManager.getAllCurves();
      curves.forEach(c => curveManager.removeCurve(c.id));
      expect(curveManager.getAllCurves()).toHaveLength(1);
    });

    it('should do nothing if curve ID not found', () => {
      const initialCount = curveManager.getAllCurves().length;
      curveManager.removeCurve('nonexistent-id');
      expect(curveManager.getAllCurves()).toHaveLength(initialCount);
    });
  });

  describe('setActiveCurve', () => {
    it('should set active curve by ID', () => {
      const id = curveManager.addCurve();
      curveManager.setActiveCurve(id);
      expect(curveManager.getActiveCurve()?.id).toBe(id);
    });

    it('should not change active curve if ID not found', () => {
      const currentActive = curveManager.getActiveCurve()?.id;
      curveManager.setActiveCurve('nonexistent-id');
      expect(curveManager.getActiveCurve()?.id).toBe(currentActive);
    });
  });

  describe('getActiveCurvePoints', () => {
    it('should return points of active curve', () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ];
      curveManager.setActiveCurvePoints(points);
      expect(curveManager.getActiveCurvePoints()).toEqual(points);
    });

    it('should return empty array if no active curve', () => {
      // Remove all curves (which creates a new one)
      const curves = curveManager.getAllCurves();
      curves.forEach(c => curveManager.removeCurve(c.id));
      // Manually set active to null
      curveManager['activeCurveId'] = null;
      expect(curveManager.getActiveCurvePoints()).toEqual([]);
    });
  });

  describe('setActiveCurvePoints', () => {
    it('should set points on active curve', () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ];
      curveManager.setActiveCurvePoints(points);
      const activeCurve = curveManager.getActiveCurve();
      expect(activeCurve?.points).toEqual(points);
    });

    it('should do nothing if no active curve', () => {
      curveManager['activeCurveId'] = null;
      const points: Point[] = [{ x: 10, y: 20 }];
      expect(() => curveManager.setActiveCurvePoints(points)).not.toThrow();
    });
  });

  describe('clearAllCurves', () => {
    it('should remove all curves and create a new one', () => {
      curveManager.addCurve();
      curveManager.addCurve();
      curveManager.clearAllCurves();
      expect(curveManager.getAllCurves()).toHaveLength(1);
      expect(curveManager.getAllCurves()[0].points).toHaveLength(0);
    });

    it('should set new curve as active', () => {
      curveManager.clearAllCurves();
      expect(curveManager.getActiveCurve()).not.toBeNull();
    });
  });

  describe('findCurveAtPosition', () => {
    it('should find curve near clicked position', () => {
      const points: Point[] = [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ];
      curveManager.setActiveCurvePoints(points);
      const curveId = curveManager.getActiveCurve()?.id;

      const found = curveManager.findCurveAtPosition({ x: 105, y: 105 }, 15);
      expect(found).toBe(curveId);
    });

    it('should return null if no curve near position', () => {
      const points: Point[] = [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ];
      curveManager.setActiveCurvePoints(points);

      const found = curveManager.findCurveAtPosition({ x: 500, y: 500 }, 15);
      expect(found).toBeNull();
    });

    it('should respect custom threshold', () => {
      const points: Point[] = [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ];
      curveManager.setActiveCurvePoints(points);
      const curveId = curveManager.getActiveCurve()?.id;

      // Far away point should not be found with small threshold
      const found1 = curveManager.findCurveAtPosition({ x: 500, y: 500 }, 5);
      expect(found1).toBeNull();

      // Close point should be found with large threshold
      const found2 = curveManager.findCurveAtPosition({ x: 105, y: 105 }, 50);
      expect(found2).toBe(curveId);
    });

    it('should skip curves with less than 2 points', () => {
      const singlePoint: Point[] = [{ x: 100, y: 100 }];
      curveManager.setActiveCurvePoints(singlePoint);

      const found = curveManager.findCurveAtPosition({ x: 100, y: 100 }, 15);
      expect(found).toBeNull();
    });
  });

  describe('toJSON and fromJSON', () => {
    it('should serialize curves to JSON', () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ];
      curveManager.setActiveCurvePoints(points);
      curveManager.addCurve();

      const json = curveManager.toJSON();
      expect(json.curves).toHaveLength(2);
      expect(json.curves[0].points).toEqual(points);
    });

    it('should restore curves from JSON', () => {
      const jsonData = {
        curves: [
          {
            id: 'test-id-1',
            color: '#4a9eff',
            points: [
              { x: 10, y: 20 },
              { x: 30, y: 40 },
            ],
          },
          {
            id: 'test-id-2',
            color: '#ff4a9e',
            points: [{ x: 50, y: 60 }],
          },
        ],
      };

      curveManager.fromJSON(jsonData);
      const curves = curveManager.getAllCurves();
      expect(curves).toHaveLength(2);
      expect(curves[0].id).toBe('test-id-1');
      expect(curves[0].points).toEqual(jsonData.curves[0].points);
      expect(curves[1].id).toBe('test-id-2');
    });

    it('should set first curve as active after restore', () => {
      const jsonData = {
        curves: [
          {
            id: 'test-id-1',
            color: '#4a9eff',
            points: [],
          },
        ],
      };

      curveManager.fromJSON(jsonData);
      expect(curveManager.getActiveCurve()?.id).toBe('test-id-1');
    });

    it('should handle invalid JSON gracefully', () => {
      const initialCurves = curveManager.getAllCurves();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      curveManager.fromJSON({} as any);
      expect(curveManager.getAllCurves()).toEqual(initialCurves);
    });

    it('should handle non-array curves in JSON', () => {
      const initialCurves = curveManager.getAllCurves();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      curveManager.fromJSON({ curves: 'not-an-array' } as any);
      expect(curveManager.getAllCurves()).toEqual(initialCurves);
    });
  });
});
