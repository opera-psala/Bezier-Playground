import { v4 as uuidv4 } from 'uuid';
import { AutomergeManager } from './AutomergeManager';
import { WebSocketClient } from './WebSocketClient';
import { BezierCurve, Point, User } from '../types';
import { Command } from '../history';

export interface CollaborationCallbacks {
  onRemoteChange: (curves: BezierCurve[]) => void;
  onUsersUpdate: (users: User[]) => void;
  onConnectionStatusChange: (connected: boolean) => void;
}

export class CollaborationManager {
  private automerge: AutomergeManager;
  private websocket: WebSocketClient;
  private userId: string;
  private userName: string = 'Anonymous';
  private enabled: boolean = false;
  private callbacks: CollaborationCallbacks;
  private isApplyingRemoteChange: boolean = false;
  private pendingCurves?: BezierCurve[];

  constructor(serverUrl: string, _initialCurves: BezierCurve[], callbacks: CollaborationCallbacks) {
    this.userId = uuidv4();
    this.callbacks = callbacks;

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
          this.automerge.load(docState);
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
      // Sync changes intelligently - only update what changed
      const changes = this.automerge.executeLocalCommand(
        this.getCommandDescription(command),
        doc => {
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
