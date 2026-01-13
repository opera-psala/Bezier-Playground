import { v4 as uuidv4 } from 'uuid';
import { SerializedCommand, SharedHistoryNode, CollaborativeHistory, BezierCurve } from '../types';
import {
  Command,
  AddPointCommand,
  RemovePointCommand,
  MovePointCommand,
  AddCurveCommand,
  RemoveCurveCommand,
} from '../history';

/**
 * SharedHistoryManager handles the collaborative history tree.
 * It converts between local Command objects and serializable history format.
 */
export class SharedHistoryManager {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  // Serialize a command to store in Automerge
  serializeCommand(command: Command): SerializedCommand | null {
    const commandName = command.constructor.name;

    // Extract command data based on type
    // Note: This requires access to command internals
    // We'll need to add a serialize() method to Command interface
    switch (commandName) {
      case 'AddPointCommand':
        return {
          type: 'AddPoint',
          data: this.extractCommandData(command),
        };
      case 'RemovePointCommand':
        return {
          type: 'RemovePoint',
          data: this.extractCommandData(command),
        };
      case 'MovePointCommand':
        return {
          type: 'MovePoint',
          data: this.extractCommandData(command),
        };
      case 'AddCurveCommand':
        return {
          type: 'AddCurve',
          data: this.extractCommandData(command),
        };
      case 'RemoveCurveCommand':
        return {
          type: 'RemoveCurve',
          data: this.extractCommandData(command),
        };
      case 'ChangeCurveColorCommand':
        return {
          type: 'ChangeCurveColor',
          data: this.extractCommandData(command),
        };
      default:
        console.warn('Unknown command type:', commandName);
        return null;
    }
  }

  // Extract data from command (temporary - we'll add serialize() to Command interface)
  private extractCommandData(command: any): any {
    // This is a hack - we'll improve it by adding serialize() to Command interface
    return {
      curveId: command.curveId,
      point: command.point,
      index: command.index,
      oldPoint: command.oldPoint,
      newPoint: command.newPoint,
      curve: command.curve,
      oldColor: command.oldColor,
      newColor: command.newColor,
    };
  }

  // Create a history node for Automerge
  createHistoryNode(
    command: Command | null,
    parentId: string,
    description: string
  ): SharedHistoryNode {
    const nodeId = uuidv4();
    return {
      id: nodeId,
      command: command ? this.serializeCommand(command) : null,
      parentId: parentId,
      childIds: [],
      timestamp: Date.now(),
      description: description,
      userId: this.userId,
    };
  }

  // Reconstruct state by replaying commands from root to target node
  reconstructState(
    history: CollaborativeHistory,
    targetNodeId: string,
    initialCurves: BezierCurve[]
  ): BezierCurve[] {
    // Get path from root to target
    const path = this.getPathToNode(history, targetNodeId);

    // Start with initial state
    const curves: BezierCurve[] = JSON.parse(JSON.stringify(initialCurves));
    const state = { curves };

    // Replay commands along the path
    for (const nodeId of path) {
      const node = history.nodes[nodeId];
      if (node.command) {
        const command = this.deserializeCommand(node.command);
        if (command) {
          command.execute(state);
        }
      }
    }

    return state.curves;
  }

  // Get path from root to node
  private getPathToNode(history: CollaborativeHistory, nodeId: string): string[] {
    const path: string[] = [];
    let currentId: string | null = nodeId;

    // Walk backwards to root
    while (currentId !== null && currentId !== history.rootId) {
      path.unshift(currentId);
      const node: SharedHistoryNode = history.nodes[currentId];
      currentId = node.parentId;
    }

    return path;
  }

  // Deserialize command from Automerge format back to Command object
  private deserializeCommand(serialized: SerializedCommand): Command | null {
    const { data } = serialized;

    switch (serialized.type) {
      case 'AddPoint':
        return new AddPointCommand(data.curveId, data.point);
      case 'RemovePoint':
        return new RemovePointCommand(data.curveId, data.index, data.point);
      case 'MovePoint':
        return new MovePointCommand(data.curveId, data.index, data.oldPoint, data.newPoint);
      case 'AddCurve':
        return new AddCurveCommand(data.curve);
      case 'RemoveCurve':
        return new RemoveCurveCommand(data.curve, data.index);
      case 'ChangeCurveColor':
        console.warn('ChangeCurveColor command not yet implemented');
        return null;
      default:
        console.warn('Unknown serialized command type:', serialized.type);
        return null;
    }
  }
}
