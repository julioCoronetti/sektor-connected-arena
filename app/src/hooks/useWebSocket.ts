export interface UseWebSocketResult {
  connected: boolean;
  send: (payload: unknown) => void;
  disconnect: () => void;
}

export function useWebSocket(
  _url: string,
  _onMessage?: (data: unknown) => void,
): UseWebSocketResult {
  throw new Error("[useWebSocket] não implementado — responsável: Plano 03");
}
