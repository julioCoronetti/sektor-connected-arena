import { act, renderHook } from "@testing-library/react-native";

import { useWebSocket } from "../useWebSocket";

interface FakeWS {
  url: string;
  readyState: number;
  send: jest.Mock<void, [string]>;
  close: jest.Mock<void, []>;
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
}

const instances: FakeWS[] = [];

class MockWebSocket implements FakeWS {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  send = jest.fn<void, [string]>();
  close = jest.fn<void, []>(() => {
    this.readyState = MockWebSocket.CLOSED;
  });
  onopen: FakeWS["onopen"] = null;
  onmessage: FakeWS["onmessage"] = null;
  onerror: FakeWS["onerror"] = null;
  onclose: FakeWS["onclose"] = null;

  // Satisfy WebSocket interface minimally for TS
  binaryType = "blob" as BinaryType;
  bufferedAmount = 0;
  extensions = "";
  protocol = "";
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  dispatchEvent = jest.fn(() => true);
  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    instances.push(this);
  }
}

describe("useWebSocket", () => {
  const realWebSocket = global.WebSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    instances.length = 0;
    (global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket =
      MockWebSocket;
  });

  afterEach(() => {
    jest.useRealTimers();
    (global as unknown as { WebSocket: typeof realWebSocket }).WebSocket =
      realWebSocket;
  });

  it("opens a socket and reports status transitions", () => {
    const onMessage = jest.fn();
    const { result } = renderHook(() =>
      useWebSocket("wss://example/test", onMessage),
    );

    expect(result.current.status).toBe("connecting");
    expect(instances).toHaveLength(1);

    act(() => {
      const ws = instances[0];
      ws.readyState = MockWebSocket.OPEN;
      ws.onopen?.(new Event("open"));
    });
    expect(result.current.status).toBe("open");
  });

  it("parses incoming JSON messages and forwards them", () => {
    const onMessage = jest.fn();
    renderHook(() => useWebSocket("wss://example/test", onMessage));
    act(() => {
      instances[0].onmessage?.({ data: JSON.stringify({ type: "PING" }) });
    });
    expect(onMessage).toHaveBeenCalledWith({ type: "PING" });
  });

  it("ignores non-JSON payloads silently", () => {
    const onMessage = jest.fn();
    renderHook(() => useWebSocket("wss://example/test", onMessage));
    act(() => {
      instances[0].onmessage?.({ data: "not-json" });
    });
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("schedules a reconnect 3 seconds after a close event", () => {
    const onMessage = jest.fn();
    const { result } = renderHook(() =>
      useWebSocket("wss://example/test", onMessage),
    );

    act(() => {
      instances[0].readyState = MockWebSocket.OPEN;
      instances[0].onopen?.(new Event("open"));
    });
    expect(result.current.status).toBe("open");

    act(() => {
      instances[0].onclose?.(new CloseEvent("close"));
    });
    expect(result.current.status).toBe("reconnecting");
    expect(instances).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(3_000);
    });
    expect(instances).toHaveLength(2);
  });

  it("send() returns false when the socket is not open", () => {
    const { result } = renderHook(() =>
      useWebSocket("wss://example/test", jest.fn()),
    );
    expect(result.current.send({ foo: "bar" })).toBe(false);
  });

  it("send() serialises payload as JSON when the socket is open", () => {
    const { result } = renderHook(() =>
      useWebSocket("wss://example/test", jest.fn()),
    );
    act(() => {
      instances[0].readyState = MockWebSocket.OPEN;
      instances[0].onopen?.(new Event("open"));
    });
    const ok = result.current.send({ type: "ANSWER" });
    expect(ok).toBe(true);
    expect(instances[0].send).toHaveBeenCalledWith('{"type":"ANSWER"}');
  });

  it("does not reconnect after unmount", () => {
    const { unmount } = renderHook(() =>
      useWebSocket("wss://example/test", jest.fn()),
    );
    unmount();
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(instances).toHaveLength(1);
  });
});
