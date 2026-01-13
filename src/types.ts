export interface Point {
  x: number;
  y: number;
}

export interface BezierCurve {
  id: string;
  points: Point[];
  color: string;
}

export interface AnimationState {
  isAnimating: boolean;
  progress: number;
  speed: number;
}

export type VisualizationMode = 'default' | 'decasteljau' | 'tslider';

// Collaborative editing types
export interface User {
  id: string;
  name: string;
  color: string;
  cursor: Point | null;
  activeCurveId: string | null;
  lastSeen: number;
}

export interface CollaborativeState {
  curves: BezierCurve[];
  users: { [userId: string]: User };
}

export interface PresenceUpdate {
  type: 'cursor' | 'activeCurve' | 'join' | 'leave';
  userId: string;
  cursor?: Point | null;
  activeCurveId?: string | null;
  user?: User;
}

export interface SyncMessage {
  type: 'sync-request' | 'sync-response' | 'change' | 'presence';
  senderId: string;
  sessionId?: string;
  changes?: Uint8Array | number[]; // Automerge changes (converted to array for JSON)
  presence?: PresenceUpdate;
  documentState?: Uint8Array | number[]; // Full document state from server (unused, for backwards compatibility)
  isFirstUser?: boolean; // True if this user is the first to join the session
}
