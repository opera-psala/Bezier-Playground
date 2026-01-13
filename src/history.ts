import { BezierCurve, Point } from './types';

export interface Command {
  execute(state: AppState): void;
  undo(state: AppState): void;
  getAffectedCurveId(): string | null;
  serialize(): any; // Serialize command data for collaboration
}

export interface AppState {
  curves: BezierCurve[];
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

  getAffectedCurveId(): string | null {
    return this.curveId;
  }

  serialize(): any {
    return { curveId: this.curveId, point: this.point };
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

  getAffectedCurveId(): string | null {
    return this.curveId;
  }

  serialize(): any {
    return { curveId: this.curveId, index: this.index, point: this.point };
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

  getAffectedCurveId(): string | null {
    return this.curveId;
  }

  serialize(): any {
    return {
      curveId: this.curveId,
      index: this.index,
      oldPoint: this.oldPoint,
      newPoint: this.newPoint,
    };
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
  }

  undo(state: AppState): void {
    const index = state.curves.findIndex(c => c.id === this.curve.id);
    if (index !== -1) {
      state.curves.splice(index, 1);
    }
  }

  getAffectedCurveId(): string | null {
    return this.curve.id;
  }

  serialize(): any {
    return { curve: this.curve };
  }
}

class RemoveCurveCommand implements Command {
  private curveData: BezierCurve;
  private curveIndex: number;

  constructor(curve: BezierCurve, index: number) {
    this.curveData = JSON.parse(JSON.stringify(curve));
    this.curveIndex = index;
  }

  execute(state: AppState): void {
    state.curves.splice(this.curveIndex, 1);
  }

  undo(state: AppState): void {
    state.curves.splice(this.curveIndex, 0, JSON.parse(JSON.stringify(this.curveData)));
  }

  getAffectedCurveId(): string | null {
    return this.curveData.id;
  }

  serialize(): any {
    return { curve: this.curveData, index: this.curveIndex };
  }
}

class LoadCurvesCommand implements Command {
  private oldCurves: BezierCurve[];

  constructor(
    private newCurves: BezierCurve[],
    oldCurves: BezierCurve[]
  ) {
    this.oldCurves = JSON.parse(JSON.stringify(oldCurves));
  }

  execute(state: AppState): void {
    // Clear existing curves and add new ones (preserve array reference)
    state.curves.length = 0;
    state.curves.push(...JSON.parse(JSON.stringify(this.newCurves)));
  }

  undo(state: AppState): void {
    // Clear curves and restore old ones (preserve array reference)
    state.curves.length = 0;
    state.curves.push(...JSON.parse(JSON.stringify(this.oldCurves)));
  }

  getAffectedCurveId(): string | null {
    return this.newCurves[0]?.id || null;
  }

  serialize(): any {
    return { newCurves: this.newCurves, oldCurves: this.oldCurves };
  }
}

// Remote state update command for collaborative editing
export class RemoteStateUpdateCommand implements Command {
  constructor(private newCurves: BezierCurve[]) {}

  execute(state: AppState): void {
    console.log('[RemoteStateUpdateCommand] BEFORE: state.curves.length =', state.curves.length);
    console.log(
      '[RemoteStateUpdateCommand] BEFORE: state.curves =',
      JSON.stringify(state.curves).substring(0, 200)
    );
    console.log('[RemoteStateUpdateCommand] NEW curves to set:', this.newCurves.length);
    console.log(
      '[RemoteStateUpdateCommand] NEW curves =',
      JSON.stringify(this.newCurves).substring(0, 200)
    );

    state.curves.length = 0;
    state.curves.push(...JSON.parse(JSON.stringify(this.newCurves)));

    console.log('[RemoteStateUpdateCommand] AFTER: state.curves.length =', state.curves.length);
    console.log(
      '[RemoteStateUpdateCommand] AFTER: state.curves =',
      JSON.stringify(state.curves).substring(0, 200)
    );
  }

  undo(_state: AppState): void {
    throw new Error('Cannot undo remote command');
  }

  getAffectedCurveId(): string | null {
    return this.newCurves[0]?.id || null;
  }

  serialize(): any {
    return { newCurves: this.newCurves };
  }
}

interface HistoryNode {
  command: Command | null;
  parent: HistoryNode | null;
  children: HistoryNode[];
  timestamp: number;
  description: string;
}

interface BranchInfo {
  node: HistoryNode;
  depth: number;
  description: string;
  timestamp: number;
  isCurrent: boolean;
}

export class HistoryManager {
  private root: HistoryNode;
  private currentNode: HistoryNode;
  private state: AppState;
  private selectedChildIndex: number = 0; // Track which child is selected at decision points
  private collaborationCallback?: (command: Command, state: AppState) => void;

  constructor(initialState: AppState) {
    this.state = initialState;
    this.root = {
      command: null,
      parent: null,
      children: [],
      timestamp: Date.now(),
      description: 'Initial state',
    };
    this.currentNode = this.root;
  }

  setCollaborationCallback(callback: (command: Command, state: AppState) => void): void {
    this.collaborationCallback = callback;
  }

  executeCommand(command: Command): string | null {
    // Create new node
    const newNode: HistoryNode = {
      command,
      parent: this.currentNode,
      children: [],
      timestamp: Date.now(),
      description: this.getCommandDescription(command),
    };

    // Add as child to current node (creates branch if current node already has children)
    this.currentNode.children.push(newNode);

    // Execute the command
    command.execute(this.state);

    // Move to the new node
    this.currentNode = newNode;
    this.selectedChildIndex = 0; // Reset selection when moving

    // Notify collaboration manager
    if (this.collaborationCallback) {
      this.collaborationCallback(command, this.state);
    }

    return command.getAffectedCurveId();
  }

  // Execute remote command without creating history node
  executeRemoteCommand(command: Command): void {
    command.execute(this.state);
  }

  private getCommandDescription(command: Command): string {
    if (command instanceof AddPointCommand) {
      const colorName = this.getCurveColorName(command.getAffectedCurveId()!);
      return `Add point to ${colorName}`;
    } else if (command instanceof RemovePointCommand) {
      const colorName = this.getCurveColorName(command.getAffectedCurveId()!);
      return `Remove point from ${colorName}`;
    } else if (command instanceof MovePointCommand) {
      const colorName = this.getCurveColorName(command.getAffectedCurveId()!);
      return `Move point in ${colorName}`;
    } else if (command instanceof AddCurveCommand) {
      // For AddCurveCommand, get color from the command itself
      const colorName = this.getColorName(command['curve'].color);
      return `Create ${colorName} curve`;
    } else if (command instanceof RemoveCurveCommand) {
      // For RemoveCurveCommand, get color from the stored curve data
      const colorName = this.getColorName(command['curveData'].color);
      return `Delete ${colorName} curve`;
    } else if (command instanceof LoadCurvesCommand) {
      return 'Load curves from file';
    }
    return 'Unknown action';
  }

  private getCurveColorName(curveId: string): string {
    const curve = this.state.curves.find(c => c.id === curveId);
    return this.getColorName(curve?.color || '');
  }

  private getColorName(hex: string): string {
    const colorMap: { [key: string]: string } = {
      '#4a9eff': 'blue',
      '#ff4a9e': 'pink',
      '#4aff9e': 'green',
      '#ff9e4a': 'orange',
      '#9e4aff': 'purple',
      '#4afff9': 'cyan',
    };
    return colorMap[hex] || 'unknown';
  }

  undo(): string | null {
    if (!this.canUndo()) return null;

    const currentCommand = this.currentNode.command;
    if (currentCommand) {
      currentCommand.undo(this.state);
    }

    this.currentNode = this.currentNode.parent!;
    this.selectedChildIndex = 0; // Reset selection when moving

    // Return the curve ID of the current node (where we are after undoing)
    if (this.currentNode.command) {
      return this.currentNode.command.getAffectedCurveId();
    }
    return null;
  }

  redo(): string | null {
    if (!this.canRedo()) return null;

    // Use selected child index if at a decision point
    const childIndex = Math.min(this.selectedChildIndex, this.currentNode.children.length - 1);
    const nextNode = this.currentNode.children[childIndex];
    nextNode.command!.execute(this.state);

    this.currentNode = nextNode;
    this.selectedChildIndex = 0; // Reset selection when moving
    return nextNode.command!.getAffectedCurveId();
  }

  canUndo(): boolean {
    return this.currentNode.parent !== null;
  }

  canRedo(): boolean {
    return this.currentNode.children.length > 0;
  }

  hasBranches(): boolean {
    // Check if there are any branch points in the current path
    let node: HistoryNode | null = this.root;
    while (node) {
      if (node.children.length > 1) return true;
      node = node.children[0] || null;
    }
    return false;
  }

  getBranches(): BranchInfo[] {
    const branches: BranchInfo[] = [];

    // Find all branch points from root to current
    const pathToCurrentn: HistoryNode[] = [];
    let node: HistoryNode | null = this.currentNode;
    while (node) {
      pathToCurrentn.unshift(node);
      node = node.parent;
    }

    // For each node in the path, if it has multiple children, add the alternatives
    pathToCurrentn.forEach((pathNode, depth) => {
      if (pathNode.children.length > 1) {
        pathNode.children.forEach(child => {
          branches.push({
            node: child,
            depth,
            description: child.description,
            timestamp: child.timestamp,
            isCurrent: this.isInCurrentPath(child),
          });
        });
      }
    });

    return branches;
  }

  private isInCurrentPath(node: HistoryNode): boolean {
    let current: HistoryNode | null = this.currentNode;
    while (current) {
      if (current === node) return true;
      current = current.parent;
    }
    return false;
  }

  switchToBranch(targetNode: HistoryNode): string | null {
    // Undo to common ancestor
    const commonAncestor = this.findCommonAncestor(this.currentNode, targetNode);

    // Undo to common ancestor
    while (this.currentNode !== commonAncestor) {
      if (this.currentNode.command) {
        this.currentNode.command.undo(this.state);
      }
      this.currentNode = this.currentNode.parent!;
    }

    // Redo to target
    const pathToTarget: HistoryNode[] = [];
    let node: HistoryNode | null = targetNode;
    while (node !== commonAncestor && node !== null) {
      pathToTarget.unshift(node);
      node = node.parent;
    }

    pathToTarget.forEach(pathNode => {
      if (pathNode.command) {
        pathNode.command.execute(this.state);
      }
      this.currentNode = pathNode;
    });

    this.selectedChildIndex = 0; // Reset selection when moving

    return targetNode.command?.getAffectedCurveId() || null;
  }

  private findCommonAncestor(node1: HistoryNode, node2: HistoryNode): HistoryNode {
    const ancestors1 = new Set<HistoryNode>();
    let current: HistoryNode | null = node1;
    while (current) {
      ancestors1.add(current);
      current = current.parent;
    }

    current = node2;
    while (current) {
      if (ancestors1.has(current)) {
        return current;
      }
      current = current.parent;
    }

    return this.root;
  }

  clear(): void {
    // Reset to root
    while (this.currentNode !== this.root) {
      if (this.currentNode.command) {
        this.currentNode.command.undo(this.state);
      }
      this.currentNode = this.currentNode.parent!;
    }

    // Clear all children
    this.root.children = [];
    this.selectedChildIndex = 0; // Reset selection
  }

  getState(): AppState {
    return this.state;
  }

  jumpToNextIntersectionOrEnd(): string | null {
    let node = this.currentNode;
    let lastAffectedCurveId: string | null = null;
    let isFirstStep = true;

    // Move forward until we hit a branch point or end
    while (node.children.length > 0) {
      if (node.children.length > 1 && !isFirstStep) {
        // Found a branch point (not the starting point), stop here
        break;
      }

      // Choose which child to follow
      let nextNode: HistoryNode;
      if (isFirstStep && node.children.length > 1) {
        // At starting decision point, use selected branch
        const childIndex = Math.min(this.selectedChildIndex, node.children.length - 1);
        nextNode = node.children[childIndex];
        isFirstStep = false;
      } else {
        // Normal case: only one child or already past first step
        nextNode = node.children[0];
        isFirstStep = false;
      }

      if (nextNode.command) {
        nextNode.command.execute(this.state);
        lastAffectedCurveId = nextNode.command.getAffectedCurveId();
      }
      this.currentNode = nextNode;
      node = nextNode;
    }

    this.selectedChildIndex = 0; // Reset selection when moving

    return lastAffectedCurveId;
  }

  jumpToPreviousIntersectionOrStart(): string | null {
    let node = this.currentNode;
    let lastAffectedCurveId: string | null = null;

    // Move backward until we hit a branch point or start
    while (node.parent !== null) {
      // Check if parent has multiple children (is a branch point)
      if (node.parent.children.length > 1) {
        // Found a branch point, stop at parent
        if (node.command) {
          node.command.undo(this.state);
        }
        this.currentNode = node.parent;
        lastAffectedCurveId = node.parent.command?.getAffectedCurveId() || null;
        break;
      }

      // Move to parent
      if (node.command) {
        node.command.undo(this.state);
      }
      this.currentNode = node.parent;
      lastAffectedCurveId = node.parent.command?.getAffectedCurveId() || null;
      node = node.parent;
    }

    this.selectedChildIndex = 0; // Reset selection when moving

    return lastAffectedCurveId;
  }

  canJumpForward(): boolean {
    return this.currentNode.children.length > 0;
  }

  canJumpBackward(): boolean {
    return this.currentNode.parent !== null;
  }

  isAtIntersection(): boolean {
    // Only at an intersection if current node has multiple children (decision point)
    // NOT when parent has multiple children (that means you're already on a branch)
    return this.currentNode.children.length > 1;
  }

  switchToNextBranch(): string | null {
    // Only works at decision points (current node has multiple children)
    if (this.currentNode.children.length > 1) {
      this.selectedChildIndex = (this.selectedChildIndex + 1) % this.currentNode.children.length;
      // Don't execute, just update the selection
      // Return null to indicate no state change, just selection change
      return null;
    }

    return null;
  }

  switchToPreviousBranch(): string | null {
    // Only works at decision points (current node has multiple children)
    if (this.currentNode.children.length > 1) {
      this.selectedChildIndex =
        (this.selectedChildIndex - 1 + this.currentNode.children.length) %
        this.currentNode.children.length;
      // Don't execute, just update the selection
      // Return null to indicate no state change, just selection change
      return null;
    }

    return null;
  }

  getIntersectionInfo(): {
    currentBranch: number;
    totalBranches: number;
    description: string;
  } | null {
    // Only return info at decision points (current node has multiple children)
    if (this.currentNode.children.length > 1) {
      const selectedChild = this.currentNode.children[this.selectedChildIndex];
      return {
        currentBranch: this.selectedChildIndex + 1,
        totalBranches: this.currentNode.children.length,
        description: selectedChild.description,
      };
    }

    return null;
  }
}

export {
  AddPointCommand,
  RemovePointCommand,
  MovePointCommand,
  AddCurveCommand,
  RemoveCurveCommand,
  LoadCurvesCommand,
};
export type { BranchInfo };
