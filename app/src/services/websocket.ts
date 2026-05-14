function notImplemented(fn: string, plano: string): never {
  throw new Error(`[websocket.${fn}] não implementado — responsável: ${plano}`);
}

export type WebSocketMessageHandler = (data: unknown) => void;

export interface ArenaWebSocket {
  send(payload: unknown): void;
  close(): void;
}

export function connectArena(
  _matchId: string,
  _onMessage: WebSocketMessageHandler,
): ArenaWebSocket {
  return notImplemented("connectArena", "Plano 03");
}
