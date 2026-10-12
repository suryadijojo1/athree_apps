import type { ClipboardEvent as ReactClipboardEvent } from 'react';

/**
 * Utility untuk kompresi dan pengolahan gambar Mockup Design
 * Memastikan gambar yang di-paste atau di-upload dikompres ke ukuran kecil (thumbnail/preview lightweight)
 * agar tidak memberatkan Firestore, localStorage, atau database server.
 */

export interface CompressedImageResult {
  dataUrl: string;
  sizeKb: number;
  width: number;
  height: number;
}

/**
 * Mengompres gambar dari File, Blob, atau Data URL
 * @param source File, Blob, atau string data URL gambar
 * @param maxWidth Resolusi maksimal lebar (default: 800px)
 * @param maxHeight Resolusi maksimal tinggi (default: 800px)
 * @param quality Kualitas JPEG/WebP kompresi (0.1 - 1.0, default: 0.65)
 */
export async function compressImage(
  source: File | Blob | string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.65
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    let srcUrl = '';
    let isObjectUrl = false;

    if (typeof source === 'string') {
      srcUrl = source;
    } else if (source instanceof Blob) {
      srcUrl = URL.createObjectURL(source);
      isObjectUrl = true;
    } else {
      return reject(new Error('Format sumber gambar tidak didukung'));
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (isObjectUrl) {
        URL.revokeObjectURL(srcUrl);
      }

      let { width, height } = img;

      // Hitung skala aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Gagal menginisialisasi canvas context'));
      }

      // Bersihkan background ke putih untuk transparansi PNG jika disimpan sebagai JPEG
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Render gambar ke canvas dengan smoothing berkualitas
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Coba kompres sebagai WebP jika didukung, fallback ke JPEG
      let compressedDataUrl = '';
      try {
        compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      } catch {
        compressedDataUrl = canvas.toDataURL('image/png');
      }

      // Hitung perkiraan ukuran dalam KB
      const base64Length = compressedDataUrl.length - (compressedDataUrl.indexOf(',') + 1);
      const sizeBytes = Math.round((base64Length * 3) / 4);
      const sizeKb = Math.round((sizeBytes / 1024) * 10) / 10;

      resolve({
        dataUrl: compressedDataUrl,
        sizeKb,
        width,
        height
      });
    };

    img.onerror = () => {
      if (isObjectUrl) {
        URL.revokeObjectURL(srcUrl);
      }
      reject(new Error('Gagal memproses gambar'));
    };

    img.src = srcUrl;
  });
}

/**
 * Mengekstrak file gambar dari Clipboard Event (Ctrl+V / Cmd+V)
 */
export function extractImageFromClipboard(event: ReactClipboardEvent | ClipboardEvent): File | null {
  const clipboardData = event.clipboardData;
  if (!clipboardData) return null;

  // Cek items (Chrome / Safari / Firefox modern)
  if (clipboardData.items) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }

  // Cek files
  if (clipboardData.files && clipboardData.files.length > 0) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const file = clipboardData.files[i];
      if (file.type.indexOf('image') !== -1) {
        return file;
      }
    }
  }

  return null;
}
