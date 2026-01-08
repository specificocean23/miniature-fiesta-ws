import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { authenticate } from "./auth";
import { handleEvent } from "./event-handler";
import { broadcastAll, broadcastToChannel, broadcastToUsers } from "./broadcaster";
import { registerClient, unregisterClient } from "./connection-manager";
import { IncomingEvent, WSClient } from "./types";

const PORT = Number(process.env.WS_PORT || 3001);
const HEARTBEAT_MS = Number(process.env.WS_HEARTBEAT_MS || 25_000);

const app = express();
app.use(express.json());
const server = createServer(app);

const wss = new WebSocketServer({
  server,
  perMessageDeflate: {
    threshold: 1024,
  },
});

// HTTP publish endpoint for other services (e.g., HTTP message handlers)
app.post("/publish", (req, res) => {
  const secret = process.env.WS_PUBLISH_SECRET || "";
  if (!secret || req.header("x-ws-secret") !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { type, payload, channelId, memberIds } = req.body || {};

  // Support message fanout and generic channel/user broadcasts
  if (type === "message.new" && channelId && payload) {
    broadcastToChannel(channelId, { type: "message.new", payload });
    if (Array.isArray(memberIds) && memberIds.length) {
      broadcastToUsers(memberIds, { type: "message.new", payload });
    }
    return res.json({ ok: true });
  }

  if (type === "channel.new" && Array.isArray(memberIds)) {
    broadcastToUsers(memberIds, { type: "channel.new", payload });
    return res.json({ ok: true });
  }

  // Generic passthrough
  if (channelId && type) {
    broadcastToChannel(channelId, { type, payload } as any);
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: "Invalid publish payload" });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, clients: wss.clients.size });
});

wss.on("connection", (ws, req) => {
  const token = new URL(req.url || "", "http://localhost").searchParams.get("token");
  const decoded = authenticate(token || undefined);
  if (!decoded?.userId) {
    ws.close(4001, "Unauthorized");
    return;
  }

  (ws as any).isAlive = true;

  const clientId = `${decoded.userId}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
  const client: WSClient = {
    id: clientId,
    ws,
    userId: decoded.userId,
    channels: new Set(),
    sendQueue: [],
    isAlive: true,
  };

  registerClient(client);
  broadcastAll({ type: "presence.online", payload: { userId: client.userId } });

  ws.on("message", (data) => {
    try {
      const event = JSON.parse(data.toString()) as IncomingEvent;
      handleEvent(event, client);
    } catch (e) {
      // ignore malformed messages
    }
  });

  ws.on("pong", () => {
    (ws as any).isAlive = true;
  });

  ws.on("close", () => {
    unregisterClient(clientId);
    broadcastAll({ type: "presence.offline", payload: { userId: client.userId } });
  });

  ws.on("error", () => {
    // swallow
  });
});

// Heartbeat to drop dead connections
setInterval(() => {
  for (const socket of wss.clients) {
    const wsAny = socket as any;
    if (wsAny.isAlive === false) {
      socket.terminate();
      continue;
    }
    wsAny.isAlive = false;
    socket.ping();
  }
}, HEARTBEAT_MS);

server.listen(PORT, () => {
  console.log(`WebSocket server listening on :${PORT}`);
});
