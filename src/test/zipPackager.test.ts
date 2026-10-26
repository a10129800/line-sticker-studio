import { describe, it, expect } from 'vitest';
import { runPreExportCheck, packageLineStickersZip } from '../features/exporter/lineZipPackager';
import { buildZipArchive, verifyZipArchive } from '../features/exporter/zipEngine';
import { ensurePngFormat, isPngBuffer } from '../features/exporter/pngConverter';
import type { StickerProject, StickerImage } from '../types/project';

// 建立模擬的 1x1 PNG Uint8Array (具備完整 PNG Signature: 89 50 4E 47 0D 0A 1A 0A)
const MOCK_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
  0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
  0x42, 0x60, 0x82
]);

function createMockPngBlob(): Blob {
  return new Blob([MOCK_PNG_BYTES], { type: 'image/png' });
}

function createMockImage(overrides: Partial<StickerImage> = {}): StickerImage {
  return {
    id: 'img-' + Math.random().toString(36).substring(2, 9),
    projectId: 'test-proj',
    originalName: 'sticker.png',
    customName: '貼圖',
    blob: createMockPngBlob(),
    width: 370,
    height: 320,
    fileSize: 45000,
    mimeType: 'image/png',
    hasAlphaChannel: true,
    notes: '',
    orderIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('LINE 上架素材 ZIP 打包與驗證測試', () => {
  describe('1. PNG 簽章判定與安全保真', () => {
    it('應正確識別標準 PNG 檔案魔術數字簽章', () => {
      expect(isPngBuffer(MOCK_PNG_BYTES)).toBe(true);
      const fakeBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]); // JPEG
      expect(isPngBuffer(fakeBytes)).toBe(false);
    });

    it('對於本體已經是真 PNG 的 Blob，ensurePngFormat 應保真保留不重壓', async () => {
      const originalBlob = createMockPngBlob();
      const result = await ensurePngFormat(originalBlob);
      expect(result.converted).toBe(false);
      expect(result.blob).toBe(originalBlob); // 原始物件直接引用
    });
  });

  describe('2. 匯出前 10 項官方條件審查 (runPreExportCheck)', () => {
    const baseProject: StickerProject = {
      id: 'proj-1',
      name: '測試貼圖專案',
      characterName: '小熊',
      characterDescription: '可愛的小熊貼圖',
      stickerType: 'static',
      targetCount: 8,
      status: 'completed',
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mainImageId: 'main-img-id',
      tabImageId: 'tab-img-id',
    };

    it('缺少主圖 (mainImageId) 時應嚴格阻擋匯出', () => {
      const projWithoutMain: StickerProject = { ...baseProject, mainImageId: undefined };
      const images: StickerImage[] = Array.from({ length: 8 }, (_, i) =>
        createMockImage({ id: `img-${i}`, orderIndex: i })
      );

      const check = runPreExportCheck(projWithoutMain, images);
      expect(check.canExport).toBe(false);
      const mainErr = check.items.find((it) => it.id === 'MAIN_IMAGE_EXISTS');
      expect(mainErr?.status).toBe('error');
    });

    it('缺少聊天室標籤圖 (tabImageId) 時應嚴格阻擋匯出', () => {
      const projWithoutTab: StickerProject = { ...baseProject, tabImageId: undefined };
      const images: StickerImage[] = Array.from({ length: 8 }, (_, i) =>
        createMockImage({ id: `img-${i}`, orderIndex: i })
      );

      const check = runPreExportCheck(projWithoutTab, images);
      expect(check.canExport).toBe(false);
      const tabErr = check.items.find((it) => it.id === 'TAB_IMAGE_EXISTS');
      expect(tabErr?.status).toBe('error');
    });

    it('主圖尺寸非 240x240 時應判定為 Error 並阻擋匯出', () => {
      const mainImage = createMockImage({
        id: 'main-img-id',
        width: 200, // 錯誤尺寸
        height: 200,
      });
      const tabImage = createMockImage({
        id: 'tab-img-id',
        width: 96,
        height: 74,
      });
      const stickers = Array.from({ length: 8 }, (_, i) =>
        createMockImage({ id: `img-${i}`, orderIndex: i })
      );

      const check = runPreExportCheck(baseProject, [mainImage, tabImage, ...stickers]);
      expect(check.canExport).toBe(false);
      const sizeErr = check.items.find((it) => it.id === 'MAIN_IMAGE_SIZE');
      expect(sizeErr?.status).toBe('error');
    });

    it('標籤圖尺寸非 96x74 時應判定為 Error 並阻擋匯出', () => {
      const mainImage = createMockImage({
        id: 'main-img-id',
        width: 240,
        height: 240,
      });
      const tabImage = createMockImage({
        id: 'tab-img-id',
        width: 100, // 錯誤尺寸
        height: 80,
      });
      const stickers = Array.from({ length: 8 }, (_, i) =>
        createMockImage({ id: `img-${i}`, orderIndex: i })
      );

      const check = runPreExportCheck(baseProject, [mainImage, tabImage, ...stickers]);
      expect(check.canExport).toBe(false);
      const tabErr = check.items.find((it) => it.id === 'TAB_IMAGE_SIZE');
      expect(tabErr?.status).toBe('error');
    });

    it('貼圖張數不符合官方規格 (如只有 3 張) 時應判定為 Error 並阻擋', () => {
      const mainImage = createMockImage({ id: 'main-img-id', width: 240, height: 240 });
      const tabImage = createMockImage({ id: 'tab-img-id', width: 96, height: 74 });
      const stickers = [
        createMockImage({ id: 'img-1', orderIndex: 0 }),
        createMockImage({ id: 'img-2', orderIndex: 1 }),
        createMockImage({ id: 'img-3', orderIndex: 2 }),
      ];

      const check = runPreExportCheck(baseProject, [mainImage, tabImage, ...stickers]);
      expect(check.canExport).toBe(false);
      const countErr = check.items.find((it) => it.id === 'STICKER_COUNT');
      expect(countErr?.status).toBe('error');
    });

    it('貼圖寬度或高度為奇數時應阻擋匯出', () => {
      const mainImage = createMockImage({ id: 'main-img-id', width: 240, height: 240 });
      const tabImage = createMockImage({ id: 'tab-img-id', width: 96, height: 74 });
      const stickers = Array.from({ length: 8 }, (_, i) =>
        createMockImage({
          id: `img-${i}`,
          orderIndex: i,
          width: i === 0 ? 369 : 370, // 第一張為奇數寬度
          height: 320,
        })
      );

      const check = runPreExportCheck(baseProject, [mainImage, tabImage, ...stickers]);
      expect(check.canExport).toBe(false);
      const evenErr = check.items.find((it) => it.id === 'STICKERS_EVEN_DIMENSIONS');
      expect(evenErr?.status).toBe('error');
    });

    it('所有條件完全符合時，前置檢查應通過 (canExport = true)', () => {
      const mainImage = createMockImage({ id: 'main-img-id', width: 240, height: 240 });
      const tabImage = createMockImage({ id: 'tab-img-id', width: 96, height: 74 });
      const stickers = Array.from({ length: 8 }, (_, i) =>
        createMockImage({ id: `img-${i}`, orderIndex: i, width: 370, height: 320 })
      );

      const check = runPreExportCheck(baseProject, [mainImage, tabImage, ...stickers]);
      expect(check.canExport).toBe(true);
      expect(check.items.filter((it) => it.status === 'error')).toHaveLength(0);
    });
  });

  describe('3. ZIP 封裝與反解驗證 (JSZip Engine)', () => {
    it('應成功封裝包含 main.png, tab.png, 01.png~08.png 的純淨 ZIP 檔案', async () => {
      const entries = [
        { filename: 'main.png', blob: createMockPngBlob() },
        { filename: 'tab.png', blob: createMockPngBlob() },
        ...Array.from({ length: 8 }, (_, i) => ({
          filename: `${String(i + 1).padStart(2, '0')}.png`,
          blob: createMockPngBlob(),
        })),
      ];

      const zipBlob = await buildZipArchive(entries);
      expect(zipBlob).toBeDefined();
      expect(zipBlob.size).toBeGreaterThan(0);

      // 使用 verifyZipArchive 重新讀取解壓縮驗證
      const verifyResult = await verifyZipArchive(zipBlob, 8);
      expect(verifyResult.isValid).toBe(true);
      expect(verifyResult.totalFiles).toBe(10); // 1 main + 1 tab + 8 stickers
      expect(verifyResult.missingRequiredFiles).toHaveLength(0);
      expect(verifyResult.unexpectedFiles).toHaveLength(0);
    });

    it('當 ZIP 內混入多餘未預期檔案時，反解驗證應明確識別', async () => {
      const entries = [
        { filename: 'main.png', blob: createMockPngBlob() },
        { filename: 'tab.png', blob: createMockPngBlob() },
        { filename: 'README.txt', blob: new Blob(['not allowed']) }, // 非官方檔案
        ...Array.from({ length: 8 }, (_, i) => ({
          filename: `${String(i + 1).padStart(2, '0')}.png`,
          blob: createMockPngBlob(),
        })),
      ];

      const zipBlob = await buildZipArchive(entries);
      const verifyResult = await verifyZipArchive(zipBlob, 8);
      expect(verifyResult.isValid).toBe(false);
      expect(verifyResult.unexpectedFiles).toContain('README.txt');
    });
  });

  describe('4. LINE 完整素材打包流程 (packageLineStickersZip)', () => {
    const validProject: StickerProject = {
      id: 'proj-valid',
      name: '小貓表情包',
      characterName: '小貓',
      characterDescription: '日常聊天貼圖',
      stickerType: 'static',
      targetCount: 8,
      status: 'completed',
      notes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mainImageId: 'main-valid',
      tabImageId: 'tab-valid',
    };

    it('條件齊全時應成功產生打包結果與驗證資訊', async () => {
      const mainImage = createMockImage({ id: 'main-valid', width: 240, height: 240 });
      const tabImage = createMockImage({ id: 'tab-valid', width: 96, height: 74 });
      const stickers = Array.from({ length: 8 }, (_, i) =>
        createMockImage({ id: `stk-${i}`, orderIndex: i, width: 370, height: 320 })
      );

      const allImages = [mainImage, tabImage, ...stickers];
      const result = await packageLineStickersZip(validProject, allImages);

      expect(result.success).toBe(true);
      expect(result.zipBlob).toBeDefined();
      expect(result.verification?.isValid).toBe(true);
      expect(result.verification?.totalFiles).toBe(10);
      expect(result.fileCount).toBe(10);
    });

    it('缺少主圖時，packageLineStickersZip 應嚴格阻擋匯出並回報錯誤', async () => {
      const projWithoutMain = { ...validProject, mainImageId: undefined };
      const stickers = Array.from({ length: 8 }, (_, i) =>
        createMockImage({ id: `stk-${i}`, orderIndex: i })
      );

      const result = await packageLineStickersZip(projWithoutMain, stickers);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.zipBlob).toBeUndefined();
    });
  });
});
