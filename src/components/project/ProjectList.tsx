import React, { useState } from 'react';
import { 
  FolderPlus, 
  Search, 
  Copy, 
  Archive, 
  Trash2, 
  Edit3, 
  ArrowRight, 
  Calendar,
  Image as ImageIcon
} from 'lucide-react';
import type { StickerProject } from '../../types/project';

interface ProjectListProps {
  projects: StickerProject[];
  projectImageCounts: Record<string, number>;
  onSelectProject: (project: StickerProject) => void;
  onOpenCreateModal: () => void;
  onOpenEditModal: (project: StickerProject) => void;
  onDuplicateProject: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onRequestDelete: (project: StickerProject) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  projectImageCounts,
  onSelectProject,
  onOpenCreateModal,
  onOpenEditModal,
  onDuplicateProject,
  onToggleArchive,
  onRequestDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredProjects = projects.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.characterName && p.characterName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status: StickerProject['status']) => {
    switch (status) {
      case 'draft':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">草稿</span>;
      case 'in_progress':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800">製作中</span>;
      case 'completed':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">已完成</span>;
      case 'archived':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-700">已封存</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* 頂部操作與過濾列 */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋專案名稱或角色..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:bg-white transition-all"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#06C755] font-medium text-slate-700"
          >
            <option value="all">所有狀態</option>
            <option value="draft">草稿</option>
            <option value="in_progress">製作中</option>
            <option value="completed">已完成</option>
            <option value="archived">已封存</option>
          </select>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#06C755] hover:bg-[#05B04B] text-white text-sm font-bold rounded-xl shadow-md shadow-[#06C755]/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <FolderPlus className="w-4 h-4" />
          <span>新增貼圖專案</span>
        </button>
      </div>

      {/* 專案卡片列表 */}
      {filteredProjects.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
            <FolderPlus className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-slate-700 mb-1">
            {searchTerm || filterStatus !== 'all' ? '找不到符合條件的專案' : '目前尚無貼圖專案'}
          </h4>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
            點擊下方按鈕建立第一組 LINE 貼圖專案，開始匯入手繪或製圖工具完成的素材。
          </p>
          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#06C755] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-[#05B04B] transition-all"
          >
            <FolderPlus className="w-4 h-4" />
            <span>建立新專案</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredProjects.map((p) => {
            const currentCount = projectImageCounts[p.id] || 0;
            const progressPct = Math.min(100, Math.round((currentCount / p.targetCount) * 100));

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group hover:border-[#06C755]/40"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h4 className="font-bold text-slate-900 group-hover:text-[#06C755] transition-colors line-clamp-1">
                        {p.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {p.characterName ? `角色：${p.characterName}` : '未指定角色'}
                      </p>
                    </div>
                    {getStatusBadge(p.status)}
                  </div>

                  {p.characterDescription && (
                    <p className="text-xs text-slate-600 line-clamp-2 mt-2 leading-relaxed bg-slate-50 p-2 rounded-lg">
                      {p.characterDescription}
                    </p>
                  )}

                  {/* 貼圖張數進度條 */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>已匯入圖片</span>
                      </span>
                      <span className={currentCount >= p.targetCount ? 'text-emerald-600' : 'text-slate-700'}>
                        {currentCount} / {p.targetCount} 張
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          currentCount >= p.targetCount ? 'bg-emerald-500' : 'bg-[#06C755]'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(p.updatedAt).toLocaleDateString('zh-TW')} 更新</span>
                    </span>
                    <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                      ID: {p.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                {/* 卡片底部操作列 */}
                <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      title="編輯專案資訊"
                      onClick={() => onOpenEditModal(p)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      title="複製專案副本"
                      onClick={() => onDuplicateProject(p.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      title={p.status === 'archived' ? '解除封存' : '封存專案'}
                      onClick={() => onToggleArchive(p.id)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 transition-colors"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    <button
                      title="刪除專案 (僅移除管理資料，不刪除本機原圖)"
                      onClick={() => onRequestDelete(p)}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => onSelectProject(p)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-black text-white font-semibold rounded-lg text-xs transition-colors shadow-sm"
                  >
                    <span>開啟工作區</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
