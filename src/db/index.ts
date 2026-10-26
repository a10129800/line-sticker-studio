import Dexie, { type EntityTable } from 'dexie';
import type { StickerProject, StickerImage, ProductMetadata } from '../types/project';

// 定義 Dexie 資料庫類別
export class StickerDatabase extends Dexie {
  projects!: EntityTable<StickerProject, 'id'>;
  images!: EntityTable<StickerImage, 'id'>;
  metadata!: EntityTable<ProductMetadata, 'id'>;

  constructor() {
    super('LINEStickerStudioDB');
    
    // 版本 1：定義主鍵與查詢索引
    this.version(1).stores({
      projects: 'id, status, stickerType, updatedAt, createdAt',
      images: 'id, projectId, orderIndex, [projectId+orderIndex], createdAt',
      metadata: 'id, projectId'
    });
  }
}

// 單例資料庫實例
export const db = new StickerDatabase();
