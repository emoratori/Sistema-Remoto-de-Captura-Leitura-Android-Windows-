// Image processing utilities tailored for Screen OCR (handling LCD subpixels, Moiré and backlighting)

export interface PreprocessOptions {
  grayscale: boolean;
  contrastBoost: number; // 0 to 2, 1 = normal
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

/**
 * Preprocesses a canvas to dramatically improve OCR accuracy on photos of computer screens
 * (Removes color artifacts from LCD pixels, mitigates Moiré, normalizes brightness)
 */
export function preprocessCanvasForOcr(
  canvas: HTMLCanvasElement,
  options: PreprocessOptions
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 1. Grayscale conversion with ITU-R BT.709 luminance weights
  if (options.grayscale) {
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
  }

  // 2. Contrast stretching
  if (options.contrastBoost !== 1.0) {
    const factor = (259 * (options.contrastBoost * 255 + 255)) / (255 * (259 - options.contrastBoost * 255));
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
    }
  }

  // 3. Optional Anti-Moiré / Denoise (Box blur 3x3)
  if (options.denoiseMoire) {
    // Light horizontal/vertical smoothing to cancel LCD stripe frequency
    const temp = new Uint8ClampedArray(data);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = ((y + dy) * w + (x + dx)) * 4;
            sum += temp[nIdx];
          }
        }
        const val = sum / 9;
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
      }
    }
  }

  // 4. Thresholding (Otsu method calculation)
  if (options.thresholding === 'otsu') {
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      histogram[Math.floor(data[i])]++;
    }

    const total = w * h;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * histogram[t];

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let varMax = 0;
    let threshold = 128;

    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      wF = total - wB;
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

    for (let i = 0; i < data.length; i += 4) {
      const v = data[i] > threshold ? 255 : 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
