import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  X, 
  Scaling, 
  Lock, 
  Unlock, 
  RotateCcw, 
  Info, 
  Save, 
  Maximize2,
  Minimize2,
  AlignCenter,
  ZoomIn,
  ZoomOut,
  Star,
  Bookmark,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import type { StickerImage } from '../../types/project';
import { 
  validateDimension, 
  calculateLockedDimension,
  calculateFitTransform,
  calculateFillTransform,
  calculateCenterTransform,
  executeCustomTransformResize,
  ResizeExecutionResult,
  MAX_RESIZE_DIMENSION
} from '../../features/resizer/imageResizer';
import { InteractiveCanvas } from './InteractiveCanvas';

export type StickerTargetCategory = 'sticker' | 'main' | 'tab';

interface ImageResizerModalProps {
  isOpen: boolean;
  image: StickerImage | null;
  isMainImage?: boolean;
  isTabImage?: boolean;
  onClose: () => void;
  onSaveAsNew: (result: ResizeExecutionResult, originalImage: StickerImage) => Promise<void>;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ImageResizerModal: React.FC<ImageResizerModalProps> = ({
  isOpen,
  image,
  isMainImage = false,
  isTabImage = false,
  onClose,
  onSaveAsNew,
  showToast,
}) => {
  if (!isOpen || !image) return null;

  // 圖片目標類型：一般貼圖、主要圖片、聊天室標籤圖（各自記憶尺寸，互不污染）
  const initialCategory: StickerTargetCategory = isMainImage ? 'main' : isTabImage ? 'tab' : 'sticker';
  const [targetCategory, setTargetCategory] = useState<StickerTargetCategory>(initialCategory);

  // 各類型的獨立尺寸快取（防止互相污染）
  const [categorySettings, setCategorySettings] = useState<Record<StickerTargetCategory, { width: number; height: number; lock: boolean }>>({
    sticker: { width: 370, height: 320, lock: false },
    main: { width: 240, height: 240, lock: true },
    tab: { width: 96, height: 74, lock: false },
  });

  // 當前畫布／裁切框尺寸狀態
  const [targetWidth, setTargetWidth] = useState<number>(370);
  const [targetHeight, setTargetHeight] = useState<number>(320);
  const [widthInput, setWidthInput] = useState<string>('370');
  const [heightInput, setHeightInput] = useState<string>('320');
  const [lockRatio, setLockRatio] = useState<boolean>(false);

  // 框框內圖片的變換參數 (獨立於框框)
  const [imageOffsetX, setImageOffsetX] = useState<number>(0);
  const [imageOffsetY, setImageOffsetY] = useState<number>(0);
  const [imageScale, setImageScale] = useState<number>(1.0);

  // 主要圖片輔助線顯示開關
  const [showMainGuide, setShowMainGuide] = useState<boolean>(isMainImage);

  // 狀態與錯誤管理
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [dimensionError, setDimensionError] = useState<string | null>(null);

  // 原圖 URL
  const [originalUrl, setOriginalUrl] = useState<string>('');

  // 初始化原圖與載入設定
  useEffect(() => {
    if (image) {
      const url = URL.createObjectURL(image.blob);
      setOriginalUrl(url);

      const cat: StickerTargetCategory = isMainImage ? 'main' : isTabImage ? 'tab' : 'sticker';
      setTargetCategory(cat);
      setShowMainGuide(cat === 'main');

      const initialDims = cat === 'main'
        ? { width: 240, height: 240, lock: true }
        : cat === 'tab'
        ? { width: 96, height: 74, lock: false }
        : { width: 370, height: 320, lock: false };

      setTargetWidth(initialDims.width);
      setTargetHeight(initialDims.height);
      setWidthInput(String(initialDims.width));
      setHeightInput(String(initialDims.height));
      setLockRatio(initialDims.lock);

      // 預設將圖片適應框框置中 (Fit)
      const fit = calculateFitTransform(image.width, image.height, initialDims.width, initialDims.height);
      setImageScale(fit.scale);
      setImageOffsetX(fit.offsetX);
      setImageOffsetY(fit.offsetY);

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [image, isMainImage, isTabImage]);

  // 切換目標類型 (一般貼圖 / 主要圖片 / 聊天室標籤圖)，使用獨立尺寸，不互相污染
  const handleSwitchCategory = (cat: StickerTargetCategory) => {
    setTargetCategory(cat);
    setShowMainGuide(cat === 'main');

    const setting = categorySettings[cat];
    setTargetWidth(setting.width);
    setTargetHeight(setting.height);
    setWidthInput(String(setting.width));
    setHeightInput(String(setting.height));
    setLockRatio(setting.lock);

    if (image) {
      const fit = calculateFitTransform(image.width, image.height, setting.width, setting.height);
      setImageScale(fit.scale);
      setImageOffsetX(fit.offsetX);
      setImageOffsetY(fit.offsetY);
    }
  };

  // 寬度手動輸入處理 (與框框雙向同步)
  const handleWidthChange = (valStr: string) => {
    setWidthInput(valStr);
    const val = parseInt(valStr, 10);
    if (!isNaN(val) && val > 0) {
      const valRes = validateDimension(val);
      if (!valRes.isValid) {
        setDimensionError(valRes.error || '寬度不合法');
        return;
      }
      setDimensionError(null);
      setTargetWidth(val);

      if (lockRatio && targetHeight > 0) {
        const locked = calculateLockedDimension(targetWidth, targetHeight, 'width', val);
        setTargetHeight(locked.height);
        setHeightInput(String(locked.height));
        updateCategoryCache(targetCategory, val, locked.height, lockRatio);
      } else {
        updateCategoryCache(targetCategory, val, targetHeight, lockRatio);
      }
    }
  };

  // 高度手動輸入處理 (與框框雙向同步)
  const handleHeightChange = (valStr: string) => {
    setHeightInput(valStr);
    const val = parseInt(valStr, 10);
    if (!isNaN(val) && val > 0) {
      const valRes = validateDimension(val);
      if (!valRes.isValid) {
        setDimensionError(valRes.error || '高度不合法');
        return;
      }
      setDimensionError(null);
      setTargetHeight(val);

      if (lockRatio && targetWidth > 0) {
        const locked = calculateLockedDimension(targetWidth, targetHeight, 'height', val);
        setTargetWidth(locked.width);
        setWidthInput(String(locked.width));
        updateCategoryCache(targetCategory, locked.width, val, lockRatio);
      } else {
        updateCategoryCache(targetCategory, targetWidth, val, lockRatio);
      }
    }
  };

  // 快取特定分類的設定
  const updateCategoryCache = (cat: StickerTargetCategory, w: number, h: number, lock: boolean) => {
    setCategorySettings((prev) => ({
      ...prev,
      [cat]: { width: w, height: h, lock },
    }));
  };

  // 滑鼠拖曳框框四角時的回呼 (即時更新數值)
  const handleCanvasBoxResize = useCallback(
    (newW: number, newH: number) => {
      setTargetWidth(newW);
      setTargetHeight(newH);
      setWidthInput(String(newW));
      setHeightInput(String(newH));
      setDimensionError(null);
      updateCategoryCache(targetCategory, newW, newH, lockRatio);
    },
    [targetCategory, lockRatio]
  );

  // 滑鼠拖曳圖片平移或縮放的回呼
  const handleCanvasTransform = useCallback((nextOffsetX: number, nextOffsetY: number, nextScale: number) => {
    setImageOffsetX(nextOffsetX);
    setImageOffsetY(nextOffsetY);
    setImageScale(nextScale);
  }, []);

  // 快捷尺寸套用
  const handleApplyPreset = (w: number, h: number, cat?: StickerTargetCategory) => {
    const nextCat = cat ?? (w === 240 && h === 240 ? 'main' : w === 96 && h === 74 ? 'tab' : 'sticker');
    setTargetCategory(nextCat);
    setShowMainGuide(nextCat === 'main');
    setTargetWidth(w);
    setTargetHeight(h);
    setWidthInput(String(w));
    setHeightInput(String(h));
    setDimensionError(null);
    updateCategoryCache(nextCat, w, h, lockRatio);

    if (image) {
      const fit = calculateFitTransform(image.width, image.height, w, h);
      setImageScale(fit.scale);
      setImageOffsetX(fit.offsetX);
      setImageOffsetY(fit.offsetY);
    }
  };

  // 快捷操作：適應框框 (Fit)
  const handleActionFit = () => {
    if (!image) return;
    const fit = calculateFitTransform(image.width, image.height, targetWidth, targetHeight);
    setImageScale(fit.scale);
    setImageOffsetX(fit.offsetX);
    setImageOffsetY(fit.offsetY);
  };

  // 快捷操作：填滿框框 (Fill)
  const handleActionFill = () => {
    if (!image) return;
    const fill = calculateFillTransform(image.width, image.height, targetWidth, targetHeight);
    setImageScale(fill.scale);
    setImageOffsetX(fill.offsetX);
    setImageOffsetY(fill.offsetY);
  };

  // 快捷操作：圖片置中 (Center)
  const handleActionCenter = () => {
    if (!image) return;
    const center = calculateCenterTransform(image.width, image.height, targetWidth, targetHeight, imageScale);
    setImageOffsetX(center.offsetX);
    setImageOffsetY(center.offsetY);
  };

  // 快捷操作：重設縮放 (100% 原始大小)
  const handleActionResetScale = () => {
    if (!image) return;
    setImageScale(1.0);
    const center = calculateCenterTransform(image.width, image.height, targetWidth, targetHeight, 1.0);
    setImageOffsetX(center.offsetX);
    setImageOffsetY(center.offsetY);
  };

  // 重設全部至原圖初始狀態
  const handleResetAll = () => {
    if (!image) return;
    setTargetWidth(image.width);
    setTargetHeight(image.height);
    setWidthInput(String(image.width));
    setHeightInput(String(image.height));
    setLockRatio(false);
    setImageScale(1.0);
    setImageOffsetX(0);
    setImageOffsetY(0);
    setDimensionError(null);
  };

  // 執行「另存為新圖片」
  const handleSaveAsNew = async () => {
    if (!image) return;
    const valW = validateDimension(targetWidth);
    const valH = validateDimension(targetHeight);
    if (!valW.isValid || !valH.isValid) {
      showToast('error', valW.error || valH.error || '請確認尺寸合規');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await executeCustomTransformResize(
        image.blob,
        {
          targetWidth,
          targetHeight,
          imageOffsetX,
          imageOffsetY,
          imageScale,
        },
        image.hasAlphaChannel
      );

      await onSaveAsNew(result, image);
      onClose();
    } catch (err) {
      showToast('error', `另存新圖片失敗: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 規格檢驗狀態判定 (檢查尺寸是否符合 LINE Creators Market 規範)
  const specStatus = useMemo(() => {
    const isEven = targetWidth % 2 === 0 && targetHeight % 2 === 0;

    if (targetCategory === 'main') {
      const isExact = targetWidth === 240 && targetHeight === 240;
      return {
        isStandard: isExact,
        isEven,
        label: isExact ? '完全符合主要圖片規格 (240 × 240)' : '未達主要圖片標準 (官方要求必須精確為 240 × 240 px)',
        color: isExact ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200',
      };
    }

    if (targetCategory === 'tab') {
      const isExact = targetWidth === 96 && targetHeight === 74;
      return {
        isStandard: isExact,
        isEven,
        label: isExact ? '完全符合聊天室標籤圖規格 (96 × 74)' : '未達標籤圖標準 (官方要求必須精確為 96 × 74 px)',
        color: isExact ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200',
      };
    }

    // 一般貼圖：最大 370 x 320，且寬高皆須為偶數
    const isWithinMax = targetWidth <= 370 && targetHeight <= 320;
    const isOk = isWithinMax && isEven;
    let label = '符合一般貼圖規範 (最大 370×320，偶數寬高)';
    if (!isWithinMax) label = '超出一般貼圖最大尺寸上限 370 × 320 px';
    else if (!isEven) label = '寬度或高度為奇數，官方要求必須為偶數';

    return {
      isStandard: isOk,
      isEven,
      label,
      color: isOk ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200',
    };
  }, [targetCategory, targetWidth, targetHeight]);

  const isJpeg = image.mimeType === 'image/jpeg' || /\.jpe?g$/i.test(image.originalName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* 頂部標題與類型切換列 */}
        <div className="px-6 py-3.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
              <Scaling className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">自由裁切與尺寸調整畫布</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800">
                  互動編輯模式
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-md">
                來源：{image.customName || image.originalName} ({image.width} × {image.height} px)
              </p>
            </div>
          </div>

          {/* 圖片類型切換 Tab (各自記憶尺寸，互不污染) */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleSwitchCategory('sticker')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                targetCategory === 'sticker'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>一般貼圖</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchCategory('main')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                targetCategory === 'main'
                  ? 'bg-white text-amber-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-amber-500" />
              <span>主要圖片</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchCategory('tab')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                targetCategory === 'tab'
                  ? 'bg-white text-sky-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5 text-sky-500" />
              <span>聊天室標籤圖</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 核心主體：左右雙欄 (左欄互動式編輯畫布，右欄控制面板) */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左欄：互動編輯畫布區域 (7 欄) */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            {/* 畫布工具列：快捷置中、適應、填滿與縮放倍率控制 */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={handleActionFit}
                  className="px-2.5 py-1 rounded-lg text-slate-700 hover:bg-white hover:shadow-xs transition-all font-semibold flex items-center gap-1"
                  title="將圖片等比例縮小以完整置入框框內 (四周透明留白)"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>適應框框</span>
                </button>

                <button
                  type="button"
                  onClick={handleActionFill}
                  className="px-2.5 py-1 rounded-lg text-slate-700 hover:bg-white hover:shadow-xs transition-all font-semibold flex items-center gap-1"
                  title="將圖片等比例放大以填滿整個框框"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>填滿框框</span>
                </button>

                <button
                  type="button"
                  onClick={handleActionCenter}
                  className="px-2.5 py-1 rounded-lg text-slate-700 hover:bg-white hover:shadow-xs transition-all font-semibold flex items-center gap-1"
                  title="保持當前縮放，將圖片中心與框框中心對齊"
                >
                  <AlignCenter className="w-3.5 h-3.5 text-indigo-600" />
                  <span>圖片置中</span>
                </button>

                <button
                  type="button"
                  onClick={handleActionResetScale}
                  className="px-2 py-1 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 transition-all font-medium"
                  title="還原圖片為 100% 原始尺寸"
                >
                  <span>100% 原尺寸</span>
                </button>
              </div>

              {/* 圖片縮放微調列 */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
                <button
                  type="button"
                  onClick={() => setImageScale((s) => Math.max(0.1, +(s - 0.05).toFixed(2)))}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                  title="縮小圖片"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-bold min-w-[48px] text-center">{Math.round(imageScale * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setImageScale((s) => Math.min(10, +(s + 0.05).toFixed(2)))}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-600"
                  title="放大圖片"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 可直接拖曳的操作畫布元件 (Interactive Canvas) */}
            <div className="flex-1 w-full min-h-[380px] relative">
              <InteractiveCanvas
                sourceUrl={originalUrl}
                sourceWidth={image.width}
                sourceHeight={image.height}
                targetWidth={targetWidth}
                targetHeight={targetHeight}
                imageOffsetX={imageOffsetX}
                imageOffsetY={imageOffsetY}
                imageScale={imageScale}
                lockRatio={lockRatio}
                showMainImageGuide={showMainGuide}
                onUpdateTransform={handleCanvasTransform}
                onUpdateTargetDimensions={handleCanvasBoxResize}
                onZoomChange={(newS) => setImageScale(newS)}
              />
            </div>

            {/* 規格檢查合規狀態即時橫幅 */}
            <div className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${specStatus.color}`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold">{specStatus.label}</span>
              </div>
              <span className="font-mono font-bold text-[11px] whitespace-nowrap">
                {targetWidth} × {targetHeight} px
              </span>
            </div>
          </div>

          {/* 右欄：控制面板 (5 欄) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              {/* 主要圖片尺寸專屬輔助提示與一鍵套用區 */}
              {targetCategory === 'main' && (
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-amber-950 text-xs space-y-2.5">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-amber-900">
                      <Star className="w-4 h-4 text-amber-500" />
                      <span>主要圖片 (main.png) 規範指引</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowMainGuide(!showMainGuide)}
                      className="text-[11px] underline text-amber-800 hover:text-amber-950 font-medium"
                    >
                      {showMainGuide ? '隱藏正方形輔助框' : '顯示正方形輔助框'}
                    </button>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    LINE 官方嚴格限制主要圖片尺寸必須為 <strong className="text-amber-900 font-mono">240 × 240 px</strong>。若原圖比例非正方形，可點選下方按鈕直接切換為正方形畫布，並透過「適應」或「填滿」進行微調。
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(240, 240, 'main')}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-xs"
                    >
                      直接套用 240 × 240 正方形畫布
                    </button>
                  </div>
                </div>
              )}

              {/* 快捷預設尺寸按鈕 */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1.5 flex items-center justify-between">
                  <span>官方預設尺寸</span>
                  <span className="text-[10px] text-slate-400 font-normal">點擊直接套用</span>
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(370, 320, 'sticker')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      targetWidth === 370 && targetHeight === 320
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="block font-semibold">一般貼圖最大上限</span>
                    <span className="font-mono text-[11px] text-slate-500">370 × 320 px</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset(240, 240, 'main')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      targetWidth === 240 && targetHeight === 240
                        ? 'border-amber-500 bg-amber-50/70 text-amber-950 font-bold shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="block font-semibold flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-500" />
                      <span>主要圖片 (main)</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">240 × 240 px</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset(96, 74, 'tab')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      targetWidth === 96 && targetHeight === 74
                        ? 'border-sky-500 bg-sky-50/70 text-sky-950 font-bold shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="block font-semibold flex items-center gap-1">
                      <Bookmark className="w-3 h-3 text-sky-500" />
                      <span>標籤圖片 (tab)</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">96 × 74 px</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset(image.width, image.height, targetCategory)}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 text-slate-700 text-left transition-all"
                  >
                    <span className="block font-semibold flex items-center gap-1">
                      <RotateCcw className="w-3 h-3 text-slate-400" />
                      <span>還原原尺寸</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {image.width} × {image.height} px
                    </span>
                  </button>
                </div>
              </div>

              {/* 自訂寬度與高度 (雙向同步) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800">輸出畫布尺寸 (px)</label>
                  <button
                    type="button"
                    onClick={() => setLockRatio(!lockRatio)}
                    className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg transition-colors ${
                      lockRatio ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title={lockRatio ? '比例已鎖定，拖曳或修改時保持比例' : '比例未鎖定，可自由調整寬高'}
                  >
                    {lockRatio ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    <span>{lockRatio ? '比例鎖定中' : '自由比例'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1 font-medium">寬度 (Width)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max={MAX_RESIZE_DIMENSION}
                        value={widthInput}
                        onChange={(e) => handleWidthChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="寬度"
                      />
                      <span className="absolute right-3 top-2.5 text-[11px] text-slate-400 font-mono">px</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1 font-medium">高度 (Height)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max={MAX_RESIZE_DIMENSION}
                        value={heightInput}
                        onChange={(e) => handleHeightChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="高度"
                      />
                      <span className="absolute right-3 top-2.5 text-[11px] text-slate-400 font-mono">px</span>
                    </div>
                  </div>
                </div>

                {dimensionError && (
                  <p className="text-[11px] text-rose-600 font-medium mt-1">{dimensionError}</p>
                )}
              </div>

              {/* 操作說明卡片 */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-700 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                  <span>畫布操作小技巧</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                  <li><strong>拖曳框框四角或四邊</strong>：自由改變裁切畫布尺寸。</li>
                  <li><strong>在框框內按住拖曳</strong>：任意調整圖片擺放位置。</li>
                  <li><strong>滾動滑鼠滾輪</strong>：平滑放大或縮小圖片。</li>
                  <li><strong>超出框框的內容</strong>：輸出時自動裁切，保留透明背景。</li>
                </ul>
              </div>

              {/* 透明度說明 */}
              {isJpeg && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-[11px]">
                    <span className="font-bold">原圖無透明通道：</span>原始檔案為 JPEG 或不含透明通道，輸出為 PNG 會保留原圖白底或實色底，不會強制加入白色也不會假裝已去背。
                  </p>
                </div>
              )}
            </div>

            {/* 底端操作按鈕列 */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleResetAll}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                重設為原圖
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  取消
                </button>

                <button
                  type="button"
                  onClick={handleSaveAsNew}
                  disabled={isSubmitting || !!dimensionError}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/25 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>合成輸出中...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>另存為新圖片</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
