# Bezier Collaboration WebSocket Server

This is the WebSocket server for the Bezier Playground collaborative editing feature.

## Local Development

```bash
cd server
npm install
npm start
```

The server will run on port 8080 by default.

## Deployment to Render.com (Free Tier)

1. Create a Render.com account at https://render.com
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: bezier-collab-server (or your choice)
   - **Environment**: Node
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Instance Type**: Free

5. Click "Create Web Service"

6. Once deployed, copy the WebSocket URL (will be like `wss://bezier-collab-server.onrender.com`)

7. Update your Vercel environment variables:
   - Go to your Vercel project settings
   - Add environment variable: `VITE_WS_SERVER_URL=wss://your-server.onrender.com`
   - Redeploy your frontend

## Features

- Manages collaborative sessions
- Broadcasts state changes between clients
- Stores latest document state for new clients
- Automatic session cleanup
- Reconnection support

## Environment Variables

- `PORT`: Server port (default: 8080)
