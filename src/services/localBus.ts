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
    const wsUrl = `${protocol}//${host}${port}/ws`;

    this.connectWebSocket(wsUrl);

    // Periodically fetch server status as a fallback and ground truth
    setInterval(async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          this.notifyListeners({
            type: 'ANDROID_STATUS',
            payload: { online: Boolean(data.androidConnected), serverStats: data },
            timestamp: Date.now(),
          });
        }
      } catch {
        // server might not be running REST yet
      }
    }, 3000);
  }

  public connectWebSocket(serverUrl: string, onStatusChange?: (connected: boolean) => void) {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const wsUrl = serverUrl.replace(/^http/, 'ws');
      this.ws = new WebSocket(wsUrl);

      const isAndroidClient = typeof window !== 'undefined' && (
        window.location.hash === '#android' || window.location.search.includes('android')
      );

      this.ws.onopen = () => {
        this.isConnectedToWs = true;
        if (onStatusChange) onStatusChange(true);

        // Register role on server
        this.send('REGISTER', {
          device: isAndroidClient ? 'android' : 'windows',
        });

        // Android heartbeat loop
        if (isAndroidClient) {
          setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({
                type: 'HEARTBEAT',
                payload: { device: 'android' },
                timestamp: Date.now(),
              }));
            }
          }, 2500);
        }
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

// Photo Storage helper (In-memory + safe LocalStorage)
const STORAGE_KEY = 'remote_capture_photos_v1';
let inMemoryPhotos: CapturedPhoto[] = [];

export function getSavedPhotos(): CapturedPhoto[] {
  if (inMemoryPhotos.length > 0) return inMemoryPhotos;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    inMemoryPhotos = JSON.parse(raw);
    return inMemoryPhotos;
  } catch {
    return inMemoryPhotos;
  }
}

export function savePhoto(photo: CapturedPhoto): CapturedPhoto[] {
  try {
    const existing = inMemoryPhotos.length > 0 ? inMemoryPhotos : getSavedPhotos();
    const updated = [photo, ...existing.filter((p) => p.id !== photo.id)].slice(0, 50);
    inMemoryPhotos = updated;

    // Safely persist to localStorage, omitting huge base64 strings (>300KB) to prevent QuotaExceededError
    try {
      const lightweightToPersist = updated.map((p) => {
        if (p.url && p.url.startsWith('data:') && p.url.length > 300000) {
          // If it's a huge base64, save metadata without the huge string in localStorage
          // (it stays in inMemoryPhotos and on the server disk)
          return { ...p, url: p.filename ? `/photos/${p.filename}` : '' };
        }
        return p;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweightToPersist));
    } catch (quotaErr) {
      console.warn('LocalStorage quota limit reached, keeping photo in memory:', quotaErr);
    }

    return updated;
  } catch (e) {
    console.warn('Failed to save photo:', e);
    // NEVER return empty array! Return at least the current photo in memory
    inMemoryPhotos = [photo, ...inMemoryPhotos.filter((p) => p.id !== photo.id)];
    return inMemoryPhotos;
  }
}

export function deleteSavedPhoto(id: string): CapturedPhoto[] {
  try {
    const existing = inMemoryPhotos.length > 0 ? inMemoryPhotos : getSavedPhotos();
    const updated = existing.filter((p) => p.id !== id);
    inMemoryPhotos = updated;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    inMemoryPhotos = inMemoryPhotos.filter((p) => p.id !== id);
    return inMemoryPhotos;
  }
}
