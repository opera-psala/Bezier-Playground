import { Point } from './types';

export class InteractionManager {
  private canvas: HTMLCanvasElement;
  private points: Point[] = [];
  private draggingIndex: number | null = null;
  private onUpdate: () => void;

  constructor(canvas: HTMLCanvasElement, onUpdate: () => void) {
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
    } else {
      this.points.push(pos);
      this.onUpdate();
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
    if (this.draggingIndex !== null) {
      this.onUpdate();
    }
    this.draggingIndex = null;
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const pos = this.getMousePos(e);
    const index = this.findPointAtPosition(pos);

    if (index !== -1) {
      this.points.splice(index, 1);
      this.onUpdate();
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
