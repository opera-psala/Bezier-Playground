import { describe, it, expect, beforeEach } from 'vitest';
import {
  HistoryManager,
  AddPointCommand,
  RemovePointCommand,
  MovePointCommand,
  AddCurveCommand,
  RemoveCurveCommand,
} from '../src/history';
import { BezierCurve, Point } from '../src/types';

const createMockCurve = (id: string, color: string, points: Point[] = []): BezierCurve => ({
  id,
  color,
  points: points.map(p => ({ ...p })),
});

describe('HistoryManager', () => {
  let history: HistoryManager;
  let initialState: { curves: BezierCurve[] };

  beforeEach(() => {
    initialState = {
      curves: [createMockCurve('curve1', '#4a9eff', [])],
    };
    history = new HistoryManager(initialState);
  });

  describe('initialization', () => {
    it('should start with root node', () => {
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
    });

    it('should preserve initial state', () => {
      const state = history.getState();
      expect(state.curves).toHaveLength(1);
      expect(state.curves[0].id).toBe('curve1');
    });
  });

  describe('AddPointCommand', () => {
    it('should add point to curve', () => {
      const point: Point = { x: 10, y: 20 };
      const cmd = new AddPointCommand('curve1', point);

      history.executeCommand(cmd);

      expect(initialState.curves[0].points).toHaveLength(1);
      expect(initialState.curves[0].points[0]).toEqual(point);
      expect(history.canUndo()).toBe(true);
    });

    it('should undo point addition', () => {
      const cmd = new AddPointCommand('curve1', { x: 10, y: 20 });
      history.executeCommand(cmd);
      history.undo();

      expect(initialState.curves[0].points).toHaveLength(0);
      expect(history.canUndo()).toBe(false);
    });

    it('should return affected curve ID', () => {
      const cmd = new AddPointCommand('curve1', { x: 10, y: 20 });
      const affectedId = history.executeCommand(cmd);

      expect(affectedId).toBe('curve1');
    });

    it('should generate proper description', () => {
      const cmd = new AddPointCommand('curve1', { x: 10, y: 20 });
      history.executeCommand(cmd);

      // Create branches by undoing and adding alternate command
      history.executeCommand(new AddPointCommand('curve1', { x: 30, y: 40 }));
      history.undo();
      history.executeCommand(new AddPointCommand('curve1', { x: 50, y: 60 }));

      const branchList = history.getBranches();
      const hasBlueDescription = branchList.some(b => b.description.includes('blue'));
      expect(hasBlueDescription).toBe(true);
    });
  });

  describe('RemovePointCommand', () => {
    it('should remove point from curve', () => {
      const point: Point = { x: 10, y: 20 };
      initialState.curves[0].points = [point, { x: 30, y: 40 }];

      const cmd = new RemovePointCommand('curve1', 0, point);
      history.executeCommand(cmd);

      expect(initialState.curves[0].points).toHaveLength(1);
      expect(initialState.curves[0].points[0]).toEqual({ x: 30, y: 40 });
    });

    it('should undo point removal', () => {
      const point: Point = { x: 10, y: 20 };
      initialState.curves[0].points = [point, { x: 30, y: 40 }];

      const cmd = new RemovePointCommand('curve1', 0, point);
      history.executeCommand(cmd);
      history.undo();

      expect(initialState.curves[0].points).toHaveLength(2);
      expect(initialState.curves[0].points[0]).toEqual(point);
    });
  });

  describe('MovePointCommand', () => {
    it('should move point in curve', () => {
      const oldPoint: Point = { x: 10, y: 20 };
      const newPoint: Point = { x: 15, y: 25 };
      initialState.curves[0].points = [oldPoint];

      const cmd = new MovePointCommand('curve1', 0, oldPoint, newPoint);
      history.executeCommand(cmd);

      expect(initialState.curves[0].points[0]).toEqual(newPoint);
    });

    it('should undo point movement', () => {
      const oldPoint: Point = { x: 10, y: 20 };
      const newPoint: Point = { x: 15, y: 25 };
      initialState.curves[0].points = [oldPoint];

      const cmd = new MovePointCommand('curve1', 0, oldPoint, newPoint);
      history.executeCommand(cmd);
      history.undo();

      expect(initialState.curves[0].points[0]).toEqual(oldPoint);
    });
  });

  describe('AddCurveCommand', () => {
    it('should add new curve', () => {
      const newCurve = createMockCurve('curve2', '#ff4a9e', []);
      const cmd = new AddCurveCommand(newCurve);

      history.executeCommand(cmd);

      expect(initialState.curves).toHaveLength(2);
      expect(initialState.curves[1].id).toBe('curve2');
      expect(initialState.curves[1].color).toBe('#ff4a9e');
    });

    it('should undo curve addition', () => {
      const newCurve = createMockCurve('curve2', '#ff4a9e', []);
      const cmd = new AddCurveCommand(newCurve);

      history.executeCommand(cmd);
      history.undo();

      expect(initialState.curves).toHaveLength(1);
      expect(initialState.curves[0].id).toBe('curve1');
    });
  });

  describe('RemoveCurveCommand', () => {
    it('should remove curve', () => {
      const curve2 = createMockCurve('curve2', '#ff4a9e', [{ x: 10, y: 20 }]);
      initialState.curves.push(curve2);

      const cmd = new RemoveCurveCommand(curve2, 1);
      history.executeCommand(cmd);

      expect(initialState.curves).toHaveLength(1);
      expect(initialState.curves[0].id).toBe('curve1');
    });

    it('should undo curve removal', () => {
      const curve2 = createMockCurve('curve2', '#ff4a9e', [{ x: 10, y: 20 }]);
      initialState.curves.push(curve2);

      const cmd = new RemoveCurveCommand(curve2, 1);
      history.executeCommand(cmd);
      history.undo();

      expect(initialState.curves).toHaveLength(2);
      expect(initialState.curves[1].id).toBe('curve2');
      expect(initialState.curves[1].points).toHaveLength(1);
    });

    it('should preserve curve data with deep copy', () => {
      const curve2 = createMockCurve('curve2', '#ff4a9e', [{ x: 10, y: 20 }]);
      initialState.curves.push(curve2);

      // Modify the curve after creating command
      const cmd = new RemoveCurveCommand(curve2, 1);
      curve2.points.push({ x: 30, y: 40 });

      history.executeCommand(cmd);
      history.undo();

      // Should restore original state, not modified state
      expect(initialState.curves[1].points).toHaveLength(1);
    });
  });

  describe('undo and redo', () => {
    it('should undo and redo multiple commands', () => {
      history.executeCommand(new AddPointCommand('curve1', { x: 10, y: 20 }));
      history.executeCommand(new AddPointCommand('curve1', { x: 30, y: 40 }));
      history.executeCommand(new AddPointCommand('curve1', { x: 50, y: 60 }));

      expect(initialState.curves[0].points).toHaveLength(3);

      history.undo();
      expect(initialState.curves[0].points).toHaveLength(2);

      history.undo();
      expect(initialState.curves[0].points).toHaveLength(1);

      history.redo();
      expect(initialState.curves[0].points).toHaveLength(2);

      history.redo();
      expect(initialState.curves[0].points).toHaveLength(3);
    });

    it('should return null when undo not possible', () => {
      const result = history.undo();
      expect(result).toBeNull();
    });

    it('should return null when redo not possible', () => {
      const result = history.redo();
      expect(result).toBeNull();
    });

    it('should return affected curve ID on undo', () => {
      history.executeCommand(new AddPointCommand('curve1', { x: 10, y: 20 }));
      const affectedId = history.undo();

      expect(affectedId).toBeNull(); // Root node has no command
    });

    it('should return affected curve ID on redo', () => {
      history.executeCommand(new AddPointCommand('curve1', { x: 10, y: 20 }));
      history.undo();
      const affectedId = history.redo();

      expect(affectedId).toBe('curve1');
    });
  });

  describe('branching history', () => {
    it('should create branch when executing after undo', () => {
      history.executeCommand(new AddPointCommand('curve1', { x: 10, y: 20 }));
      history.executeCommand(new AddPointCommand('curve1', { x: 30, y: 40 }));
      history.undo();

      // Create branch
      history.executeCommand(new AddPointCommand('curve1', { x: 50, y: 60 }));

      const branches = history.getBranches();
      expect(branches.length).toBeGreaterThan(0);
    });

    it('should track current branch', () => {
      history.executeCommand(new AddPointCommand('curve1', { x: 10, y: 20 }));
      history.undo();
      history.executeCommand(new AddPointCommand('curve1', { x: 30, y: 40 }));
      history.undo();
      history.executeCommand(new AddPointCommand('curve1', { x: 50, y: 60 }));

      const branches = history.getBranches();
      const currentBranch = branches.find(b => b.isCurrent);
      expect(currentBranch).toBeDefined();
    });

    it('should switch between branches', () => {
      // Create first command and continue to second
      history.executeCommand(new AddPointCommand('curve1', { x: 10, y: 20 }));
      history.executeCommand(new AddPointCommand('curve1', { x: 20, y: 30 }));

      // Go back one step and create alternate branch
      history.undo();
      history.executeCommand(new AddPointCommand('curve1', { x: 30, y: 40 }));

      // Verify we're on the alternate branch
      expect(initialState.curves[0].points).toHaveLength(2);
      expect(initialState.curves[0].points[1]).toEqual({ x: 30, y: 40 });

      // Get branches - should have 2 branches from the first point
      const branches = history.getBranches();
      expect(branches.length).toBeGreaterThanOrEqual(2);

      // Find the original branch (x: 20, y: 30)
      const originalBranch = branches.find(b => !b.isCurrent)?.node;

      if (originalBranch) {
        history.switchToBranch(originalBranch);
        expect(initialState.curves[0].points).toHaveLength(2);
        expect(initialState.curves[0].points[1]).toEqual({ x: 20, y: 30 });
      } else {
        throw new Error('Original branch not found');
      }
    });

    it('should handle complex branching scenarios', () => {
      // Create a complex tree:
      //       root
      //         |
      //       cmd1
      //       /   \
      //    cmd2a  cmd2b
      //      |
      //    cmd3

      history.executeCommand(new AddPointCommand('curve1', { x: 10, y: 20 })); // cmd1
      history.executeCommand(new AddPointCommand('curve1', { x: 20, y: 30 })); // cmd2a
      history.executeCommand(new AddPointCommand('curve1', { x: 30, y: 40 })); // cmd3

      history.undo(); // back to cmd2a
      history.undo(); // back to cmd1

      history.executeCommand(new AddPointCommand('curve1', { x: 50, y: 60 })); // cmd2b (branch)

      const branches = history.getBranches();
      expect(branches).toHaveLength(2); // cmd2a and cmd2b
    });
  });

  describe('jumping navigation', () => {
    beforeEach(() => {
      // Create a branching history
      history.executeCommand(new AddPointCommand('curve1', { x: 10, y: 20 }));
      history.executeCommand(new AddPointCommand('curve1', { x: 20, y: 30 }));
      history.undo();
      history.executeCommand(new AddPointCommand('curve1', { x: 30, y: 40 }));
      history.undo();
      history.undo(); // Back to root
    });

    it('should jump to next intersection', () => {
      expect(history.canJumpForward()).toBe(true);

      history.jumpToNextIntersectionOrEnd();

      expect(history.isAtIntersection()).toBe(true);
      expect(initialState.curves[0].points).toHaveLength(1);
    });

    it('should jump to previous intersection', () => {
      history.jumpToNextIntersectionOrEnd();
      history.redo(); // Go past the intersection

      expect(history.canJumpBackward()).toBe(true);

      history.jumpToPreviousIntersectionOrStart();

      expect(history.isAtIntersection()).toBe(true);
    });

    it('should jump to end if no intersection ahead', () => {
      // Start fresh without branching history
      const freshHistory = new HistoryManager({
        curves: [createMockCurve('curve1', '#4a9eff', [])],
      });
      const freshState = freshHistory.getState();

      // Create linear history (no branches)
      freshHistory.executeCommand(new AddPointCommand('curve1', { x: 100, y: 100 }));
      freshHistory.executeCommand(new AddPointCommand('curve1', { x: 200, y: 200 }));

      // Go back to start
      freshHistory.undo();
      freshHistory.undo();

      // Jump to end should go all the way
      freshHistory.jumpToNextIntersectionOrEnd();

      expect(freshHistory.canJumpForward()).toBe(false);
      expect(freshState.curves[0].points).toHaveLength(2);
    });

    it('should jump to start if no intersection behind', () => {
      history.executeCommand(new AddPointCommand('curve1', { x: 100, y: 100 }));

      history.jumpToPreviousIntersectionOrStart();

      expect(history.canJumpBackward()).toBe(false);
      expect(history.canUndo()).toBe(false);
    });
  });

  describe('intersection handling', () => {
    beforeEach(() => {
      history.executeCommand(new AddPointCommand('curve1', { x: 10, y: 20 }));
      history.undo();
      history.executeCommand(new AddPointCommand('curve1', { x: 30, y: 40 }));
      history.undo();
      history.executeCommand(new AddPointCommand('curve1', { x: 50, y: 60 }));
      history.undo(); // Back at intersection with 3 branches
    });

    it('should detect intersections', () => {
      expect(history.isAtIntersection()).toBe(true);
    });

    it('should switch to next branch', () => {
      const info1 = history.getIntersectionInfo();
      expect(info1?.currentBranch).toBe(1);

      history.switchToNextBranch();

      const info2 = history.getIntersectionInfo();
      expect(info2?.currentBranch).toBe(2);
    });

    it('should switch to previous branch', () => {
      history.switchToNextBranch(); // Move to branch 2

      const info1 = history.getIntersectionInfo();
      expect(info1?.currentBranch).toBe(2);

      history.switchToPreviousBranch();

      const info2 = history.getIntersectionInfo();
      expect(info2?.currentBranch).toBe(1);
    });

    it('should cycle through branches', () => {
      const info1 = history.getIntersectionInfo();
      const totalBranches = info1!.totalBranches;

      // Cycle through all branches
      for (let i = 0; i < totalBranches; i++) {
        history.switchToNextBranch();
      }

      const info2 = history.getIntersectionInfo();
      expect(info2?.currentBranch).toBe(1); // Back to first
    });

    it('should provide intersection info', () => {
      const info = history.getIntersectionInfo();

      expect(info).not.toBeNull();
      expect(info?.currentBranch).toBeGreaterThan(0);
      expect(info?.totalBranches).toBeGreaterThan(1);
      expect(info?.description).toBeTruthy();
    });

    it('should return null info when not at intersection', () => {
      history.redo(); // Move past intersection

      const info = history.getIntersectionInfo();
      expect(info).toBeNull();
    });

    it('should use selected branch when redoing from intersection', () => {
      history.switchToNextBranch(); // Select branch 2
      history.switchToNextBranch(); // Select branch 3

      history.redo();

      // Should have taken branch 3
      expect(initialState.curves[0].points[0]).toEqual({ x: 50, y: 60 });
    });
  });

  describe('clear', () => {
    it('should clear all history', () => {
      history.executeCommand(new AddPointCommand('curve1', { x: 10, y: 20 }));
      history.executeCommand(new AddPointCommand('curve1', { x: 30, y: 40 }));

      history.clear();

      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
      expect(initialState.curves[0].points).toHaveLength(0);
    });

    it('should undo all commands back to root', () => {
      // Start with an initial point via command
      history.executeCommand(new AddPointCommand('curve1', { x: 10, y: 20 }));
      history.executeCommand(new AddPointCommand('curve1', { x: 30, y: 40 }));
      history.executeCommand(new AddPointCommand('curve1', { x: 50, y: 60 }));

      expect(initialState.curves[0].points).toHaveLength(3);

      history.clear();

      // Should be back to initial empty state
      expect(initialState.curves[0].points).toHaveLength(0);
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
    });
  });

  describe('color name mapping', () => {
    it('should generate correct descriptions for all colors', () => {
      const colors = [
        { hex: '#4a9eff', name: 'blue' },
        { hex: '#ff4a9e', name: 'pink' },
        { hex: '#4aff9e', name: 'green' },
        { hex: '#ff9e4a', name: 'orange' },
        { hex: '#9e4aff', name: 'purple' },
        { hex: '#4afff9', name: 'cyan' },
      ];

      colors.forEach(color => {
        // Create fresh history for each color test
        const testCurve = createMockCurve('test', color.hex, []);
        const testState = { curves: [testCurve] };
        const testHistory = new HistoryManager(testState);

        // Execute a command, creating a description with the color name
        const cmd = new AddPointCommand('test', { x: 10, y: 20 });
        testHistory.executeCommand(cmd);

        // Go back and create a branch
        testHistory.undo();
        testHistory.executeCommand(new AddPointCommand('test', { x: 30, y: 40 }));

        // Check branches contain color name in descriptions
        const branches = testHistory.getBranches();
        const hasColorName = branches.some(b => b.description.toLowerCase().includes(color.name));
        expect(hasColorName).toBe(true);
      });
    });
  });
});
