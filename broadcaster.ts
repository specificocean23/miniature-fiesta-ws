import { WSClient, OutgoingEvent } from "./types";
import { getAllClients, getClientsByChannel, getClientsByUserIds } from "./connection-manager";

const BATCH_DELAY_MS = Number(process.env.WS_BATCH_DELAY_MS || 15);

function enqueue(client: WSClient, data: string) {
  client.sendQueue.push(data);
  if (client.flushTimer) return;
  client.flushTimer = setTimeout(() => flush(client), BATCH_DELAY_MS);
}

function flush(client: WSClient) {
  client.flushTimer = undefined;
  if (client.sendQueue.length === 0) return;
  if (client.ws.readyState !== client.ws.OPEN) {
    client.sendQueue = [];
    return;
  }
  for (const msg of client.sendQueue) {
    client.ws.send(msg);
  }
  client.sendQueue = [];
}

function serialize(event: OutgoingEvent) {
  return JSON.stringify(event);
}

export function broadcastAll(event: OutgoingEvent) {
  const payload = serialize(event);
  for (const client of getAllClients()) {
    enqueue(client, payload);
  }
}

export function broadcastToChannel(channelId: string, event: OutgoingEvent) {
  const payload = serialize(event);
  for (const client of getClientsByChannel(channelId)) {
    enqueue(client, payload);
  }
}

export function broadcastToUsers(userIds: string[], event: OutgoingEvent) {
  const payload = serialize(event);
  for (const client of getClientsByUserIds(userIds)) {
    enqueue(client, payload);
  }
}
