/**
 * LINE Sticker Studio - LINE 靜態貼圖上架素材打包與檢驗流程
 * 遵守 LINE Creators Market 官方素材規範與防呆要求
 */

import type { StickerProject, StickerImage } from '../../types/project';
import { 
  STICKER_IMAGE_SPEC, 
  MAIN_IMAGE_SPEC, 
  TAB_IMAGE_SPEC, 
  MAX_ZIP_PACKAGE_SIZE_BYTES,
  OFFICIAL_VALID_STICKER_COUNTS 
} from '../spec-checker/specRules';
import { ensurePngFormat } from './pngConverter';
import { buildZipArchive, verifyZipArchive, ZipFileInput, ZipVerificationResult } from './zipEngine';

export interface PreExportCheckItem {
  id: string;
  name: string;
  status: 'pass' | 'error' | 'warning';
  isPassed: boolean;
  isMandatory: boolean;
  message: string;
  suggestion?: string;
}

export interface ExportValidationReport {
  canExport: boolean;
  items: PreExportCheckItem[];
  errors: PreExportCheckItem[];
  warnings: PreExportCheckItem[];
  checkedStickersCount: number;
  targetCount: number;
  hasMainImage: boolean;
  hasTabImage: boolean;
  totalEstimatedBytes: number;
}

export interface ExportExecutionResult {
  success: boolean;
  zipBlob?: Blob;
  filename?: string;
  totalFiles: number;
  fileCount: number;
  totalSizeBytes: number;
  verification?: ZipVerificationResult;
  errorMessage?: string;
  errors: string[];
}

/**
 * 匯出前執行完整 10 項官方必要條件檢驗
 */
export function runPreExportCheck(
  project: StickerProject,
  images: StickerImage[]
): ExportValidationReport {
  const items: PreExportCheckItem[] = [];

  const targetCount = project.targetCount || 16;
  const stickerImages = images.filter(
    (img) => img.id !== project.mainImageId && img.id !== project.tabImageId
  );
  const currentStickerCount = stickerImages.length;

  // 1. 專案合法張數選項檢查
  const isTargetValid = OFFICIAL_VALID_STICKER_COUNTS.includes(targetCount);
  items.push({
    id: 'TARGET_COUNT_VALID',
    name: '官方合法貼圖張數規格',
    status: isTargetValid ? 'pass' : 'error',
    isPassed: isTargetValid,
    isMandatory: true,
    message: isTargetValid
      ? `專案設定目標為 ${targetCount} 張（符合官方 8, 16, 24, 32, 40 規範）。`
      : `專案目標設定為 ${targetCount} 張，官方僅支援 8, 16, 24, 32, 40 張。`,
    suggestion: isTargetValid ? undefined : '請進入專案設定將目標張數修改為官方合法選項。',
  });

  // 2. 貼圖張數吻合檢查 (不包含主圖與標籤圖)
  const isCountMatch = currentStickerCount === targetCount;
  const diff = targetCount - currentStickerCount;
  items.push({
    id: 'STICKER_COUNT',
    name: '一般貼圖張數檢查',
    status: isCountMatch ? 'pass' : 'error',
    isPassed: isCountMatch,
    isMandatory: true,
    message: isCountMatch
      ? `目前貼圖數量已齊全 (${currentStickerCount} / ${targetCount} 張)。`
      : `目前貼圖有 ${currentStickerCount} 張，目標為 ${targetCount} 張（${diff > 0 ? `缺少 ${diff} 張` : `超出 ${Math.abs(diff)} 張`}）。`,
    suggestion: isCountMatch
      ? undefined
      : diff > 0
      ? `請於圖片工作區補齊 ${diff} 張貼圖。`
      : `請移除多餘的 ${Math.abs(diff)} 張貼圖。`,
  });

  // 3. 主圖 (main.png) 是否存在
  const mainImage = images.find((img) => img.id === project.mainImageId);
  const hasMainImage = !!mainImage;
  items.push({
    id: 'MAIN_IMAGE_EXISTS',
    name: '主要圖片 (main.png) 指派',
    status: hasMainImage ? 'pass' : 'error',
    isPassed: hasMainImage,
    isMandatory: true,
    message: hasMainImage
      ? `已指定主要圖片「${mainImage.customName || mainImage.originalName}」。`
      : '尚未指定專案的主要圖片 (Main Image 240 × 240 px)。',
    suggestion: hasMainImage
      ? undefined
      : '請於工作區或匯出設定中，將一張 240 × 240 px 的圖片指定為主要圖片。',
  });

  // 4. 主圖尺寸 240x240
  if (mainImage) {
    const isMainDimOk =
      mainImage.width === MAIN_IMAGE_SPEC.width && mainImage.height === MAIN_IMAGE_SPEC.height;
    items.push({
      id: 'MAIN_IMAGE_SIZE',
      name: '主要圖片尺寸 (240 × 240 px)',
      status: isMainDimOk ? 'pass' : 'error',
      isPassed: isMainDimOk,
      isMandatory: true,
      message: isMainDimOk
        ? '主要圖片尺寸符合 240 × 240 px 官方標準。'
        : `主要圖片「${mainImage.customName || mainImage.originalName}」尺寸為 ${mainImage.width} × ${mainImage.height} px，官方要求必須精確為 240 × 240 px。`,
      suggestion: isMainDimOk ? undefined : '請將主要圖片裁切或調整為 240 × 240 px。',
    });
  }

  // 5. 聊天室標籤圖 (tab.png) 是否存在
  const tabImage = images.find((img) => img.id === project.tabImageId);
  const hasTabImage = !!tabImage;
  items.push({
    id: 'TAB_IMAGE_EXISTS',
    name: '聊天室標籤圖 (tab.png) 指派',
    status: hasTabImage ? 'pass' : 'error',
    isPassed: hasTabImage,
    isMandatory: true,
    message: hasTabImage
      ? `已指定聊天室標籤圖「${tabImage.customName || tabImage.originalName}」。`
      : '尚未指定專案的聊天室標籤圖 (Tab Image 96 × 74 px)。',
    suggestion: hasTabImage
      ? undefined
      : '請於工作區或匯出設定中，將一張 96 × 74 px 的圖片指定為聊天室標籤圖。',
  });

  // 6. 標籤圖尺寸 96x74
  if (tabImage) {
    const isTabDimOk =
      tabImage.width === TAB_IMAGE_SPEC.width && tabImage.height === TAB_IMAGE_SPEC.height;
    items.push({
      id: 'TAB_IMAGE_SIZE',
      name: '聊天室標籤圖尺寸 (96 × 74 px)',
      status: isTabDimOk ? 'pass' : 'error',
      isPassed: isTabDimOk,
      isMandatory: true,
      message: isTabDimOk
        ? '標籤圖尺寸符合 96 × 74 px 官方標準。'
        : `標籤圖「${tabImage.customName || tabImage.originalName}」尺寸為 ${tabImage.width} × ${tabImage.height} px，官方要求必須精確為 96 × 74 px。`,
      suggestion: isTabDimOk ? undefined : '請將聊天室標籤圖裁切或調整為 96 × 74 px。',
    });
  }

  // 7. 一般貼圖偶數寬高檢查
  const oddImages = stickerImages.filter(
    (img) => img.width % 2 !== 0 || img.height % 2 !== 0
  );
  items.push({
    id: 'STICKERS_EVEN_DIMENSIONS',
    name: '貼圖尺寸偶數限制',
    status: oddImages.length === 0 ? 'pass' : 'error',
    isPassed: oddImages.length === 0,
    isMandatory: true,
    message:
      oddImages.length === 0
        ? '所有貼圖圖片寬度與高度皆為偶數。'
        : `共有 ${oddImages.length} 張貼圖寬度或高度為奇數（例如 ${oddImages[0].width}×${oddImages[0].height}），官方要求必須設為偶數。`,
    suggestion: oddImages.length === 0 ? undefined : '請調整奇數尺寸圖片的寬高為偶數像素。',
  });

  // 8. 一般貼圖最大尺寸 (370 x 320)
  const oversizeImages = stickerImages.filter(
    (img) => img.width > STICKER_IMAGE_SPEC.maxWidth || img.height > STICKER_IMAGE_SPEC.maxHeight
  );
  items.push({
    id: 'STICKERS_MAX_DIMENSIONS',
    name: '貼圖最大尺寸限制 (370 × 320 px)',
    status: oversizeImages.length === 0 ? 'pass' : 'error',
    isPassed: oversizeImages.length === 0,
    isMandatory: true,
    message:
      oversizeImages.length === 0
        ? '所有貼圖皆在最大限制 370 × 320 px 範圍內。'
        : `共有 ${oversizeImages.length} 張貼圖超出最大上限 370 × 320 px。`,
    suggestion: oversizeImages.length === 0 ? undefined : '請等比例縮小畫布至 370 × 320 px 以內。',
  });

  // 9. 單張容量上限 1MB
  const over1MbImages = images.filter((img) => (img.blob?.size || img.fileSize) > 1024 * 1024);
  items.push({
    id: 'IMAGES_FILESIZE_1MB',
    name: '單張圖檔容量限制 (< 1MB)',
    status: over1MbImages.length === 0 ? 'pass' : 'error',
    isPassed: over1MbImages.length === 0,
    isMandatory: true,
    message:
      over1MbImages.length === 0
        ? '所有素材檔案容量皆小於 1MB 官方上限。'
        : `共有 ${over1MbImages.length} 張圖片檔案大小超過 1MB。`,
    suggestion: over1MbImages.length === 0 ? undefined : '請透過 PNG 壓縮降低單張圖檔體積。',
  });

  // 10. 總容量檢查 (< 60MB)
  let totalBytes = 0;
  images.forEach((img) => {
    totalBytes += img.blob?.size || img.fileSize;
  });
  const isTotalSizeOk = totalBytes <= MAX_ZIP_PACKAGE_SIZE_BYTES;
  items.push({
    id: 'TOTAL_ZIP_SIZE',
    name: '素材總容量限制 (< 60MB)',
    status: isTotalSizeOk ? 'pass' : 'error',
    isPassed: isTotalSizeOk,
    isMandatory: true,
    message: isTotalSizeOk
      ? `素材預估總容量為 ${(totalBytes / (1024 * 1024)).toFixed(1)} MB（遠低於 60MB 上限）。`
      : `素材總容量估計為 ${(totalBytes / (1024 * 1024)).toFixed(1)} MB，超出官方 ZIP 60MB 限制。`,
    suggestion: isTotalSizeOk ? undefined : '請適度壓縮高解析度圖片以控制總容量。',
  });

  const errors = items.filter((it) => it.status === 'error');
  const warnings = items.filter((it) => it.status === 'warning');
  const canExport = errors.length === 0;

  return {
    canExport,
    items,
    errors,
    warnings,
    checkedStickersCount: currentStickerCount,
    targetCount,
    hasMainImage,
    hasTabImage,
    totalEstimatedBytes: totalBytes,
  };
}

/**
 * 執行素材準備、重命名並輸出純淨的 LINE 官方上架 ZIP
 */
export async function packageLineStickersZip(
  project: StickerProject,
  images: StickerImage[],
  onProgress?: (percent: number, stepText: string) => void
): Promise<ExportExecutionResult> {
  try {
    // 1. 強制執行前置檢查
    onProgress?.(10, '執行匯出前規格檢驗...');
    const checkReport = runPreExportCheck(project, images);
    if (!checkReport.canExport) {
      const topErrors = checkReport.errors.map((e) => `• ${e.name}: ${e.message}`);
      return {
        success: false,
        totalFiles: 0,
        fileCount: 0,
        totalSizeBytes: 0,
        errorMessage: `專案未達 LINE 官方上架要求，阻擋匯出：\n${topErrors.join('\n')}`,
        errors: topErrors,
      };
    }

    onProgress?.(25, '整理貼圖檔案清單與順序...');
    const zipFiles: ZipFileInput[] = [];
    const expectedFilenames: string[] = [];

    // 2. 處理 main.png (主圖)
    const mainImg = images.find((img) => img.id === project.mainImageId);
    if (!mainImg) throw new Error('找不到主要圖片 (main.png) 資料');
    onProgress?.(30, '處理 main.png 格式與透明通道...');
    const mainPng = await ensurePngFormat(mainImg.blob, 'main.png');
    zipFiles.push({ filename: 'main.png', blob: mainPng.blob });
    expectedFilenames.push('main.png');

    // 3. 處理 tab.png (聊天室標籤圖)
    const tabImg = images.find((img) => img.id === project.tabImageId);
    if (!tabImg) throw new Error('找不到聊天室標籤圖 (tab.png) 資料');
    onProgress?.(40, '處理 tab.png 格式與透明通道...');
    const tabPng = await ensurePngFormat(tabImg.blob, 'tab.png');
    zipFiles.push({ filename: 'tab.png', blob: tabPng.blob });
    expectedFilenames.push('tab.png');

    // 4. 依序處理 01.png ~ XX.png (一般貼圖)
    const stickerImages = images
      .filter((img) => img.id !== project.mainImageId && img.id !== project.tabImageId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    for (let i = 0; i < stickerImages.length; i++) {
      const img = stickerImages[i];
      const seq = String(i + 1).padStart(2, '0');
      const filename = `${seq}.png`;
      expectedFilenames.push(filename);

      onProgress?.(
        40 + Math.round(((i + 1) / stickerImages.length) * 35),
        `驗證與包裝 ${filename}...`
      );

      const stickerPng = await ensurePngFormat(img.blob, filename);
      zipFiles.push({ filename, blob: stickerPng.blob });
    }

    // 5. 呼叫 JSZip 建立標準 ZIP
    onProgress?.(80, '使用 JSZip 封裝二進位壓縮檔...');
    const zipBlob = await buildZipArchive(zipFiles);

    // 6. 依據需求：實際重新讀取並使用 JSZip 驗證封裝內容
    onProgress?.(90, '使用 JSZip 實際重新解開並核驗檔案完整性...');
    const verification = await verifyZipArchive(zipBlob, expectedFilenames);
    if (!verification.isValid) {
      throw new Error(`ZIP 封裝校驗失敗: ${verification.errorMessage}`);
    }

    const safeProjectName = project.name.replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `${safeProjectName}_LINE_Stickers.zip`;

    onProgress?.(100, '完成匯出！');

    return {
      success: true,
      zipBlob,
      filename,
      totalFiles: zipFiles.length,
      fileCount: zipFiles.length,
      totalSizeBytes: zipBlob.size,
      verification,
      errors: [],
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      totalFiles: 0,
      fileCount: 0,
      totalSizeBytes: 0,
      errorMessage: errorMsg,
      errors: [errorMsg],
    };
  }
}

/**
 * 觸發下載產出的 ZIP 檔案至創作者電腦
 */
export function triggerZipDownload(zipBlob: Blob, filename: string): void {
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
