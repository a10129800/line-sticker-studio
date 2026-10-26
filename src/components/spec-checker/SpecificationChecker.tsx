import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShieldCheck, 
  ArrowLeft, 
  RefreshCw, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  ExternalLink,
  Layers,
  Info
} from 'lucide-react';
import type { StickerProject, StickerImage } from '../../types/project';
import { getImagesByProjectId } from '../../db/repository';
import { 
  validateProjectSpecs, 
  ProjectValidationSummary, 
  SingleImageValidation 
} from '../../features/spec-checker/specChecker';
import { 
  exportValidationReportJson, 
  exportValidationReportCsv 
} from '../../features/spec-checker/reportExporter';
import { formatBytes } from '../../utils/imageAnalyzer';

interface SpecificationCheckerProps {
  project: StickerProject;
  onBackToWorkspace: () => void;
  onBackToProjects: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

type FilterType = 'all' | 'errors' | 'warnings' | 'passes';

export const SpecificationChecker: React.FC<SpecificationCheckerProps> = ({
  project,
  onBackToWorkspace,
  onBackToProjects,
  showToast,
}) => {
  const [images, setImages] = useState<StickerImage[]>([]);
  const [imageUrlMap, setImageUrlMap] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<ProjectValidationSummary | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [expandedImageIds, setExpandedImageIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // 執行全專案規格檢查
  const runValidation = useCallback(async () => {
    try {
      setIsValidating(true);
      const imgList = await getImagesByProjectId(project.id);
      setImages(imgList);

      // 為圖片生成暫存 Object URL
      const urls: Record<string, string> = {};
      imgList.forEach((img) => {
        urls[img.id] = URL.createObjectURL(img.blob);
      });
      // 釋放舊有的 Object URLs
      setImageUrlMap((prev) => {
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return urls;
      });

      // 執行核心驗證
      const result = await validateProjectSpecs(project, imgList);
      setSummary(result);
    } catch (err) {
      showToast('error', `規格檢查失敗: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsValidating(false);
    }
  }, [project, showToast]);

  useEffect(() => {
    runValidation();
    return () => {
      Object.values(imageUrlMap).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [project.id]);

  // 切換展開/收合細項
  const toggleExpand = (imageId: string) => {
    setExpandedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) next.delete(imageId);
      else next.add(imageId);
      return next;
    });
  };

  // 一鍵展開所有有問題的圖片
  const expandAllIssues = () => {
    if (!summary) return;
    const issueIds = summary.images
      .filter((img) => img.overallStatus === 'error' || img.overallStatus === 'warning')
      .map((img) => img.imageId);
    setExpandedImageIds(new Set(issueIds));
  };

  // 篩選圖片清單
  const filteredImages = useMemo(() => {
    if (!summary) return [];
    switch (filterType) {
      case 'errors':
        return summary.images.filter((img) => img.overallStatus === 'error');
      case 'warnings':
        return summary.images.filter((img) => img.overallStatus === 'warning');
      case 'passes':
        return summary.images.filter((img) => img.overallStatus === 'pass');
      case 'all':
      default:
        return summary.images;
    }
  }, [summary, filterType]);

  // 匯出報告
  const handleExportJson = () => {
    if (!summary) return;
    try {
      exportValidationReportJson(summary);
      showToast('success', '已成功匯出 JSON 格式規格檢查報告');
      setIsExportMenuOpen(false);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '匯出 JSON 報告失敗');
    }
  };

  const handleExportCsv = () => {
    if (!summary) return;
    try {
      exportValidationReportCsv(summary);
      showToast('success', '已成功匯出 CSV 格式規格檢查報告');
      setIsExportMenuOpen(false);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '匯出 CSV 報告失敗');
    }
  };

  const getOverallBadge = (status: ProjectValidationSummary['overallStatus']) => {
    switch (status) {
      case 'pass':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>規格檢查全部合格</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>存在官方強制錯誤</span>
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>強制規則通過，但有建議事項</span>
          </span>
        );
      case 'uncertain':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            <HelpCircle className="w-4 h-4 text-slate-500" />
            <span>尚待補齊資料或檢查</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* 頂部操作列 */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={onBackToProjects}
              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors font-medium"
              title="返回所有專案列表"
            >
              所有專案
            </button>
            <span className="text-slate-300">/</span>
            <button
              onClick={onBackToWorkspace}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors font-bold"
              title="返回此專案圖片工作區"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>圖片工作區</span>
            </button>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{project.name}</h2>
              {summary && getOverallBadge(summary.overallStatus)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              LINE 官方靜態貼圖規格檢查器 (依據 LINE Creators Market 2026 最新官方指南)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 重新檢查按鈕 */}
          <button
            onClick={runValidation}
            disabled={isValidating}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all disabled:opacity-50"
            title="重新掃描所有圖片"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{isValidating ? '檢查中...' : '重新檢查'}</span>
          </button>

          {/* 匯出檢查報告下拉選單 */}
          <div className="relative">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              disabled={!summary || isValidating}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>匯出檢查報告</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-20 animate-scale-up">
                <button
                  onClick={handleExportJson}
                  className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>完整 JSON 報告</span>
                </button>
                <button
                  onClick={handleExportCsv}
                  className="w-full px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>貼圖清單 CSV 檔</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 官方規則依據橫幅 */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
          <div className="text-emerald-900 leading-relaxed">
            <span className="font-bold">官方規格標準：</span>
            靜態貼圖最大 370 × 320 px (偶數寬高)、單張 &lt; 1MB、去背透明 PNG；張數需為 8 / 16 / 24 / 32 / 40 張；ZIP 包 &lt; 60MB。
          </div>
        </div>
        <a
          href="https://creator.line.me/zh-hant/guideline/sticker/"
          target="_blank"
          rel="noreferrer"
          className="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
        >
          <span>查看 LINE 官方準則</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {isValidating && !summary ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 text-emerald-600 animate-spin" />
          <p className="text-sm font-bold text-slate-700">正在逐張掃描圖片二進位簽章與像素透明通道...</p>
          <p className="text-xs text-slate-400 mt-1">請稍候，系統正依據 LINE Creators Market 官方準則精確檢驗中</p>
        </div>
      ) : summary ? (
        <>
          {/* 專案檢查總結面板 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 block">貼圖張數進度</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-xl font-black ${
                  summary.currentStickerCount === summary.targetCount ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {summary.currentStickerCount}
                </span>
                <span className="text-xs text-slate-400">/ {summary.targetCount} 張</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 block">通過檢查點</span>
              <span className="text-xl font-black text-emerald-600 mt-1 block">
                {summary.passChecksCount}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 block">強制錯誤</span>
              <span className={`text-xl font-black mt-1 block ${summary.errorChecksCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                {summary.errorChecksCount}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 block">建議與警告</span>
              <span className={`text-xl font-black mt-1 block ${summary.warningChecksCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                {summary.warningChecksCount}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 block">無法自動判定</span>
              <span className="text-xl font-black text-slate-600 mt-1 block">
                {summary.uncertainChecksCount}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 block">圖片總容量</span>
              <span className="text-sm font-mono font-bold text-slate-800 mt-1 block truncate">
                {formatBytes(summary.totalSizeBytes)} <span className="text-[10px] text-slate-400">(&lt;60MB)</span>
              </span>
            </div>
          </div>

          {/* 專案層級問題警示列表 */}
          {(summary.projectLevelIssues.length > 0 || !summary.mainImageStatus.isConfigured || !summary.tabImageStatus.isConfigured) && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>專案整體規格警示與待辦事項</span>
              </h3>

              <div className="space-y-2">
                {summary.projectLevelIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 ${
                      issue.status === 'error'
                        ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                        : 'bg-amber-50/80 border-amber-200 text-amber-900'
                    }`}
                  >
                    {issue.status === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="font-bold">{issue.title}</div>
                      <div className="mt-0.5 text-slate-600">{issue.message}</div>
                      <div className="mt-1 font-medium text-slate-700">💡 建議：{issue.suggestion}</div>
                    </div>
                  </div>
                ))}

                {/* 主圖狀態 */}
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-3 ${
                  summary.mainImageStatus.isConfigured
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">主要圖片 (Main Image 240 × 240 px)：</span>
                    <span>{summary.mainImageStatus.message}</span>
                  </div>
                </div>

                {/* 標籤圖狀態 */}
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-3 ${
                  summary.tabImageStatus.isConfigured
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">聊天室標籤圖 (Tab Image 96 × 74 px)：</span>
                    <span>{summary.tabImageStatus.message}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 逐張圖片檢查結果區塊 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* 標題與篩選列 */}
            <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">逐張貼圖檢測清單</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                  共 {summary.images.length} 張
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* 篩選按鈕組 */}
                <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-semibold">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      filterType === 'all' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    全部 ({summary.images.length})
                  </button>
                  <button
                    onClick={() => setFilterType('errors')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      filterType === 'errors' ? 'bg-rose-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-rose-600'
                    }`}
                  >
                    錯誤 ({summary.images.filter((i) => i.overallStatus === 'error').length})
                  </button>
                  <button
                    onClick={() => setFilterType('warnings')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      filterType === 'warnings' ? 'bg-amber-500 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-amber-600'
                    }`}
                  >
                    警告 ({summary.images.filter((i) => i.overallStatus === 'warning').length})
                  </button>
                  <button
                    onClick={() => setFilterType('passes')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      filterType === 'passes' ? 'bg-emerald-600 text-white shadow-sm font-bold' : 'text-slate-600 hover:text-emerald-600'
                    }`}
                  >
                    合格 ({summary.images.filter((i) => i.overallStatus === 'pass').length})
                  </button>
                </div>

                <button
                  onClick={expandAllIssues}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1 hover:bg-slate-200/80 rounded-lg transition-colors"
                >
                  展開問題項目
                </button>
              </div>
            </div>

            {/* 清單項目 */}
            {filteredImages.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                {images.length === 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-slate-600">專案中目前尚無匯入任何圖片</p>
                    <button
                      onClick={onBackToWorkspace}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#06C755] hover:bg-[#05B04B] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>前往工作區匯入圖片</span>
                    </button>
                  </div>
                ) : (
                  '無符合目前篩選條件的圖片'
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredImages.map((img: SingleImageValidation) => {
                  const isExpanded = expandedImageIds.has(img.imageId);
                  const seqNum = String(img.orderIndex + 1).padStart(2, '0');

                  return (
                    <div key={img.imageId} className="p-4 hover:bg-slate-50/70 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* 左側：縮圖與檔案資訊 */}
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* 縮圖 */}
                          <div
                            className="w-14 h-14 rounded-xl border border-slate-200 flex-shrink-0 p-1 flex items-center justify-center overflow-hidden bg-slate-100"
                            style={{
                              backgroundImage:
                                'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
                              backgroundSize: '12px 12px',
                              backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                            }}
                          >
                            <img
                              src={imageUrlMap[img.imageId]}
                              alt={img.displayName}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                #{seqNum}
                              </span>
                              <h4 className="font-bold text-sm text-slate-800 truncate" title={img.displayName}>
                                {img.displayName}
                              </h4>
                              {img.overallStatus === 'pass' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  全部合格
                                </span>
                              )}
                              {img.overallStatus === 'error' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                                  {img.errorCount} 項錯誤
                                </span>
                              )}
                              {img.overallStatus === 'warning' && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  {img.warningCount} 項建議
                                </span>
                              )}
                            </div>

                            {/* 關鍵規格標籤 */}
                            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500 font-mono">
                              <span className={`px-1.5 py-0.5 rounded border ${
                                img.isRealPng ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-rose-50 border-rose-200 text-rose-700 font-bold'
                              }`}>
                                {img.realFormat}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded border ${
                                img.actualWidth <= 370 && img.actualHeight <= 320 && img.actualWidth % 2 === 0 && img.actualHeight % 2 === 0
                                  ? 'bg-slate-50 border-slate-200 text-slate-700'
                                  : 'bg-rose-50 border-rose-200 text-rose-700 font-bold'
                              }`}>
                                {img.actualWidth} × {img.actualHeight} px
                              </span>
                              <span className={`px-1.5 py-0.5 rounded border ${
                                img.actualSizeBytes <= 1024 * 1024
                                  ? 'bg-slate-50 border-slate-200 text-slate-700'
                                  : 'bg-rose-50 border-rose-200 text-rose-700 font-bold'
                              }`}>
                                {formatBytes(img.actualSizeBytes)}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded border ${
                                img.hasAlphaChannel
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-rose-50 border-rose-200 text-rose-700 font-bold'
                              }`}>
                                {img.hasAlphaChannel ? `透明 (${img.transparentRatio}%)` : '無透明底色'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 右側：展開細項按鈕與前往工作區 */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={onBackToWorkspace}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            前往替換圖片
                          </button>
                          <button
                            onClick={() => toggleExpand(img.imageId)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <span>{isExpanded ? '收合細項' : '詳細檢查'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* 展開之檢查細項清單 */}
                      {isExpanded && (
                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs bg-slate-50/60 p-3.5 rounded-xl">
                          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                            官方靜態貼圖規則檢查明細
                          </div>

                          {img.details.map((detail) => (
                            <div
                              key={detail.id}
                              className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${
                                detail.status === 'pass'
                                  ? 'bg-white border-emerald-100 text-slate-700'
                                  : detail.status === 'error'
                                  ? 'bg-rose-50/80 border-rose-200 text-rose-950 font-medium'
                                  : detail.status === 'warning'
                                  ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                                  : 'bg-slate-100 border-slate-200 text-slate-600'
                              }`}
                            >
                              {detail.status === 'pass' && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                              )}
                              {detail.status === 'error' && (
                                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                              )}
                              {detail.status === 'warning' && (
                                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              )}
                              {detail.status === 'uncertain' && (
                                <HelpCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                              )}

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold">{detail.name}</span>
                                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-200/60 text-slate-600">
                                    {detail.isMandatory ? '官方強制' : '品質建議'}
                                  </span>
                                </div>
                                <div className="text-slate-600 mt-0.5 leading-relaxed">{detail.message}</div>
                                {detail.suggestion && (
                                  <div className="text-xs text-slate-800 font-medium mt-1">
                                    💡 修正建議：{detail.suggestion}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};
