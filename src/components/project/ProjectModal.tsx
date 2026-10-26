import React, { useState, useEffect } from 'react';
import { X, Sparkles, FolderPlus, Edit3 } from 'lucide-react';
import type { StickerProject, StickerCount, ProjectStatus } from '../../types/project';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    characterName: string;
    characterDescription: string;
    targetCount: StickerCount;
    status: ProjectStatus;
    notes: string;
  }) => Promise<void>;
  initialData?: StickerProject | null;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const [name, setName] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [characterDescription, setCharacterDescription] = useState('');
  const [targetCount, setTargetCount] = useState<StickerCount>(16);
  const [status, setStatus] = useState<ProjectStatus>('draft');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setCharacterName(initialData.characterName || '');
      setCharacterDescription(initialData.characterDescription || '');
      setTargetCount(initialData.targetCount || 16);
      setStatus(initialData.status || 'draft');
      setNotes(initialData.notes || '');
    } else {
      setName('');
      setCharacterName('');
      setCharacterDescription('');
      setTargetCount(16);
      setStatus('draft');
      setNotes('');
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('請輸入專案名稱');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        characterName: characterName.trim(),
        characterDescription: characterDescription.trim(),
        targetCount,
        status,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存專案失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  const countOptions: StickerCount[] = [8, 16, 24, 32, 40];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal 標頭 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#06C755]/10 text-[#06C755] flex items-center justify-center font-bold">
              {initialData ? <Edit3 className="w-5 h-5" /> : <FolderPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {initialData ? '編輯貼圖專案' : '新增 LINE 貼圖專案'}
              </h3>
              <p className="text-xs text-slate-500">依據 LINE Creators Market 官方規格建立與管理</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表單內容 */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              專案名稱 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：柴犬小橘日常篇 Vol.1"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">主要角色名稱</label>
              <input
                type="text"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="例如：小橘"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">製作狀態</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent transition-all bg-white"
              >
                <option value="draft">草稿構想</option>
                <option value="in_progress">進行製作中</option>
                <option value="completed">製作完成</option>
                <option value="archived">已封存歸檔</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">官方規格目標張數</label>
            <div className="grid grid-cols-5 gap-2">
              {countOptions.map((cnt) => (
                <button
                  type="button"
                  key={cnt}
                  onClick={() => setTargetCount(cnt)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    targetCount === cnt
                      ? 'bg-[#06C755] text-white border-[#06C755] shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cnt} 張
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              LINE 官方支援規格：8、16、24、32 或 40 張（另需 1 張主圖與 1 張標籤圖）
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">角色特徵或風格描述</label>
            <textarea
              rows={2}
              value={characterDescription}
              onChange={(e) => setCharacterDescription(e.target.value)}
              placeholder="例如：溫暖療癒的黃金獵犬，帶有淡水彩筆觸與日常生活對白..."
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">內部備註 (僅供本機管理，不會上傳官方)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="預計上架目標檔期、繪圖軟體版本、圖層檔案存放路徑等..."
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#06C755] focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* 底部動作 */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#06C755] hover:bg-[#05B04B] rounded-xl shadow-md shadow-[#06C755]/20 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSubmitting ? '儲存中...' : initialData ? '確認更新' : '建立專案'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
