import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Send, 
  Trash2, 
  FileText, 
  Copy, 
  Check, 
  Sliders, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Sparkles, 
  Wifi, 
  WifiOff, 
  Layers, 
  RefreshCw,
  Crop,
  Download,
  AlertCircle,
  Clock,
  Info,
  QrCode,
  X,
  Hand
} from 'lucide-react';
import QRCode from 'qrcode';
import { CapturedPhoto, SelectionRect, CameraCapabilities } from '../types';
import { localBus, getSavedPhotos, savePhoto, deleteSavedPhoto } from '../services/localBus';
import { runEnglishOcr, OcrResult } from '../services/tesseractOcr';
import { cropImageToCanvas } from '../services/imageProcessing';
import { generateSyntheticLaptopCapture } from '../data/samplePhotos';

interface WindowsControllerProps {
  serverIp: string;
  onServerIpChange: (ip: string) => void;
  isAndroidOnline: boolean;
  onSwitchToAndroidTab: () => void;
}

export default function WindowsController({
  serverIp,
  onServerIpChange,
  isAndroidOnline,
  onSwitchToAndroidTab
}: WindowsControllerProps) {
  // Photos state
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Focus state
  const [focusDistance, setFocusDistance] = useState<number>(() => {
    return Number(localStorage.getItem('last_focus_distance') || '0.28');
  });
  const [isAutoFocus, setIsAutoFocus] = useState<boolean>(false);
  const [cameraCapabilities, setCameraCapabilities] = useState<CameraCapabilities>({
    supported: true,
    hasManualFocus: true,
    minFocusDistance: 0.1,
    maxFocusDistance: 1.0,
    stepFocusDistance: 0.01,
    currentFocusDistance: 0.28,
    isAutoFocus: false,
    label: 'Redmi Note 10S (Samsung GW3 64MP)',
  });

  // Text sent to Android (max 255 chars)
  const [androidText, setAndroidText] = useState<string>(() => {
    return localStorage.getItem('last_android_text') || 'SYSTEM READY: WAITING FOR USER ACTION';
  });
  const [textDelivered, setTextDelivered] = useState<boolean>(true);

  // Pan & Zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select');
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // ROI / Selection Rectangle
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const selectStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // OCR state
  const [ocrRunning, setOcrRunning] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<{ percent: number; status: string }>({ percent: 0, status: '' });
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [copyingImage, setCopyingImage] = useState<boolean>(false);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);
  const [copyImageError, setCopyImageError] = useState<string | null>(null);
  const [useAntiMoire, setUseAntiMoire] = useState<boolean>(true);
  const [useOtsu, setUseOtsu] = useState<boolean>(false);

  // QR Code Modal for Android Setup
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Compute exact URL to access Android view
  const androidUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${serverIp || window.location.hostname}${window.location.port ? ':' + window.location.port : ''}/#android`
    : `https://${serverIp}:3000/#android`;

  useEffect(() => {
    QRCode.toDataURL(androidUrl, {
      width: 256,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(setQrDataUrl)
      .catch((err) => console.warn('QR code gen error:', err));
  }, [androidUrl]);

  // Load photos on mount from server disk or local fallback
  useEffect(() => {
    fetch('/api/photos')
      .then((res) => (res.ok ? res.json() : []))
      .then((serverPhotos: CapturedPhoto[]) => {
        if (serverPhotos && Array.isArray(serverPhotos) && serverPhotos.length > 0) {
          setPhotos(serverPhotos);
          setCurrentIndex(0);
          return;
        }
        loadLocalFallback();
      })
      .catch(() => {
        loadLocalFallback();
      });

    function loadLocalFallback() {
      const saved = getSavedPhotos();
      if (saved.length > 0) {
        setPhotos(saved);
        setCurrentIndex(0);
      } else {
        const sample1 = generateSyntheticLaptopCapture('code');
        const sample2 = generateSyntheticLaptopCapture('docs');
        const sample3 = generateSyntheticLaptopCapture('terminal');
        const initial = [sample1, sample2, sample3];
        setPhotos(initial);
        setCurrentIndex(0);
      }
    }
  }, []);

  // Listen to message bus from Android or local server
  useEffect(() => {
    const unsubscribe = localBus.subscribe((msg) => {
      if (msg.type === 'PHOTO_READY' && msg.payload) {
        const newPhoto: CapturedPhoto = msg.payload;
        setPhotos((prev) => {
          const filtered = prev.filter((p) => p.id !== newPhoto.id);
          return [newPhoto, ...filtered];
        });
        savePhoto(newPhoto);
        setCurrentIndex(0);
        setIsCapturing(false);
        // Clear old selection on new photo
        setSelection(null);
        setOcrResult(null);
      } else if (msg.type === 'ANDROID_STATUS' && msg.payload) {
        if (msg.payload.capabilities) {
          setCameraCapabilities(msg.payload.capabilities);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Synchronize text changes to Android with debounce
  useEffect(() => {
    localStorage.setItem('last_android_text', androidText);
    setTextDelivered(false);

    const timer = setTimeout(() => {
      localBus.send('SYNC_TEXT', { text: androidText });
      setTextDelivered(true);
    }, 150);

    return () => clearTimeout(timer);
  }, [androidText]);

  // Handle focus slider change
  const handleFocusChange = (val: number) => {
    setFocusDistance(val);
    setIsAutoFocus(false);
    localStorage.setItem('last_focus_distance', String(val));
    localBus.send('SET_FOCUS', { distance: val });
  };

  const handleTriggerAutoFocus = () => {
    setIsAutoFocus(true);
    localBus.send('AUTO_FOCUS');
  };

  // Trigger capture command
  const handleTakePhoto = () => {
    setIsCapturing(true);
    localBus.send('TAKE_PHOTO', { focusDistance });

    // Release loading state after 8s if timeout
    setTimeout(() => {
      setIsCapturing(false);
    }, 8000);
  };

  // Current photo
  const currentPhoto = photos[currentIndex] || null;

  // Delete current photo from UI, localStorage and server disk
  const handleDeleteCurrentPhoto = async () => {
    if (!currentPhoto) return;
    const photoToDelete = currentPhoto;

    deleteSavedPhoto(photoToDelete.id);
    setPhotos((prev) => {
      const updated = prev.filter((p) => p.id !== photoToDelete.id);
      setCurrentIndex((idx) => Math.max(0, Math.min(idx, updated.length - 1)));
      return updated;
    });
    setSelection(null);
    setOcrResult(null);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });

    if (photoToDelete.filename) {
      try {
        await fetch(`/api/photos/${encodeURIComponent(photoToDelete.filename)}`, {
          method: 'DELETE',
        });
      } catch {
        // Ignore if sample/local-only photo
      }
    }
  };

  // ROI Mouse Events for drawing selection box or panning zoomed image
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageContainerRef.current || !currentPhoto) return;
    const rect = imageContainerRef.current.getBoundingClientRect();

    if (interactionMode === 'pan' || e.shiftKey || e.button === 1 || e.altKey) {
      // Pan mode
      if (selection) setSelection(null);
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      return;
    }

    // Selection mode
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    setIsSelecting(true);
    selectStartRef.current = { x: clickX, y: clickY };
    setSelection({
      x: Math.max(0, Math.min(1, clickX)),
      y: Math.max(0, Math.min(1, clickY)),
      width: 0,
      height: 0,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && imageContainerRef.current) {
      const rect = imageContainerRef.current.getBoundingClientRect();
      const maxX = Math.max(220, rect.width * zoomLevel * 0.55);
      const maxY = Math.max(180, rect.height * zoomLevel * 0.55);
      const nextX = Math.max(-maxX, Math.min(maxX, e.clientX - panStartRef.current.x));
      const nextY = Math.max(-maxY, Math.min(maxY, e.clientY - panStartRef.current.y));
      setPanOffset({
        x: nextX,
        y: nextY,
      });
      return;
    }

    if (!isSelecting || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const currentY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const startX = selectStartRef.current.x;
    const startY = selectStartRef.current.y;

    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    setSelection({ x, y, width, height });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (isSelecting) {
      setIsSelecting(false);
      // If selection is too tiny, dismiss it (accidental click)
      if (selection && (selection.width < 0.02 || selection.height < 0.02)) {
        setSelection(null);
      }
    }
  };

  const getNormalizedImageCrop = (sel: SelectionRect | null): SelectionRect | null => {
    if (!sel || sel.width <= 0 || sel.height <= 0) return null;

    if (!imageContainerRef.current || !imgRef.current) {
      return sel;
    }

    const containerRect = imageContainerRef.current.getBoundingClientRect();
    const imgRect = imgRef.current.getBoundingClientRect();
    const natW = imgRef.current.naturalWidth;
    const natH = imgRef.current.naturalHeight;

    if (
      containerRect.width <= 0 ||
      containerRect.height <= 0 ||
      imgRect.width <= 0 ||
      imgRect.height <= 0 ||
      natW <= 0 ||
      natH <= 0
    ) {
      return sel;
    }

    const natRatio = natW / natH;
    const rectRatio = imgRect.width / imgRect.height;

    let renW = imgRect.width;
    let renH = imgRect.height;
    let renLeft = imgRect.left;
    let renTop = imgRect.top;

    if (rectRatio > natRatio) {
      renW = imgRect.height * natRatio;
      renLeft = imgRect.left + (imgRect.width - renW) / 2;
    } else {
      renH = imgRect.width / natRatio;
      renTop = imgRect.top + (imgRect.height - renH) / 2;
    }

    const selLeft = containerRect.left + sel.x * containerRect.width;
    const selTop = containerRect.top + sel.y * containerRect.height;
    const selRight = selLeft + sel.width * containerRect.width;
    const selBottom = selTop + sel.height * containerRect.height;

    const x1 = Math.max(0, Math.min(1, (selLeft - renLeft) / renW));
    const y1 = Math.max(0, Math.min(1, (selTop - renTop) / renH));
    const x2 = Math.max(0, Math.min(1, (selRight - renLeft) / renW));
    const y2 = Math.max(0, Math.min(1, (selBottom - renTop) / renH));

    const w = x2 - x1;
    const h = y2 - y1;

    if (w <= 0 || h <= 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    return { x: x1, y: y1, width: w, height: h };
  };

  // Run English OCR
  const handleRunOcr = async () => {
    if (!currentPhoto) return;
    setOcrRunning(true);
    setOcrResult(null);

    try {
      const mappedCrop = getNormalizedImageCrop(selection);
      if (mappedCrop && (mappedCrop.width <= 0 || mappedCrop.height <= 0)) {
        throw new Error('A seleção está fora da área da imagem.');
      }

      const res = await runEnglishOcr(
        currentPhoto.url,
        mappedCrop,
        {
          grayscale: true,
          contrastBoost: 1.25,
          thresholding: useOtsu ? 'otsu' : 'none',
          denoiseMoire: useAntiMoire,
        },
        (progress, status) => {
          setOcrProgress({ percent: Math.round(progress * 100), status });
        }
      );
      setOcrResult(res);
    } catch (err) {
      console.error('OCR Error:', err);
      setOcrResult({
        text: 'Erro ao executar OCR: ' + (err as Error).message,
        confidence: 0,
        timeMs: 0,
      });
    } finally {
      setOcrRunning(false);
    }
  };

  const copyToClipboard = () => {
    if (!ocrResult?.text) return;
    navigator.clipboard.writeText(ocrResult.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasValidSelection = Boolean(selection && selection.width > 0 && selection.height > 0);

  const handleCopySelectionToClipboard = () => {
    if (!currentPhoto || !selection || selection.width <= 0 || selection.height <= 0) return;

    if (!navigator.clipboard || typeof ClipboardItem === 'undefined' || !navigator.clipboard.write) {
      setCopyImageError('Cópia de imagem não suportada neste contexto. Acesse via HTTPS ou localhost.');
      setTimeout(() => setCopyImageError(null), 4000);
      return;
    }

    const cropNorm = getNormalizedImageCrop(selection);
    if (!cropNorm || cropNorm.width <= 0 || cropNorm.height <= 0) {
      setCopyImageError('A seleção está fora da área da imagem.');
      setTimeout(() => setCopyImageError(null), 4000);
      return;
    }

    setCopyingImage(true);
    setCopyImageError(null);

    const buildSizedPngBlob = async (): Promise<Blob> => {
      let canvas: HTMLCanvasElement;
      const canUseDomImg = Boolean(
        imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0
      );

      if (canUseDomImg && imgRef.current) {
        try {
          canvas = await cropImageToCanvas(imgRef.current, cropNorm);
        } catch {
          canvas = await cropImageToCanvas(currentPhoto.url, cropNorm);
        }
      } else {
        canvas = await cropImageToCanvas(currentPhoto.url, cropNorm);
      }

      const canvasToPng = (c: HTMLCanvasElement) =>
        new Promise<Blob | null>((resolve) => {
          try {
            c.toBlob(resolve, 'image/png');
          } catch {
            resolve(null);
          }
        });

      let blob = await canvasToPng(canvas);
      if (!blob) {
        // Retry from clean URL load if DOM element was tainted
        canvas = await cropImageToCanvas(currentPhoto.url, cropNorm);
        blob = await canvasToPng(canvas);
      }

      // Windows 11 Clipboard History (Win+V) silently drops items > 4 MB.
      // Keep PNG <= 3.5 MB so large 16MP camera crops always appear in Win+V and Ctrl+V.
      const MAX_CLIPBOARD_BYTES = 3.5 * 1024 * 1024;
      let attempts = 0;
      while (
        blob &&
        blob.size > MAX_CLIPBOARD_BYTES &&
        attempts < 5 &&
        canvas.width > 320 &&
        canvas.height > 320
      ) {
        attempts++;
        const scale = 0.72;
        const resized = document.createElement('canvas');
        resized.width = Math.max(1, Math.round(canvas.width * scale));
        resized.height = Math.max(1, Math.round(canvas.height * scale));
        const rCtx = resized.getContext('2d');
        if (!rCtx) break;
        rCtx.imageSmoothingEnabled = true;
        rCtx.imageSmoothingQuality = 'high';
        rCtx.drawImage(canvas, 0, 0, resized.width, resized.height);
        canvas = resized;
        blob = await canvasToPng(canvas);
      }

      if (!blob || blob.size === 0) {
        throw new Error('Falha ao gerar a imagem PNG da seleção.');
      }

      return blob;
    };

    try {
      const clipboardItem = new ClipboardItem({
        'image/png': buildSizedPngBlob(),
      });

      navigator.clipboard
        .write([clipboardItem])
        .then(() => {
          setCopiedImage(true);
          setTimeout(() => setCopiedImage(false), 2500);
        })
        .catch((err) => {
          console.error('Copy selection error:', err);
          setCopyImageError((err as Error).message || 'Não foi possível copiar a seleção.');
          setTimeout(() => setCopyImageError(null), 4000);
        })
        .finally(() => {
          setCopyingImage(false);
        });
    } catch (err) {
      console.error('ClipboardItem error:', err);
      setCopyImageError((err as Error).message || 'Erro ao preparar imagem para a área de transferência.');
      setTimeout(() => setCopyImageError(null), 4000);
      setCopyingImage(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

      {/* QR Code & Mobile Pairing Instructions Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Como Acessar no Android (Redmi Note 10S)</h3>
                  <p className="text-xs text-slate-500">Escaneie o QR Code ou digite a URL no Chrome do celular</p>
                </div>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR Code para Android"
                  className="w-44 h-44 rounded-lg bg-white p-2 border border-slate-200 shadow-xs"
                />
              ) : (
                <div className="w-44 h-44 bg-slate-200 rounded-lg animate-pulse" />
              )}

              <div className="flex-1 space-y-2 text-xs">
                <span className="font-semibold text-slate-800">URL Direta para o Celular:</span>
                <div className="p-2 bg-white rounded border border-slate-200 font-mono text-emerald-700 break-all select-all text-[11px]">
                  {androidUrl}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(androidUrl);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Link Copiado!' : 'Copiar Endereço'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="font-bold text-slate-800">Passo a Passo no Android:</div>
              <ol className="list-decimal pl-4 space-y-1.5">
                <li>
                  <strong>Wi-Fi:</strong> Certifique-se de que o Redmi Note 10S está conectado no mesmo Wi-Fi do computador (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">192.168.15.x</code>).
                </li>
                <li>
                  <strong>Abrir no Chrome:</strong> Aponte a câmera do celular para o QR Code acima ou abra o Chrome e digite a URL.
                </li>
                <li>
                  <strong>Aviso de Certificado:</strong> Na tela "Sua conexão não é particular", toque em <strong>"Avançado"</strong> e depois em <strong>"Continuar para {serverIp} (não seguro)"</strong>.
                </li>
                <li>
                  <strong>Permissão de Câmera:</strong> Quando o Chrome pedir autorização, toque em <strong>"Permitir"</strong>.
                </li>
                <li>
                  <strong>Pronto!</strong> A tela ficará toda preta com o texto do Windows, o Wake Lock manterá a tela ligada e você poderá controlar tudo aqui pelo Windows.
                </li>
              </ol>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowQrModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
              >
                Entendido, Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Column: High-Res Photo Viewer (Section 6.4) */}
      <div className="lg:col-span-8 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* Viewer Toolbar */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* History Navigator (Section 6.5) */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentIndex((prev) => Math.min(photos.length - 1, prev + 1))}
                disabled={currentIndex >= photos.length - 1}
                className="p-1.5 rounded bg-white border border-slate-200 text-slate-700 disabled:opacity-30 hover:bg-slate-100"
                title="Foto Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium text-slate-700">
                Foto {photos.length > 0 ? currentIndex + 1 : 0} de {photos.length}
              </span>
              <button
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex <= 0}
                className="p-1.5 rounded bg-white border border-slate-200 text-slate-700 disabled:opacity-30 hover:bg-slate-100"
                title="Próxima Foto"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {currentPhoto && (
                <div className="flex items-center gap-1.5 text-slate-500 ml-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{currentPhoto.timestamp}</span>
                  <span className="text-slate-300">|</span>
                  <span>{currentPhoto.width}×{currentPhoto.height}</span>
                </div>
              )}
            </div>

            {/* Zoom, Pan, Delete & ROI Helpers */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Mode Toggle: Select ROI vs Drag/Pan Image */}
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                <button
                  onClick={() => setInteractionMode('select')}
                  title="Modo Seleção: clique e arraste para desenhar o retângulo verde"
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    interactionMode === 'select'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Crop className="w-3 h-3" />
                  <span>Selecionar</span>
                </button>
                <button
                  onClick={() => setInteractionMode('pan')}
                  title="Modo Arrastar: clique e arraste a imagem ampliada para ver qualquer canto"
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    interactionMode === 'pan'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Hand className="w-3 h-3" />
                  <span>Arrastar</span>
                </button>
              </div>

              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                <button
                  onClick={() =>
                    setZoomLevel((z) => {
                      const next = Math.max(0.5, z - 0.25);
                      if (next <= 1) setPanOffset({ x: 0, y: 0 });
                      return next;
                    })
                  }
                  className="p-1 text-slate-600 hover:text-slate-900"
                  title="Diminuir Zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-slate-700 font-mono text-[11px]">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-1 text-slate-600 hover:text-slate-900"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 border-l border-slate-100"
                  title="Resetar Zoom e Centralizar"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {selection && (
                <button
                  onClick={() => setSelection(null)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                  title="Desfazer seleção"
                >
                  <Crop className="w-3 h-3" />
                  Limpar Recorte
                </button>
              )}

              <button
                onClick={handleDeleteCurrentPhoto}
                disabled={!currentPhoto}
                title="Excluir foto atual"
                aria-label="Excluir foto atual"
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Primary "Tirar foto agora" Button right next to viewer action buttons */}
              <button
                onClick={handleTakePhoto}
                disabled={isCapturing}
                title={isAndroidOnline ? 'Android conectado — Disparar captura remota' : 'Android desconectado — Verifique conexão abaixo'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs transition-all ${
                  isCapturing
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isAndroidOnline ? 'bg-emerald-200 animate-pulse' : 'bg-red-300'
                  }`}
                />
                <Camera className={`w-3.5 h-3.5 ${isCapturing ? 'animate-spin' : ''}`} />
                <span>{isCapturing ? 'Capturando...' : 'Tirar foto agora'}</span>
              </button>
            </div>
          </div>

          {/* Photo Canvas & Interactive ROI Drag Area */}
          <div 
            ref={imageContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`relative w-full h-[540px] bg-slate-950 flex items-center justify-center overflow-hidden select-none ${
              interactionMode === 'pan'
                ? isPanning
                  ? 'cursor-grabbing'
                  : 'cursor-grab'
                : 'cursor-crosshair'
            }`}
          >
            {currentPhoto ? (
              <div
                style={{
                  transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                }}
                className="relative max-w-full max-h-full flex items-center justify-center pointer-events-none"
              >
                <img
                  ref={imgRef}
                  src={currentPhoto.url}
                  alt="Laptop Screen Capture"
                  className="max-h-[500px] w-auto object-contain rounded shadow-2xl pointer-events-none"
                  draggable={false}
                />
              </div>
            ) : (
              <div className="text-center text-slate-500 space-y-2">
                <Camera className="w-12 h-12 mx-auto text-slate-600" />
                <p className="text-sm">Nenhuma foto capturada ainda.</p>
                <p className="text-xs text-slate-600">Clique em "Tirar foto agora" acima para solicitar.</p>
              </div>
            )}

            {/* Selection Bounding Box Overlay */}
            {selection && selection.width > 0 && selection.height > 0 && (
              <div
                style={{
                  left: `${selection.x * 100}%`,
                  top: `${selection.y * 100}%`,
                  width: `${selection.width * 100}%`,
                  height: `${selection.height * 100}%`,
                }}
                className="absolute border-2 border-emerald-400 bg-emerald-500/15 pointer-events-none rounded-sm z-20 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
              >
                <div className="absolute top-0 right-0 transform translate-x-1 -translate-y-5 bg-emerald-600 text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow">
                  Área de Leitura OCR ({Math.round(selection.width * 100)}% × {Math.round(selection.height * 100)}%)
                </div>
              </div>
            )}

            {/* Instruction tooltip overlay */}
            <div className="absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur-xs text-slate-300 text-[11px] px-3 py-1.5 rounded-md pointer-events-none border border-slate-700/50 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                {interactionMode === 'pan'
                  ? 'Arraste a imagem para visualizar qualquer canto · Clique em "Selecionar" para recortar'
                  : 'Clique e arraste para delimitar um texto · Use "Arrastar" (ou Shift+arraste) para mover com zoom'}
              </span>
            </div>
          </div>
        </div>

        {/* OCR Trigger & English Results Panel (Section 6.7) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Leitura de Texto (OCR em Inglês)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {selection 
                  ? 'Processando área delimitada no retângulo para máxima precisão.' 
                  : 'Nenhuma área selecionada. Será processada a foto inteira.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Preprocessing Toggles with Hover Help Text */}
              <div className="relative group flex items-center">
                <label
                  title="Suaviza listras e quadriculados de telas LCD. Deixe marcado na maioria das fotos; desmarque apenas se a foto estiver bem nítida e com fonte muito pequena."
                  className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={useAntiMoire}
                    onChange={(e) => setUseAntiMoire(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Filtro Anti-Moiré</span>
                  <Info className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                </label>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 rounded-lg bg-slate-900 text-slate-100 text-[11px] leading-relaxed shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none z-30">
                  Suaviza listras e quadriculados típicos de fotos de tela LCD. Deixe marcado na maioria das fotos; desmarque se a foto já estiver bem nítida e com fonte muito pequena.
                </div>
              </div>

              <div className="relative group flex items-center">
                <label
                  title="Converte para preto e branco puros. Deixe desmarcado na maioria dos casos (preserva letras finas e coloridas); marque se o fundo estiver manchado."
                  className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={useOtsu}
                    onChange={(e) => setUseOtsu(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Binarização Otsu</span>
                  <Info className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                </label>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 rounded-lg bg-slate-900 text-slate-100 text-[11px] leading-relaxed shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 pointer-events-none z-30">
                  Converte tudo para preto e branco puros. Deixe desmarcado na maioria dos casos (preserva letras finas e coloridas); marque apenas se o fundo estiver manchado ou acinzentado.
                </div>
              </div>

              {/* "Ler texto" Action Button */}
              <button
                onClick={handleRunOcr}
                disabled={ocrRunning || !currentPhoto}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm transition-all ${
                  ocrRunning || !currentPhoto
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${ocrRunning ? 'animate-spin' : 'text-emerald-400'}`} />
                {ocrRunning ? 'Processando Tesseract...' : 'Ler texto'}
              </button>

              {/* Copy Selected Region Image to Clipboard Button */}
              <button
                onClick={handleCopySelectionToClipboard}
                disabled={copyingImage || !currentPhoto || !hasValidSelection}
                title={
                  hasValidSelection
                    ? 'Copiar apenas a área do retângulo verde para a área de transferência'
                    : 'Desenhe um retângulo verde na imagem para copiar a seleção'
                }
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all ${
                  copyingImage || !currentPhoto || !hasValidSelection
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : copiedImage
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {copiedImage ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copyingImage ? 'Copiando...' : copiedImage ? 'Seleção copiada!' : 'Copiar seleção'}
              </button>
            </div>
          </div>

          {copyImageError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{copyImageError}</span>
            </div>
          )}

          {/* OCR Progress Bar */}
          {ocrRunning && (
            <div className="space-y-1.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex justify-between text-xs font-medium text-slate-700">
                <span>{ocrProgress.status}</span>
                <span>{ocrProgress.percent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${ocrProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* OCR Result Output Box */}
          {ocrResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-3">
                  <span>Confiança do Reconhecimento: <strong className="text-slate-800">{ocrResult.confidence}%</strong></span>
                  <span>·</span>
                  <span>Tempo de Execução: <strong className="text-slate-800">{ocrResult.timeMs}ms</strong></span>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                readOnly
                value={ocrResult.text}
                rows={5}
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:outline-none select-all"
                placeholder="Nenhum texto detectado na área selecionada."
              />
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Primary Android Text Dispatcher (Highlighted at top) */}
      <div className="lg:col-span-4 space-y-4">
        {/* Text Sender Card (Section 6.6) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" />
              Exibição de Texto no Android
            </h3>
            <span className={`text-[11px] font-mono ${androidText.length >= 250 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
              {androidText.length}/255 caracteres
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            O texto abaixo é transmitido instantaneamente para o celular e renderizado em fonte grande, cinza-escuro sobre fundo preto puro AMOLED.
          </p>

          <textarea
            value={androidText}
            maxLength={255}
            onChange={(e) => setAndroidText(e.target.value)}
            rows={6}
            className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            placeholder="Digite até 255 caracteres para exibir no Android..."
          />

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5 text-xs">
              {textDelivered ? (
                <span className="text-emerald-600 flex items-center gap-1 font-medium">
                  <Check className="w-3.5 h-3.5" /> Sincronizado no Android
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Enviando...
                </span>
              )}
            </div>

            <button
              onClick={() => setAndroidText('')}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar texto
            </button>
          </div>

          {/* Quick preset phrases */}
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[11px] font-semibold text-slate-600 mb-2">Frases Rápidas:</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                'AGUARDANDO PROXIMA ETAPA',
                'CALIBRANDO FOCO 28CM',
                'FOTO 12 CAPTURADA COM SUCESSO',
                'SISTEMA EM OPERACAO 100%'
              ].map((phrase) => (
                <button
                  key={phrase}
                  onClick={() => setAndroidText(phrase)}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded"
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Secondary Controls Row: Connection/QR, Remote Focus & Storage */}
      <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-slate-200/80">
        {/* Connection, Server IP & Android Status Card */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
                <Camera className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900">Console Remoto Windows 11</h2>
                <span className="text-[10px] text-slate-500 font-mono">Conexão & Pareamento Android</span>
              </div>
            </div>

            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all ${
              isAndroidOnline
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isAndroidOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="font-semibold">{isAndroidOnline ? 'Android Conectado' : 'Desconectado'}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>IP Servidor:</span>
              <input
                type="text"
                value={serverIp}
                onChange={(e) => onServerIpChange(e.target.value)}
                className="font-mono text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 w-36 focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="192.168.1.100"
              />
            </div>

            <button
              onClick={() => setShowQrModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-all"
            >
              <QrCode className="w-3.5 h-3.5 text-indigo-600" />
              <span>Conectar Android (QR Code)</span>
            </button>
          </div>
        </div>

        {/* Focus Control Card (Section 6.2) */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              Controle de Foco Remoto
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              {focusDistance.toFixed(2)} m
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Macro (0.10m)</span>
              <span className="text-emerald-700 font-semibold">Ideal (0.28m)</span>
              <span>Infinito (1.00m)</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.80"
              step="0.01"
              value={focusDistance}
              onChange={(e) => handleFocusChange(parseFloat(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleFocusChange(0.28)}
              className="flex-1 py-1 px-2.5 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-700 hover:bg-slate-50 text-center"
            >
              28 cm (Laptop 14")
            </button>
            <button
              onClick={handleTriggerAutoFocus}
              className={`flex-1 py-1 px-2.5 rounded-lg text-[11px] font-medium text-center transition-all ${
                isAutoFocus 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Foco Automático (PDAF)
            </button>
          </div>

          {!cameraCapabilities.hasManualFocus && (
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-[10px] text-amber-800 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Foco manual não exposto pelo driver MediaTek. Operando em PDAF contínuo.
              </span>
            </div>
          )}
        </div>

        {/* Server Storage Summary */}
        <div className="lg:col-span-3 bg-slate-900 text-white rounded-xl p-4 text-xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-slate-400">
            <span>Armazenamento Local</span>
            <span className="font-mono text-emerald-400">Node.js Server</span>
          </div>
          <div className="font-mono text-[11px] text-slate-300 break-all">
            Pasta: C:\LocalCapture\Storage\
          </div>
          <div className="text-slate-400 text-[11px]">
            {photos.length} fotos salvas em disco com resolução nativa.
          </div>
        </div>
      </div>
    </div>
  );
}
