import {
  CAL_CHAT_DENIED_CLOSE_CODE,
  CAL_CHAT_ROTATE_CLOSE_CODE,
  calChatCallFrameSchema,
  type CalChatCallFrame,
  type CalChatClientFrame,
  type CalChatServerFrame,
  parseCalChatServerFrame,
} from "./types";

export type CalChatConnection = "connecting" | "live" | "reconnecting" | "denied";

export type CalChatSocket = {
  send: (data: string) => void;
  close: () => void;
  isOpen: () => boolean;
};

export type CalChatSocketHandlers = {
  onOpen: () => void;
  onMessage: (data: string) => void;
  onClose: (code: number) => void;
};

export type CalChatSocketFactory = (url: string, handlers: CalChatSocketHandlers) => CalChatSocket;

/** React Native's global WebSocket, wrapped to the few operations the client needs. */
export const createNativeSocket: CalChatSocketFactory = (url, handlers) => {
  const socket = new WebSocket(url);
  socket.onopen = handlers.onOpen;
  socket.onmessage = (event) => handlers.onMessage(String(event.data));
  socket.onclose = (event) => handlers.onClose(event.code);
  socket.onerror = () => undefined;
  return {
    send: (data) => socket.send(data),
    close: () => socket.close(),
    isOpen: () => socket.readyState === WebSocket.OPEN,
  };
};

export type CalChatSocketClientOptions = {
  /** The socket endpoint itself, `wss://i.cal.video/api/chat/socket`. */
  url: string;
  createSocket?: CalChatSocketFactory;
  /** Tokens live 60 s, so every connect asks for a new one. The token rides in the first frame. */
  fetchToken: () => Promise<string>;
  onFrame: (frame: CalChatServerFrame) => void;
  onCallFrame?: (frame: CalChatCallFrame) => void;
  onConnection: (connection: CalChatConnection) => void;
  /** The gateway refused the caller: chat may be off or membership may have lapsed. */
  onDenied?: () => void;
};

const PING_MS = 25_000;
const MAX_BACKOFF_MS = 30_000;

type Link = { socket: CalChatSocket; ready: boolean; retired: boolean; denied: boolean };

/**
 * One room socket: token, auth frame, ping, reconnect with jittered backoff, and make-before-break
 * rotation. On a `reconnect` frame it opens a replacement and drops the old socket only once the
 * new one is ready. Both deliver during the overlap; the reducer de-duplicates by message id.
 * A port of the web's `EventRoomSocketClient`, with the same close codes.
 */
export class CalChatSocketClient {
  private current: Link | null = null;
  private replacement: Link | null = null;
  private running = false;
  private generation = 0;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private waitingAfterDenial = false;
  private pingTimer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly options: CalChatSocketClientOptions) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.options.onConnection("connecting");
    void this.connect();
  }

  stop(): void {
    this.running = false;
    this.generation++;
    this.clearRetry();
    clearInterval(this.pingTimer);
    for (const link of [this.current, this.replacement]) {
      if (!link) continue;
      link.retired = true;
      link.socket.close();
    }
    this.current = null;
    this.replacement = null;
  }

  /** Skips the rest of a backoff wait, e.g. when the app comes back to the foreground. */
  retryNow(): void {
    if (!this.running || this.retryTimer === undefined || this.waitingAfterDenial) return;
    this.clearRetry();
    void this.connect();
  }

  /** False until the gateway has said `ready`; it drops anything sent earlier, so nothing is queued. */
  send(frame: CalChatClientFrame): boolean {
    const link = this.current;
    if (!link?.ready || !link.socket.isOpen()) return false;
    link.socket.send(JSON.stringify(frame));
    return true;
  }

  private async connect(): Promise<void> {
    const generation = this.generation;
    const link = await this.open(generation);
    if (generation !== this.generation || !this.running) return;
    if (!link) {
      this.scheduleRetry(false);
      return;
    }
    this.current = link;
  }

  private async open(generation: number): Promise<Link | null> {
    const token = await this.options.fetchToken().catch(() => null);
    if (token === null) return null;
    if (generation !== this.generation || !this.running) return null;
    const createSocket = this.options.createSocket ?? createNativeSocket;
    let link: Link | null = null;
    const socket = createSocket(this.options.url, {
      onOpen: () =>
        socket.send(JSON.stringify({ type: "auth", token } satisfies CalChatClientFrame)),
      onMessage: (data) => {
        if (link) this.handleMessage(link, data);
      },
      onClose: (code) => {
        if (link) this.handleClose(link, code);
      },
    });
    link = { socket, ready: false, retired: false, denied: false };
    return link;
  }

  private handleMessage(link: Link, data: string): void {
    if (link.retired) return;
    try {
      const json = JSON.parse(data);
      const callFrame = calChatCallFrameSchema.safeParse(json);
      if (callFrame.success && !("messageId" in json)) {
        this.options.onCallFrame?.(callFrame.data);
        return;
      }
    } catch {
      return;
    }
    const frame = parseCalChatServerFrame(data);
    if (!frame) return;
    if (frame.type === "reconnect") {
      if (link === this.current) void this.rotate();
      return;
    }
    if (frame.type === "denied") {
      link.denied = true;
      return;
    }
    if (frame.type === "ready") {
      link.ready = true;
      if (link === this.replacement) this.promote(link);
      this.attempt = 0;
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.send({ type: "ping" }), PING_MS);
      this.options.onConnection("live");
    }
    this.options.onFrame(frame);
  }

  private async rotate(): Promise<void> {
    if (this.replacement || !this.running) return;
    const from = this.current;
    const generation = this.generation;
    const link = await this.open(generation);
    if (!link) return;
    if (generation !== this.generation || this.current !== from || this.replacement) {
      link.retired = true;
      link.socket.close();
      return;
    }
    this.replacement = link;
  }

  private promote(link: Link): void {
    const previous = this.current;
    this.current = link;
    this.replacement = null;
    if (!previous) return;
    previous.retired = true;
    previous.socket.close();
  }

  private handleClose(link: Link, code: number): void {
    if (link.retired) return;
    link.retired = true;
    if (link === this.replacement) {
      this.replacement = null;
      return;
    }
    if (link !== this.current) return;
    this.current = null;
    clearInterval(this.pingTimer);
    if (!this.running) return;
    if (this.replacement) {
      this.current = this.replacement;
      this.replacement = null;
      return;
    }
    if (code === CAL_CHAT_DENIED_CLOSE_CODE || link.denied) {
      this.options.onDenied?.();
      this.scheduleRetry(true);
      return;
    }
    if (code === CAL_CHAT_ROTATE_CLOSE_CODE) {
      this.options.onConnection("reconnecting");
      void this.connect();
      return;
    }
    this.scheduleRetry(false);
  }

  private scheduleRetry(denied: boolean): void {
    if (!this.running) return;
    this.options.onConnection(denied ? "denied" : "reconnecting");
    const jitter = 0.5 + Math.random() / 2;
    const base = denied ? MAX_BACKOFF_MS : Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** this.attempt);
    this.attempt++;
    this.clearRetry();
    this.waitingAfterDenial = denied;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.connect();
    }, base * jitter);
  }

  private clearRetry(): void {
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.waitingAfterDenial = false;
  }
}
