import React, { useState, useEffect, useCallback } from 'react';
import { 
  Download, 
  ArrowLeft, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  FileArchive, 
  Star, 
  Bookmark, 
  ExternalLink
} from 'lucide-react';
import type { StickerProject, StickerImage } from '../../types/project';
import { getImagesByProjectId } from '../../db/repository';
import { 
  runPreExportCheck, 
  packageLineStickersZip, 
  triggerZipDownload, 
  ExportValidationReport, 
  ExportExecutionResult 
} from '../../features/exporter/lineZipPackager';
import { formatBytes } from '../../utils/imageAnalyzer';

interface ExportCenterProps {
  project: StickerProject;
  onBackToWorkspace: () => void;
  onBackToProjects: () => void;
  onGoToValidator: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const ExportCenter: React.FC<ExportCenterProps> = ({
  project,
  onBackToWorkspace,
  onBackToProjects,
  onGoToValidator,
  showToast,
}) => {
  const [images, setImages] = useState<StickerImage[]>([]);
  const [report, setReport] = useState<ExportValidationReport | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ percent: number; text: string }>({
    percent: 0,
    text: '',
  });
  const [lastResult, setLastResult] = useState<ExportExecutionResult | null>(null);

  // 載入資料並執行前置審查
  const loadAndCheck = useCallback(async () => {
    try {
      setIsChecking(true);
      setLastResult(null);
      const imgList = await getImagesByProjectId(project.id);
      setImages(imgList);

      const checkResult = await runPreExportCheck(project, imgList);
      setReport(checkResult);
    } catch (err) {
      showToast('error', `載入專案素材失敗: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsChecking(false);
    }
  }, [project, showToast]);

  useEffect(() => {
    loadAndCheck();
  }, [project.id]);

  // 執行正式上架 ZIP 打包
  const handleExportZip = async () => {
    if (!report?.canExport) {
      showToast('error', '專案尚有官方強制要求未通過，無法匯出上架素材');
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress({ percent: 5, text: '啟動 LINE 官方素材打包程序...' });

      const result = await packageLineStickersZip(project, images, (percent, stepText) => {
        setExportProgress({ percent, text: stepText });
      });

      setLastResult(result);

      if (result.success && result.zipBlob && result.filename) {
        triggerZipDownload(result.zipBlob, result.filename);
        showToast('success', `成功產生並下載「${result.filename}」`);
      } else {
        showToast('error', result.errorMessage || '打包程序失敗');
      }
    } catch (err) {
      showToast('error', `打包失敗: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const mainImage = images.find((i) => i.id === project.mainImageId);
  const tabImage = images.find((i) => i.id === project.tabImageId);

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* 頂部操作與導航列 */}
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
              title="返回圖片工作區"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>圖片工作區</span>
            </button>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <FileArchive className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">{project.name}</h2>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                LINE 上架素材匯出中心
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              依據 LINE Creators Market 官方規則進行 10 項前置防呆檢驗，並封裝符合命名慣例的純淨上架 ZIP
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAndCheck}
            disabled={isChecking || isExporting}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            title="重新掃描最新素材狀態"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-emerald-600' : ''}`} />
            <span>重新檢查</span>
          </button>

          <button
            onClick={onGoToValidator}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>規格檢查報告</span>
          </button>
        </div>
      </div>

      {/* 官方規則提示橫幅 */}
      <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-start gap-2.5 text-sky-950">
          <FileArchive className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">官方上架 ZIP 結構規範：</span>
            包含主圖 <code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">main.png</code> (240×240)、標籤圖 <code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">tab.png</code> (96×74) 及依序編號之 <code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">01.png</code> ~ <code className="bg-sky-100 px-1 py-0.5 rounded font-mono font-bold">{String(project.targetCount).padStart(2, '0')}.png</code>。任何雜檔均不得混入。
          </div>
        </div>
        <a
          href="https://creator.line.me/zh-hant/guideline/sticker/"
          target="_blank"
          rel="noreferrer"
          className="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold text-sky-700 hover:text-sky-900 hover:underline"
        >
          <span>官方準則</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {isChecking ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 text-emerald-600 animate-spin" />
          <p className="text-sm font-bold text-slate-700">正在執行匯出前 10 項官方條件檢驗...</p>
        </div>
      ) : report ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側 2 欄：素材現狀與檢驗清單 */}
          <div className="lg:col-span-2 space-y-5">
            {/* 核心狀態指標 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-500 block">貼圖數量</span>
                <span className={`text-xl font-black mt-1 block ${
                  report.checkedStickersCount === report.targetCount ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {report.checkedStickersCount} / {report.targetCount}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-500 block">主要圖片 (main.png)</span>
                <span className={`text-sm font-bold mt-2 block ${
                  report.hasMainImage ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {report.hasMainImage ? '已指定 (240×240)' : '尚未指定'}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-500 block">標籤圖片 (tab.png)</span>
                <span className={`text-sm font-bold mt-2 block ${
                  report.hasTabImage ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {report.hasTabImage ? '已指定 (96×74)' : '尚未指定'}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <span className="text-[11px] font-semibold text-slate-500 block">預估總容量</span>
                <span className="text-sm font-mono font-bold text-slate-800 mt-2 block">
                  {formatBytes(report.totalEstimatedBytes)} <span className="text-[10px] text-slate-400">(&lt;60MB)</span>
                </span>
              </div>
            </div>

            {/* 必要條件審核清單 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-700" />
                  <h3 className="text-sm font-bold text-slate-900">匯出前 10 項必要條件審核</h3>
                </div>
                {report.canExport ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>全部符合官方上架要求</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>未達上架標準 (禁止匯出)</span>
                  </span>
                )}
              </div>

              {/* 錯誤清單 */}
              {report.errors.length > 0 && (
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>發現 {report.errors.length} 項官方強制錯誤（必須修正才能打包上架）：</span>
                  </div>

                  <div className="space-y-2">
                    {report.errors.map((err) => (
                      <div
                        key={err.id}
                        className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950 space-y-1"
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>{err.name}</span>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-200/80 text-rose-900">
                            阻擋匯出
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{err.message}</p>
                        {err.suggestion && (
                          <p className="text-slate-900 font-medium">💡 修正建議：{err.suggestion}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 通過清單摘要 */}
              {report.canExport && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>恭喜！專案素材已完全通過 LINE Creators Market 官方靜態貼圖規範：</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
                    <li>貼圖張數符合目標 {report.targetCount} 張（官方合法張數選項）。</li>
                    <li>主要圖片 (main.png) 尺寸精確符合 240 × 240 px。</li>
                    <li>聊天室標籤圖 (tab.png) 尺寸精確符合 96 × 74 px。</li>
                    <li>所有圖片尺寸寬度與高度皆為偶數，且在 370 × 320 px 規範內。</li>
                    <li>單張檔案大小均在 1MB 以下，且具備透明通道。</li>
                    <li>預估 ZIP 壓縮包總容量遠低於 60MB 上限。</li>
                  </ul>
                </div>
              )}
            </div>

            {/* 主圖與標籤圖預覽與指定狀態 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-900">特殊素材配置說明</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className={`p-3.5 rounded-xl border ${
                  mainImage ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
                    <Star className="w-4 h-4 text-amber-500" />
                    <span>主要圖片 (main.png)</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    {mainImage
                      ? `已指定「${mainImage.customName || mainImage.originalName || '未命名圖片'}」(${mainImage.width}×${mainImage.height} px)`
                      : '尚未指定。官方要求尺寸必須為 240 × 240 px。請回到圖片工作區為特定圖片點選星號指定。'}
                  </p>
                </div>

                <div className={`p-3.5 rounded-xl border ${
                  tabImage ? 'bg-sky-50/50 border-sky-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2 font-bold text-slate-800 mb-1">
                    <Bookmark className="w-4 h-4 text-sky-500" />
                    <span>聊天室標籤圖 (tab.png)</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    {tabImage
                      ? `已指定「${tabImage.customName || tabImage.originalName || '未命名圖片'}」(${tabImage.width}×${tabImage.height} px)`
                      : '尚未指定。官方要求尺寸必須為 96 × 74 px。請回到圖片工作區為特定圖片點選書籤指定。'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 右側 1 欄：打包操作卡片與進度 */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5 sticky top-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">打包 LINE 上架 ZIP</h3>
                <p className="text-xs text-slate-500 mt-1">
                  將依官方規定產生 main.png, tab.png 及 01.png~{String(project.targetCount).padStart(2, '0')}.png。
                </p>
              </div>

              {/* 進度顯示 */}
              {isExporting && (
                <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>{exportProgress.text}</span>
                    <span className="font-mono">{exportProgress.percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#06C755] transition-all duration-200 rounded-full"
                      style={{ width: `${exportProgress.percent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 打包按鈕 */}
              <button
                onClick={handleExportZip}
                disabled={!report.canExport || isExporting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-[#06C755] hover:bg-[#05B04B] shadow-lg shadow-[#06C755]/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>正在封裝與校驗 ZIP...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>{report.canExport ? '開始打包並下載 ZIP' : '尚未符合上架規範 (無法匯出)'}</span>
                  </>
                )}
              </button>

              {!report.canExport && (
                <p className="text-xs text-slate-500 text-center leading-relaxed">
                  請先修正左側列出之官方強制錯誤，系統將自動解鎖打包功能。
                </p>
              )}

              {/* 匯出結果面板 */}
              {lastResult && (
                <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                  lastResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                }`}>
                  <div className="font-bold flex items-center gap-1.5 text-slate-900">
                    {lastResult.success ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>ZIP 封裝與二次驗證成功！</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span>打包失敗</span>
                      </>
                    )}
                  </div>

                  {lastResult.success && (
                    <div className="space-y-1 text-slate-700">
                      <div>檔案名稱：<span className="font-mono font-semibold">{lastResult.filename}</span></div>
                      <div>包含檔案：<span className="font-bold">{lastResult.totalFiles} 個</span>（含 main.png、tab.png 與 {lastResult.totalFiles - 2} 張貼圖）</div>
                      <div>壓縮容量：<span className="font-mono">{formatBytes(lastResult.totalSizeBytes)}</span></div>
                      <div className="pt-2 border-t border-emerald-200/60 text-[11px] text-emerald-900 font-medium leading-relaxed">
                        ⚠️ 聲明：ZIP 已成功產生並通過 JSZip 完整性檢驗，此不代表 LINE 官方已通過審核，實際審核結果以 LINE Creators Market 為準。
                      </div>
                    </div>
                  )}

                  {!lastResult.success && (
                    <div className="text-rose-900 whitespace-pre-line leading-relaxed">
                      {lastResult.errorMessage}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
