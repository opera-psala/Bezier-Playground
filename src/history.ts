import { BezierCurve, Point } from './types';

interface Command {
  execute(state: AppState): void;
  undo(state: AppState): void;
}

interface AppState {
  curves: BezierCurve[];
  activeCurveId: string | null;
}

class AddPointCommand implements Command {
  constructor(
    private curveId: string,
    private point: Point
  ) {}

  execute(state: AppState): void {
    const curve = state.curves.find(c => c.id === this.curveId);
    if (curve) {
      curve.points.push({ ...this.point });
    }
  }

  undo(state: AppState): void {
    const curve = state.curves.find(c => c.id === this.curveId);
    if (curve && curve.points.length > 0) {
      curve.points.pop();
    }
  }
}

class RemovePointCommand implements Command {
  constructor(
    private curveId: string,
    private index: number,
    private point: Point
  ) {}

  execute(state: AppState): void {
    const curve = state.curves.find(c => c.id === this.curveId);
    if (curve) {
      curve.points.splice(this.index, 1);
    }
  }

  undo(state: AppState): void {
    const curve = state.curves.find(c => c.id === this.curveId);
    if (curve) {
      curve.points.splice(this.index, 0, { ...this.point });
    }
  }
}

class MovePointCommand implements Command {
  constructor(
    private curveId: string,
    private index: number,
    private oldPoint: Point,
    private newPoint: Point
  ) {}

  execute(state: AppState): void {
    const curve = state.curves.find(c => c.id === this.curveId);
    if (curve && curve.points[this.index]) {
      curve.points[this.index] = { ...this.newPoint };
    }
  }

  undo(state: AppState): void {
    const curve = state.curves.find(c => c.id === this.curveId);
    if (curve && curve.points[this.index]) {
      curve.points[this.index] = { ...this.oldPoint };
    }
  }
}

class AddCurveCommand implements Command {
  constructor(private curve: BezierCurve) {}

  execute(state: AppState): void {
    state.curves.push({
      id: this.curve.id,
      color: this.curve.color,
      points: [],
    });
    state.activeCurveId = this.curve.id;
  }

  undo(state: AppState): void {
    const index = state.curves.findIndex(c => c.id === this.curve.id);
    if (index !== -1) {
      state.curves.splice(index, 1);
      state.activeCurveId = state.curves.length > 0 ? state.curves[0].id : null;
    }
  }
}

class RemoveCurveCommand implements Command {
  private curveData: BezierCurve;
  private curveIndex: number;
  private previousActiveCurveId: string | null;

  constructor(curve: BezierCurve, index: number, activeCurveId: string | null) {
    this.curveData = JSON.parse(JSON.stringify(curve));
    this.curveIndex = index;
    this.previousActiveCurveId = activeCurveId;
  }

  execute(state: AppState): void {
    state.curves.splice(this.curveIndex, 1);
    if (state.activeCurveId === this.curveData.id) {
      state.activeCurveId = state.curves.length > 0 ? state.curves[0].id : null;
    }
  }

  undo(state: AppState): void {
    state.curves.splice(this.curveIndex, 0, JSON.parse(JSON.stringify(this.curveData)));
    state.activeCurveId = this.previousActiveCurveId;
  }
}

export class HistoryManager {
  private commands: Command[] = [];
  private currentIndex = -1;
  private maxHistory = 100;
  private state: AppState;

  constructor(initialState: AppState) {
    this.state = initialState;
  }

  executeCommand(command: Command): void {
    this.commands = this.commands.slice(0, this.currentIndex + 1);
    this.commands.push(command);
    command.execute(this.state);

    if (this.commands.length > this.maxHistory) {
      this.commands.shift();
    } else {
      this.currentIndex++;
    }
  }

  undo(): void {
    if (this.currentIndex >= 0) {
      this.commands[this.currentIndex].undo(this.state);
      this.currentIndex--;
    }
  }

  redo(): void {
    if (this.currentIndex < this.commands.length - 1) {
      this.currentIndex++;
      this.commands[this.currentIndex].execute(this.state);
    }
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.commands.length - 1;
  }

  clear(): void {
    this.commands = [];
    this.currentIndex = -1;
  }

  getState(): AppState {
    return this.state;
  }
}

export { AddPointCommand, RemovePointCommand, MovePointCommand, AddCurveCommand, RemoveCurveCommand };
