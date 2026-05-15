import { useCallback, useEffect, useRef, useState } from "react";

export type WebSocketStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface UseWebSocketResult {
  status: WebSocketStatus;
  send: (data: object) => boolean;
  disconnect: () => void;
}

const RECONNECT_DELAY_MS = 3_000;

/**
 * Hook fino sobre a API nativa de WebSocket. Tenta reconectar uma única vez
 * 3 segundos após o fechamento e expõe o status de conexão para a UI.
 */
export function useWebSocket(
  url: string,
  onMessage: (data: unknown) => void,
): UseWebSocketResult {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlerRef = useRef(onMessage);
  const teardownRef = useRef(false);
  const [status, setStatus] = useState<WebSocketStatus>("connecting");

  // Mantém o handler atual sem reconectar quando ele muda.
  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  const clearReconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (teardownRef.current) return;
    if (!url) return; // Sem URL ainda — aguarda configuração.
    setStatus((prev) => (prev === "reconnecting" ? "reconnecting" : "connecting"));
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (teardownRef.current) return;
      setStatus("open");
    };

    ws.onmessage = (event) => {
      if (teardownRef.current) return;
      const raw = event.data;
      try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        handlerRef.current(parsed);
      } catch {
        // Mensagem não-JSON: ignorada silenciosamente.
      }
    };

    ws.onerror = () => {
      // Erros disparam onclose subsequente; nada a fazer aqui.
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (teardownRef.current) {
        setStatus("closed");
        return;
      }
      setStatus("reconnecting");
      clearReconnect();
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, RECONNECT_DELAY_MS);
    };
  }, [url, clearReconnect]);

  const send = useCallback((data: object): boolean => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }, []);

  const disconnect = useCallback(() => {
    teardownRef.current = true;
    clearReconnect();
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
    setStatus("closed");
  }, [clearReconnect]);

  useEffect(() => {
    teardownRef.current = false;
    connect();
    return () => {
      teardownRef.current = true;
      clearReconnect();
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    };
  }, [connect, clearReconnect]);

  return { status, send, disconnect };
}
