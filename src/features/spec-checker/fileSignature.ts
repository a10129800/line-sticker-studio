/**
 * 檔案二進位簽章（Magic Number）真實格式檢驗模組
 * 不只依賴副檔名或使用者偽造的 MIME Type
 */

export interface FileFormatDetection {
  realFormat: 'PNG' | 'JPEG' | 'WEBP' | 'GIF' | 'UNKNOWN';
  isRealPng: boolean;
  signatureHex: string;
}

/**
 * 讀取 Blob 前 12 個 Byte 判斷真實檔案格式
 */
export async function detectRealFileFormat(blob: Blob): Promise<FileFormatDetection> {
  try {
    const slice = blob.slice(0, 16);
    const arrayBuffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.length < 8) {
      return { realFormat: 'UNKNOWN', isRealPng: false, signatureHex: '' };
    }

    const hex = Array.from(bytes.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');

    // PNG 檔案簽章: 89 50 4E 47 0D 0A 1A 0A
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a;

    if (isPng) {
      return { realFormat: 'PNG', isRealPng: true, signatureHex: hex };
    }

    // JPEG 簽章: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { realFormat: 'JPEG', isRealPng: false, signatureHex: hex };
    }

    // GIF 簽章: GIF87a 或 GIF89a (47 49 46 38)
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
      return { realFormat: 'GIF', isRealPng: false, signatureHex: hex };
    }

    // WebP 簽章: RIFF....WEBP
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return { realFormat: 'WEBP', isRealPng: false, signatureHex: hex };
    }

    return { realFormat: 'UNKNOWN', isRealPng: false, signatureHex: hex };
  } catch (err) {
    console.warn('檔案簽章檢驗失敗:', err);
    return { realFormat: 'UNKNOWN', isRealPng: false, signatureHex: '' };
  }
}
