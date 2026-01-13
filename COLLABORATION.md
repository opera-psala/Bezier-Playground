# Collaborative Editing Setup Guide

Your Bezier Playground now supports real-time collaborative editing using Automerge CRDTs!

## What Was Added

### Frontend Changes
- ✅ Automerge CRDT integration for conflict-free merging
- ✅ WebSocket client for real-time synchronization
- ✅ Presence indicators (user cursors, active curve highlights, online users list)
- ✅ Collaboration UI toggle button
- ✅ Dual history system (local branching + collaborative merging)

### Backend
- ✅ WebSocket server for broadcasting changes
- ✅ Session management with automatic cleanup
- ✅ Document state persistence for new clients

### Files Created
```
src/collaboration/
  ├── AutomergeManager.ts         # CRDT document operations
  ├── CollaborationManager.ts     # Main coordinator
  ├── PresenceRenderer.ts         # Renders remote user cursors/highlights
  └── WebSocketClient.ts          # WebSocket connection handler

src/managers/
  └── CollaborationUIManager.ts   # UI controls for collaboration

server/
  ├── websocket-server.js         # WebSocket server
  ├── package.json                # Server dependencies
  ├── render.yaml                 # Render.com deployment config
  └── README.md                   # Server documentation
```

### Files Modified
- `src/types.ts` - Added collaborative types (User, CollaborativeState, etc.)
- `src/history.ts` - Added collaboration hooks and RemoteStateUpdateCommand
- `src/managers/StateManager.ts` - Added remote change handling
- `src/main.ts` - Initialized collaboration system
- `index.html` - Added collaboration UI elements and styles

## Local Development

### 1. Start the WebSocket Server

```bash
cd server
npm install
npm start
```

Server runs on http://localhost:8080

### 2. Start the Frontend

```bash
npm run dev
```

Frontend runs on http://localhost:5173

### 3. Test Collaboration

1. Open http://localhost:5173 in two browser windows
2. Click "Enable Collaboration" in both windows
3. Try these actions:
   - Add a point in window A → see it appear in window B
   - Move a point in window A → watch it move in window B
   - See cursors and active curve highlights from the other user
   - Check the online users list

## Production Deployment

### Deploy WebSocket Server to Render.com (Free)

1. **Create Render.com Account**
   - Go to https://render.com and sign up (free)

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: bezier-collab-server
     - **Root Directory**: `server`
     - **Environment**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Instance Type**: Free

3. **Copy WebSocket URL**
   - After deployment, copy the URL (e.g., `bezier-collab-server.onrender.com`)

4. **Update Vercel Environment**
   - Go to your Vercel project settings
   - Add environment variable:
     ```
     VITE_WS_SERVER_URL=wss://bezier-collab-server.onrender.com
     ```
   - Redeploy frontend

## How It Works

### Architecture

```
Browser A                  WebSocket Server              Browser B
    │                            │                            │
    │──── Connect ──────────────>│                            │
    │                            │<──── Connect ──────────────│
    │                            │                            │
    │──── Add Point ────────────>│                            │
    │                            │──── Broadcast Point ──────>│
    │                            │                            │
    │                            │<──── Move Point ───────────│
    │<──── Broadcast Move ───────│                            │
```

### Key Features

1. **Conflict-Free Merging**
   - Automerge CRDTs automatically merge concurrent edits
   - No conflicts when multiple users edit simultaneously

2. **Dual History System**
   - Local: Tree-based branching history for undo/redo
   - Collaborative: Automerge handles merging from remote users
   - Undo/redo disabled during active collaboration to prevent conflicts

3. **Independent User State**
   - Each user has their own active curve selection
   - Each user sees their own cursor
   - Other users' cursors and selections are visualized

4. **Presence Indicators**
   - User cursors with names
   - Active curve highlights in user's color
   - Online users list with avatars

## Testing Checklist

- [x] All 199 existing tests pass
- [ ] Manual: Add point in window A appears in window B
- [ ] Manual: Move point syncs between windows
- [ ] Manual: Delete point syncs between windows
- [ ] Manual: Cursors visible for remote users
- [ ] Manual: Active curve highlighted for remote users
- [ ] Manual: Online users list updates correctly
- [ ] Manual: Reconnection after disconnect works
- [ ] Manual: New user joining sees current state

## Troubleshooting

### WebSocket Won't Connect

1. Check server is running: `cd server && npm start`
2. Verify URL in browser console
3. Check firewall/network settings

### Changes Not Syncing

1. Open browser console and check for errors
2. Verify both users have collaboration enabled
3. Try refreshing both windows

### Render.com Free Tier Spinning Down

- Free tier sleeps after 15 minutes of inactivity
- First connection after sleep takes ~30 seconds
- Upgrade to paid tier for always-on server

## Future Enhancements

- [ ] Named sessions/rooms (URL-based)
- [ ] Persistent storage (save sessions to database)
- [ ] User authentication
- [ ] Conflict notification UI
- [ ] Mobile/touch support
- [ ] Voice/video chat integration

## Support

For issues or questions about the collaboration feature, check:
- `server/README.md` for server-specific info
- GitHub issues at https://github.com/anthropics/claude-code/issues
