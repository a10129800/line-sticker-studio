/**
 * LINE Sticker Studio - 基於 JSZip 的成熟打包與驗證引擎
 * 依據規範：採用成熟維護的 JSZip 套件，並在打包完成後實際解壓核驗檔案完整性
 */

import JSZip from 'jszip';
import { MAX_ZIP_PACKAGE_SIZE_BYTES } from '../spec-checker/specRules';

export interface ZipFileInput {
  filename: string;
  blob: Blob;
}

export interface ZipVerificationResult {
  isValid: boolean;
  totalEntries: number;
  totalFiles: number;
  entryNames: string[];
  totalSizeBytes: number;
  missingFiles: string[];
  missingRequiredFiles: string[];
  unexpectedFiles: string[];
  errorMessage?: string;
}

/**
 * 使用 JSZip 封裝標準 ZIP 檔案
 */
export async function buildZipArchive(
  files: ZipFileInput[],
  onProgress?: (percent: number, currentFile: string) => void
): Promise<Blob> {
  if (!files || files.length === 0) {
    throw new Error('未提供任何需打包的素材檔案');
  }

  const zip = new JSZip();

  // 逐一將檔案載入 JSZip 物件
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(Math.round(((i + 1) / files.length) * 50), file.filename);
    zip.file(file.filename, file.blob, {
      binary: true,
      date: new Date(),
    });
  }

  // 產生標準 ZIP Blob (使用 DEFLATE 壓縮以減少體積)
  const zipBlob: Blob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }
  );

  onProgress?.(100, '打包完成');
  return zipBlob;
}

/**
 * 實際重新讀取並使用 JSZip 驗證 ZIP 封裝內容
 * 嚴格比對：
 * 1. 檔案總數
 * 2. 檔案名稱是否 100% 吻合預期清單
 * 3. 是否存在未預期的多餘檔案
 * 4. 總容量是否超出官方 60MB 上限
 */
export async function verifyZipArchive(
  zipBlob: Blob,
  expected: string[] | number
): Promise<ZipVerificationResult> {
  const expectedFilenames: string[] = Array.isArray(expected)
    ? expected
    : [
        'main.png',
        'tab.png',
        ...Array.from({ length: expected }, (_, i) => `${String(i + 1).padStart(2, '0')}.png`),
      ];

  try {
    const unzipped = await JSZip.loadAsync(zipBlob);
    const entryNames = Object.keys(unzipped.files).filter(
      (name) => !unzipped.files[name].dir
    );

    const expectedSet = new Set(expectedFilenames);
    const actualSet = new Set(entryNames);

    const missingFiles = expectedFilenames.filter((name) => !actualSet.has(name));
    const unexpectedFiles = entryNames.filter((name) => !expectedSet.has(name));

    const totalSizeBytes = zipBlob.size;
    const isSizeOk = totalSizeBytes <= MAX_ZIP_PACKAGE_SIZE_BYTES;

    const isValid =
      missingFiles.length === 0 &&
      unexpectedFiles.length === 0 &&
      entryNames.length === expectedFilenames.length &&
      isSizeOk;

    let errorMessage: string | undefined;
    if (!isSizeOk) {
      errorMessage = `ZIP 封裝總大小 (${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB) 超出官方 60MB 上限`;
    } else if (missingFiles.length > 0) {
      errorMessage = `ZIP 內容缺失必要素材: ${missingFiles.join(', ')}`;
    } else if (unexpectedFiles.length > 0) {
      errorMessage = `ZIP 內容包含未預期的雜檔: ${unexpectedFiles.join(', ')}`;
    }

    return {
      isValid,
      totalEntries: entryNames.length,
      totalFiles: entryNames.length,
      entryNames,
      totalSizeBytes,
      missingFiles,
      missingRequiredFiles: missingFiles,
      unexpectedFiles,
      errorMessage,
    };
  } catch (err) {
    return {
      isValid: false,
      totalEntries: 0,
      totalFiles: 0,
      entryNames: [],
      totalSizeBytes: zipBlob.size,
      missingFiles: expectedFilenames,
      missingRequiredFiles: expectedFilenames,
      unexpectedFiles: [],
      errorMessage: `無法使用 ZIP 套件解讀封裝檔案: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}
