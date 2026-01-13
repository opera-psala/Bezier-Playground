import * as Automerge from '@automerge/automerge';
import { BezierCurve, CollaborativeState, User } from '../types';

export interface AutomergeCallbacks {
  onRemoteChange: (curves: BezierCurve[]) => void;
  onPresenceUpdate: (users: User[]) => void;
}

export class AutomergeManager {
  private doc: Automerge.Doc<CollaborativeState>;
  private localUserId: string;
  private callbacks: AutomergeCallbacks;

  constructor(localUserId: string, initialCurves: BezierCurve[], callbacks: AutomergeCallbacks) {
    this.localUserId = localUserId;
    this.callbacks = callbacks;

    // Initialize Automerge document
    this.doc = Automerge.from({
      curves: initialCurves,
      users: {},
    });
  }

  // Execute local command and generate Automerge change
  executeLocalCommand(
    description: string,
    mutator: (doc: CollaborativeState) => void
  ): Uint8Array | null {
    try {
      const oldDoc = this.doc;
      this.doc = Automerge.change(this.doc, description, mutator);

      // Get changes to broadcast
      const changes = Automerge.getChanges(oldDoc, this.doc);
      if (changes.length === 0) {
        console.log('No changes to broadcast');
        return null;
      }
      // Return the raw change, not encoded
      return changes[0];
    } catch (error) {
      console.error('Error executing local command:', error);
      return null;
    }
  }

  // Apply remote changes from peers
  applyRemoteChanges(changes: Uint8Array): void {
    try {
      console.log('[Automerge] Applying remote changes...');
      console.log('[Automerge] Before: curves =', this.doc.curves?.length || 0);

      // Apply the raw change
      const [newDoc] = Automerge.applyChanges(this.doc, [changes]);

      // Check if curves actually changed
      const oldCurves = JSON.stringify(this.doc.curves || []);
      const newCurves = JSON.stringify(newDoc.curves || []);

      console.log('[Automerge] After: curves =', newDoc.curves?.length || 0);
      console.log('[Automerge] Old curves JSON:', oldCurves.substring(0, 100));
      console.log('[Automerge] New curves JSON:', newCurves.substring(0, 100));

      this.doc = newDoc;

      console.log('[Automerge] Curves changed:', oldCurves !== newCurves);

      if (oldCurves !== newCurves) {
        const curves = this.doc.curves ? JSON.parse(JSON.stringify(this.doc.curves)) : [];
        console.log('[Automerge] Triggering onRemoteChange callback with', curves.length, 'curves');
        this.callbacks.onRemoteChange(curves);
      }

      // Always update presence - convert to plain objects
      const users = this.doc.users
        ? (Object.values(JSON.parse(JSON.stringify(this.doc.users))) as User[])
        : [];
      console.log('[Automerge] Total users after applying changes:', users.length);
      this.callbacks.onPresenceUpdate(users);
    } catch (error) {
      console.error('Error applying remote changes:', error);
    }
  }

  // Update local user presence and return changes to broadcast
  updatePresence(
    cursor: { x: number; y: number } | null,
    activeCurveId: string | null,
    userName?: string
  ): Uint8Array | null {
    try {
      const oldDoc = this.doc;
      this.doc = Automerge.change(this.doc, 'Update presence', doc => {
        // Ensure users object exists
        if (!doc.users) {
          doc.users = {};
        }

        if (!doc.users[this.localUserId]) {
          doc.users[this.localUserId] = {
            id: this.localUserId,
            name: userName || `User ${this.localUserId.slice(0, 6)}`,
            color: this.generateUserColor(),
            cursor,
            activeCurveId,
            lastSeen: Date.now(),
          };
        } else {
          doc.users[this.localUserId].cursor = cursor;
          doc.users[this.localUserId].activeCurveId = activeCurveId;
          doc.users[this.localUserId].lastSeen = Date.now();
          // Update name if provided
          if (userName) {
            doc.users[this.localUserId].name = userName;
          }
        }
      });

      const userCount = this.doc.users ? Object.keys(this.doc.users).length : 0;
      console.log('[Automerge] Updated presence, total users:', userCount);

      // Convert to plain objects for callback
      const users = this.doc.users
        ? (Object.values(JSON.parse(JSON.stringify(this.doc.users))) as User[])
        : [];
      this.callbacks.onPresenceUpdate(users);

      // Return changes to broadcast
      const changes = Automerge.getChanges(oldDoc, this.doc);
      if (changes.length > 0) {
        return changes[0];
      }
      return null;
    } catch (error) {
      console.error('Error updating presence:', error);
      return null;
    }
  }

  // Get current state (as plain objects)
  getState(): CollaborativeState {
    // Return a deep clone to avoid Automerge proxy issues
    return JSON.parse(JSON.stringify(this.doc));
  }

  // Get full document for sync
  save(): Uint8Array {
    return Automerge.save(this.doc);
  }

  // Load from full document
  load(data: Uint8Array, skipCallbacks: boolean = false): void {
    try {
      console.log('[Automerge] Loading document, data size:', data.length, 'bytes');
      this.doc = Automerge.load(data);
      // Convert Automerge arrays/objects to plain JS
      const curves = this.doc.curves ? JSON.parse(JSON.stringify(this.doc.curves)) : [];
      const users = this.doc.users
        ? (Object.values(JSON.parse(JSON.stringify(this.doc.users))) as User[])
        : [];

      console.log('[Automerge] Loaded document with', curves.length, 'curves');
      if (curves.length > 0) {
        console.log('[Automerge] First curve:', curves[0]);
      }
      console.log('[Automerge] Loaded', users.length, 'users');

      if (!skipCallbacks) {
        this.callbacks.onRemoteChange(curves);
        this.callbacks.onPresenceUpdate(users);
      } else {
        console.log('[Automerge] Skipping callbacks during load');
      }
    } catch (error) {
      console.error('Error loading document:', error);
    }
  }

  private generateUserColor(): string {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
