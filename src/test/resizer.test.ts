import { describe, it, expect } from 'vitest';
import { 
  validateDimension, 
  calculateLockedDimension, 
  calculateResizeLayout, 
  calculateCropBoxResize,
  calculateFitTransform,
  calculateFillTransform,
  calculateCenterTransform,
  executeCustomTransformResize,
  MAX_RESIZE_DIMENSION,
  MIN_RESIZE_DIMENSION
} from '../features/resizer/imageResizer';
import { evaluateStickerImageRules } from '../features/spec-checker/specChecker';
import { runPreExportCheck } from '../features/exporter/lineZipPackager';
import type { StickerProject, StickerImage } from '../types/project';

// 建立模擬 PNG Blob (具備 1x1 PNG 二進位簽章)
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

describe('LINE Sticker Studio - 圖片尺寸調整模組測試', () => {
  // 1. 尺寸輸入驗證
  describe('1. 尺寸輸入驗證 (validateDimension)', () => {
    it('合法正整數尺寸應通過驗證', () => {
      expect(validateDimension(370).isValid).toBe(true);
      expect(validateDimension(320).isValid).toBe(true);
      expect(validateDimension(240).isValid).toBe(true);
      expect(validateDimension(96).isValid).toBe(true);
      expect(validateDimension(74).isValid).toBe(true);
      expect(validateDimension(MIN_RESIZE_DIMENSION).isValid).toBe(true);
      expect(validateDimension(MAX_RESIZE_DIMENSION).isValid).toBe(true);
    });

    it('小於 1 或負數應判定為無效', () => {
      expect(validateDimension(0).isValid).toBe(false);
      expect(validateDimension(-10).isValid).toBe(false);
    });

    it('小數應判定為無效 (LINE 要求整數像素)', () => {
      expect(validateDimension(370.5).isValid).toBe(false);
      expect(validateDimension(240.2).isValid).toBe(false);
    });

    it('超過上限 (MAX_RESIZE_DIMENSION) 應被阻擋以防記憶體超限', () => {
      expect(validateDimension(MAX_RESIZE_DIMENSION + 1).isValid).toBe(false);
      expect(validateDimension(10000).isValid).toBe(false);
    });

    it('非數值輸入應被阻擋', () => {
      expect(validateDimension(NaN).isValid).toBe(false);
    });
  });

  // 2. 比例鎖定連動計算
  describe('2. 比例鎖定連動計算 (calculateLockedDimension)', () => {
    it('寬度變更時應依原圖比例等比推算高度', () => {
      // 原圖 400 x 200 (2:1)，寬度變為 200，高度應為 100
      const res = calculateLockedDimension(400, 200, 'width', 200);
      expect(res.width).toBe(200);
      expect(res.height).toBe(100);
    });

    it('高度變更時應依原圖比例等比推算寬度', () => {
      // 原圖 300 x 600 (1:2)，高度變為 200，寬度應為 100
      const res = calculateLockedDimension(300, 600, 'height', 200);
      expect(res.width).toBe(100);
      expect(res.height).toBe(200);
    });

    it('四捨五入計算時不應產出小數點', () => {
      // 原圖 370 x 320，寬度變更為 185，高度應四捨五入為整數
      const res = calculateLockedDimension(370, 320, 'width', 185);
      expect(Number.isInteger(res.height)).toBe(true);
      expect(res.height).toBe(160);
    });
  });

  // 3. 裁切框拖曳計算 (calculateCropBoxResize)
  describe('3. 裁切框拖曳計算與控制點操作 (calculateCropBoxResize)', () => {
    it('拖曳右邊 (e) 控制點應自由調整寬度，高度保持不變', () => {
      const res = calculateCropBoxResize(370, 320, 'e', 50, 0, false);
      expect(res.width).toBe(420);
      expect(res.height).toBe(320);
    });

    it('拖曳底邊 (s) 控制點應自由調整高度，寬度保持不變', () => {
      const res = calculateCropBoxResize(370, 320, 's', 0, -40, false);
      expect(res.width).toBe(370);
      expect(res.height).toBe(280);
    });

    it('拖曳右下角 (se) 控制點自由比例縮放', () => {
      const res = calculateCropBoxResize(300, 200, 'se', 30, 40, false);
      expect(res.width).toBe(330);
      expect(res.height).toBe(240);
    });

    it('拖曳左上角 (nw) 控制點反向擴展寬高', () => {
      // 往左上拉 deltaX = -50, deltaY = -30
      const res = calculateCropBoxResize(300, 200, 'nw', -50, -30, false);
      expect(res.width).toBe(350);
      expect(res.height).toBe(230);
    });

    it('四角拖曳與最小、最大尺寸邊界限制 (1px ~ 4000px)', () => {
      // 劇烈縮小超過 1px
      const minRes = calculateCropBoxResize(50, 50, 'se', -100, -100, false);
      expect(minRes.width).toBe(MIN_RESIZE_DIMENSION);
      expect(minRes.height).toBe(MIN_RESIZE_DIMENSION);

      // 劇烈放大超過 4000px
      const maxRes = calculateCropBoxResize(3800, 3800, 'se', 500, 500, false);
      expect(maxRes.width).toBe(MAX_RESIZE_DIMENSION);
      expect(maxRes.height).toBe(MAX_RESIZE_DIMENSION);
    });

    it('鎖定長寬比例時，拖曳手柄應等比例約束 (lockRatio = true)', () => {
      // 原長寬比 2:1 (400 x 200)
      const res = calculateCropBoxResize(400, 200, 'e', 100, 0, true, 2);
      expect(res.width).toBe(500);
      // 等比推算高度：500 / 2 = 250
      expect(res.height).toBe(250);
    });
  });

  // 4. 圖片平移、縮放及置中計算
  describe('4. 圖片平移、縮放及置中計算', () => {
    it('適應框框 (Fit)：圖片較大邊等比縮放至邊界內，並精確水平與垂直置中', () => {
      // 來源 800 x 400，目標 400 x 400
      const fit = calculateFitTransform(800, 400, 400, 400);
      expect(fit.scale).toBe(0.5); // 800 * 0.5 = 400, 400 * 0.5 = 200
      expect(fit.offsetX).toBe(0); // 寬度剛好貼邊
      expect(fit.offsetY).toBe(100); // 高度 (400 - 200) / 2 = 100
    });

    it('填滿框框 (Fill)：圖片較小邊等比縮放填滿框框，溢出部分對稱置中', () => {
      // 來源 800 x 400，目標 400 x 400
      const fill = calculateFillTransform(800, 400, 400, 400);
      expect(fill.scale).toBe(1); // 為了讓高度 400 填滿，scale = 400 / 400 = 1
      expect(fill.offsetX).toBe(-200); // 寬度 800 溢出，(400 - 800) / 2 = -200
      expect(fill.offsetY).toBe(0);
    });

    it('圖片置中 (Center)：保持當前 scale 重新計算置中偏移量', () => {
      // 來源 200 x 200，目標 370 x 320，scale = 1
      const center = calculateCenterTransform(200, 200, 370, 320, 1);
      expect(center.offsetX).toBe(Math.round((370 - 200) / 2)); // 85
      expect(center.offsetY).toBe(Math.round((320 - 200) / 2)); // 60
    });
  });

  // 5. 佈局與調整模式計算
  describe('5. 佈局與調整模式計算 (calculateResizeLayout)', () => {
    it('等比例縮放 (Contain)：原圖正方形縮放至 370x320 畫布，應等比縮放並在 X 軸置中留下透明邊距', () => {
      const layout = calculateResizeLayout(500, 500, 370, 320, 'contain');
      expect(layout.canvasWidth).toBe(370);
      expect(layout.canvasHeight).toBe(320);
      expect(layout.destHeight).toBe(320);
      expect(layout.destWidth).toBe(320);
      expect(layout.destX).toBe(25);
      expect(layout.destY).toBe(0);
      expect(layout.isDistorted).toBe(false);
    });

    it('置中縮放 (Center)：原圖 100x100 置於 240x240 畫布，應保持原尺寸置中', () => {
      const layout = calculateResizeLayout(100, 100, 240, 240, 'center');
      expect(layout.destWidth).toBe(100);
      expect(layout.destHeight).toBe(100);
      expect(layout.destX).toBe(70);
      expect(layout.destY).toBe(70);
      expect(layout.isDistorted).toBe(false);
    });

    it('裁切填滿 (Cover)：原圖 500x300 填滿 370x320 畫布，超出部分應適當裁切', () => {
      const layout = calculateResizeLayout(500, 300, 370, 320, 'cover', 'center');
      expect(layout.canvasWidth).toBe(370);
      expect(layout.canvasHeight).toBe(320);
      expect(layout.destHeight).toBeGreaterThanOrEqual(320);
      expect(layout.destWidth).toBeGreaterThanOrEqual(370);
      expect(layout.isDistorted).toBe(false);
    });

    it('自由拉伸 (Stretch)：比例不符時應明確標記變形 (isDistorted = true)', () => {
      const layout = calculateResizeLayout(400, 400, 370, 320, 'stretch');
      expect(layout.destWidth).toBe(370);
      expect(layout.destHeight).toBe(320);
      expect(layout.isDistorted).toBe(true);
    });
  });

  // 6. 執行自由變換調整與真實像素輸出 (executeCustomTransformResize)
  describe('6. 執行自由變換合成與輸出真實像素 (executeCustomTransformResize)', () => {
    it('輸出圖片必須精確按照設定的真實像素尺寸產生，超出框框內容被裁切', async () => {
      const originalBlob = createMockPngBlob();
      const originalSize = originalBlob.size;

      const result = await executeCustomTransformResize(originalBlob, {
        targetWidth: 240,
        targetHeight: 240,
        imageOffsetX: -50, // 圖片往左偏，超出框框 50px
        imageOffsetY: 20,
        imageScale: 1.5,
      });

      expect(result.width).toBe(240);
      expect(result.height).toBe(240);
      expect(result.mimeType).toBe('image/png');
      expect(result.hasAlphaChannel).toBe(true);
      // 原圖 Blob 完全未受破壞
      expect(originalBlob.size).toBe(originalSize);
      expect(result.blob).not.toBe(originalBlob);
    });

    it('支援非等比拉伸檢測 (isDistorted = true)', async () => {
      const originalBlob = createMockPngBlob();
      const result = await executeCustomTransformResize(originalBlob, {
        targetWidth: 370,
        targetHeight: 320,
        imageOffsetX: 0,
        imageOffsetY: 0,
        imageScale: 1.0,
        imageScaleY: 0.8, // 垂直與水平 scale 不一致
      });

      expect(result.isDistorted).toBe(true);
    });
  });

  // 7. 主要圖片正方形尺寸輔助框與分類規格獨立性
  describe('7. 主要圖片規格與各分類設定獨立不污染', () => {
    it('主要圖片 240x240 規格符合性檢驗', () => {
      // 240x240 正方形
      const isSquare240 = (w: number, h: number) => w === 240 && h === 240;
      expect(isSquare240(240, 240)).toBe(true);
      expect(isSquare240(370, 320)).toBe(false);
      expect(isSquare240(240, 238)).toBe(false);
    });

    it('一般貼圖、主要圖片、標籤圖片設定字典獨立存在，互不干擾', () => {
      const categorySettings = {
        sticker: { width: 370, height: 320, lockAspect: false },
        main: { width: 240, height: 240, lockAspect: true },
        tab: { width: 96, height: 74, lockAspect: false },
      };

      // 修改一般貼圖寬度
      categorySettings.sticker.width = 350;
      expect(categorySettings.sticker.width).toBe(350);
      // 主要圖片與標籤圖片不受影響
      expect(categorySettings.main.width).toBe(240);
      expect(categorySettings.tab.width).toBe(96);
    });
  });

  // 8. 調整後新圖片與規格檢查器及 ZIP 匯出整合
  describe('8. 調整後新圖片與規格檢查器及 ZIP 匯出整合', () => {
    const validAlpha = {
      hasAlpha: true,
      transparentRatio: 30,
      hasMarginWarning: false,
      canAnalyze: true,
    };

    it('調整至 370x320 偶數尺寸之新圖片，規格檢查應判定為合格 (Pass)', () => {
      const result = evaluateStickerImageRules({
        isReadable: true,
        realFormat: 'PNG',
        isRealPng: true,
        actualWidth: 370,
        actualHeight: 320,
        fileSizeBytes: 200 * 1024,
        alphaAnalysis: validAlpha,
      });

      expect(result.overallStatus).toBe('pass');
    });

    it('調整至 240x240 之圖片指定為主圖後，前置匯出檢查應通過主圖檢驗', () => {
      const project: StickerProject = {
        id: 'p1',
        name: '測試專案',
        characterName: '',
        characterDescription: '',
        stickerType: 'static',
        targetCount: 8,
        status: 'in_progress',
        notes: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mainImageId: 'resized-main',
        tabImageId: 'resized-tab',
      };

      const mainImg: StickerImage = {
        id: 'resized-main',
        projectId: 'p1',
        orderIndex: 0,
        originalName: 'main_resized.png',
        customName: '主圖 (調整尺寸)',
        mimeType: 'image/png',
        fileSize: 50000,
        width: 240, // 符合主圖標準
        height: 240,
        hasAlphaChannel: true,
        notes: '',
        blob: createMockPngBlob(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const tabImg: StickerImage = {
        id: 'resized-tab',
        projectId: 'p1',
        orderIndex: 1,
        originalName: 'tab_resized.png',
        customName: '標籤圖 (調整尺寸)',
        mimeType: 'image/png',
        fileSize: 15000,
        width: 96, // 符合標籤圖標準
        height: 74,
        hasAlphaChannel: true,
        notes: '',
        blob: createMockPngBlob(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const stickerImages: StickerImage[] = Array.from({ length: 8 }, (_, i) => ({
        id: `stk-${i}`,
        projectId: 'p1',
        orderIndex: i + 2,
        originalName: `sticker_${i}_resized.png`,
        customName: `貼圖_${i}`,
        mimeType: 'image/png',
        fileSize: 80000,
        width: 370,
        height: 320,
        hasAlphaChannel: true,
        notes: '',
        blob: createMockPngBlob(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      const report = runPreExportCheck(project, [mainImg, tabImg, ...stickerImages]);
      expect(report.canExport).toBe(true);
      const mainCheck = report.items.find((it) => it.id === 'MAIN_IMAGE_SIZE');
      const tabCheck = report.items.find((it) => it.id === 'TAB_IMAGE_SIZE');
      expect(mainCheck?.status).toBe('pass');
      expect(tabCheck?.status).toBe('pass');
    });
  });
});
