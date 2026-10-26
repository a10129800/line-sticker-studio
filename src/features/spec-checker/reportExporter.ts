/**
 * LINE Sticker Studio - 規格檢查報告匯出工具
 * 產生乾淨且不含敏感圖片二進位或本機路徑的 JSON / CSV 報告
 */

import type { ProjectValidationSummary } from './specChecker';

export interface SpecReportPayload {
  reportVersion: '1.1';
  exportedAt: string;
  officialGuidelineSource: string;
  project: {
    id: string;
    name: string;
    targetCount: number;
    currentStickerCount: number;
    totalSizeBytes: number;
    overallStatus: string;
  };
  statistics: {
    totalChecks: number;
    passedChecks: number;
    errorChecks: number;
    warningChecks: number;
    uncertainChecks: number;
  };
  projectLevelIssues: Array<{
    id: string;
    status: string;
    title: string;
    message: string;
    suggestion: string;
  }>;
  mainImageStatus: {
    isConfigured: boolean;
    status: string;
    message: string;
  };
  tabImageStatus: {
    isConfigured: boolean;
    status: string;
    message: string;
  };
  images: Array<{
    imageId: string;
    orderIndex: number;
    displayName: string;
    originalName: string;
    realFormat: string;
    isRealPng: boolean;
    actualWidth: number;
    actualHeight: number;
    actualSizeBytes: number;
    hasAlphaChannel: boolean;
    transparentRatio: number;
    overallStatus: string;
    checks: Array<{
      id: string;
      name: string;
      status: string;
      message: string;
      suggestion?: string;
    }>;
  }>;
}

/**
 * 將檢查結果轉換為安全純淨的報告物件
 */
export function generateReportPayload(summary: ProjectValidationSummary): SpecReportPayload {
  return {
    reportVersion: '1.1',
    exportedAt: new Date().toISOString(),
    officialGuidelineSource: 'https://creator.line.me/zh-hant/guideline/sticker/ (2026-10-26)',
    project: {
      id: summary.projectId,
      name: summary.projectName,
      targetCount: summary.targetCount,
      currentStickerCount: summary.currentStickerCount,
      totalSizeBytes: summary.totalSizeBytes,
      overallStatus: summary.overallStatus,
    },
    statistics: {
      totalChecks: summary.totalChecksCount,
      passedChecks: summary.passChecksCount,
      errorChecks: summary.errorChecksCount,
      warningChecks: summary.warningChecksCount,
      uncertainChecks: summary.uncertainChecksCount,
    },
    projectLevelIssues: summary.projectLevelIssues,
    mainImageStatus: {
      isConfigured: summary.mainImageStatus.isConfigured,
      status: summary.mainImageStatus.status,
      message: summary.mainImageStatus.message,
    },
    tabImageStatus: {
      isConfigured: summary.tabImageStatus.isConfigured,
      status: summary.tabImageStatus.status,
      message: summary.tabImageStatus.message,
    },
    images: summary.images.map((img) => ({
      imageId: img.imageId,
      orderIndex: img.orderIndex,
      displayName: img.displayName,
      originalName: img.originalName,
      realFormat: img.realFormat,
      isRealPng: img.isRealPng,
      actualWidth: img.actualWidth,
      actualHeight: img.actualHeight,
      actualSizeBytes: img.actualSizeBytes,
      hasAlphaChannel: img.hasAlphaChannel,
      transparentRatio: img.transparentRatio,
      overallStatus: img.overallStatus,
      checks: img.details.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        message: d.message,
        suggestion: d.suggestion,
      })),
    })),
  };
}

/**
 * 觸發瀏覽器下載純文字 / JSON 檔案
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * 匯出 JSON 格式規格檢查報告
 */
export function exportValidationReportJson(summary: ProjectValidationSummary): void {
  try {
    const payload = generateReportPayload(summary);
    const jsonString = JSON.stringify(payload, null, 2);
    const safeName = summary.projectName.replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `LINE_Sticker_SpecReport_${safeName}_${Date.now()}.json`;
    downloadFile(jsonString, filename, 'application/json');
  } catch (err) {
    throw new Error(`匯出 JSON 檢查報告失敗: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * 匯出 CSV 格式圖片清單報告
 */
export function exportValidationReportCsv(summary: ProjectValidationSummary): void {
  try {
    const rows: string[][] = [
      ['貼圖序號', '顯示名稱', '原始檔名', '實際格式', '寬度(px)', '高度(px)', '容量(Bytes)', '透明背景', '檢查結果', '錯誤/警告備註與建議'],
    ];

    summary.images.forEach((img, idx) => {
      const issueNotes = img.details
        .filter((d) => d.status === 'error' || d.status === 'warning')
        .map((d) => `[${d.status.toUpperCase()}] ${d.name}: ${d.message} (${d.suggestion || ''})`)
        .join('; ');

      rows.push([
        String(idx + 1).padStart(2, '0'),
        `"${img.displayName.replace(/"/g, '""')}"`,
        `"${img.originalName.replace(/"/g, '""')}"`,
        img.realFormat,
        String(img.actualWidth),
        String(img.actualHeight),
        String(img.actualSizeBytes),
        img.hasAlphaChannel ? '是' : '否',
        img.overallStatus.toUpperCase(),
        `"${issueNotes.replace(/"/g, '""')}"`,
      ]);
    });

    // 加上 UTF-8 BOM 以免 Excel 開啟亂碼
    const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\r\n');
    const safeName = summary.projectName.replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `LINE_Sticker_SpecReport_${safeName}_${Date.now()}.csv`;
    downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  } catch (err) {
    throw new Error(`匯出 CSV 檢查報告失敗: ${err instanceof Error ? err.message : String(err)}`);
  }
}
