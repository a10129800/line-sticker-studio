/**
 * LINE Sticker Studio - 核心資料型別定義
 */

// 貼圖類型（第一階段聚焦一般靜態貼圖，保留擴充性）
export type StickerType = 'static' | 'animated' | 'custom' | 'message' | 'big';

// 官方支援的貼圖數量
export type StickerCount = 8 | 16 | 24 | 32 | 40;

// 專案製作狀態
export type ProjectStatus = 'draft' | 'in_progress' | 'completed' | 'archived';

// 貼圖角色與專案主資料
export interface StickerProject {
  id: string; // 唯一 UUID，避免使用陣列索引
  name: string; // 專案名稱
  characterName: string; // 角色名稱
  characterDescription: string; // 角色描述
  coverImageId?: string; // 專案封面圖 ID
  mainImageId?: string; // LINE 上架主要圖片 (240x240 main.png)
  tabImageId?: string; // LINE 聊天室標籤圖片 (96x74 tab.png)
  stickerType: StickerType; // 貼圖類型
  targetCount: StickerCount; // 目標貼圖張數
  status: ProjectStatus; // 製作狀態
  createdAt: number; // 建立時間戳記 (ms)
  updatedAt: number; // 最後修改時間戳記 (ms)
  notes: string; // 備註
}

// 單張貼圖圖片資料
export interface StickerImage {
  id: string; // 唯一 UUID
  projectId: string; // 所屬專案 ID
  orderIndex: number; // 貼圖排序 (0-based)
  originalName: string; // 原始檔名
  customName: string; // 使用者自訂名稱
  mimeType: string; // image/png, image/jpeg, image/webp 等
  fileSize: number; // 檔案大小 (bytes)
  width: number; // 寬度 (px)
  height: number; // 高度 (px)
  hasAlphaChannel: boolean; // 是否具備透明通道
  notes: string; // 單張備註
  blob: Blob; // 原始圖片二進位資料（非破壞性儲存）
  thumbnailUrl?: string; // 暫存 Object URL 或 Data URL
  createdAt: number;
  updatedAt: number;
}

// 模組 D：LINE Creators Market 商品資訊
export interface ProductMetadata {
  id: string;
  projectId: string;
  title: string; // 商品名稱 (最大 40 字元)
  description: string; // 商品說明 (最大 160 字元)
  authorName: string; // 創作者名稱 (最大 50 字元)
  copyright: string; // 版權標記 (最大 50 字元)
  category: string; // 商品分類
  priceTier: string; // 價格區間備註
  publishStatus: 'unreleased' | 'submitted' | 'on_sale' | 'suspended';
  releaseDateNotes?: string; // 上架日期備註
  productUrl?: string; // 商品網址
  promoText?: string; // 宣傳文案
}

// 規格檢查層級
export type CheckLevel = 'pass' | 'warning' | 'error' | 'uncertain';

// 單項規格檢查項目
export interface ValidationItem {
  id: string;
  category: 'dimensions' | 'format' | 'filesize' | 'count' | 'alpha' | 'margin';
  name: string;
  level: CheckLevel;
  message: string;
  suggestion?: string;
}

// 專案規格檢查結果
export interface ValidationResult {
  projectId: string;
  checkedAt: number;
  overallLevel: CheckLevel;
  items: ValidationItem[];
}

// 匯出工作紀錄
export interface ExportJob {
  id: string;
  projectId: string;
  type: 'line_submission_zip' | 'full_backup_zip';
  status: 'pending' | 'success' | 'failed';
  totalFiles: number;
  totalSize: number;
  createdAt: number;
  errorMessage?: string;
}

// 專案備份封包（供匯出/匯入驗證）
export interface ProjectBackup {
  version: '1.0';
  exportedAt: number;
  project: Omit<StickerProject, 'coverImageId'>;
  metadata?: ProductMetadata;
  images: Array<{
    id: string;
    orderIndex: number;
    originalName: string;
    customName: string;
    mimeType: string;
    fileSize: number;
    width: number;
    height: number;
    hasAlphaChannel: boolean;
    notes: string;
    base64Data: string; // 匯出備份 JSON 時轉為 Base64
  }>;
}
