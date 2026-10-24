export interface CapturedPhoto {
  id: string;
  url: string;
  timestamp: string;
  filename: string;
  width: number;
  height: number;
  sizeBytes: number;
  focusDistance?: number;
}

export interface SelectionRect {
  x: number; // percentage 0-100 or pixels
  y: number;
  width: number;
  height: number;
}

export interface CameraCapabilities {
  supported: boolean;
  hasManualFocus: boolean;
  minFocusDistance: number;
  maxFocusDistance: number;
  stepFocusDistance: number;
  currentFocusDistance: number;
  isAutoFocus: boolean;
  label: string;
}

export interface ServerState {
  serverIp: string;
  port: number;
  isHttps: boolean;
  connected: boolean;
  androidOnline: boolean;
  windowsOnline: boolean;
  lastPing: number;
}

export interface AppSyncMessage {
  type: 
    | 'SYNC_TEXT' 
    | 'CLEAR_TEXT' 
    | 'TAKE_PHOTO' 
    | 'PHOTO_READY' 
    | 'SET_FOCUS' 
    | 'AUTO_FOCUS' 
    | 'ANDROID_STATUS' 
    | 'SERVER_TELEMETRY'
    | 'REGISTER'
    | 'HEARTBEAT'
    | 'PING' 
    | 'PONG';
  payload?: any;
  timestamp: number;
}
