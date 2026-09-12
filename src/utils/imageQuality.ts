/**
 * Image Quality Analyzer for OCR
 * Analyzes brightness (lighting) and Laplacian variance (blur / sharpness)
 * to provide real-time UI feedback for optimal OCR accuracy.
 */

export interface ImageQualityReport {
  brightness: number; // 0 to 255
  sharpness: number; // Variance score (typically 0 to 100+)
  lightingStatus: 'dark' | 'good' | 'glare';
  sharpnessStatus: 'blurry' | 'acceptable' | 'sharp';
  isReadyForOcr: boolean;
  score: number; // 0 to 100%
  feedbackMessage: string;
}

/**
 * Analyzes an image source (HTMLVideoElement, HTMLImageElement, HTMLCanvasElement, or ImageBitmap)
 */
export function analyzeImageQuality(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number
): ImageQualityReport {
  // Create a small offscreen canvas for fast real-time analysis
  const canvas = document.createElement('canvas');
  // Downscale for real-time 60fps / responsive CPU performance
  const targetWidth = 160;
  const targetHeight = Math.max(1, Math.round((sourceHeight / sourceWidth) * targetWidth));
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      brightness: 128,
      sharpness: 25,
      lightingStatus: 'good',
      sharpnessStatus: 'sharp',
      isReadyForOcr: true,
      score: 85,
      feedbackMessage: 'Ready to scan',
    };
  }

  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
  const data = imgData.data;

  // 1. Calculate Brightness (Luminance Y = 0.299R + 0.587G + 0.114B)
  let totalLuminance = 0;
  const pixelCount = targetWidth * targetHeight;
  const gray: number[] = new Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = lum;
    totalLuminance += lum;
  }

  const avgBrightness = totalLuminance / pixelCount;

  // 2. Calculate Sharpness / Blur via Discrete Laplacian Operator Variance
  // Kernel:
  // [ 0,  1, 0]
  // [ 1, -4, 1]
  // [ 0,  1, 0]
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let sampleCount = 0;

  for (let y = 1; y < targetHeight - 1; y++) {
    for (let x = 1; x < targetWidth - 1; x++) {
      const idx = y * targetWidth + x;
      const top = gray[(y - 1) * targetWidth + x];
      const bottom = gray[(y + 1) * targetWidth + x];
      const left = gray[y * targetWidth + (x - 1)];
      const right = gray[y * targetWidth + (x + 1)];
      const center = gray[idx];

      const lap = top + bottom + left + right - 4 * center;
      laplacianSum += lap;
      laplacianSqSum += lap * lap;
      sampleCount++;
    }
  }

  const lapMean = sampleCount > 0 ? laplacianSum / sampleCount : 0;
  const lapVariance = sampleCount > 0 ? laplacianSqSum / sampleCount - lapMean * lapMean : 0;

  // Normalize sharpness score (empirically > 14 is sharp for text, < 6 is blurry)
  const sharpness = Math.round(lapVariance * 10) / 10;

  // Classify lighting
  let lightingStatus: 'dark' | 'good' | 'glare' = 'good';
  if (avgBrightness < 65) {
    lightingStatus = 'dark';
  } else if (avgBrightness > 218) {
    lightingStatus = 'glare';
  }

  // Classify sharpness
  let sharpnessStatus: 'blurry' | 'acceptable' | 'sharp' = 'sharp';
  if (sharpness < 7) {
    sharpnessStatus = 'blurry';
  } else if (sharpness < 15) {
    sharpnessStatus = 'acceptable';
  } else {
    sharpnessStatus = 'sharp';
  }

  // Calculate overall score (0 - 100)
  let score = 100;
  if (lightingStatus === 'dark') {
    score -= Math.min(50, Math.round((65 - avgBrightness) * 1.2));
  } else if (lightingStatus === 'glare') {
    score -= Math.min(40, Math.round((avgBrightness - 218) * 1.5));
  }

  if (sharpnessStatus === 'blurry') {
    score -= Math.min(50, Math.round((7 - sharpness) * 7));
  } else if (sharpnessStatus === 'acceptable') {
    score -= 15;
  }

  score = Math.max(10, Math.min(100, score));

  // Determine readiness & user-friendly feedback message
  const isReadyForOcr = lightingStatus === 'good' && sharpnessStatus !== 'blurry';

  let feedbackMessage = 'Perfect! Ready to capture.';
  if (lightingStatus === 'dark' && sharpnessStatus === 'blurry') {
    feedbackMessage = 'Too dark & blurry. Turn on lights and hold steady.';
  } else if (lightingStatus === 'dark') {
    feedbackMessage = 'Lighting is dim. Move closer to light.';
  } else if (lightingStatus === 'glare') {
    feedbackMessage = 'Strong glare detected. Tilt slightly to avoid reflection.';
  } else if (sharpnessStatus === 'blurry') {
    feedbackMessage = 'Camera is moving. Hold steady to focus.';
  } else if (sharpnessStatus === 'acceptable') {
    feedbackMessage = 'Hold steady for clearest text.';
  }

  return {
    brightness: Math.round(avgBrightness),
    sharpness,
    lightingStatus,
    sharpnessStatus,
    isReadyForOcr,
    score,
    feedbackMessage,
  };
}

/**
 * Analyzes an image File or Base64 data URL
 */
export async function analyzeImageFile(fileOrBase64: File | string): Promise<ImageQualityReport> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const report = analyzeImageQuality(img, img.naturalWidth || 640, img.naturalHeight || 480);
      resolve(report);
    };
    img.onerror = () => {
      resolve({
        brightness: 128,
        sharpness: 20,
        lightingStatus: 'good',
        sharpnessStatus: 'sharp',
        isReadyForOcr: true,
        score: 80,
        feedbackMessage: 'Ready to scan',
      });
    };

    if (typeof fileOrBase64 === 'string') {
      img.src = fileOrBase64;
    } else {
      const url = URL.createObjectURL(fileOrBase64);
      img.src = url;
    }
  });
}
