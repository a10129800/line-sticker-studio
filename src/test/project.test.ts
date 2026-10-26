import { describe, it, expect } from 'vitest';
import { generateUUID } from '../db/repository';
import { formatBytes } from '../utils/imageAnalyzer';
import type { StickerCount } from '../types/project';

describe('LINE Sticker Studio - 核心邏輯單元測試', () => {
  describe('UUID 與唯一識別碼生成', () => {
    it('應產生格式正確且不重複的 UUID', () => {
      const id1 = generateUUID();
      const id2 = generateUUID();
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(10);
    });
  });

  describe('檔案大小格式化 (formatBytes)', () => {
    it('應正確格式化 0 Bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('應正確格式化 KB 與 MB', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(500 * 1024)).toBe('500 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
    });
  });

  describe('LINE 官方規格驗證邏輯測試', () => {
    const validCounts: StickerCount[] = [8, 16, 24, 32, 40];

    it('應精確符合官方支援張數 (8, 16, 24, 32, 40)', () => {
      expect(validCounts).toContain(8);
      expect(validCounts).toContain(16);
      expect(validCounts).toContain(24);
      expect(validCounts).toContain(32);
      expect(validCounts).toContain(40);
      expect(validCounts.includes(10 as any)).toBe(false);
      expect(validCounts.includes(20 as any)).toBe(false);
    });

    it('貼圖圖片尺寸規格：寬度與高度應為偶數且最大 370x320', () => {
      const isEvenDimension = (w: number, h: number) => w % 2 === 0 && h % 2 === 0;
      const isValidSize = (w: number, h: number) => w <= 370 && h <= 320;

      // 合格貼圖
      expect(isEvenDimension(370, 320)).toBe(true);
      expect(isValidSize(370, 320)).toBe(true);

      expect(isEvenDimension(350, 300)).toBe(true);
      expect(isValidSize(350, 300)).toBe(true);

      // 奇數不合規
      expect(isEvenDimension(369, 320)).toBe(false);
      expect(isEvenDimension(370, 321)).toBe(false);

      // 超過尺寸不合規
      expect(isValidSize(372, 320)).toBe(false);
      expect(isValidSize(370, 322)).toBe(false);
    });

    it('主圖尺寸必須為 240 x 240 px', () => {
      const isMainImageValid = (w: number, h: number) => w === 240 && h === 240;
      expect(isMainImageValid(240, 240)).toBe(true);
      expect(isMainImageValid(240, 241)).toBe(false);
      expect(isMainImageValid(370, 320)).toBe(false);
    });

    it('聊天室標籤圖尺寸必須為 96 x 74 px', () => {
      const isTabImageValid = (w: number, h: number) => w === 96 && h === 74;
      expect(isTabImageValid(96, 74)).toBe(true);
      expect(isTabImageValid(100, 100)).toBe(false);
    });

    it('單張圖片容量上限為 1MB (1,048,576 Bytes)', () => {
      const MAX_STICKER_SIZE = 1024 * 1024;
      expect(500 * 1024 <= MAX_STICKER_SIZE).toBe(true);
      expect(1024 * 1024 <= MAX_STICKER_SIZE).toBe(true);
      expect(1024 * 1024 + 1 <= MAX_STICKER_SIZE).toBe(false);
    });
  });

  describe('貼圖排序陣列重編索引邏輯', () => {
    it('重新排序後各元素應獲得連續且 0-based 的 orderIndex', () => {
      const sampleItems = [
        { id: 'item-b', orderIndex: 1 },
        { id: 'item-a', orderIndex: 0 },
        { id: 'item-c', orderIndex: 2 },
      ];

      // 假設使用者調換順序為 a, c, b，依 ID 查表並重編 orderIndex
      const userReorderedIds = ['item-a', 'item-c', 'item-b'];
      const updated = userReorderedIds.map((id, index) => {
        const originalItem = sampleItems.find((item) => item.id === id);
        return {
          id,
          originalOrder: originalItem?.orderIndex,
          orderIndex: index,
        };
      });

      expect(updated[0]).toEqual({ id: 'item-a', originalOrder: 0, orderIndex: 0 });
      expect(updated[1]).toEqual({ id: 'item-c', originalOrder: 2, orderIndex: 1 });
      expect(updated[2]).toEqual({ id: 'item-b', originalOrder: 1, orderIndex: 2 });
    });
  });
});
