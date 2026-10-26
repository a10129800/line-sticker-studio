/**
 * LINE Sticker Studio - 官方規格規則集中管理模組
 * 參考來源：LINE Creators Market 官方製作準則 (https://creator.line.me/zh-hant/guideline/sticker/)
 * 查閱日期：2026-10-26
 */

import type { StickerCount } from '../../types/project';

// 官方支援的合法貼圖張數
export const OFFICIAL_VALID_STICKER_COUNTS: readonly StickerCount[] = [8, 16, 24, 32, 40] as const;

// 官方單張圖片上限：1MB (1,048,576 Bytes)
export const MAX_IMAGE_FILE_SIZE_BYTES = 1024 * 1024;

// 官方 ZIP 打包上限：60MB (62,914,560 Bytes)
export const MAX_ZIP_PACKAGE_SIZE_BYTES = 60 * 1024 * 1024;

// 靜態貼圖圖片規格
export const STICKER_IMAGE_SPEC = {
  maxWidth: 370,
  maxHeight: 320,
  minWidth: 10,
  minHeight: 10,
  format: 'image/png',
  formatLabel: 'PNG',
  requireEvenDimensions: true,
  requireTransparency: true,
  recommendedMarginPx: 10,
} as const;

// 主要圖片 (Main Image) 規格
export const MAIN_IMAGE_SPEC = {
  width: 240,
  height: 240,
  format: 'image/png',
  formatLabel: 'PNG',
  requireTransparency: true,
} as const;

// 聊天室標籤圖片 (Tab Image) 規格
export const TAB_IMAGE_SPEC = {
  width: 96,
  height: 74,
  format: 'image/png',
  formatLabel: 'PNG',
  requireTransparency: true,
} as const;

// 規則嚴重程度
export type RuleSeverity = 'mandatory' | 'recommended' | 'quality_check';

// 檢查結果層級
export type CheckStatus = 'pass' | 'warning' | 'error' | 'uncertain';

// 適用目標類型
export type TargetImageType = 'sticker' | 'main' | 'tab' | 'project';

// 單項規格規則定義介面
export interface SpecRuleDefinition {
  id: string;
  name: string;
  targetType: TargetImageType;
  severity: RuleSeverity;
  officialRef: string;
  description: string;
  defaultSuggestion?: string;
}

// 規格清單字典
export const SPEC_RULES: Record<string, SpecRuleDefinition> = {
  // 專案層級規則
  'PROJECT_STICKER_COUNT_MATCH': {
    id: 'PROJECT_STICKER_COUNT_MATCH',
    name: '貼圖張數符合官方合法設定',
    targetType: 'project',
    severity: 'mandatory',
    officialRef: 'LINE 製作準則：貼圖圖片數量需為 8、16、24、32 或 40 張',
    description: '專案目前圖片張數必須與所設定的目標張數相符，且為官方支援選項。',
    defaultSuggestion: '請補足或刪減圖片張數至目標設定張數。',
  },
  'PROJECT_TOTAL_PACKAGE_SIZE': {
    id: 'PROJECT_TOTAL_PACKAGE_SIZE',
    name: '總圖片包大小預估',
    targetType: 'project',
    severity: 'mandatory',
    officialRef: 'LINE 製作準則：ZIP 壓縮檔須小於 60MB',
    description: '專案所有圖片總容量不得超過 60MB 上限。',
    defaultSuggestion: '請適度最佳化高容量貼圖檔案。',
  },

  // 單張貼圖圖片規則
  'IMAGE_READABLE': {
    id: 'IMAGE_READABLE',
    name: '圖片可正常讀取與解碼',
    targetType: 'sticker',
    severity: 'mandatory',
    officialRef: '檔案完整性',
    description: '圖片二進位資料必須完整且可被瀏覽器解碼渲染。',
    defaultSuggestion: '圖片資料可能損壞，請嘗試重新匯入。',
  },
  'IMAGE_FORMAT_PNG': {
    id: 'IMAGE_FORMAT_PNG',
    name: '真實 PNG 格式檢查',
    targetType: 'sticker',
    severity: 'mandatory',
    officialRef: 'LINE 製作準則：圖檔均為 PNG',
    description: '必須為真正的 PNG 二進位圖檔（簽章檢驗），不可僅更改副檔名。',
    defaultSuggestion: '請使用製圖工具將圖片重新輸出為標準 PNG 格式。',
  },
  'IMAGE_SIZE_LIMIT': {
    id: 'IMAGE_SIZE_LIMIT',
    name: '單張檔案容量上限 (1MB)',
    targetType: 'sticker',
    severity: 'mandatory',
    officialRef: 'LINE 製作準則：單個貼圖圖片需在 1MB 以下',
    description: '單張貼圖檔案大小不得超過 1,048,576 Bytes (1MB)。',
    defaultSuggestion: '請使用無損 PNG 壓縮工具或減少多餘色階以降低檔案容量。',
  },
  'IMAGE_DIMENSIONS_MAX': {
    id: 'IMAGE_DIMENSIONS_MAX',
    name: '最大尺寸限制 (370 × 320 px)',
    targetType: 'sticker',
    severity: 'mandatory',
    officialRef: 'LINE 製作準則：寬 370px × 高 320px (上限)',
    description: '貼圖圖片的寬度不可超過 370px，高度不可超過 320px。',
    defaultSuggestion: '請等比例縮小貼圖畫布尺寸至 370 × 320 px 以內。',
  },
  'IMAGE_DIMENSIONS_EVEN': {
    id: 'IMAGE_DIMENSIONS_EVEN',
    name: '寬度與高度皆為偶數',
    targetType: 'sticker',
    severity: 'mandatory',
    officialRef: 'LINE 製作準則：貼圖圖片大小將會自動縮小，故請將尺寸設為偶數',
    description: '寬度與高度像素值均需為偶數，以避免在手機端自動縮放時產生毛邊。',
    defaultSuggestion: '請調整畫布寬高各增減 1 像素使其皆為偶數 (Even Numbers)。',
  },
  'IMAGE_TRANSPARENT_BACKGROUND': {
    id: 'IMAGE_TRANSPARENT_BACKGROUND',
    name: '去背透明背景 (Alpha 通道)',
    targetType: 'sticker',
    severity: 'mandatory',
    officialRef: 'LINE 製作準則：請為圖片進行去背透明處理',
    description: '圖片中必須包含透明像素（Alpha < 255），不得為純色不透明背景。',
    defaultSuggestion: '請使用去背工具或魔術棒清除背景底色並儲存為透明 PNG。',
  },
  'IMAGE_MARGIN_RECOMMENDED': {
    id: 'IMAGE_MARGIN_RECOMMENDED',
    name: '四周視覺留白 (約 10px)',
    targetType: 'sticker',
    severity: 'recommended',
    officialRef: 'LINE 製作準則：剪裁後的圖片與貼圖圖案之間必須有一定程度（10px左右）的留白',
    description: '貼圖主體圖案四周若緊貼邊界，在對話框可能被裁切或顯得擁擠。',
    defaultSuggestion: '建議於角色邊緣與畫布邊框之間保留約 10px 的透明空間。',
  },
  'IMAGE_COLOR_DPI_CHECK': {
    id: 'IMAGE_COLOR_DPI_CHECK',
    name: '色彩模式與解析度判定',
    targetType: 'sticker',
    severity: 'recommended',
    officialRef: 'LINE 製作準則：解析度設為 72dpi 以上，色彩模式為 RGB',
    description: '瀏覽器環境若無內嵌 EXIF/DPI metadata，將標記為無法判定，不影響強制通過。',
    defaultSuggestion: '匯出時請確認繪圖軟體使用 RGB/sRGB 色彩空間與 72+ DPI。',
  },
};
