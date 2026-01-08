import { WSClient } from "./types";

const clients = new Map<string, WSClient>();
const channels = new Map<string, Set<string>>(); // channelId -> clientIds
const users = new Map<string, Set<string>>(); // userId -> clientIds

export function registerClient(client: WSClient) {
  clients.set(client.id, client);
  let userSet = users.get(client.userId);
  if (!userSet) {
    userSet = new Set();
    users.set(client.userId, userSet);
  }
  userSet.add(client.id);
}

export function unregisterClient(clientId: string) {
  const client = clients.get(clientId);
  if (!client) return;

  // Remove from channel maps
  for (const channelId of client.channels) {
    const set = channels.get(channelId);
    if (set) {
      set.delete(clientId);
      if (set.size === 0) channels.delete(channelId);
    }
  }

  // Remove from user map
  const userSet = users.get(client.userId);
  if (userSet) {
    userSet.delete(client.id);
    if (userSet.size === 0) users.delete(client.userId);
  }

  clients.delete(clientId);
}

export function joinChannel(clientId: string, channelId: string) {
  const client = clients.get(clientId);
  if (!client) return;
  client.channels.add(channelId);
  let set = channels.get(channelId);
  if (!set) {
    set = new Set();
    channels.set(channelId, set);
  }
  set.add(clientId);
}

export function leaveChannel(clientId: string, channelId: string) {
  const client = clients.get(clientId);
  if (!client) return;
  client.channels.delete(channelId);
  const set = channels.get(channelId);
  if (set) {
    set.delete(clientId);
    if (set.size === 0) channels.delete(channelId);
  }
}

export function getClient(clientId: string) {
  return clients.get(clientId);
}

export function getClientsByUserIds(userIds: string[]): WSClient[] {
  const result: WSClient[] = [];
  for (const userId of userIds) {
    const ids = users.get(userId);
    if (!ids) continue;
    for (const id of ids) {
      const client = clients.get(id);
      if (client) result.push(client);
    }
  }
  return result;
}

export function getClientsByChannel(channelId: string): WSClient[] {
  const ids = channels.get(channelId);
  if (!ids) return [];
  const result: WSClient[] = [];
  for (const id of ids) {
    const client = clients.get(id);
    if (client) result.push(client);
  }
  return result;
}

export function getAllClients(): WSClient[] {
  return Array.from(clients.values());
}
