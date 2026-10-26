import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { ProjectList } from './components/project/ProjectList';
import { ImageWorkspace } from './components/workspace/ImageWorkspace';
import { SpecificationChecker } from './components/spec-checker/SpecificationChecker';
import { ExportCenter } from './components/exporter/ExportCenter';
import { ProjectModal } from './components/project/ProjectModal';
import { ConfirmDialog } from './components/common/ConfirmDialog';
import { ToastContainer, ToastMessage, ToastType } from './components/common/Toast';
import type { StickerProject, StickerCount, ProjectStatus } from './types/project';
import { 
  getAllProjects, 
  createProject, 
  updateProject, 
  duplicateProject, 
  toggleArchiveProject, 
  deleteProject,
  generateUUID 
} from './db/repository';
import { db } from './db/index';
import { Layers, ShieldCheck, Download, Settings as SettingsIcon } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [projects, setProjects] = useState<StickerProject[]>([]);
  const [projectImageCounts, setProjectImageCounts] = useState<Record<string, number>>({});
  const [activeProject, setActiveProject] = useState<StickerProject | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal 狀態
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<StickerProject | null>(null);

  // 刪除專案確認狀態
  const [projectToDelete, setProjectToDelete] = useState<StickerProject | null>(null);

  // Toast 狀態
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = generateUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 載入所有專案與各專案圖片計數
  const loadProjectData = useCallback(async () => {
    try {
      const list = await getAllProjects();
      setProjects(list);

      // 計算每個專案目前儲存的圖片數量
      const counts: Record<string, number> = {};
      for (const p of list) {
        const c = await db.images.where('projectId').equals(p.id).count();
        counts[p.id] = c;
      }
      setProjectImageCounts(counts);

      // 同步更新當前選取中的 activeProject
      if (activeProject) {
        const updatedActive = list.find((p) => p.id === activeProject.id);
        if (updatedActive) {
          setActiveProject(updatedActive);
        } else {
          setActiveProject(null);
        }
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '載入專案資料庫失敗');
    } finally {
      setLoading(false);
    }
  }, [activeProject, showToast]);

  useEffect(() => {
    loadProjectData();
  }, []);

  // 處理專案新增/編輯提交
  const handleProjectSubmit = async (data: {
    name: string;
    characterName: string;
    characterDescription: string;
    targetCount: StickerCount;
    status: ProjectStatus;
    notes: string;
  }) => {
    if (editingProject) {
      // 編輯既有專案
      const updated = await updateProject(editingProject.id, data);
      showToast('success', `已成功更新專案「${updated.name}」`);
      if (activeProject?.id === updated.id) {
        setActiveProject(updated);
      }
    } else {
      // 新增專案
      const created = await createProject({
        ...data,
        stickerType: 'static',
      });
      showToast('success', `已建立新貼圖專案「${created.name}」`);
      setActiveProject(created);
      setCurrentTab('workspace'); // 建立完成後直接引導至圖片工作區
    }
    await loadProjectData();
  };

  // 複製專案
  const handleDuplicate = async (id: string) => {
    try {
      const dup = await duplicateProject(id);
      showToast('success', `已複製專案副本「${dup.name}」`);
      await loadProjectData();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '複製專案失敗');
    }
  };

  // 封存專案
  const handleToggleArchive = async (id: string) => {
    try {
      const updated = await toggleArchiveProject(id);
      showToast(
        'info',
        updated.status === 'archived' ? `專案「${updated.name}」已封存` : `專案「${updated.name}」已解除封存`
      );
      await loadProjectData();
    } catch (err) {
      showToast('error', '變更封存狀態失敗');
    }
  };

  // 刪除專案確認執行
  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      const deletedName = projectToDelete.name;
      await deleteProject(projectToDelete.id);
      if (activeProject?.id === projectToDelete.id) {
        setActiveProject(null);
        setCurrentTab('projects');
      }
      showToast('success', `已自資料庫刪除專案「${deletedName}」`);
      setProjectToDelete(null);
      await loadProjectData();
    } catch (err) {
      showToast('error', '刪除專案失敗');
    }
  };

  // 選擇並進入某專案的工作區
  const handleSelectProject = (project: StickerProject) => {
    setActiveProject(project);
    setCurrentTab('workspace');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100/70 text-slate-800">
      {/* 左側功能選單 */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => setCurrentTab(tab)}
        activeProject={activeProject}
      />

      {/* 右側主要工作區域 */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* 頂部全域狀態欄 */}
        <header className="h-16 px-8 bg-white border-b border-slate-200/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              V1.0 開發階段
            </span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs text-slate-500 font-medium">
              {currentTab === 'dashboard' && '儀表板總覽'}
              {currentTab === 'projects' && '專案清單管理'}
              {currentTab === 'workspace' && `貼圖圖片工作區 — ${activeProject?.name || ''}`}
              {currentTab === 'preview' && '商品預覽工作室 (第四階段模組)'}
              {currentTab === 'validator' && `官方規格檢查器 — ${activeProject?.name || ''}`}
              {currentTab === 'exporter' && 'LINE 上架素材打包 — ' + (activeProject?.name || '')}
              {currentTab === 'settings' && '系統備份與還原'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <div className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>IndexedDB 就緒</span>
            </div>
          </div>
        </header>

        {/* 頁面主要內容 */}
        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              載入本機專案資料中...
            </div>
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <Dashboard
                  projects={projects}
                  projectImageCounts={projectImageCounts}
                  onSelectProject={handleSelectProject}
                  onOpenCreateModal={() => {
                    setEditingProject(null);
                    setIsProjectModalOpen(true);
                  }}
                  onGoToProjects={() => setCurrentTab('projects')}
                  onInspectSpecs={(p) => {
                    setActiveProject(p);
                    setCurrentTab('validator');
                  }}
                  onGoToExporter={(p) => {
                    setActiveProject(p);
                    setCurrentTab('exporter');
                  }}
                />
              )}

              {currentTab === 'projects' && (
                <ProjectList
                  projects={projects}
                  projectImageCounts={projectImageCounts}
                  onSelectProject={handleSelectProject}
                  onOpenCreateModal={() => {
                    setEditingProject(null);
                    setIsProjectModalOpen(true);
                  }}
                  onOpenEditModal={(p) => {
                    setEditingProject(p);
                    setIsProjectModalOpen(true);
                  }}
                  onDuplicateProject={handleDuplicate}
                  onToggleArchive={handleToggleArchive}
                  onRequestDelete={(p) => setProjectToDelete(p)}
                />
              )}

              {currentTab === 'workspace' && activeProject && (
                <ImageWorkspace
                  project={activeProject}
                  onBack={() => setCurrentTab('projects')}
                  showToast={showToast}
                  onImagesUpdated={loadProjectData}
                  onGoToValidator={() => setCurrentTab('validator')}
                  onGoToExporter={() => setCurrentTab('exporter')}
                  onProjectUpdated={(p) => setActiveProject(p)}
                />
              )}

              {currentTab === 'validator' && (
                activeProject ? (
                  <SpecificationChecker
                    project={activeProject}
                    onBackToWorkspace={() => setCurrentTab('workspace')}
                    onBackToProjects={() => setCurrentTab('projects')}
                    showToast={showToast}
                  />
                ) : (
                  <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center max-w-md mx-auto my-12 shadow-sm space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800">尚未選取貼圖專案</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        規格檢查需針對特定專案的所有貼圖進行掃描，請先選擇一組專案。
                      </p>
                    </div>
                    <button
                      onClick={() => setCurrentTab('projects')}
                      className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-colors"
                    >
                      前往所有專案選擇
                    </button>
                  </div>
                )
              )}

              {currentTab === 'exporter' && (
                activeProject ? (
                  <ExportCenter
                    project={activeProject}
                    onBackToWorkspace={() => setCurrentTab('workspace')}
                    onBackToProjects={() => setCurrentTab('projects')}
                    onGoToValidator={() => setCurrentTab('validator')}
                    showToast={showToast}
                  />
                ) : (
                  <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center max-w-md mx-auto my-12 shadow-sm space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                      <Download className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-800">尚未選取貼圖專案</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        匯出官方上架素材前，請先選擇要打包的貼圖專案。
                      </p>
                    </div>
                    <button
                      onClick={() => setCurrentTab('projects')}
                      className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                      前往所有專案選擇
                    </button>
                  </div>
                )
              )}

              {/* 未來模組準備中提示 */}
              {(currentTab === 'preview' || currentTab === 'settings') && (
                <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center max-w-xl mx-auto my-8 shadow-sm">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-4">
                    {currentTab === 'preview' && <Layers className="w-8 h-8 text-sky-600" />}
                    {currentTab === 'settings' && <SettingsIcon className="w-8 h-8 text-slate-600" />}
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-2">
                    {currentTab === 'preview' && '商品預覽工作室'}
                    {currentTab === 'settings' && '專案資料備份與還原'}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-6">
                    本模組規劃於後續階段整合。目前的專案管理、圖片工作區、LINE 官方規格檢查器及素材 ZIP 打包皆已可完整使用。
                  </p>
                  <button
                    onClick={() => setCurrentTab('workspace')}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition-colors"
                  >
                    返回圖片工作區
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* 專案建立與編輯 Modal */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        initialData={editingProject}
        onClose={() => setIsProjectModalOpen(false)}
        onSubmit={handleProjectSubmit}
      />

      {/* 專案刪除確認對話框（依需求清楚說明預設只移除管理資料，不刪除本機原始圖片） */}
      <ConfirmDialog
        isOpen={!!projectToDelete}
        title="確認刪除貼圖專案"
        description={`您確定要刪除專案「${projectToDelete?.name}」嗎？`}
        note="重要提醒：此操作僅會自 LINE Sticker Studio 本機管理資料庫中移除此專案，絕不會刪除或覆寫您電腦硬碟中現有的原始圖片檔案。"
        confirmText="確認刪除專案"
        isDanger={true}
        onConfirm={handleConfirmDeleteProject}
        onCancel={() => setProjectToDelete(null)}
      />

      {/* 全域 Toast 訊息列 */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

export default App;
