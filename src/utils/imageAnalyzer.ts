/**
 * 圖片像素與元資料分析工具
 */

export interface ImageAnalysis {
  width: number;
  height: number;
  hasAlphaChannel: boolean;
  mimeType: string;
  fileSize: number;
  dataUrl: string;
}

// 格式化檔案大小
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// 檢查圖片 Alpha 通道
function detectAlphaChannel(img: HTMLImageElement, width: number, height: number): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(width, 400); // 縮樣採樣以提昇檢測效能
    canvas.height = Math.min(height, 400);
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // 檢查像素資料中的 Alpha (第 4, 8, 12... 個數值)
    for (let i = 3; i < imgData.length; i += 4) {
      if (imgData[i] < 250) {
        // 存在透明或半透明像素
        return true;
      }
    }
    return false;
  } catch (e) {
    console.warn('無法檢測透明通道:', e);
    return false;
  }
}

// 完整分析圖片檔案
export async function analyzeImageFile(file: File | Blob, originalFilename?: string): Promise<ImageAnalysis> {
  const mimeType = file.type || (originalFilename?.toLowerCase().endsWith('.png') ? 'image/png' : 'application/octet-stream');
  const fileSize = file.size;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('讀取圖片檔案失敗'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onerror = () => reject(new Error('無法解析圖片格式，請確認是否為有效圖片'));
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        const hasAlphaChannel = detectAlphaChannel(img, width, height);

        resolve({
          width,
          height,
          hasAlphaChannel,
          mimeType,
          fileSize,
          dataUrl,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
