import { IncomingEvent, WSClient } from "./types";
import { broadcastAll, broadcastToChannel, broadcastToUsers } from "./broadcaster";
import { joinChannel, leaveChannel } from "./connection-manager";

const TYPING_DEBOUNCE_MS = Number(process.env.WS_TYPING_DEBOUNCE_MS || 150);

export function handleEvent(event: IncomingEvent, client: WSClient) {
  switch (event.type) {
    case "channel.join": {
      joinChannel(client.id, event.payload.channelId);
      return;
    }
    case "channel.leave": {
      leaveChannel(client.id, event.payload.channelId);
      return;
    }
    case "typing.start": {
      if (shouldDebounceTyping(client, event.payload.channelId)) return;
      broadcastToChannel(event.payload.channelId, {
        type: "typing.start",
        payload: { channelId: event.payload.channelId, userId: client.userId },
      });
      return;
    }
    case "typing.stop": {
      broadcastToChannel(event.payload.channelId, {
        type: "typing.stop",
        payload: { channelId: event.payload.channelId, userId: client.userId },
      });
      return;
    }
    case "receipt.read": {
      broadcastToChannel(event.payload.channelId, {
        type: "receipt.read",
        payload: {
          channelId: event.payload.channelId,
          userId: client.userId,
          messageId: event.payload.messageId,
          readAt: event.payload.readAt || new Date().toISOString(),
        },
      });
      return;
    }
    case "presence.ping": {
      // Presence stays alive via heartbeat; nothing to broadcast here.
      return;
    }
    case "message.push": {
      // For server-triggered fanout (e.g., HTTP handler calls into WS layer)
      broadcastToChannel(event.payload.channelId, {
        type: "message.new",
        payload: { channelId: event.payload.channelId, message: event.payload.message },
      });
      if (Array.isArray(event.payload.memberIds) && event.payload.memberIds.length) {
        broadcastToUsers(event.payload.memberIds, {
          type: "message.new",
          payload: { channelId: event.payload.channelId, message: event.payload.message },
        });
      }
      return;
    }
    case "delivery.ack": {
      // Echo back to sender; UI can clear optimistic state
      broadcastToUsers([client.userId], {
        type: "delivery.ack",
        payload: { messageId: event.payload.messageId },
      });
      return;
    }
    default:
      return;
  }
}

function shouldDebounceTyping(client: WSClient, channelId: string) {
  if (!client.lastTyping) client.lastTyping = new Map();
  const last = client.lastTyping.get(channelId) || 0;
  const now = Date.now();
  if (now - last < TYPING_DEBOUNCE_MS) return true;
  client.lastTyping.set(channelId, now);
  return false;
}
