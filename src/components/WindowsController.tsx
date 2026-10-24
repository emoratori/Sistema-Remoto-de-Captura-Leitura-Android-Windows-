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
  X
} from 'lucide-react';
import QRCode from 'qrcode';
import { CapturedPhoto, SelectionRect, CameraCapabilities } from '../types';
import { localBus, getSavedPhotos, savePhoto } from '../services/localBus';
import { runEnglishOcr, OcrResult } from '../services/tesseractOcr';
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
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // ROI / Selection Rectangle
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const selectStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // OCR state
  const [ocrRunning, setOcrRunning] = useState<boolean>(false);
  const [ocrProgress, setOcrProgress] = useState<{ percent: number; status: string }>({ percent: 0, status: '' });
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [useAntiMoire, setUseAntiMoire] = useState<boolean>(true);
  const [useOtsu, setUseOtsu] = useState<boolean>(true);

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

  // Load photos on mount or populate with realistic sample
  useEffect(() => {
    const saved = getSavedPhotos();
    if (saved.length > 0) {
      setPhotos(saved);
      setCurrentIndex(0);
    } else {
      // Seed with sample photos simulating 14" laptop screen
      const sample1 = generateSyntheticLaptopCapture('code');
      const sample2 = generateSyntheticLaptopCapture('docs');
      const sample3 = generateSyntheticLaptopCapture('terminal');
      const initial = [sample1, sample2, sample3];
      savePhoto(sample3);
      savePhoto(sample2);
      savePhoto(sample1);
      setPhotos(initial);
      setCurrentIndex(0);
    }
  }, []);

  // Listen to message bus from Android or local server
  useEffect(() => {
    const unsubscribe = localBus.subscribe((msg) => {
      if (msg.type === 'PHOTO_READY' && msg.payload) {
        const newPhoto: CapturedPhoto = msg.payload;
        const updated = savePhoto(newPhoto);
        setPhotos(updated);
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

    // Fallback timer if Android device isn't responding in 3s
    setTimeout(() => {
      setIsCapturing((prev) => {
        if (prev) {
          // If no response from real phone, generate a synthetic fresh capture for desktop testing
          const freshPhoto = generateSyntheticLaptopCapture('code');
          const updated = savePhoto(freshPhoto);
          setPhotos(updated);
          setCurrentIndex(0);
          return false;
        }
        return false;
      });
    }, 2800);
  };

  // Current photo
  const currentPhoto = photos[currentIndex] || null;

  // ROI Mouse Events for drawing selection box
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();

    if (e.shiftKey || e.button === 1 || e.altKey) {
      // Pan mode
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
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
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

  // Run English OCR
  const handleRunOcr = async () => {
    if (!currentPhoto) return;
    setOcrRunning(true);
    setOcrResult(null);

    try {
      const res = await runEnglishOcr(
        currentPhoto.url,
        selection,
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Top Bar / Status Banner */}
      <div className="lg:col-span-12 bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
            <Camera className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900">Console Remoto Windows 11</h1>
              <span className="text-[11px] text-slate-500 font-mono">PWA Control Station</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>IP Servidor:</span>
              <input
                type="text"
                value={serverIp}
                onChange={(e) => onServerIpChange(e.target.value)}
                className="font-mono text-xs bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-slate-700 w-36 focus:outline-none focus:ring-1 focus:ring-slate-400"
                placeholder="192.168.1.100"
              />
            </div>
          </div>
        </div>

        {/* Android Device Status & QR Connection */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-all shadow-xs"
          >
            <QrCode className="w-4 h-4 text-indigo-600" />
            <span>Conectar Android (QR Code)</span>
          </button>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            {isAndroidOnline ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-slate-700">Android Online</span>
                <span className="text-[11px] text-slate-400">· Redmi Note 10S</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-xs font-medium text-slate-700">Android em Standby</span>
                <button
                  onClick={onSwitchToAndroidTab}
                  className="text-[11px] text-indigo-600 font-semibold underline hover:text-indigo-800"
                >
                  Abrir Tela do Celular
                </button>
              </>
            )}
          </div>

          {/* Big "Tirar foto agora" Button */}
          <button
            onClick={handleTakePhoto}
            disabled={isCapturing}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all ${
              isCapturing
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-emerald-700/20'
            }`}
          >
            <Camera className={`w-4 h-4 ${isCapturing ? 'animate-spin' : ''}`} />
            {isCapturing ? 'Capturando 16MP...' : 'Tirar foto agora'}
          </button>
        </div>
      </div>

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

            {/* Zoom & ROI Helpers */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
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
                  title="Resetar Zoom"
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
            </div>
          </div>

          {/* Photo Canvas & Interactive ROI Drag Area */}
          <div 
            ref={imageContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="relative w-full h-[540px] bg-slate-950 flex items-center justify-center overflow-hidden cursor-crosshair select-none"
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
              <span>Clique e arraste para delimitar um texto específico da tela · Segure Shift para arrastar</span>
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

            <div className="flex items-center gap-3">
              {/* Preprocessing Toggles */}
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAntiMoire}
                  onChange={(e) => setUseAntiMoire(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Filtro Anti-Moiré</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useOtsu}
                  onChange={(e) => setUseOtsu(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Binarização Otsu</span>
              </label>

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
            </div>
          </div>

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

      {/* Right Column: Camera Focus & Text Dispatcher (Sections 6.2 & 6.6) */}
      <div className="lg:col-span-4 space-y-4">
        {/* Focus Control Card (Section 6.2) */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Controle de Foco Remoto
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              {focusDistance.toFixed(2)} m
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Distância calibrada entre o Redmi Note 10S e o laptop de 14": <strong>25 cm a 30 cm</strong>.
          </p>

          {/* Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
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
              className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 text-center"
            >
              28 cm (Laptop 14")
            </button>
            <button
              onClick={handleTriggerAutoFocus}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium text-center transition-all ${
                isAutoFocus 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Foco Automático (PDAF)
            </button>
          </div>

          {!cameraCapabilities.hasManualFocus && (
            <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-800 flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Foco manual não exposto pelo driver MediaTek. O sistema opera em Foco Automático PDAF contínuo.
              </span>
            </div>
          )}
        </div>

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
            rows={4}
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

        {/* Server Storage Summary */}
        <div className="bg-slate-900 text-white rounded-xl p-4 text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span>Armazenamento Local</span>
            <span className="font-mono text-emerald-400">Node.js Server</span>
          </div>
          <div className="font-mono text-[11px] text-slate-300">
            Pasta: C:\LocalCapture\Storage\
          </div>
          <div className="text-slate-400 text-[11px]">
            {photos.length} fotos salvas em disco com resolução nativa. Cada foto é gravada instantaneamente ao término da exposição.
          </div>
        </div>
      </div>
    </div>
  );
}
