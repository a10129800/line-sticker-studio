import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { HandleType } from '../../features/resizer/imageResizer';
import { calculateCropBoxResize } from '../../features/resizer/imageResizer';

interface InteractiveCanvasProps {
  sourceUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  imageOffsetX: number;
  imageOffsetY: number;
  imageScale: number;
  imageScaleY?: number;
  lockRatio: boolean;
  showMainImageGuide?: boolean;
  onUpdateTransform: (offsetX: number, offsetY: number, scale: number) => void;
  onUpdateTargetDimensions: (width: number, height: number) => void;
  onZoomChange?: (newScale: number) => void;
}

type DragMode = 'none' | 'pan-image' | 'move-box' | 'resize-box';

export const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({
  sourceUrl,
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  imageOffsetX,
  imageOffsetY,
  imageScale,
  imageScaleY,
  lockRatio,
  showMainImageGuide = false,
  onUpdateTransform,
  onUpdateTargetDimensions,
  onZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 440,
    height: 380,
  });

  // 拖曳狀態管理
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [activeHandle, setActiveHandle] = useState<HandleType | null>(null);
  const [cursorPos, setCursorPos] = useState<string>('default');

  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialWidth: number;
    initialHeight: number;
    initialOffsetX: number;
    initialOffsetY: number;
  }>({
    clientX: 0,
    clientY: 0,
    initialWidth: targetWidth,
    initialHeight: targetHeight,
    initialOffsetX: imageOffsetX,
    initialOffsetY: imageOffsetY,
  });

  // 監聽容器大小變更
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: Math.max(260, rect.width),
          height: Math.max(260, rect.height),
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // 計算視埠縮放比例 (使裁切框加邊距後完美置中容納於編輯區內)
  const padding = 36;
  const availW = containerSize.width - padding * 2;
  const availH = containerSize.height - padding * 2;
  const viewScale = Math.min(availW / Math.max(1, targetWidth), availH / Math.max(1, targetHeight), 1.2);

  // 裁切框在螢幕容器中的絕對位置與尺寸
  const boxScreenW = targetWidth * viewScale;
  const boxScreenH = targetHeight * viewScale;
  const boxScreenX = (containerSize.width - boxScreenW) / 2;
  const boxScreenY = (containerSize.height - boxScreenH) / 2;

  // 圖片在螢幕容器中的絕對位置與尺寸
  const actualScaleY = imageScaleY ?? imageScale;
  const imgScreenW = sourceWidth * imageScale * viewScale;
  const imgScreenH = sourceHeight * actualScaleY * viewScale;
  const imgScreenX = boxScreenX + imageOffsetX * viewScale;
  const imgScreenY = boxScreenY + imageOffsetY * viewScale;

  // 主要圖片 240x240 輔助框螢幕尺寸與位置 (中心對齊輸出框框)
  const guideSize = 240 * viewScale;
  const guideX = boxScreenX + (boxScreenW - guideSize) / 2;
  const guideY = boxScreenY + (boxScreenH - guideSize) / 2;

  // 滑鼠滾輪縮放圖片
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
      const newScale = Math.max(0.05, Math.min(20, imageScale * zoomFactor));

      // 保持以框框中心進行縮放
      const centerBoxX = targetWidth / 2;
      const centerBoxY = targetHeight / 2;
      const ratio = newScale / imageScale;

      const newOffsetX = centerBoxX - (centerBoxX - imageOffsetX) * ratio;
      const newOffsetY = centerBoxY - (centerBoxY - imageOffsetY) * ratio;

      onUpdateTransform(Math.round(newOffsetX), Math.round(newOffsetY), newScale);
      onZoomChange?.(newScale);
    },
    [imageScale, imageOffsetX, imageOffsetY, targetWidth, targetHeight, onUpdateTransform, onZoomChange]
  );

  // 開始拖曳控制手柄 (Resize Box)
  const handleStartResize = (e: React.MouseEvent, handle: HandleType) => {
    e.stopPropagation();
    e.preventDefault();
    setDragMode('resize-box');
    setActiveHandle(handle);

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialWidth: targetWidth,
      initialHeight: targetHeight,
      initialOffsetX: imageOffsetX,
      initialOffsetY: imageOffsetY,
    };
  };

  // 開始拖曳裁切框邊線 (Move Box)
  const handleStartMoveBox = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragMode('move-box');

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialWidth: targetWidth,
      initialHeight: targetHeight,
      initialOffsetX: imageOffsetX,
      initialOffsetY: imageOffsetY,
    };
  };

  // 開始拖曳圖片 (Pan Image)
  const handleStartPanImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragMode('pan-image');

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialWidth: targetWidth,
      initialHeight: targetHeight,
      initialOffsetX: imageOffsetX,
      initialOffsetY: imageOffsetY,
    };
  };

  // 全域滑鼠移動監聽
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragMode === 'none') return;

      const deltaScreenX = e.clientX - dragStartRef.current.clientX;
      const deltaScreenY = e.clientY - dragStartRef.current.clientY;

      // 換算為畫布實際像素 delta
      const deltaX = deltaScreenX / viewScale;
      const deltaY = deltaScreenY / viewScale;

      if (dragMode === 'pan-image') {
        const nextX = Math.round(dragStartRef.current.initialOffsetX + deltaX);
        const nextY = Math.round(dragStartRef.current.initialOffsetY + deltaY);
        onUpdateTransform(nextX, nextY, imageScale);
      } else if (dragMode === 'move-box') {
        // 移動框框時相對平移圖片
        const nextX = Math.round(dragStartRef.current.initialOffsetX - deltaX);
        const nextY = Math.round(dragStartRef.current.initialOffsetY - deltaY);
        onUpdateTransform(nextX, nextY, imageScale);
      } else if (dragMode === 'resize-box' && activeHandle) {
        const { width: newW, height: newH } = calculateCropBoxResize(
          dragStartRef.current.initialWidth,
          dragStartRef.current.initialHeight,
          activeHandle,
          deltaX,
          deltaY,
          lockRatio,
          dragStartRef.current.initialWidth / dragStartRef.current.initialHeight
        );
        onUpdateTargetDimensions(newW, newH);
      }
    };

    const handleMouseUp = () => {
      setDragMode('none');
      setActiveHandle(null);
    };

    if (dragMode !== 'none') {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    dragMode,
    activeHandle,
    viewScale,
    imageScale,
    lockRatio,
    onUpdateTransform,
    onUpdateTargetDimensions,
  ]);

  // 控制點手柄清單 (8 個方向)
  const handles: Array<{ type: HandleType; cursor: string; style: React.CSSProperties }> = [
    { type: 'nw', cursor: 'nwse-resize', style: { top: -7, left: -7 } },
    { type: 'n', cursor: 'ns-resize', style: { top: -7, left: '50%', transform: 'translateX(-50%)' } },
    { type: 'ne', cursor: 'nesw-resize', style: { top: -7, right: -7 } },
    { type: 'e', cursor: 'ew-resize', style: { top: '50%', right: -7, transform: 'translateY(-50%)' } },
    { type: 'se', cursor: 'nwse-resize', style: { bottom: -7, right: -7 } },
    { type: 's', cursor: 'ns-resize', style: { bottom: -7, left: '50%', transform: 'translateX(-50%)' } },
    { type: 'sw', cursor: 'nesw-resize', style: { bottom: -7, left: -7 } },
    { type: 'w', cursor: 'ew-resize', style: { top: '50%', left: -7, transform: 'translateY(-50%)' } },
  ];

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className="relative w-full h-full min-h-[380px] rounded-2xl overflow-hidden select-none border border-slate-200 shadow-inner flex items-center justify-center"
      style={{
        backgroundImage:
          'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
        cursor: cursorPos,
      }}
    >
      {/* 1. 底層：圖片元素 */}
      <div
        className="absolute transition-none pointer-events-none"
        style={{
          width: `${imgScreenW}px`,
          height: `${imgScreenH}px`,
          left: `${imgScreenX}px`,
          top: `${imgScreenY}px`,
        }}
      >
        <img
          src={sourceUrl}
          alt="編輯圖片"
          draggable={false}
          className="w-full h-full object-fill filter drop-shadow-sm select-none"
        />
      </div>

      {/* 2. 中層：裁切框外部半透明暗色遮罩 (Darkened Out-of-Bounds Overlay) */}
      {/* 上方遮罩 */}
      <div
        className="absolute left-0 top-0 w-full bg-slate-900/65 pointer-events-none"
        style={{ height: `${Math.max(0, boxScreenY)}px` }}
      />
      {/* 下方遮罩 */}
      <div
        className="absolute left-0 w-full bg-slate-900/65 pointer-events-none"
        style={{
          top: `${boxScreenY + boxScreenH}px`,
          bottom: 0,
        }}
      />
      {/* 左方遮罩 */}
      <div
        className="absolute top-0 bg-slate-900/65 pointer-events-none"
        style={{
          left: 0,
          top: `${boxScreenY}px`,
          width: `${Math.max(0, boxScreenX)}px`,
          height: `${boxScreenH}px`,
        }}
      />
      {/* 右方遮罩 */}
      <div
        className="absolute top-0 bg-slate-900/65 pointer-events-none"
        style={{
          left: `${boxScreenX + boxScreenW}px`,
          right: 0,
          top: `${boxScreenY}px`,
          height: `${boxScreenH}px`,
        }}
      />

      {/* 3. 主要圖片 (240x240) 正方形規格輔助線 (若啟用) */}
      {showMainImageGuide && (
        <div
          className="absolute pointer-events-none border-2 border-dashed border-amber-400 z-10"
          style={{
            left: `${guideX}px`,
            top: `${guideY}px`,
            width: `${guideSize}px`,
            height: `${guideSize}px`,
            boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.2), inset 0 0 8px rgba(245, 158, 11, 0.15)',
          }}
        >
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] tracking-wide whitespace-nowrap shadow-sm">
            主要圖片標準：240 × 240 px
          </div>
        </div>
      )}

      {/* 4. 頂層互動裁切框 (Interactive Crop Box) */}
      <div
        className="absolute border-2 border-indigo-600 z-20 group"
        style={{
          left: `${boxScreenX}px`,
          top: `${boxScreenY}px`,
          width: `${boxScreenW}px`,
          height: `${boxScreenH}px`,
          boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.8), 0 4px 20px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* 框框內部拖曳圖片感應區 (Pan Image) */}
        <div
          onMouseDown={handleStartPanImage}
          onMouseEnter={() => setCursorPos('grab')}
          onMouseLeave={() => setCursorPos('default')}
          className="w-full h-full cursor-grab active:cursor-grabbing bg-transparent relative"
          title="按住滑鼠拖曳圖片位置，滾輪縮放大小"
        >
          {/* 九宮格輔助導引虛線 */}
          <div className="absolute inset-0 pointer-events-none opacity-25 grid grid-cols-3 grid-rows-3">
            <div className="border-r border-b border-indigo-300" />
            <div className="border-r border-b border-indigo-300" />
            <div className="border-b border-indigo-300" />
            <div className="border-r border-b border-indigo-300" />
            <div className="border-r border-b border-indigo-300" />
            <div className="border-b border-indigo-300" />
            <div className="border-r border-indigo-300" />
            <div className="border-r border-indigo-300" />
            <div />
          </div>

          {/* 尺寸角標提示 */}
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-slate-900/80 text-white font-mono text-[10px] font-bold pointer-events-none shadow-sm backdrop-blur-xs">
            {targetWidth} × {targetHeight}
          </div>
        </div>

        {/* 框框四邊框拖曳手柄 (Move Entire Box) */}
        <div
          onMouseDown={handleStartMoveBox}
          className="absolute -inset-1 cursor-move pointer-events-auto"
          style={{ zIndex: 1 }}
          title="拖曳框框整體移動"
        />

        {/* 框框 8 個縮放手柄 (8 Resize Handles) */}
        {handles.map(({ type, cursor, style }) => (
          <div
            key={type}
            onMouseDown={(e) => handleStartResize(e, type)}
            onMouseEnter={() => setCursorPos(cursor)}
            onMouseLeave={() => setCursorPos('default')}
            style={{
              ...style,
              cursor,
              zIndex: 10,
            }}
            className="absolute w-3.5 h-3.5 bg-white border-2 border-indigo-600 rounded-xs shadow-md transition-transform hover:scale-125 active:scale-110 pointer-events-auto"
            title={`拖曳調整尺寸 (${type})`}
          />
        ))}
      </div>

      {/* 底部浮動操作提示標籤 */}
      <div className="absolute bottom-2.5 left-3 px-2.5 py-1 rounded-lg bg-slate-900/80 text-white text-[10px] font-medium backdrop-blur-md flex items-center gap-2 pointer-events-none z-30 shadow-md">
        <span>🖱️ 拖曳框框四角調整尺寸</span>
        <span className="text-slate-500">|</span>
        <span>✋ 框內拖曳圖片</span>
        <span className="text-slate-500">|</span>
        <span>⚙️ 滾輪縮放圖片</span>
      </div>
    </div>
  );
};
