import { getApiBaseUrl } from './api';

type PendingRequest = {
  resolve: (data: any) => void;
  reject: (err: Error) => void;
  onStatus?: (statusText: string) => void;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Persistent bidirectional WebSocket client for low-latency agent chat,
 * multi-step action streaming, and voice transcription.
 */
class RecareWebSocketManager {
  private ws: WebSocket | null = null;
  private connectPromise: Promise<WebSocket | null> | null = null;
  private pending = new Map<string, PendingRequest>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private async getWsUrl(): Promise<string> {
    const httpBase = await getApiBaseUrl();
    const wsBase = httpBase.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
    return `${wsBase}/api/v1/ws`;
  }

  async connect(): Promise<WebSocket | null> {
    if (typeof WebSocket === 'undefined') return null;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws;
    }
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = (async () => {
      try {
        const wsUrl = await this.getWsUrl();
        const socket = await new Promise<WebSocket | null>((resolve) => {
          let settled = false;
          const sock = new WebSocket(wsUrl);
          const timeout = setTimeout(() => {
            if (!settled) {
              settled = true;
              try {
                sock.close();
              } catch {}
              resolve(null);
            }
          }, 4500);

          sock.onopen = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            this.ws = sock;
            this.startHeartbeat();
            resolve(sock);
          };

          sock.onmessage = (event) => {
            this.handleMessage(String(event.data || ''));
          };

          sock.onerror = () => {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              resolve(null);
            }
          };

          sock.onclose = () => {
            this.stopHeartbeat();
            if (this.ws === sock) {
              this.ws = null;
            }
            for (const [reqId, item] of this.pending.entries()) {
              clearTimeout(item.timer);
              item.reject(new Error('WebSocket connection closed'));
              this.pending.delete(reqId);
            }
          };
        });
        return socket;
      } catch {
        return null;
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch {}
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      const reqId = msg.request_id;
      if (!reqId) return;
      const entry = this.pending.get(reqId);
      if (!entry) return;

      if (msg.type === 'status') {
        if (msg.text) entry.onStatus?.(msg.text);
        return;
      }

      clearTimeout(entry.timer);
      this.pending.delete(reqId);

      if (msg.type === 'error') {
        entry.reject(new Error(msg.error || 'WebSocket request failed'));
      } else {
        entry.resolve(msg.data);
      }
    } catch {}
  }

  async sendRequest<T>(
    type: string,
    payload: Record<string, any>,
    onStatus?: (statusText: string) => void,
    timeoutMs: number = 28000
  ): Promise<T | null> {
    const sock = await this.connect();
    if (!sock || sock.readyState !== WebSocket.OPEN) {
      return null;
    }

    const requestId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `ws_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return await new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('WebSocket request timed out'));
      }, timeoutMs);

      this.pending.set(requestId, { resolve, reject, onStatus, timer });
      try {
        sock.send(JSON.stringify({ type, request_id: requestId, ...payload }));
      } catch (err: any) {
        clearTimeout(timer);
        this.pending.delete(requestId);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
}

export const RecareWsClient = new RecareWebSocketManager();
