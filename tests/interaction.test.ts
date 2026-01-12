import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractionManager } from '../src/interaction';
import { Point } from '../src/types';

const createMockCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  // Mock getBoundingClientRect
  canvas.getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }));
  return canvas;
};

const createMouseEvent = (type: string, x: number, y: number, button = 0): MouseEvent => {
  return new MouseEvent(type, {
    clientX: x,
    clientY: y,
    button,
    bubbles: true,
    cancelable: true,
  });
};

describe('InteractionManager', () => {
  let canvas: HTMLCanvasElement;
  let interaction: InteractionManager;
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    canvas = createMockCanvas();
    onUpdate = vi.fn();
    interaction = new InteractionManager(canvas, onUpdate);
  });

  describe('initialization', () => {
    it('should start with empty points array', () => {
      expect(interaction.getPoints()).toEqual([]);
    });

    it('should set up event listeners on canvas', () => {
      const addEventListenerSpy = vi.spyOn(canvas, 'addEventListener');
      const newInteraction = new InteractionManager(canvas, onUpdate);

      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));

      newInteraction.destroy();
    });
  });

  describe('getPoints and setPoints', () => {
    it('should return points', () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ];
      interaction.setPoints(points);
      expect(interaction.getPoints()).toEqual(points);
    });

    it('should update points', () => {
      interaction.setPoints([{ x: 10, y: 20 }]);
      expect(interaction.getPoints()).toHaveLength(1);

      interaction.setPoints([
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);
      expect(interaction.getPoints()).toHaveLength(2);
    });
  });

  describe('mouse interactions - adding points', () => {
    it('should add point on mousedown in empty area', () => {
      canvas.dispatchEvent(createMouseEvent('mousedown', 100, 200));

      expect(onUpdate).toHaveBeenCalledWith({
        type: 'add',
        point: { x: 100, y: 200 },
      });
    });

    it('should add multiple points', () => {
      canvas.dispatchEvent(createMouseEvent('mousedown', 50, 50));
      canvas.dispatchEvent(createMouseEvent('mousedown', 150, 150));

      expect(onUpdate).toHaveBeenCalledTimes(2);
      expect(onUpdate).toHaveBeenNthCalledWith(1, {
        type: 'add',
        point: { x: 50, y: 50 },
      });
      expect(onUpdate).toHaveBeenNthCalledWith(2, {
        type: 'add',
        point: { x: 150, y: 150 },
      });
    });

    it('should respect canvas offset from getBoundingClientRect', () => {
      canvas.getBoundingClientRect = vi.fn(() => ({
        left: 100,
        top: 50,
        right: 900,
        bottom: 650,
        width: 800,
        height: 600,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      }));

      // Client coords at 150, 100 with offset 100, 50 = canvas coords 50, 50
      canvas.dispatchEvent(createMouseEvent('mousedown', 150, 100));

      expect(onUpdate).toHaveBeenCalledWith({
        type: 'add',
        point: { x: 50, y: 50 },
      });
    });
  });

  describe('mouse interactions - dragging points', () => {
    it('should start dragging when mousedown on existing point', () => {
      interaction.setPoints([{ x: 100, y: 100 }]);
      onUpdate.mockClear();

      canvas.dispatchEvent(createMouseEvent('mousedown', 100, 100));

      // Should not add a new point
      expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'add' }));
    });

    it('should update point position during drag', () => {
      interaction.setPoints([{ x: 100, y: 100 }]);
      onUpdate.mockClear();

      // Start drag
      canvas.dispatchEvent(createMouseEvent('mousedown', 100, 100));

      // Move mouse
      canvas.dispatchEvent(createMouseEvent('mousemove', 150, 150));

      expect(onUpdate).toHaveBeenCalled();
      expect(interaction.getPoints()[0]).toEqual({ x: 150, y: 150 });
    });

    it('should emit move action on mouseup after drag', () => {
      interaction.setPoints([{ x: 100, y: 100 }]);
      onUpdate.mockClear();

      // Start drag
      canvas.dispatchEvent(createMouseEvent('mousedown', 100, 100));

      // Move to new position
      canvas.dispatchEvent(createMouseEvent('mousemove', 150, 150));
      onUpdate.mockClear();

      // Release
      canvas.dispatchEvent(createMouseEvent('mouseup', 150, 150));

      expect(onUpdate).toHaveBeenCalledWith({
        type: 'move',
        point: { x: 150, y: 150 },
        index: 0,
        oldPoint: { x: 100, y: 100 },
      });
    });

    it('should not emit move action if point didnt move', () => {
      interaction.setPoints([{ x: 100, y: 100 }]);
      onUpdate.mockClear();

      // Start drag
      canvas.dispatchEvent(createMouseEvent('mousedown', 100, 100));

      // Release without moving
      canvas.dispatchEvent(createMouseEvent('mouseup', 100, 100));

      expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'move' }));
    });

    it('should stop dragging after mouseup', () => {
      interaction.setPoints([{ x: 100, y: 100 }]);
      onUpdate.mockClear();

      // Start and complete drag
      canvas.dispatchEvent(createMouseEvent('mousedown', 100, 100));
      canvas.dispatchEvent(createMouseEvent('mousemove', 150, 150));
      canvas.dispatchEvent(createMouseEvent('mouseup', 150, 150));

      onUpdate.mockClear();

      // Move again after release - should not update
      canvas.dispatchEvent(createMouseEvent('mousemove', 200, 200));

      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('should use threshold to find nearby points', () => {
      interaction.setPoints([{ x: 100, y: 100 }]);
      onUpdate.mockClear();

      // Click 9 pixels away (within default threshold of 10)
      canvas.dispatchEvent(createMouseEvent('mousedown', 109, 100));

      // Should start dragging, not add new point
      expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'add' }));
    });

    it('should not find point outside threshold', () => {
      interaction.setPoints([{ x: 100, y: 100 }]);
      onUpdate.mockClear();

      // Click 11 pixels away (outside default threshold of 10)
      canvas.dispatchEvent(createMouseEvent('mousedown', 111, 100));

      // Should add new point, not drag
      expect(onUpdate).toHaveBeenCalledWith({
        type: 'add',
        point: { x: 111, y: 100 },
      });
    });
  });

  describe('mouse interactions - removing points', () => {
    it('should remove point on right click', () => {
      interaction.setPoints([
        { x: 50, y: 50 },
        { x: 150, y: 150 },
      ]);
      onUpdate.mockClear();

      // Right click on first point
      const rightClick = createMouseEvent('contextmenu', 50, 50, 2);
      canvas.dispatchEvent(rightClick);

      expect(onUpdate).toHaveBeenCalledWith({
        type: 'remove',
        point: { x: 50, y: 50 },
        index: 0,
      });
    });

    it('should prevent default context menu', () => {
      const rightClick = createMouseEvent('contextmenu', 100, 100, 2);
      const preventDefaultSpy = vi.spyOn(rightClick, 'preventDefault');

      canvas.dispatchEvent(rightClick);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not remove if right click in empty area', () => {
      interaction.setPoints([{ x: 50, y: 50 }]);
      onUpdate.mockClear();

      // Right click far away
      canvas.dispatchEvent(createMouseEvent('contextmenu', 200, 200, 2));

      expect(onUpdate).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'remove' }));
    });

    it('should remove correct point when multiple points exist', () => {
      interaction.setPoints([
        { x: 50, y: 50 },
        { x: 150, y: 150 },
        { x: 250, y: 250 },
      ]);
      onUpdate.mockClear();

      // Right click on middle point
      canvas.dispatchEvent(createMouseEvent('contextmenu', 150, 150, 2));

      expect(onUpdate).toHaveBeenCalledWith({
        type: 'remove',
        point: { x: 150, y: 150 },
        index: 1,
      });
    });
  });

  describe('destroy', () => {
    it('should remove event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(canvas, 'removeEventListener');

      interaction.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function));
    });

    it('should not respond to events after destroy', () => {
      interaction.destroy();
      onUpdate.mockClear();

      canvas.dispatchEvent(createMouseEvent('mousedown', 100, 100));

      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('complex interactions', () => {
    it('should handle rapid clicks', () => {
      canvas.dispatchEvent(createMouseEvent('mousedown', 10, 10));
      canvas.dispatchEvent(createMouseEvent('mousedown', 20, 20));
      canvas.dispatchEvent(createMouseEvent('mousedown', 30, 30));

      expect(onUpdate).toHaveBeenCalledTimes(3);
    });

    it('should handle drag then add', () => {
      interaction.setPoints([{ x: 100, y: 100 }]);
      onUpdate.mockClear();

      // Drag existing point
      canvas.dispatchEvent(createMouseEvent('mousedown', 100, 100));
      canvas.dispatchEvent(createMouseEvent('mousemove', 150, 150));
      canvas.dispatchEvent(createMouseEvent('mouseup', 150, 150));

      onUpdate.mockClear();

      // Add new point
      canvas.dispatchEvent(createMouseEvent('mousedown', 300, 300));

      expect(onUpdate).toHaveBeenCalledWith({
        type: 'add',
        point: { x: 300, y: 300 },
      });
    });

    it('should handle drag of multiple different points', () => {
      interaction.setPoints([
        { x: 50, y: 50 },
        { x: 150, y: 150 },
      ]);
      onUpdate.mockClear();

      // Drag first point
      canvas.dispatchEvent(createMouseEvent('mousedown', 50, 50));
      canvas.dispatchEvent(createMouseEvent('mousemove', 60, 60));
      canvas.dispatchEvent(createMouseEvent('mouseup', 60, 60));

      onUpdate.mockClear();

      // Drag second point
      canvas.dispatchEvent(createMouseEvent('mousedown', 150, 150));
      canvas.dispatchEvent(createMouseEvent('mousemove', 160, 160));
      canvas.dispatchEvent(createMouseEvent('mouseup', 160, 160));

      expect(onUpdate).toHaveBeenCalledWith({
        type: 'move',
        point: { x: 160, y: 160 },
        index: 1,
        oldPoint: { x: 150, y: 150 },
      });
    });
  });
});
