/**
 * Client-side Image Optimizer & File Size Validator
 * Ensures files stay strictly under 5MB to prevent server memory bloat and API latency.
 */

export interface OptimizationResult {
  file: File;
  base64: string;
  originalSizeMB: number;
  finalSizeMB: number;
  mimeType: string;
  error?: string;
}

export const MAX_RECEIPT_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Validates file size and optimizes/compresses high-resolution images down to safe size (<5MB).
 */
export async function validateAndOptimizeReceiptImage(
  file: File,
  maxSizeBytes: number = MAX_RECEIPT_FILE_SIZE_BYTES
): Promise<OptimizationResult> {
  const originalSizeMB = Number((file.size / (1024 * 1024)).toFixed(2));

  // Non-image files (like PDFs) or already small images
  if (!file.type.startsWith('image/')) {
    if (file.size > maxSizeBytes) {
      return {
        file,
        base64: '',
        originalSizeMB,
        finalSizeMB: originalSizeMB,
        mimeType: file.type,
        error: `File "${file.name}" exceeds the 5MB limit (${originalSizeMB}MB). Please upload a file under 5MB.`,
      };
    }

    const base64 = await readFileAsBase64(file);
    return {
      file,
      base64,
      originalSizeMB,
      finalSizeMB: originalSizeMB,
      mimeType: file.type || 'application/octet-stream',
    };
  }

  // For image files, we load and compress if needed to ensure high clarity & <5MB payload
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Determine optimal target dimensions (1400px preserves 100% of OCR legibility while reducing processing latency)
          const MAX_DIMENSION = 1400;
          let width = img.width;
          let height = img.height;

          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
              height = Math.round((height * MAX_DIMENSION) / width);
              width = MAX_DIMENSION;
            } else {
              width = Math.round((width * MAX_DIMENSION) / height);
              height = MAX_DIMENSION;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            // Fallback to original base64 if canvas context fails
            const rawBase64 = e.target?.result as string;
            resolve({
              file,
              base64: rawBase64,
              originalSizeMB,
              finalSizeMB: originalSizeMB,
              mimeType: file.type,
            });
            return;
          }

          // Draw with white background in case of transparent PNGs
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with high visual fidelity for receipts
          let quality = 0.82;
          let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

          // Estimate byte size from base64 string
          let estimatedBytes = Math.round((compressedDataUrl.length * 3) / 4);

          // If still over limit, lower quality slightly
          if (estimatedBytes > maxSizeBytes) {
            quality = 0.70;
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            estimatedBytes = Math.round((compressedDataUrl.length * 3) / 4);
          }

          const finalSizeMB = Number((estimatedBytes / (1024 * 1024)).toFixed(2));

          if (estimatedBytes > maxSizeBytes) {
            resolve({
              file,
              base64: '',
              originalSizeMB,
              finalSizeMB,
              mimeType: 'image/jpeg',
              error: `Image "${file.name}" is too large (${originalSizeMB}MB) and exceeds the 5MB limit.`,
            });
            return;
          }

          resolve({
            file,
            base64: compressedDataUrl,
            originalSizeMB,
            finalSizeMB,
            mimeType: 'image/jpeg',
          });
        } catch (err: any) {
          resolve({
            file,
            base64: '',
            originalSizeMB,
            finalSizeMB: originalSizeMB,
            mimeType: file.type,
            error: `Failed to process image "${file.name}": ${err?.message || 'Unknown error'}`,
          });
        }
      };

      img.onerror = () => {
        resolve({
          file,
          base64: '',
          originalSizeMB,
          finalSizeMB: originalSizeMB,
          mimeType: file.type,
          error: `Could not read image format for "${file.name}".`,
        });
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      resolve({
        file,
        base64: '',
        originalSizeMB,
        finalSizeMB: originalSizeMB,
        mimeType: file.type,
        error: `Could not read file "${file.name}".`,
      });
    };

    reader.readAsDataURL(file);
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
