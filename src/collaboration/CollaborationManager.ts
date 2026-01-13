import { v4 as uuidv4 } from 'uuid';
import { AutomergeManager } from './AutomergeManager';
import { WebSocketClient } from './WebSocketClient';
import { SharedHistoryManager } from './SharedHistoryManager';
import { BezierCurve, Point, User, CollaborativeHistory } from '../types';
import { Command } from '../history';

export interface CollaborationCallbacks {
  onRemoteChange: (curves: BezierCurve[]) => void;
  onUsersUpdate: (users: User[]) => void;
  onConnectionStatusChange: (connected: boolean) => void;
  onHistoryChange: (history: CollaborativeHistory) => void;
}

export class CollaborationManager {
  private automerge: AutomergeManager;
  private websocket: WebSocketClient;
  private sharedHistory: SharedHistoryManager;
  private userId: string;
  private userName: string = 'Anonymous';
  private enabled: boolean = false;
  private callbacks: CollaborationCallbacks;
  private isApplyingRemoteChange: boolean = false;
  private pendingCurves?: BezierCurve[];

  constructor(serverUrl: string, _initialCurves: BezierCurve[], callbacks: CollaborationCallbacks) {
    this.userId = uuidv4();
    this.callbacks = callbacks;

    // Initialize SharedHistoryManager
    this.sharedHistory = new SharedHistoryManager(this.userId);

    // Initialize Automerge with EMPTY state - will sync from server or first user
    // This ensures all clients start from the same baseline
    this.automerge = new AutomergeManager(this.userId, [], {
      onRemoteChange: curves => {
        if (!this.isApplyingRemoteChange) {
          this.isApplyingRemoteChange = true;
          console.log(
            '[Collaboration] Triggering onRemoteChange callback with',
            curves.length,
            'curves'
          );
          this.callbacks.onRemoteChange(curves);
          this.isApplyingRemoteChange = false;
        }
      },
      onPresenceUpdate: users => {
        console.log(
          '[Collaboration] Triggering onPresenceUpdate callback with',
          users.length,
          'users'
        );
        this.callbacks.onUsersUpdate(users);
      },
      onHistoryChange: history => {
        if (!this.isApplyingRemoteChange) {
          console.log('[Collaboration] History changed remotely');
          this.isApplyingRemoteChange = true;
          this.callbacks.onHistoryChange(history);
          this.isApplyingRemoteChange = false;
        }
      },
    });

    // Initialize WebSocket
    this.websocket = new WebSocketClient(serverUrl, this.userId, {
      onConnected: sessionId => {
        console.log('Connected to session:', sessionId);
        this.callbacks.onConnectionStatusChange(true);
        // Update presence after connecting
        if (this.enabled) {
          setTimeout(() => {
            this.updatePresence(null, null);
          }, 100);
        }
      },
      onDisconnected: () => {
        this.callbacks.onConnectionStatusChange(false);
      },
      onSyncResponse: (documentState, isFirstUser) => {
        console.log(
          '[Collaboration] onSyncResponse called, documentState length:',
          documentState.length,
          'isFirstUser:',
          isFirstUser
        );

        // ALWAYS load the server's document to ensure same lineage
        if (documentState.length > 0) {
          console.log('[Collaboration] Loading document state from server');
          const docState = Array.isArray(documentState)
            ? new Uint8Array(documentState)
            : documentState;

          // If we're the first user, skip callbacks during load to preserve our pending curves
          const skipCallbacks = isFirstUser;
          this.automerge.load(docState, skipCallbacks);
          console.log('[Collaboration] Successfully loaded server state');

          // If we're the first user and have local curves, sync them now
          if (isFirstUser) {
            console.log('[Collaboration] First user - syncing local curves to server document');
            this.syncInitialState();
          } else {
            // Late joiner - just initialize presence
            console.log('[Collaboration] Late joiner - initializing presence only');
            setTimeout(() => {
              this.updatePresence(null, null);
            }, 100);
          }
        } else {
          console.error(
            '[Collaboration] Server sent empty document state - this should not happen!'
          );
        }
      },
      onRemoteChange: (changes, senderId) => {
        console.log(
          '[Collaboration] Received remote changes from:',
          senderId,
          'size:',
          changes.length
        );
        this.automerge.applyRemoteChanges(changes);
      },
      onPresenceUpdate: _presence => {
        // Presence updates are handled through Automerge
      },
    });
  }

  enable(currentCurves: BezierCurve[], userName?: string): void {
    console.log('[Collaboration] Enabling with', currentCurves.length, 'local curves...');
    this.enabled = true;

    // Store user name
    if (userName) {
      this.userName = userName;
      console.log('[Collaboration] User name set to:', this.userName);
    }

    // Store current curves to sync after we know if we're first user or not
    this.pendingCurves = currentCurves;

    this.websocket.connect();
  }

  // Called after sync response determines if we're first user or loading state
  private syncInitialState(): void {
    if (!this.pendingCurves) return;

    console.log('[Collaboration] Syncing initial state with', this.pendingCurves.length, 'curves');

    // If we have curves locally, push them to Automerge
    if (this.pendingCurves.length > 0) {
      const curvesToSync = JSON.parse(JSON.stringify(this.pendingCurves));
      const changes = this.automerge.executeLocalCommand('Initial sync', doc => {
        // Use splice to replace entire array content
        doc.curves.splice(0, doc.curves.length, ...curvesToSync);
      });
      if (changes && this.websocket.isConnected()) {
        this.websocket.sendChange(changes);
      }
    }

    this.pendingCurves = undefined;

    // Initialize our presence
    setTimeout(() => {
      this.updatePresence(null, null);
    }, 100);
  }

  disable(): void {
    console.log('[Collaboration] Disabling...');
    this.enabled = false;
    this.websocket.disconnect();
  }

  // Called when a local command is executed
  onLocalCommand(command: Command, state: { curves: BezierCurve[] }): void {
    if (!this.enabled || this.isApplyingRemoteChange) return;

    console.log(
      '[Collaboration] onLocalCommand called:',
      this.getCommandDescription(command),
      'curves:',
      state.curves.length
    );

    try {
      // Sync changes - update both curves AND history
      const changes = this.automerge.executeLocalCommand(
        this.getCommandDescription(command),
        doc => {
          // 1. Update curves (existing logic)
          const localCurves = state.curves;
          const currentCurves = doc.curves;

          // Build maps for quick lookup
          const localById = new Map(localCurves.map(c => [c.id, c]));
          const currentById = new Map<string, number>();
          for (let i = 0; i < currentCurves.length; i++) {
            currentById.set(currentCurves[i].id, i);
          }

          // Remove curves that no longer exist locally
          for (let i = currentCurves.length - 1; i >= 0; i--) {
            const curveId = currentCurves[i].id;
            if (!localById.has(curveId)) {
              doc.curves.splice(i, 1);
              console.log('[Collaboration] Removed curve:', curveId);
            }
          }

          // Add or update curves
          localCurves.forEach(localCurve => {
            const currentIndex = currentById.get(localCurve.id);

            if (currentIndex === undefined) {
              // New curve - add it
              const curveCopy = JSON.parse(JSON.stringify(localCurve));
              doc.curves.push(curveCopy);
              console.log('[Collaboration] Added curve:', localCurve.id);
            } else {
              // Existing curve - update its properties
              const docCurve = doc.curves[currentIndex];

              // Update color if changed
              if (docCurve.color !== localCurve.color) {
                docCurve.color = localCurve.color;
              }

              // Update points array if changed
              const pointsChanged =
                docCurve.points.length !== localCurve.points.length ||
                JSON.stringify(docCurve.points) !== JSON.stringify(localCurve.points);

              if (pointsChanged) {
                // Replace points array
                docCurve.points.splice(
                  0,
                  docCurve.points.length,
                  ...JSON.parse(JSON.stringify(localCurve.points))
                );
              }
            }
          });

          // 2. Update shared history tree (if history exists)
          if (doc.history && doc.history.currentNodeId) {
            try {
              const historyNode = this.sharedHistory.createHistoryNode(
                command,
                doc.history.currentNodeId,
                this.getCommandDescription(command)
              );

              // Add new node to history
              doc.history.nodes[historyNode.id] = JSON.parse(JSON.stringify(historyNode));

              // Link node to parent
              const parentNode = doc.history.nodes[doc.history.currentNodeId];
              if (parentNode && !parentNode.childIds.includes(historyNode.id)) {
                parentNode.childIds.push(historyNode.id);
              }

              // Update current position
              doc.history.currentNodeId = historyNode.id;

              console.log('[Collaboration] Added history node:', historyNode.id);
            } catch (error) {
              console.error('[Collaboration] Error updating history:', error);
              // Continue anyway - curve sync should still work
            }
          } else {
            console.log('[Collaboration] History not initialized yet, skipping history sync');
          }
        }
      );

      // Broadcast to peers if there are changes
      if (changes) {
        console.log('[Collaboration] Broadcasting changes, size:', changes.length);
        this.websocket.sendChange(changes);
      } else {
        console.log('[Collaboration] No changes to broadcast');
      }
    } catch (error) {
      console.error('Error in onLocalCommand:', error);
    }
  }

  // Update presence info
  updatePresence(cursor: Point | null, activeCurveId: string | null): void {
    if (!this.enabled) return;

    try {
      // Update presence in Automerge and get changes
      const changes = this.automerge.updatePresence(cursor, activeCurveId, this.userName);

      // Broadcast the changes (which include presence updates)
      if (changes && this.websocket.isConnected()) {
        this.websocket.sendChange(changes);
      }
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }

  // Shared undo - moves history back and reconstructs state
  undo(): boolean {
    if (!this.enabled || !this.websocket.isConnected()) return false;

    try {
      console.log('[Collaboration] Shared undo requested');

      const state = this.automerge.getState();
      if (!state.history) {
        console.warn('[Collaboration] History not available');
        return false;
      }

      const currentNode = state.history.nodes[state.history.currentNodeId];
      if (!currentNode || !currentNode.parentId) {
        console.log('[Collaboration] Cannot undo - at root');
        return false;
      }

      // Move to parent node
      const newCurrentId = currentNode.parentId;
      console.log('[Collaboration] Moving to parent node:', newCurrentId);

      // Update history position and reconstruct state
      const changes = this.automerge.executeLocalCommand('Shared undo', doc => {
        doc.history.currentNodeId = newCurrentId;

        // Reconstruct curves from history
        const reconstructedCurves = this.sharedHistory.reconstructState(
          state.history,
          newCurrentId,
          []
        );

        // Update curves using splice (Automerge-compatible)
        const curvesCopy = JSON.parse(JSON.stringify(reconstructedCurves));
        doc.curves.splice(0, doc.curves.length, ...curvesCopy);
        console.log(
          '[Collaboration] Reconstructed',
          reconstructedCurves.length,
          'curves after undo'
        );
      });

      // Broadcast changes
      if (changes && this.websocket.isConnected()) {
        this.websocket.sendChange(changes);
      }

      // Trigger local callback to update our own UI
      const updatedState = this.automerge.getState();
      console.log('[Collaboration] Triggering local onRemoteChange after undo');
      this.callbacks.onRemoteChange(updatedState.curves);

      return true;
    } catch (error) {
      console.error('Error in shared undo:', error);
      return false;
    }
  }

  // Shared redo - moves history forward and reconstructs state
  redo(): boolean {
    if (!this.enabled || !this.websocket.isConnected()) return false;

    try {
      console.log('[Collaboration] Shared redo requested');

      const state = this.automerge.getState();
      if (!state.history) {
        console.warn('[Collaboration] History not available');
        return false;
      }

      const currentNode = state.history.nodes[state.history.currentNodeId];
      if (!currentNode || currentNode.childIds.length === 0) {
        console.log('[Collaboration] Cannot redo - no children');
        return false;
      }

      // Move to first child (TODO: handle multiple branches)
      const newCurrentId = currentNode.childIds[0];
      console.log('[Collaboration] Moving to child node:', newCurrentId);

      // Update history position and reconstruct state
      const changes = this.automerge.executeLocalCommand('Shared redo', doc => {
        doc.history.currentNodeId = newCurrentId;

        // Reconstruct curves from history
        const reconstructedCurves = this.sharedHistory.reconstructState(
          state.history,
          newCurrentId,
          []
        );

        // Update curves using splice (Automerge-compatible)
        const curvesCopy = JSON.parse(JSON.stringify(reconstructedCurves));
        doc.curves.splice(0, doc.curves.length, ...curvesCopy);
        console.log(
          '[Collaboration] Reconstructed',
          reconstructedCurves.length,
          'curves after redo'
        );
      });

      // Broadcast changes
      if (changes && this.websocket.isConnected()) {
        this.websocket.sendChange(changes);
      }

      // Trigger local callback to update our own UI
      const updatedState = this.automerge.getState();
      console.log('[Collaboration] Triggering local onRemoteChange after redo');
      this.callbacks.onRemoteChange(updatedState.curves);

      return true;
    } catch (error) {
      console.error('Error in shared redo:', error);
      return false;
    }
  }

  // Check if undo is available
  canUndo(): boolean {
    if (!this.enabled) return false;

    const state = this.automerge.getState();
    if (!state.history) return false;

    const currentNode = state.history.nodes[state.history.currentNodeId];
    return currentNode && currentNode.parentId !== null;
  }

  // Check if redo is available
  canRedo(): boolean {
    if (!this.enabled) return false;

    const state = this.automerge.getState();
    if (!state.history) return false;

    const currentNode = state.history.nodes[state.history.currentNodeId];
    return currentNode && currentNode.childIds.length > 0;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isConnected(): boolean {
    return this.websocket.isConnected();
  }

  getUserId(): string {
    return this.userId;
  }

  private getCommandDescription(command: Command): string {
    return command.constructor.name;
  }
}
