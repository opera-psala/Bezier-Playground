import { BezierCurve } from './types';

interface AppState {
  curves: BezierCurve[];
  activeCurveId: string | null;
}

export class HistoryManager {
  private history: AppState[] = [];
  private currentIndex = -1;
  private maxHistory = 50;

  saveState(curves: BezierCurve[], activeCurveId: string | null) {
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push({
      curves: JSON.parse(JSON.stringify(curves)),
      activeCurveId,
    });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  undo(): AppState | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return JSON.parse(JSON.stringify(this.history[this.currentIndex]));
    }
    return null;
  }

  redo(): AppState | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return JSON.parse(JSON.stringify(this.history[this.currentIndex]));
    }
    return null;
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  clear() {
    this.history = [];
    this.currentIndex = -1;
  }
}
