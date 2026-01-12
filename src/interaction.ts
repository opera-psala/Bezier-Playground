import { Point } from './types';

export interface PointAction {
  type: 'add' | 'remove' | 'move';
  point: Point;
  index?: number;
  oldPoint?: Point;
}

export class InteractionManager {
  private canvas: HTMLCanvasElement;
  private points: Point[] = [];
  private draggingIndex: number | null = null;
  private dragStartPoint: Point | null = null;
  private onUpdate: (action?: PointAction) => void;

  constructor(canvas: HTMLCanvasElement, onUpdate: (action?: PointAction) => void) {
    this.canvas = canvas;
    this.onUpdate = onUpdate;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  private getMousePos(e: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private findPointAtPosition(pos: Point, threshold = 10): number {
    for (let i = 0; i < this.points.length; i++) {
      const dx = this.points[i].x - pos.x;
      const dy = this.points[i].y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        return i;
      }
    }
    return -1;
  }

  private handleMouseDown = (e: MouseEvent) => {
    const pos = this.getMousePos(e);
    const index = this.findPointAtPosition(pos);

    if (index !== -1) {
      this.draggingIndex = index;
      this.dragStartPoint = { ...this.points[index] };
    } else {
      this.onUpdate({
        type: 'add',
        point: { ...pos },
      });
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.draggingIndex !== null) {
      const pos = this.getMousePos(e);
      this.points[this.draggingIndex] = pos;
      this.onUpdate();
    }
  };

  private handleMouseUp = () => {
    if (this.draggingIndex !== null && this.dragStartPoint) {
      const endPoint = this.points[this.draggingIndex];
      if (this.dragStartPoint.x !== endPoint.x || this.dragStartPoint.y !== endPoint.y) {
        this.onUpdate({
          type: 'move',
          point: { ...endPoint },
          index: this.draggingIndex,
          oldPoint: this.dragStartPoint,
        });
      }
    }
    this.draggingIndex = null;
    this.dragStartPoint = null;
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const pos = this.getMousePos(e);
    const index = this.findPointAtPosition(pos);

    if (index !== -1) {
      const removedPoint = { ...this.points[index] };
      this.onUpdate({
        type: 'remove',
        point: removedPoint,
        index,
      });
    }
  };

  getPoints(): Point[] {
    return this.points;
  }

  setPoints(points: Point[]) {
    this.points = points;
  }

  destroy() {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }
}
