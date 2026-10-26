import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  ArrowLeft, 
  Trash2, 
  RefreshCw, 
  ArrowUp, 
  ArrowDown, 
  ZoomIn, 
  Edit2, 
  Check, 
  X, 
  Layers,
  ShieldCheck,
  Download,
  Star,
  Bookmark,
  Scaling
} from 'lucide-react';
import type { StickerProject, StickerImage } from '../../types/project';
import { 
  getImagesByProjectId, 
  addStickerImages, 
  removeStickerImage, 
  replaceStickerImage, 
  reorderStickerImages,
  updateStickerImageMeta,
  setProjectSpecialImage 
} from '../../db/repository';
import { analyzeImageFile, formatBytes } from '../../utils/imageAnalyzer';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ImageResizerModal } from '../resizer/ImageResizerModal';
import type { ResizeExecutionResult } from '../../features/resizer/imageResizer';

interface ImageWorkspaceProps {
  project: StickerProject;
  onBack: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  onImagesUpdated?: () => void;
  onGoToValidator?: () => void;
  onGoToExporter?: () => void;
  onProjectUpdated?: (updated: StickerProject) => void;
}

export const ImageWorkspace: React.FC<ImageWorkspaceProps> = ({
  project,
  onBack,
  showToast,
  onImagesUpdated,
  onGoToValidator,
  onGoToExporter,
  onProjectUpdated,
}) => {
  const [images, setImages] = useState<StickerImage[]>([]);
  const [imageUrlMap, setImageUrlMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewImage, setPreviewImage] = useState<StickerImage | null>(null);

  // 尺寸調整目標圖片狀態
  const [resizingImage, setResizingImage] = useState<StickerImage | null>(null);

  // 刪除確認狀態
  const [deleteTarget, setDeleteTarget] = useState<StickerImage | null>(null);

  // 替換目標圖片 ID
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);

  // 單張編輯備註與自訂名稱
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // 載入專案圖片
  const loadImages = async () => {
    try {
      setLoading(true);
      const list = await getImagesByProjectId(project.id);
      setImages(list);

      // 為每張圖片產生安全的 Object URL
      const urls: Record<string, string> = {};
      list.forEach((img) => {
        urls[img.id] = URL.createObjectURL(img.blob);
      });

      // 釋放先前記憶體
      Object.values(imageUrlMap).forEach((url) => URL.revokeObjectURL(url));
      setImageUrlMap(urls);
      onImagesUpdated?.();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '讀取圖片失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
    return () => {
      // 元件卸載時清理 Object URLs
      Object.values(imageUrlMap).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [project.id]);

  // 處理匯入多張圖片
  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      showToast('error', '未偵測到支援的圖片格式 (僅支援 PNG, JPG, WebP)');
      return;
    }

    try {
      showToast('info', `正在解析並匯入 ${validFiles.length} 張圖片...`);
      const newStickerPayloads = [];
      const currentCount = images.length;

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const analysis = await analyzeImageFile(file, file.name);

        newStickerPayloads.push({
          projectId: project.id,
          orderIndex: currentCount + i,
          originalName: file.name,
          customName: file.name.replace(/\.[^/.]+$/, ''),
          mimeType: analysis.mimeType,
          fileSize: analysis.fileSize,
          width: analysis.width,
          height: analysis.height,
          hasAlphaChannel: analysis.hasAlphaChannel,
          notes: '',
          blob: file, // 儲存原始 Blob 二進位檔
        });
      }

      await addStickerImages(newStickerPayloads);
      showToast('success', `成功匯入 ${validFiles.length} 張圖片`);
      await loadImages();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '圖片匯入失敗');
    }
  };

  // 替換單張圖片
  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replaceTargetId) return;

    try {
      showToast('info', '正在分析並替換圖片...');
      const analysis = await analyzeImageFile(file, file.name);

      await replaceStickerImage(replaceTargetId, {
        blob: file,
        originalName: file.name,
        mimeType: analysis.mimeType,
        fileSize: analysis.fileSize,
        width: analysis.width,
        height: analysis.height,
        hasAlphaChannel: analysis.hasAlphaChannel,
      });

      showToast('success', '圖片已成功替換（原始本機檔案未被覆寫）');
      setReplaceTargetId(null);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
      await loadImages();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '替換圖片失敗');
    }
  };

  // 尺寸調整完成後，另存為新圖片
  const handleSaveResizedAsNew = async (
    result: ResizeExecutionResult,
    originalImage: StickerImage
  ) => {
    try {
      const baseName = originalImage.originalName.replace(/\.[^/.]+$/, '');
      const newOriginalName = `${baseName}_resized.png`;
      const newCustomName = `${originalImage.customName || baseName} (調整尺寸)`;

      const newStickerPayload = {
        projectId: project.id,
        orderIndex: images.length,
        originalName: newOriginalName,
        customName: newCustomName,
        mimeType: 'image/png',
        fileSize: result.fileSize,
        width: result.width,
        height: result.height,
        hasAlphaChannel: result.hasAlphaChannel,
        notes: `自「${originalImage.customName || originalImage.originalName}」調整為 ${result.width}×${result.height}`,
        blob: result.blob,
      };

      await addStickerImages([newStickerPayload]);
      showToast('success', `已另存為新圖片「${newCustomName}」(${result.width} × ${result.height} px)`);
      await loadImages();
    } catch (err) {
      showToast('error', `另存新圖片失敗: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // 調整順序 (向上或向下移動)
  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const newImages = [...images];
    const temp = newImages[index];
    newImages[index] = newImages[targetIndex];
    newImages[targetIndex] = temp;

    const orderedIds = newImages.map((img) => img.id);
    try {
      await reorderStickerImages(project.id, orderedIds);
      await loadImages();
    } catch (err) {
      showToast('error', '重新排序失敗');
    }
  };

  // 刪除確認
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeStickerImage(deleteTarget.id);
      showToast('success', `已從專案移除「${deleteTarget.originalName}」`);
      setDeleteTarget(null);
      await loadImages();
    } catch (err) {
      showToast('error', '移除圖片失敗');
    }
  };

  // 儲存單張自訂資訊
  const handleSaveMeta = async (imageId: string) => {
    try {
      await updateStickerImageMeta(imageId, {
        customName: editName.trim(),
        notes: editNotes.trim(),
      });
      setEditingImageId(null);
      await loadImages();
    } catch (err) {
      showToast('error', '更新圖片資訊失敗');
    }
  };

  // 指定或取消主圖 (main) / 標籤圖 (tab)
  const handleToggleSpecialRole = async (imageId: string, role: 'main' | 'tab') => {
    try {
      const currentId = role === 'main' ? project.mainImageId : project.tabImageId;
      const nextId = currentId === imageId ? null : imageId;
      const updated = await setProjectSpecialImage(project.id, role, nextId);
      onProjectUpdated?.(updated);
      showToast(
        'success',
        nextId
          ? `已將圖片指定為${role === 'main' ? '主要圖片 (main.png 240x240)' : '聊天室標籤圖 (tab.png 96x74)'}`
          : `已取消指定${role === 'main' ? '主要圖片' : '聊天室標籤圖'}`
      );
    } catch (err) {
      showToast('error', '更新素材指定失敗');
    }
  };

  return (
    <div className="space-y-6">
      {/* 隱藏的更換檔案輸入框 */}
      <input
        type="file"
        ref={replaceInputRef}
        accept="image/png,image/jpeg,image/webp"
        onChange={handleReplaceFile}
        className="hidden"
      />

      {/* 頂部功能列 */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="返回專案清單"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{project.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-600">
                目標 {project.targetCount} 張
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              圖片管理工作區：拖曳或點擊匯入靜態貼圖，調整順序與檢查規格
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 張數統計計數器 */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <Layers className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-600">目前張數：</span>
            <span
              className={`text-xs font-bold ${
                images.length === project.targetCount
                  ? 'text-emerald-600'
                  : images.length > project.targetCount
                  ? 'text-amber-600'
                  : 'text-slate-800'
              }`}
            >
              {images.length} / {project.targetCount}
            </span>
          </div>

          {onGoToValidator && (
            <button
              onClick={onGoToValidator}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all"
              title="前往規格檢查器查看全專案合格狀態與修正建議"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>檢查規格</span>
            </button>
          )}

          {onGoToExporter && (
            <button
              onClick={onGoToExporter}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-md shadow-slate-900/20 transition-all hover:scale-[1.01]"
              title="前往 LINE 官方上架素材 ZIP 打包中心"
            >
              <Download className="w-4 h-4 text-[#06C755]" />
              <span>匯出上架 ZIP</span>
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-[#06C755] hover:bg-[#05B04B] text-white text-xs font-bold rounded-xl shadow-md shadow-[#06C755]/20 transition-all hover:scale-[1.01]"
          >
            <Upload className="w-4 h-4" />
            <span>匯入圖片</span>
          </button>
          <input
            type="file"
            multiple
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />
        </div>
      </div>

      {/* 主圖與聊天室標籤圖指派狀態列 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-4 rounded-2xl border border-slate-200 text-xs shadow-sm">
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Star className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800">主要圖片 (main.png)</div>
              <div className="text-[11px] text-slate-500">
                {project.mainImageId ? (
                  (() => {
                    const found = images.find((i) => i.id === project.mainImageId);
                    return found ? (
                      <span className="text-emerald-700 font-medium">
                        已指定：{found.customName || found.originalName} ({found.width}×{found.height} px)
                      </span>
                    ) : (
                      <span className="text-rose-600 font-medium">指定之圖片已不存在</span>
                    );
                  })()
                ) : (
                  <span className="text-amber-700">尚未指定 (官方規格需 240 × 240 px)</span>
                )}
              </div>
            </div>
          </div>
          {project.mainImageId && (
            <button
              onClick={() => handleToggleSpecialRole(project.mainImageId!, 'main')}
              className="text-[11px] text-slate-500 hover:text-rose-600 font-medium px-2 py-1 rounded hover:bg-slate-200/60"
            >
              取消指定
            </button>
          )}
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800">聊天室標籤圖 (tab.png)</div>
              <div className="text-[11px] text-slate-500">
                {project.tabImageId ? (
                  (() => {
                    const found = images.find((i) => i.id === project.tabImageId);
                    return found ? (
                      <span className="text-emerald-700 font-medium">
                        已指定：{found.customName || found.originalName} ({found.width}×{found.height} px)
                      </span>
                    ) : (
                      <span className="text-rose-600 font-medium">指定之圖片已不存在</span>
                    );
                  })()
                ) : (
                  <span className="text-amber-700">尚未指定 (官方規格需 96 × 74 px)</span>
                )}
              </div>
            </div>
          </div>
          {project.tabImageId && (
            <button
              onClick={() => handleToggleSpecialRole(project.tabImageId!, 'tab')}
              className="text-[11px] text-slate-500 hover:text-rose-600 font-medium px-2 py-1 rounded hover:bg-slate-200/60"
            >
              取消指定
            </button>
          )}
        </div>
      </div>

      {/* 拖放匯入區 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
          isDraggingOver
            ? 'border-[#06C755] bg-emerald-50/50 scale-[1.005]'
            : 'border-slate-300 hover:border-[#06C755]/60 bg-white'
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-[#06C755]/10 text-[#06C755] flex items-center justify-center">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            點擊或拖放圖片至此處進行批次匯入
          </p>
          <p className="text-xs text-slate-400">
            支援 PNG、JPG、JPEG、WebP 格式。原始檔案將妥善留存，裁切與縮放均為非破壞性操作。
          </p>
        </div>
      </div>

      {/* 貼圖卡片網格 */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-medium">讀取貼圖圖片中...</div>
      ) : images.length === 0 ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center">
          <p className="text-sm font-semibold text-slate-600">目前尚無匯入的貼圖圖片</p>
          <p className="text-xs text-slate-400 mt-1">
            請點擊上方「匯入圖片」或拖放已手繪/製圖完成的檔案。
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {images.map((img, index) => {
            const isEditing = editingImageId === img.id;
            const seqNumber = String(index + 1).padStart(2, '0');
            const isTargetFull = index < project.targetCount;

            return (
              <div
                key={img.id}
                className={`bg-white rounded-2xl border transition-all overflow-hidden flex flex-col justify-between group shadow-sm hover:shadow-md ${
                  isTargetFull ? 'border-slate-200' : 'border-amber-300 bg-amber-50/20'
                }`}
              >
                {/* 貼圖編號與狀態條 */}
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-700 bg-slate-200/80 px-1.5 py-0.5 rounded text-[11px]">
                      #{seqNumber}
                    </span>
                    {project.mainImageId === img.id && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white flex items-center gap-0.5 shadow-xs">
                        <Star className="w-2.5 h-2.5" />
                        <span>主圖</span>
                      </span>
                    )}
                    {project.tabImageId === img.id && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500 text-white flex items-center gap-0.5 shadow-xs">
                        <Bookmark className="w-2.5 h-2.5" />
                        <span>標籤圖</span>
                      </span>
                    )}
                  </div>
                  {img.hasAlphaChannel ? (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      透明背景
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      無透明通道
                    </span>
                  )}
                </div>

                {/* 圖片縮圖展示區（帶棋盤格背景以辨識透明度） */}
                <div
                  className="relative aspect-square p-2 flex items-center justify-center cursor-pointer group/thumb"
                  style={{
                    backgroundImage:
                      'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                  }}
                  onClick={() => setPreviewImage(img)}
                >
                  <img
                    src={imageUrlMap[img.id]}
                    alt={img.customName}
                    className="max-h-full max-w-full object-contain filter drop-shadow-sm group-hover/thumb:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      title="放大檢視"
                      className="p-1.5 rounded-lg bg-white/90 text-slate-800 hover:bg-white transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(img);
                      }}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      title="調整尺寸 (另存為新圖片)"
                      className="p-1.5 rounded-lg bg-white/90 text-indigo-600 hover:bg-white transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setResizingImage(img);
                      }}
                    >
                      <Scaling className="w-4 h-4" />
                    </button>
                    <button
                      title="替換此張圖片 (不修改原始檔案)"
                      className="p-1.5 rounded-lg bg-white/90 text-slate-800 hover:bg-white transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplaceTargetId(img.id);
                        replaceInputRef.current?.click();
                      }}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 規格與檔名資訊 */}
                <div className="p-3 text-xs space-y-1.5 bg-white border-t border-slate-100">
                  {isEditing ? (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="名稱"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                      <input
                        type="text"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="備註"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                      />
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingImageId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSaveMeta(img.id)}
                          className="p-1 text-emerald-600 hover:text-emerald-700 font-bold"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-800 truncate" title={img.customName}>
                          {img.customName}
                        </p>
                        <button
                          onClick={() => {
                            setEditingImageId(img.id);
                            setEditName(img.customName);
                            setEditNotes(img.notes);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-600 transition-opacity"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate" title={img.originalName}>
                        {img.originalName}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-50 font-mono">
                    <span>{img.width}×{img.height}</span>
                    <span>{formatBytes(img.fileSize)}</span>
                  </div>
                </div>

                {/* 卡片底端排序與刪除操作 */}
                <div className="px-2 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    <button
                      disabled={index === 0}
                      onClick={() => handleMoveOrder(index, 'up')}
                      title="往前排序"
                      className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={index === images.length - 1}
                      onClick={() => handleMoveOrder(index, 'down')}
                      title="往後排序"
                      className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setResizingImage(img)}
                      title="調整此圖片尺寸 (另存為新圖片)"
                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Scaling className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleSpecialRole(img.id, 'main')}
                      title={project.mainImageId === img.id ? '取消主要圖片指定' : '指定為主要圖片 (main.png 240×240)'}
                      className={`p-1 rounded text-xs transition-colors ${
                        project.mainImageId === img.id
                          ? 'bg-amber-100 text-amber-800 font-bold'
                          : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleSpecialRole(img.id, 'tab')}
                      title={project.tabImageId === img.id ? '取消聊天室標籤圖指定' : '指定為聊天室標籤圖 (tab.png 96×74)'}
                      className={`p-1 rounded text-xs transition-colors ${
                        project.tabImageId === img.id
                          ? 'bg-sky-100 text-sky-800 font-bold'
                          : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(img)}
                      title="從專案移除此圖片"
                      className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 放大預覽彈窗 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">{previewImage.customName}</h3>
                <p className="text-xs text-slate-500">{previewImage.originalName}</p>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className="w-full h-80 rounded-xl flex items-center justify-center p-4 border border-slate-200"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
              }}
            >
              <img
                src={imageUrlMap[previewImage.id]}
                alt={previewImage.customName}
                className="max-h-full max-w-full object-contain filter drop-shadow-md"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px]">解析度</span>
                <span className="font-semibold text-slate-800">
                  {previewImage.width} × {previewImage.height} px
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">檔案大小</span>
                <span className="font-semibold text-slate-800">
                  {formatBytes(previewImage.fileSize)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">透明通道</span>
                <span className="font-semibold text-slate-800">
                  {previewImage.hasAlphaChannel ? '具備 (Alpha)' : '無透明'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">格式</span>
                <span className="font-semibold text-slate-800">
                  {previewImage.mimeType.replace('image/', '').toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 刪除確認對話框 */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="確認自專案移除圖片"
        description={`您確定要從貼圖專案中移除「${deleteTarget?.originalName}」嗎？`}
        note="此操作僅自本管理軟體中移除該筆紀錄，不會刪除您電腦硬碟中的原始圖片檔案。"
        confirmText="確認移除"
        isDanger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 圖片尺寸調整視窗 */}
      <ImageResizerModal
        isOpen={!!resizingImage}
        image={resizingImage}
        onClose={() => setResizingImage(null)}
        onSaveAsNew={handleSaveResizedAsNew}
        showToast={showToast}
        isMainImage={project.mainImageId === resizingImage?.id}
        isTabImage={project.tabImageId === resizingImage?.id}
      />
    </div>
  );
};
