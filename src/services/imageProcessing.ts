// Image processing utilities tailored for Screen OCR (handling LCD subpixels, Moiré and uneven backlighting)

export interface PreprocessOptions {
  grayscale: boolean;
  contrastBoost: number; // 1.0 = normal, >1.0 = stronger contrast (e.g. 1.25 - 1.5)
  thresholding: 'none' | 'otsu' | 'adaptive';
  denoiseMoire: boolean;
}

/**
 * Crops a designated area from an image element or image URL onto a canvas
 */
export async function cropImageToCanvas(
  imageSource: string | HTMLImageElement,
  cropNorm: { x: number; y: number; width: number; height: number }
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const process = (img: HTMLImageElement) => {
      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;

      const sx = Math.max(0, Math.floor(cropNorm.x * naturalW));
      const sy = Math.max(0, Math.floor(cropNorm.y * naturalH));
      const sw = Math.min(naturalW - sx, Math.floor(cropNorm.width * naturalW));
      const sh = Math.min(naturalH - sy, Math.floor(cropNorm.height * naturalH));

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, sw);
      canvas.height = Math.max(1, sh);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('Failed to get canvas 2d context'));
        return;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas);
    };

    if (typeof imageSource === 'string') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => process(img);
      img.onerror = (e) => reject(new Error('Failed to load image for cropping: ' + e));
      img.src = imageSource;
    } else {
      process(imageSource);
    }
  });
}

function buildIntegralImage(gray: Uint8ClampedArray, w: number, h: number): Float64Array {
  const integ = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rowSum = 0;
    const rowOffset = (y - 1) * w;
    const integRow = y * (w + 1);
    const prevIntegRow = (y - 1) * (w + 1);
    for (let x = 1; x <= w; x++) {
      rowSum += gray[rowOffset + x - 1];
      integ[integRow + x] = integ[prevIntegRow + x] + rowSum;
    }
  }
  return integ;
}

function computeOtsuThreshold(gray: Uint8ClampedArray): number {
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) {
    histogram[gray[i]]++;
  }

  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t];

  let sumB = 0;
  let wB = 0;
  let varMax = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);

    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }

  return threshold;
}

/**
 * Preprocesses a canvas to dramatically improve OCR accuracy on photos of computer screens
 * (Removes color artifacts from LCD subpixels, suppresses Moiré via 3x3 Gaussian,
 * flattens uneven screen backlight with an integral image, and handles dark-mode inversion).
 */
export function preprocessCanvasForOcr(
  inputCanvas: HTMLCanvasElement,
  options: PreprocessOptions
): HTMLCanvasElement {
  // Upscale small ROIs so small laptop fonts have enough pixels per character for Tesseract LSTM
  let canvas = inputCanvas;
  const maxDim = Math.max(inputCanvas.width, inputCanvas.height);
  if (maxDim > 0 && maxDim < 1600) {
    const scale = Math.min(2, 2400 / maxDim);
    if (scale > 1.05) {
      const scaled = document.createElement('canvas');
      scaled.width = Math.round(inputCanvas.width * scale);
      scaled.height = Math.round(inputCanvas.height * scale);
      const sCtx = scaled.getContext('2d', { willReadFrequently: true });
      if (sCtx) {
        sCtx.imageSmoothingEnabled = true;
        sCtx.imageSmoothingQuality = 'high';
        sCtx.drawImage(inputCanvas, 0, 0, scaled.width, scaled.height);
        canvas = scaled;
      }
    }
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const pixelCount = w * h;

  // 1. Grayscale conversion with ITU-R BT.709 luminance weights
  let gray = new Uint8ClampedArray(pixelCount);
  const hist = new Uint32Array(256);
  for (let p = 0, i = 0; p < pixelCount; p++, i += 4) {
    const lum = options.grayscale
      ? Math.round(0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2])
      : Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
    gray[p] = lum;
    hist[lum]++;
  }

  // 2. Auto-detect dark mode (light text on dark screen) and invert so Tesseract receives dark text on white
  let acc = 0;
  let median = 128;
  const half = pixelCount / 2;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= half) {
      median = v;
      break;
    }
  }
  if (median < 115) {
    for (let p = 0; p < pixelCount; p++) {
      gray[p] = 255 - gray[p];
    }
  }

  // 3. Anti-Moiré / Descreen using edge-preserving 3x3 Gaussian kernel [1,2,1; 2,4,2; 1,2,1] / 16
  if (options.denoiseMoire && w >= 3 && h >= 3) {
    const smoothed = new Uint8ClampedArray(gray);
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        smoothed[i] =
          (gray[i - w - 1] +
            2 * gray[i - w] +
            gray[i - w + 1] +
            2 * gray[i - 1] +
            4 * gray[i] +
            2 * gray[i + 1] +
            gray[i + w - 1] +
            2 * gray[i + w] +
            gray[i + w + 1]) >>
          4;
      }
    }
    gray = smoothed;
  }

  // 4. Local backlight / vignetting normalization via integral image
  const integ = buildIntegralImage(gray, w, h);
  const radius = Math.max(20, Math.round(Math.min(w, h) * 0.03));
  const normalized = new Uint8ClampedArray(pixelCount);

  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h, y + radius + 1);
    const y0Off = y0 * (w + 1);
    const y1Off = y1 * (w + 1);
    const rowOff = y * w;

    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w, x + radius + 1);
      const area = (x1 - x0) * (y1 - y0);
      const localMean = (integ[y1Off + x1] - integ[y0Off + x1] - integ[y1Off + x0] + integ[y0Off + x0]) / area;
      const val = gray[rowOff + x];
      normalized[rowOff + x] = Math.min(255, Math.max(0, Math.round((val / Math.max(20, localMean)) * 230)));
    }
  }

  // 5. Safe contrast stretch (pivot around normalized text/paper separation without color inversion)
  if (options.contrastBoost !== 1.0) {
    const boost = Math.max(0.5, Math.min(2.5, options.contrastBoost * 1.16));
    for (let p = 0; p < pixelCount; p++) {
      const stretched = Math.round((normalized[p] - 160) * boost + 160);
      normalized[p] = stretched < 0 ? 0 : stretched > 255 ? 255 : stretched;
    }
  }

  // 6. Optional Binarization (Otsu or Adaptive)
  if (options.thresholding === 'otsu') {
    const threshold = computeOtsuThreshold(normalized);
    for (let p = 0; p < pixelCount; p++) {
      normalized[p] = normalized[p] > threshold ? 255 : 0;
    }
  } else if (options.thresholding === 'adaptive') {
    const normInteg = buildIntegralImage(normalized, w, h);
    const adapR = Math.max(12, Math.round(Math.min(w, h) * 0.018));
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - adapR);
      const y1 = Math.min(h, y + adapR + 1);
      const y0Off = y0 * (w + 1);
      const y1Off = y1 * (w + 1);
      const rowOff = y * w;
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - adapR);
        const x1 = Math.min(w, x + adapR + 1);
        const area = (x1 - x0) * (y1 - y0);
        const localMean =
          (normInteg[y1Off + x1] - normInteg[y0Off + x1] - normInteg[y1Off + x0] + normInteg[y0Off + x0]) / area;
        normalized[rowOff + x] = normalized[rowOff + x] < localMean * 0.88 ? 0 : 255;
      }
    }
  }

  // Write processed grayscale back to canvas RGBA buffer
  for (let p = 0, i = 0; p < pixelCount; p++, i += 4) {
    const v = normalized[p];
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
