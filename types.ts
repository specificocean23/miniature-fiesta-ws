export type IncomingEvent =
  | { type: "channel.join"; payload: { channelId: string } }
  | { type: "channel.leave"; payload: { channelId: string } }
  | { type: "typing.start"; payload: { channelId: string } }
  | { type: "typing.stop"; payload: { channelId: string } }
  | { type: "receipt.read"; payload: { channelId: string; messageId: string; readAt?: string } }
  | { type: "presence.ping"; payload?: Record<string, never> }
  | { type: "message.push"; payload: { channelId: string; message: any; memberIds?: string[] } } // server-triggered fanout
  | { type: "delivery.ack"; payload: { messageId: string } };

export type OutgoingEvent =
  | { type: "presence.online"; payload: { userId: string } }
  | { type: "presence.offline"; payload: { userId: string } }
  | { type: "typing.start"; payload: { channelId: string; userId: string } }
  | { type: "typing.stop"; payload: { channelId: string; userId: string } }
  | { type: "receipt.read"; payload: { channelId: string; userId: string; messageId: string; readAt: string } }
  | { type: "message.new"; payload: { channelId: string; message: any } }
  | { type: "channel.new"; payload: { channel: any } }
  | { type: "delivery.ack"; payload: { messageId: string } };

export interface AuthToken {
  userId: string;
  iat?: number;
  exp?: number;
}

export interface WSClient {
  id: string;
  ws: import("ws").WebSocket;
  userId: string;
  channels: Set<string>;
  sendQueue: string[];
  flushTimer?: NodeJS.Timeout;
  lastTyping?: Map<string, number>; // channelId -> ms timestamp
  isAlive: boolean;
}
