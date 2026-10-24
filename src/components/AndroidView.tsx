import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Wifi, 
  WifiOff, 
  Sun, 
  Maximize2, 
  Minimize2, 
  Check, 
  AlertCircle,
  RefreshCw,
  Power
} from 'lucide-react';
import { localBus } from '../services/localBus';
import { CapturedPhoto, CameraCapabilities } from '../types';

interface AndroidViewProps {
  serverIp: string;
}

export default function AndroidView({ serverIp }: AndroidViewProps) {
  // Displayed text (<=255 chars, large font, dark gray over pure AMOLED black)
  const [displayText, setDisplayText] = useState<string>(() => {
    return localStorage.getItem('last_android_text') || 'SYSTEM READY: WAITING FOR USER ACTION';
  });

  // Connection & Wake Lock status
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [lastPhotoTime, setLastPhotoTime] = useState<string>('');
  const [flashFeedback, setFlashFeedback] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');

  // Hardware Camera references
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const imageCaptureRef = useRef<any>(null);
  const wakeLockSentinelRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Screen Wake Lock API implementation (Section 5.5)
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockSentinelRef.current = await (navigator as any).wakeLock.request('screen');
        setWakeLockActive(true);
        wakeLockSentinelRef.current.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      } catch (err) {
        console.warn('Wake Lock request error:', err);
        setWakeLockActive(false);
      }
    }
  };

  // Visibility change auto-recovery for Wake Lock
  useEffect(() => {
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockSentinelRef.current) {
        try {
          wakeLockSentinelRef.current.release();
        } catch {}
      }
    };
  }, []);

  // 2. Camera Initialization (Back camera preferred, high resolution)
  const startCamera = async () => {
    setCameraError('');
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      // Constraints asking for environmental back camera with maximum resolution
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 3840, min: 1920 },
          height: { ideal: 2160, min: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const track = stream.getVideoTracks()[0];
      if (track) {
        // Probe capabilities
        let hasManualFocus = false;
        try {
          const caps = (track as any).getCapabilities ? (track as any).getCapabilities() : {};
          hasManualFocus = Boolean(caps.focusDistance || (caps.focusMode && caps.focusMode.includes('manual')));
        } catch {}

        // Initialize ImageCapture API if available
        if ('ImageCapture' in window) {
          try {
            imageCaptureRef.current = new (window as any).ImageCapture(track);
          } catch (e) {
            console.warn('ImageCapture constructor failed:', e);
          }
        }

        const capabilities: CameraCapabilities = {
          supported: true,
          hasManualFocus,
          minFocusDistance: 0.1,
          maxFocusDistance: 1.0,
          stepFocusDistance: 0.01,
          currentFocusDistance: 0.28,
          isAutoFocus: !hasManualFocus,
          label: track.label || 'Redmi Note 10S Back Camera',
        };

        // Broadcast status to Windows
        localBus.send('ANDROID_STATUS', { online: true, capabilities });
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Camera access could not be acquired:', err);
      setCameraError(err.message || 'Câmera ocupada ou permissão pendente');
      setCameraActive(false);
    }
  };

  // 3. Take Photo Handler
  const capturePhoto = async (targetFocusDistance?: number): Promise<void> => {
    setFlashFeedback(true);
    setTimeout(() => setFlashFeedback(false), 200);

    let photoBlob: Blob | null = null;
    let width = 3840;
    let height = 2160;

    // A. Preferred ImageCapture API
    if (imageCaptureRef.current && typeof imageCaptureRef.current.takePhoto === 'function') {
      try {
        photoBlob = await imageCaptureRef.current.takePhoto();
      } catch (err) {
        console.warn('ImageCapture.takePhoto failed, falling back to canvas grab:', err);
      }
    }

    // B. Fallback: Video Frame Grab to Canvas
    if (!photoBlob && videoRef.current && videoRef.current.videoWidth > 0) {
      const v = videoRef.current;
      width = v.videoWidth;
      height = v.videoHeight;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(v, 0, 0, width, height);
        photoBlob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.95));
      }
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour12: false });
    setLastPhotoTime(timeStr);

    if (photoBlob) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const fname = `CAPT_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours()}${now.getMinutes()}${now.getSeconds()}.jpg`;
        const photo: CapturedPhoto = {
          id: `photo-${Date.now()}`,
          url: dataUrl,
          timestamp: timeStr,
          filename: fname,
          width,
          height,
          sizeBytes: photoBlob?.size || 0,
          focusDistance: targetFocusDistance || 0.28,
        };

        // 1. Upload directly to Node server disk storage
        fetch('/api/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: dataUrl,
            filename: fname,
            width,
            height,
            focusDistance: targetFocusDistance || 0.28,
          }),
        }).catch((err) => console.warn('Falha no upload para o servidor:', err));

        // 2. Notify Windows via localBus / WebSocket
        localBus.send('PHOTO_READY', photo);
      };
      reader.readAsDataURL(photoBlob);
    } else {
      console.warn('No photo blob could be generated from hardware stream');
    }
  };

  // Apply focus constraints if supported
  const applyFocus = async (distance: number) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && (track as any).applyConstraints) {
      try {
        await (track as any).applyConstraints({
          advanced: [{ focusMode: 'manual', focusDistance: distance }],
        });
      } catch (e) {
        console.warn('Could not apply focusDistance:', e);
      }
    }
  };

  const triggerAutoFocus = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && (track as any).applyConstraints) {
      try {
        await (track as any).applyConstraints({
          advanced: [{ focusMode: 'continuous' }],
        });
      } catch (e) {
        console.warn('Could not trigger continuous focus:', e);
      }
    }
  };

  // Listen to remote commands from Windows
  useEffect(() => {
    startCamera();

    const unsubscribe = localBus.subscribe((msg) => {
      if (msg.type === 'SYNC_TEXT' && msg.payload?.text !== undefined) {
        setDisplayText(msg.payload.text);
      } else if (msg.type === 'CLEAR_TEXT') {
        setDisplayText('');
      } else if (msg.type === 'TAKE_PHOTO') {
        capturePhoto(msg.payload?.focusDistance);
      } else if (msg.type === 'SET_FOCUS' && msg.payload?.distance !== undefined) {
        applyFocus(msg.payload.distance);
      } else if (msg.type === 'AUTO_FOCUS') {
        triggerAutoFocus();
      } else if (msg.type === 'PING') {
        localBus.send('PONG', { device: 'android' });
      }
    });

    // Notify initial status
    localBus.send('ANDROID_STATUS', { online: true });

    return () => {
      unsubscribe();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full min-h-[580px] h-full bg-[#000000] text-[#666666] flex flex-col justify-between p-6 select-none overflow-hidden rounded-2xl border border-neutral-900 shadow-2xl"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Hidden Hardware Camera Video Stream (Kept active in background without rendering to save GPU/thermal) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute opacity-0 pointer-events-none w-1 h-1"
      />

      {/* Camera Shutter Flash Effect */}
      {flashFeedback && (
        <div className="absolute inset-0 bg-white/30 z-50 pointer-events-none transition-opacity duration-150" />
      )}

      {/* Initial One-Touch Setup Overlay (Section 5.2) */}
      {!cameraActive && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-6 text-center z-40">
          <div className="max-w-md space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-emerald-400">
              <Camera className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-neutral-200">Setup Inicial do Redmi Note 10S</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Toque no botão abaixo para autorizar a <strong>Câmera Traseira</strong> e ativar a <strong>Trava de Tela (Wake Lock)</strong>. Depois disso, nenhuma interação adicional na tela do celular será necessária por horas.
            </p>
            <button
              onClick={() => {
                startCamera();
                requestWakeLock();
              }}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/30 transition-transform active:scale-95"
            >
              Toque para Iniciar Câmera & Wake Lock
            </button>
            {cameraError && (
              <p className="text-[11px] text-amber-500 bg-neutral-900 p-2 rounded border border-neutral-800">
                Aviso: {cameraError}. Toque no botão acima para permitir o acesso.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Top Status Bar (Discreet, section 5.4: "Indicadores discretos apenas para conexão, erro ou status essencial") */}
      <div className="flex items-center justify-between text-[11px] text-[#444444] font-mono tracking-wider">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-600' : 'bg-red-600'}`} />
            <span>{isConnected ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          <div className="flex items-center gap-1 text-[#444444]">
            <Sun className={`w-3 h-3 ${wakeLockActive ? 'text-amber-500' : 'text-[#333333]'}`} />
            <span>{wakeLockActive ? 'WAKELOCK ATIVO' : 'WAKELOCK INATIVO'}</span>
          </div>

          {cameraActive ? (
            <div className="flex items-center gap-1 text-[#444444]">
              <Camera className="w-3 h-3 text-emerald-500" />
              <span>CÂMERA 16MP PRONTA</span>
            </div>
          ) : (
            <button
              onClick={startCamera}
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 underline"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Ativar Câmera</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {lastPhotoTime && (
            <span>ÚLTIMA FOTO: {lastPhotoTime}</span>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-1 hover:text-[#888888] transition-colors"
            title="Alternar Tela Cheia"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Center Display: Text sent from Windows (Section 5.4: "Fundo completamente preto, texto na cor cinza-escuro, fonte grande, adequada para leitura por outra pessoa, quebra de linha automática") */}
      <div className="flex-1 flex items-center justify-center py-8 px-4 text-center">
        <div 
          className="max-w-4xl text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-wide break-words leading-relaxed select-text transition-all duration-300"
          style={{ color: '#686868', textShadow: '0 0 2px rgba(0,0,0,0.8)' }}
        >
          {displayText ? (
            displayText
          ) : (
            <span className="text-[#333333] italic text-xl font-normal">
              [Tela pronta aguardando texto do Windows...]
            </span>
          )}
        </div>
      </div>

      {/* Bottom Minimalist Bar */}
      <div className="flex items-center justify-between text-[11px] text-[#3a3a3a] font-mono border-t border-[#151515] pt-3">
        <div>
          <span>REDMI NOTE 10S · AMOLED BLACK #000000 · 28CM</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{displayText.length}/255 CARACTERES</span>
          <span>·</span>
          <span>CARREGADOR CONECTADO</span>
        </div>
      </div>
    </div>
  );
}
