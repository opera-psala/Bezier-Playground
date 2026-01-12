import { Point } from './types';
import { HistoryManager } from './history';

export class InteractionManager {
  private canvas: HTMLCanvasElement;
  private points: Point[] = [];
  private draggingIndex: number | null = null;
  private onUpdate: () => void;
  private history: HistoryManager;

  constructor(canvas: HTMLCanvasElement, onUpdate: () => void) {
    this.canvas = canvas;
    this.onUpdate = onUpdate;
    this.history = new HistoryManager();
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
      this.history.saveState(this.points);
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
      this.history.saveState(this.points);
    }
    this.draggingIndex = null;
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const pos = this.getMousePos(e);
    const index = this.findPointAtPosition(pos);

    if (index !== -1) {
      this.points.splice(index, 1);
      this.history.saveState(this.points);
      this.onUpdate();
    }
  };

  getPoints(): Point[] {
    return this.points;
  }

  setPoints(points: Point[]) {
    this.points = points;
    this.history.clear();
    this.history.saveState(this.points);
    this.onUpdate();
  }

  clearPoints() {
    this.points = [];
    this.history.clear();
    this.onUpdate();
  }

  undo() {
    const state = this.history.undo();
    if (state !== null) {
      this.points = state;
      this.onUpdate();
    }
  }

  redo() {
    const state = this.history.redo();
    if (state !== null) {
      this.points = state;
      this.onUpdate();
    }
  }

  canUndo(): boolean {
    return this.history.canUndo();
  }

  canRedo(): boolean {
    return this.history.canRedo();
  }

  destroy() {
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }
}
