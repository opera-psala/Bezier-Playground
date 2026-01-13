const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const Automerge = require('@automerge/automerge');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Store active sessions and their documents
const sessions = new Map();

// Session structure:
// {
//   id: string,
//   clients: Set<WebSocket>,
//   doc: Automerge.Doc | null, // Automerge document
//   lastActivity: number
// }

// Get or create session
function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      clients: new Set(),
      doc: null, // Will be initialized by first user
      lastActivity: Date.now(),
    });
  }
  return sessions.get(sessionId);
}

// Broadcast to all clients in a session except sender
function broadcast(session, message, sender) {
  session.clients.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

wss.on('connection', ws => {
  console.log('New client connected');

  let currentSession = null;
  let clientId = null;

  ws.on('message', data => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'sync-request': {
          // Join or create session (using default session for now)
          const sessionId = 'default';
          currentSession = getSession(sessionId);
          currentSession.clients.add(ws);
          currentSession.lastActivity = Date.now();
          clientId = message.senderId;

          const isFirstUser = currentSession.doc === null;
          console.log(`Client ${clientId} joining session ${sessionId}, isFirstUser: ${isFirstUser}`);

          // If no document exists, create the initial one NOW so all clients share the same lineage
          if (currentSession.doc === null) {
            console.log('Creating initial Automerge document on server');
            currentSession.doc = Automerge.from({
              curves: [],
              users: {}
            });
          }

          // ALWAYS send the document state so all clients have the same document
          const documentState = Array.from(Automerge.save(currentSession.doc));
          console.log(`Sending document state to ${clientId}, size: ${documentState.length}, isFirstUser: ${isFirstUser}`);

          const response = {
            type: 'sync-response',
            sessionId: sessionId,
            documentState: documentState,
            isFirstUser: isFirstUser,
          };
          ws.send(JSON.stringify(response));
          break;
        }

        case 'change': {
          if (!currentSession) break;

          currentSession.lastActivity = Date.now();

          // Apply the change to the server's Automerge document
          if (message.changes && currentSession.doc !== null) {
            try {
              const changeData = Array.isArray(message.changes)
                ? new Uint8Array(message.changes)
                : message.changes;

              // Apply the change to the server document
              const [newDoc] = Automerge.applyChanges(currentSession.doc, [changeData]);
              currentSession.doc = newDoc;

              console.log(`Applied change from ${message.senderId}, doc now has ${currentSession.doc.curves?.length || 0} curves, ${Object.keys(currentSession.doc.users || {}).length} users`);
            } catch (error) {
              console.error('Error applying change to server document:', error);
            }
          }

          // Broadcast changes to other clients
          broadcast(currentSession, message, ws);

          console.log(
            `Change from ${message.senderId} broadcasted to ${currentSession.clients.size - 1} clients`
          );
          break;
        }

        case 'presence': {
          if (!currentSession) break;

          // Just broadcast presence updates
          broadcast(currentSession, message, ws);
          break;
        }
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });

  ws.on('close', () => {
    if (currentSession) {
      currentSession.clients.delete(ws);
      console.log(`Client ${clientId} disconnected from session ${currentSession.id}`);

      // Clean up empty sessions
      if (currentSession.clients.size === 0) {
        setTimeout(() => {
          if (currentSession.clients.size === 0 && Date.now() - currentSession.lastActivity > 60000) {
            sessions.delete(currentSession.id);
            console.log(`Session ${currentSession.id} cleaned up`);
          }
        }, 60000);
      }
    }
  });

  ws.on('error', error => {
    console.error('WebSocket error:', error);
  });
});

// Cleanup old sessions periodically
setInterval(() => {
  const now = Date.now();
  sessions.forEach((session, sessionId) => {
    if (session.clients.size === 0 && now - session.lastActivity > 3600000) {
      sessions.delete(sessionId);
      console.log(`Cleaned up inactive session: ${sessionId}`);
    }
  });
}, 600000); // Every 10 minutes

console.log(`WebSocket server running on port ${PORT}`);
