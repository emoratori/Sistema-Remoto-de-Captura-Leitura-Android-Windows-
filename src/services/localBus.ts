import { AppSyncMessage, CapturedPhoto } from '../types';

type MessageHandler = (msg: AppSyncMessage) => void;

class LocalMessageBus {
  private channel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private listeners: Set<MessageHandler> = new Set();
  private isConnectedToWs: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('android_windows_remote_bus');
        this.channel.onmessage = (event) => {
          this.notifyListeners(event.data);
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported or restricted:', err);
      }
    }
  }

  public subscribe(handler: MessageHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  private notifyListeners(msg: AppSyncMessage) {
    this.listeners.forEach((fn) => {
      try {
        fn(msg);
      } catch (e) {
        console.error('Error in message listener', e);
      }
    });
  }

  public send(type: AppSyncMessage['type'], payload?: any) {
    const msg: AppSyncMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };

    // 1. Broadcast locally to other tabs/windows
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (err) {
        console.warn('Failed to broadcast message:', err);
      }
    }

    // 2. Also notify local listeners in current window
    this.notifyListeners(msg);

    // 3. If connected to real local WebSocket server, send via WS
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  public initAutoConnect(preferredIp?: string) {
    if (typeof window === 'undefined') return;

    const host = preferredIp || window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const port = window.location.port ? `:${window.location.port}` : '';
    const wsUrl = `${protocol}//${host}${port}`;

    this.connectWebSocket(wsUrl);

    // Heartbeat ping every 4 seconds to maintain connection and announce presence
    setInterval(() => {
      this.send('PING', { client: 'heartbeat' });
    }, 4000);
  }

  public connectWebSocket(serverUrl: string, onStatusChange?: (connected: boolean) => void) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const wsUrl = serverUrl.replace(/^http/, 'ws');
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnectedToWs = true;
        if (onStatusChange) onStatusChange(true);
        this.send('PING', { client: 'webapp' });
      };

      this.ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          this.notifyListeners(data);
        } catch {
          // non-json
        }
      };

      this.ws.onerror = () => {
        this.isConnectedToWs = false;
        if (onStatusChange) onStatusChange(false);
      };

      this.ws.onclose = () => {
        this.isConnectedToWs = false;
        if (onStatusChange) onStatusChange(false);
        // Retry connection after 3s
        setTimeout(() => {
          if (!this.isConnectedToWs) {
            this.connectWebSocket(serverUrl, onStatusChange);
          }
        }, 3000);
      };
    } catch (e) {
      this.isConnectedToWs = false;
      if (onStatusChange) onStatusChange(false);
      setTimeout(() => {
        if (!this.isConnectedToWs) {
          this.connectWebSocket(serverUrl, onStatusChange);
        }
      }, 4000);
    }
  }
}

export const localBus = new LocalMessageBus();

// Auto-initialize connection in browser environment
if (typeof window !== 'undefined') {
  localBus.initAutoConnect();
}

// Photo Storage helper (IndexedDB / LocalStorage)
const STORAGE_KEY = 'remote_capture_photos_v1';

export function getSavedPhotos(): CapturedPhoto[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function savePhoto(photo: CapturedPhoto): CapturedPhoto[] {
  try {
    const existing = getSavedPhotos();
    // Prepend newest
    const updated = [photo, ...existing.filter((p) => p.id !== photo.id)].slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Failed to save photo to localStorage:', e);
    return [];
  }
}

export function deleteSavedPhoto(id: string): CapturedPhoto[] {
  try {
    const existing = getSavedPhotos();
    const updated = existing.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}
