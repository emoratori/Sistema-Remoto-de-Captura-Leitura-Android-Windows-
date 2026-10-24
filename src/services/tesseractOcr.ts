import { createWorker } from 'tesseract.js';
import { cropImageToCanvas, preprocessCanvasForOcr, PreprocessOptions } from './imageProcessing';

export interface OcrResult {
  text: string;
  confidence: number;
  timeMs: number;
  processedImageUrl?: string;
}

export type OcrProgressCallback = (progress: number, status: string) => void;

let cachedWorker: any = null;

async function getWorker(onProgress?: OcrProgressCallback) {
  if (!cachedWorker) {
    if (onProgress) onProgress(0.1, 'Inicializando motor Tesseract.js...');
    cachedWorker = await createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(0.3 + (m.progress || 0) * 0.7, `Reconhecendo texto em inglês (${Math.round((m.progress || 0) * 100)}%)...`);
        } else if (onProgress) {
          onProgress(0.2, m.status || 'Carregando dados de idioma...');
        }
      },
    });
  }
  return cachedWorker;
}

export async function runEnglishOcr(
  imageSource: string | HTMLImageElement,
  cropArea: { x: number; y: number; width: number; height: number } | null,
  preprocess: PreprocessOptions,
  onProgress?: OcrProgressCallback
): Promise<OcrResult> {
  const startTime = performance.now();

  if (onProgress) onProgress(0.05, 'Preparando área de interesse (ROI)...');

  // If cropArea provided, crop image; otherwise crop 100% of image
  const normArea = cropArea || { x: 0, y: 0, width: 1, height: 1 };
  const rawCanvas = await cropImageToCanvas(imageSource, normArea);

  if (onProgress) onProgress(0.15, 'Aplicando filtros anti-Moiré e contraste...');
  const processedCanvas = preprocessCanvasForOcr(rawCanvas, preprocess);
  const processedDataUrl = processedCanvas.toDataURL('image/png');

  const worker = await getWorker(onProgress);

  const { data } = await worker.recognize(processedCanvas);
  const timeMs = Math.round(performance.now() - startTime);

  if (onProgress) onProgress(1.0, 'Concluído');

  return {
    text: data.text.trim(),
    confidence: Math.round(data.confidence || 0),
    timeMs,
    processedImageUrl: processedDataUrl,
  };
}

export async function terminateOcrWorker() {
  if (cachedWorker) {
    await cachedWorker.terminate();
    cachedWorker = null;
  }
}
