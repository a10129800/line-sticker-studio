import { describe, it, expect } from 'vitest';
import { 
  evaluateStickerImageRules, 
  validateProjectSpecs,
  AlphaPixelAnalysis 
} from '../features/spec-checker/specChecker';
import { generateReportPayload } from '../features/spec-checker/reportExporter';
import { detectRealFileFormat } from '../features/spec-checker/fileSignature';
import { 
  MAX_IMAGE_FILE_SIZE_BYTES,
  OFFICIAL_VALID_STICKER_COUNTS 
} from '../features/spec-checker/specRules';
import type { StickerProject, StickerImage } from '../types/project';

describe('LINE Sticker Studio - 規格檢查器核心邏輯測試', () => {
  describe('7.1 規則判定 (單張貼圖尺寸、格式、大小)', () => {
    const validAlpha: AlphaPixelAnalysis = {
      hasAlpha: true,
      transparentRatio: 35,
      hasMarginWarning: false,
      canAnalyze: true,
    };

    it('符合所有官方規則的圖片應判定為合格 (Pass)', () => {
      const result = evaluateStickerImageRules({
        isReadable: true,
        realFormat: 'PNG',
        isRealPng: true,
        actualWidth: 370,
        actualHeight: 320,
        fileSizeBytes: 450 * 1024, // 450 KB
        alphaAnalysis: validAlpha,
      });

      expect(result.overallStatus).toBe('pass');
      expect(result.details.every((d) => d.status === 'pass')).toBe(true);
    });

    it('超過尺寸限制 (寬 > 370 或 高 > 320) 的圖片應被判定為 Error', () => {
      const wideResult = evaluateStickerImageRules({
        isReadable: true,
        realFormat: 'PNG',
        isRealPng: true,
        actualWidth: 372, // 超出 370
        actualHeight: 320,
        fileSizeBytes: 300 * 1024,
        alphaAnalysis: validAlpha,
      });
      expect(wideResult.overallStatus).toBe('error');
      const maxDimRule = wideResult.details.find((d) => d.id === 'IMAGE_DIMENSIONS_MAX');
      expect(maxDimRule?.status).toBe('error');

      const tallResult = evaluateStickerImageRules({
        isReadable: true,
        realFormat: 'PNG',
        isRealPng: true,
        actualWidth: 370,
        actualHeight: 322, // 超出 320
        fileSizeBytes: 300 * 1024,
        alphaAnalysis: validAlpha,
      });
      expect(tallResult.overallStatus).toBe('error');
    });

    it('奇數尺寸圖片應被判定為 Error (因官方系統縮小時需為偶數)', () => {
      const oddResult = evaluateStickerImageRules({
        isReadable: true,
        realFormat: 'PNG',
        isRealPng: true,
        actualWidth: 369, // 奇數
        actualHeight: 320,
        fileSizeBytes: 300 * 1024,
        alphaAnalysis: validAlpha,
      });
      expect(oddResult.overallStatus).toBe('error');
      const evenRule = oddResult.details.find((d) => d.id === 'IMAGE_DIMENSIONS_EVEN');
      expect(evenRule?.status).toBe('error');
    });

    it('超過 1MB (1,048,576 Bytes) 檔案大小限制應被判定為 Error', () => {
      const oversizeResult = evaluateStickerImageRules({
        isReadable: true,
        realFormat: 'PNG',
        isRealPng: true,
        actualWidth: 370,
        actualHeight: 320,
        fileSizeBytes: MAX_IMAGE_FILE_SIZE_BYTES + 10, // 超出 1MB
        alphaAnalysis: validAlpha,
      });
      expect(oversizeResult.overallStatus).toBe('error');
      const sizeRule = oversizeResult.details.find((d) => d.id === 'IMAGE_SIZE_LIMIT');
      expect(sizeRule?.status).toBe('error');
    });

    it('非真實 PNG 格式 (如 JPEG / WEBP) 應被判定為 Error', () => {
      const nonPngResult = evaluateStickerImageRules({
        isReadable: true,
        realFormat: 'JPEG',
        isRealPng: false,
        actualWidth: 370,
        actualHeight: 320,
        fileSizeBytes: 200 * 1024,
        alphaAnalysis: validAlpha,
      });
      expect(nonPngResult.overallStatus).toBe('error');
      const formatRule = nonPngResult.details.find((d) => d.id === 'IMAGE_FORMAT_PNG');
      expect(formatRule?.status).toBe('error');
    });
  });

  describe('7.2 透明背景與 Alpha 通道檢驗', () => {
    it('完全不透明圖片 (hasAlpha: false) 應判定為強制 Error', () => {
      const opaqueResult = evaluateStickerImageRules({
        isReadable: true,
        realFormat: 'PNG',
        isRealPng: true,
        actualWidth: 300,
        actualHeight: 300,
        fileSizeBytes: 100 * 1024,
        alphaAnalysis: {
          hasAlpha: false,
          transparentRatio: 0,
          hasMarginWarning: false,
          canAnalyze: true,
        },
      });
      expect(opaqueResult.overallStatus).toBe('error');
      const alphaRule = opaqueResult.details.find((d) => d.id === 'IMAGE_TRANSPARENT_BACKGROUND');
      expect(alphaRule?.status).toBe('error');
    });

    it('含有透明像素 (hasAlpha: true) 應順利通過透明度檢查', () => {
      const transparentResult = evaluateStickerImageRules({
        isReadable: true,
        realFormat: 'PNG',
        isRealPng: true,
        actualWidth: 300,
        actualHeight: 300,
        fileSizeBytes: 100 * 1024,
        alphaAnalysis: {
          hasAlpha: true,
          transparentRatio: 40,
          hasMarginWarning: false,
          canAnalyze: true,
        },
      });
      const alphaRule = transparentResult.details.find((d) => d.id === 'IMAGE_TRANSPARENT_BACKGROUND');
      expect(alphaRule?.status).toBe('pass');
    });

    it('無法解析像素資料 (canAnalyze: false) 應回報 Uncertain，不得當作通過', () => {
      const uncertainResult = evaluateStickerImageRules({
        isReadable: true,
        realFormat: 'PNG',
        isRealPng: true,
        actualWidth: 300,
        actualHeight: 300,
        fileSizeBytes: 100 * 1024,
        alphaAnalysis: {
          hasAlpha: false,
          transparentRatio: 0,
          hasMarginWarning: false,
          canAnalyze: false,
        },
      });
      expect(uncertainResult.overallStatus).toBe('uncertain');
      const alphaRule = uncertainResult.details.find((d) => d.id === 'IMAGE_TRANSPARENT_BACKGROUND');
      expect(alphaRule?.status).toBe('uncertain');
    });

    it('四邊未保留留白時應觸發 Warning (品質建議)，不應阻斷強制通過', () => {
      const marginWarningResult = evaluateStickerImageRules({
        isReadable: true,
        realFormat: 'PNG',
        isRealPng: true,
        actualWidth: 370,
        actualHeight: 320,
        fileSizeBytes: 100 * 1024,
        alphaAnalysis: {
          hasAlpha: true,
          transparentRatio: 20,
          hasMarginWarning: true,
          canAnalyze: true,
        },
      });
      expect(marginWarningResult.overallStatus).toBe('warning');
      const marginRule = marginWarningResult.details.find((d) => d.id === 'IMAGE_MARGIN_RECOMMENDED');
      expect(marginRule?.status).toBe('warning');
      expect(marginRule?.isMandatory).toBe(false);
    });

    it('圖片解碼失敗 (isReadable: false) 應直接回報 Error', () => {
      const brokenResult = evaluateStickerImageRules({
        isReadable: false,
        realFormat: 'UNKNOWN',
        isRealPng: false,
        actualWidth: 0,
        actualHeight: 0,
        fileSizeBytes: 0,
        alphaAnalysis: {
          hasAlpha: false,
          transparentRatio: 0,
          hasMarginWarning: false,
          canAnalyze: false,
        },
      });
      expect(brokenResult.overallStatus).toBe('error');
    });
  });

  describe('7.3 專案整體張數與總容量檢查', () => {
    const mockProject: StickerProject = {
      id: 'proj-123',
      name: '測試專案',
      characterName: '小貓',
      characterDescription: '',
      stickerType: 'static',
      targetCount: 16,
      status: 'in_progress',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      notes: '',
    };

    it('官方合法張數選項檢查：僅 8, 16, 24, 32, 40 為官方支援', () => {
      expect(OFFICIAL_VALID_STICKER_COUNTS).toEqual([8, 16, 24, 32, 40]);
      expect(OFFICIAL_VALID_STICKER_COUNTS.includes(16)).toBe(true);
      expect(OFFICIAL_VALID_STICKER_COUNTS.includes(10 as any)).toBe(false);
    });

    it('空專案 (0 張圖片) 應判定為待檢查 (Uncertain)', async () => {
      const summary = await validateProjectSpecs(mockProject, []);
      expect(summary.currentStickerCount).toBe(0);
      expect(summary.overallStatus).toBe('uncertain');
    });

    it('貼圖張數不足 (如 3 / 16 張) 應於專案層級列出 Error 並計算短缺張數', async () => {
      const mockImages: StickerImage[] = [
        createMockStickerImage('img-1', 0, 300, 300, true),
        createMockStickerImage('img-2', 1, 300, 300, true),
        createMockStickerImage('img-3', 2, 300, 300, true),
      ];

      const summary = await validateProjectSpecs(mockProject, mockImages);
      // 1. 驗證實際張數與目標張數
      expect(summary.currentStickerCount).toBe(3);
      expect(summary.targetCount).toBe(16);

      // 2. 專案層級能正確顯示張數不足的錯誤
      expect(summary.errorChecksCount).toBeGreaterThan(0);
      const deficitIssue = summary.projectLevelIssues.find((i) => i.id === 'PROJECT_STICKER_COUNT_DEFICIT');
      expect(deficitIssue).toBeDefined();
      expect(deficitIssue?.status).toBe('error');

      // 3. 短缺張數必須正確計算為 13 張
      expect(deficitIssue?.message).toContain('缺少 13 張');

      // 4. 不可將張數不足誤判為單張圖片尺寸錯誤 (單張圖片尺寸 300x300 為合規偶數尺寸)
      expect(summary.images.every((img) => img.actualWidth === 300 && img.actualHeight === 300)).toBe(true);
      const hasDimensionError = summary.images.some((img) =>
        img.details.some((d) => d.id === 'IMAGE_DIMENSIONS_MAX' && d.status === 'error')
      );
      expect(hasDimensionError).toBe(false);

      // 5. 不可把張數不足的專案直接判定為完全合格
      expect(summary.overallStatus).toBe('error');
    });
  });

  describe('7.4 檔案二進位簽章 Magic Number 檢測', () => {
    it('應正確識別標準 PNG 二進位簽章 (89 50 4E 47 0D 0A 1A 0A)', async () => {
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const blob = new Blob([pngHeader], { type: 'application/octet-stream' });
      const result = await detectRealFileFormat(blob);
      expect(result.realFormat).toBe('PNG');
      expect(result.isRealPng).toBe(true);
    });

    it('若偽造副檔名為 png 但二進位為 JPEG 簽章 (FF D8 FF)，應精確識破非 PNG', async () => {
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      const fakeBlob = new Blob([jpegHeader], { type: 'image/png' });
      const result = await detectRealFileFormat(fakeBlob);
      expect(result.realFormat).toBe('JPEG');
      expect(result.isRealPng).toBe(false);
    });
  });

  describe('7.5 檢查報告產生與安全性', () => {
    it('產生的檢查報告 payload 應包含專案資訊與統計，且不含 Base64 原始圖片', async () => {
      const mockProject: StickerProject = {
        id: 'proj-456',
        name: '柴犬篇',
        characterName: '阿柴',
        characterDescription: '',
        stickerType: 'static',
        targetCount: 8,
        status: 'in_progress',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        notes: '',
      };

      const summary = await validateProjectSpecs(mockProject, []);
      const report = generateReportPayload(summary);

      expect(report.reportVersion).toBe('1.1');
      expect(report.project.name).toBe('柴犬篇');
      expect(report.officialGuidelineSource).toContain('creator.line.me');
      expect(report.statistics).toBeDefined();

      // 安全檢查：不應存在 base64Data
      const stringified = JSON.stringify(report);
      expect(stringified).not.toContain('base64Data');
      expect(stringified).not.toContain('data:image/');
    });
  });
});

// 輔助函式：建立符合型別的 Mock StickerImage
function createMockStickerImage(
  id: string,
  orderIndex: number,
  width: number,
  height: number,
  hasAlpha: boolean
): StickerImage {
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const blob = new Blob([pngHeader], { type: 'image/png' });
  return {
    id,
    projectId: 'proj-123',
    orderIndex,
    originalName: `${id}.png`,
    customName: `貼圖_${id}`,
    mimeType: 'image/png',
    fileSize: blob.size,
    width,
    height,
    hasAlphaChannel: hasAlpha,
    notes: '',
    blob,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
