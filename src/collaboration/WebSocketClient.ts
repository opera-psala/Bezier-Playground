import { SyncMessage, PresenceUpdate } from '../types';

export interface WebSocketCallbacks {
  onConnected: (sessionId: string) => void;
  onDisconnected: () => void;
  onSyncResponse: (documentState: Uint8Array, isFirstUser: boolean) => void;
  onRemoteChange: (changes: Uint8Array, senderId: string) => void;
  onPresenceUpdate: (presence: PresenceUpdate) => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private callbacks: WebSocketCallbacks;
  private reconnectTimeout: number = 1000;
  private maxReconnectTimeout: number = 30000;
  private userId: string;

  constructor(serverUrl: string, userId: string, callbacks: WebSocketCallbacks) {
    this.serverUrl = serverUrl;
    this.userId = userId;
    this.callbacks = callbacks;
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectTimeout = 1000;
        // Request sync on connection
        this.sendSyncRequest();
      };

      this.ws.onmessage = event => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.callbacks.onDisconnected();
        this.scheduleReconnect();
      };

      this.ws.onerror = error => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendChange(changes: Uint8Array): void {
    if (!changes) {
      console.warn('[WebSocket] Attempted to send null/undefined changes');
      return;
    }
    console.log('[WebSocket] Sending change, size:', changes.length, 'bytes');
    this.send({
      type: 'change',
      senderId: this.userId,
      changes: Array.from(changes), // Convert Uint8Array to regular array for JSON
    });
  }

  sendPresence(presence: PresenceUpdate): void {
    this.send({
      type: 'presence',
      senderId: this.userId,
      presence,
    });
  }

  private sendSyncRequest(): void {
    this.send({
      type: 'sync-request',
      senderId: this.userId,
    });
  }

  private send(message: SyncMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(data: string): void {
    try {
      const message: SyncMessage = JSON.parse(data);
      console.log('[WebSocket] Received message type:', message.type);

      switch (message.type) {
        case 'sync-response':
          if (message.sessionId) {
            this.callbacks.onConnected(message.sessionId);
          }

          // ALWAYS call onSyncResponse, pass isFirstUser flag
          const isFirstUser = message.isFirstUser ?? false;
          if (message.documentState) {
            // Convert array back to Uint8Array
            const docState = Array.isArray(message.documentState)
              ? new Uint8Array(message.documentState)
              : message.documentState;
            console.log('[WebSocket] Received document state from server, size:', docState.length);
            this.callbacks.onSyncResponse(docState, isFirstUser);
          } else {
            console.log('[WebSocket] No document state - isFirstUser:', isFirstUser);
            // Pass empty Uint8Array
            this.callbacks.onSyncResponse(new Uint8Array(0), isFirstUser);
          }
          break;

        case 'change':
          if (message.changes && message.senderId !== this.userId) {
            // Convert array back to Uint8Array
            const changes = Array.isArray(message.changes)
              ? new Uint8Array(message.changes)
              : message.changes;
            this.callbacks.onRemoteChange(changes, message.senderId);
          }
          break;

        case 'presence':
          if (message.presence && message.senderId !== this.userId) {
            this.callbacks.onPresenceUpdate(message.presence);
          }
          break;
      }
    } catch (error) {
      console.error('Failed to handle message:', error);
    }
  }

  private scheduleReconnect(): void {
    setTimeout(() => {
      this.connect();
      this.reconnectTimeout = Math.min(this.reconnectTimeout * 2, this.maxReconnectTimeout);
    }, this.reconnectTimeout);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
