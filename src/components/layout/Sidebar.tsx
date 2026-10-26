import React from 'react';
import { 
  LayoutDashboard, 
  FolderKanban, 
  Images, 
  Eye, 
  ShieldCheck, 
  Download, 
  Settings,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import type { StickerProject } from '../../types/project';

export type NavTab = 
  | 'dashboard' 
  | 'projects' 
  | 'workspace' 
  | 'preview' 
  | 'validator' 
  | 'exporter' 
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeProject: StickerProject | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeProject,
}) => {
  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    requiresProject?: boolean;
    badge?: string;
  }> = [
    { id: 'dashboard', label: '首頁儀表板', icon: LayoutDashboard },
    { id: 'projects', label: '所有專案', icon: FolderKanban },
    { id: 'workspace', label: '圖片工作區', icon: Images, requiresProject: true },
    { id: 'preview', label: '商品預覽', icon: Eye, requiresProject: true },
    { id: 'validator', label: '規格檢查', icon: ShieldCheck, requiresProject: true },
    { id: 'exporter', label: '匯出中心', icon: Download, requiresProject: true },
    { id: 'settings', label: '設定與備份', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 select-none shadow-xl border-r border-slate-800">
      {/* 軟體 Logo 與標題 */}
      <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-800/80 bg-slate-950/40">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#05B04B] to-[#06C755] flex items-center justify-center text-white shadow-md shadow-[#06C755]/20">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wide text-white">LINE Sticker Studio</h1>
          <p className="text-[11px] text-slate-400 font-medium">貼圖專案管理工具</p>
        </div>
      </div>

      {/* 目前選取的活動專案狀態卡 */}
      <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/60">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
          <span>目前專案</span>
          {activeProject && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#06C755]/10 text-[#06C755] font-bold">
              {activeProject.targetCount} 張
            </span>
          )}
        </div>
        {activeProject ? (
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <div className="w-7 h-7 rounded-lg bg-[#06C755]/20 text-[#06C755] flex items-center justify-center font-bold text-xs">
              {activeProject.name.slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{activeProject.name}</p>
              <p className="text-[11px] text-slate-400 truncate">
                {activeProject.characterName || '未指定角色'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-2 rounded-xl bg-slate-800/40 border border-dashed border-slate-700 text-center">
            <p className="text-xs text-slate-400">尚未選取專案</p>
          </div>
        )}
      </div>

      {/* 導覽功能選單 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          const isDisabled = item.requiresProject && !activeProject;

          return (
            <button
              key={item.id}
              disabled={isDisabled}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#06C755] text-white shadow-md shadow-[#06C755]/25 font-semibold'
                  : isDisabled
                  ? 'text-slate-600 cursor-not-allowed hover:bg-transparent opacity-60'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {isActive ? (
                <ChevronRight className="w-4 h-4 text-white/80" />
              ) : item.requiresProject && !activeProject ? (
                <span className="text-[10px] text-slate-500">需專案</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* 底部環境與安全宣告 */}
      <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/30 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>純本機運作 (IndexedDB)</span>
        </div>
        <p className="mt-1 text-[10px] text-slate-400 leading-tight">
          無任何雲端上傳，原圖安全保障
        </p>
      </div>
    </aside>
  );
};
