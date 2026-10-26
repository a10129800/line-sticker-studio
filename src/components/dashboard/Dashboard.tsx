import React from 'react';
import { 
  FolderKanban, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  FolderPlus, 
  ArrowRight,
  Sparkles,
  Calendar,
  ShieldCheck,
  Download
} from 'lucide-react';
import type { StickerProject } from '../../types/project';

interface DashboardProps {
  projects: StickerProject[];
  projectImageCounts: Record<string, number>;
  onSelectProject: (project: StickerProject) => void;
  onOpenCreateModal: () => void;
  onGoToProjects: () => void;
  onInspectSpecs?: (project: StickerProject) => void;
  onGoToExporter?: (project: StickerProject) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  projects,
  projectImageCounts,
  onSelectProject,
  onOpenCreateModal,
  onGoToProjects,
  onInspectSpecs,
  onGoToExporter,
}) => {
  const totalCount = projects.length;
  const inProgressCount = projects.filter((p) => p.status === 'in_progress' || p.status === 'draft').length;
  const completedCount = projects.filter((p) => p.status === 'completed').length;
  
  // 尚未達到官方張數要求的專案
  const specPendingCount = projects.filter((p) => {
    const imgCount = projectImageCounts[p.id] || 0;
    return imgCount < p.targetCount;
  }).length;

  const recentProjects = [...projects]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 4);

  return (
    <div className="space-y-6">
      {/* 歡迎橫幅 */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#06C755]/20 text-[#06C755] text-xs font-bold mb-4 border border-[#06C755]/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>LINE Creators Market 貼圖上架整備工具</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            歡迎使用 LINE Sticker Studio
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            純本機高安全性管理。輕鬆組織多組手繪與製圖完成的靜態貼圖、即時檢查 LINE 官方尺寸與透明規範，一鍵產出合格上架 ZIP 檔案。
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#06C755] hover:bg-[#05B04B] text-white text-xs font-bold rounded-xl shadow-lg shadow-[#06C755]/25 transition-all hover:scale-[1.02]"
            >
              <FolderPlus className="w-4 h-4" />
              <span>建立新專案</span>
            </button>
            <button
              onClick={onGoToProjects}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
            >
              <span>查看所有專案</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 統計指標卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">貼圖專案總數</p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{totalCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <FolderKanban className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">製作進行中</p>
            <h3 className="text-2xl font-black text-sky-600 mt-1">{inProgressCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">製作完成</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{completedCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">待補足張數專案</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{specPendingCount}</h3>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 最近編輯專案 */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">最近編輯的貼圖專案</h3>
          <button
            onClick={onGoToProjects}
            className="text-xs font-semibold text-[#06C755] hover:underline flex items-center gap-1"
          >
            <span>全部清單</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentProjects.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">
            尚未有專案資料，點擊上方按鈕建立您的第一組貼圖。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentProjects.map((p) => {
              const currentImgCount = projectImageCounts[p.id] || 0;
              return (
                <div
                  key={p.id}
                  onClick={() => onSelectProject(p)}
                  className="p-4 rounded-xl border border-slate-200 hover:border-[#06C755] hover:shadow-sm cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-slate-800 text-sm group-hover:text-[#06C755] transition-colors truncate">
                      {p.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {p.characterName ? `角色：${p.characterName}` : '未指定角色'} • 目標 {p.targetCount} 張
                    </p>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(p.updatedAt).toLocaleDateString('zh-TW')} 更新</span>
                    </div>
                  </div>

                  <div className="text-right pl-4 flex flex-col items-end gap-1.5">
                    <div>
                      <span className="text-xs font-mono font-bold text-slate-700 block">
                        {currentImgCount} / {p.targetCount}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">圖片進度</span>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onInspectSpecs && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onInspectSpecs(p);
                          }}
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all text-xs font-semibold flex items-center gap-1"
                          title="直接檢查此專案規格"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span className="text-[11px]">規格</span>
                        </button>
                      )}
                      {onGoToExporter && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onGoToExporter(p);
                          }}
                          className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all text-xs font-semibold flex items-center gap-1"
                          title="前往打包匯出 ZIP"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="text-[11px]">匯出</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
