import { db } from './index';
import type { StickerProject, StickerImage } from '../types/project';

// 友善的錯誤轉換輔助函式
function handleDbError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError') {
      return new Error('本機儲存空間不足，請清理瀏覽器快取或刪除不必要的專案。');
    }
    return new Error(`${fallbackMessage}: ${error.message}`);
  }
  return new Error(fallbackMessage);
}

// 產生安全隨機 UUID
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ========================
// 專案管理 (Project CRUD)
// ========================

export async function getAllProjects(): Promise<StickerProject[]> {
  try {
    return await db.projects.orderBy('updatedAt').reverse().toArray();
  } catch (err) {
    throw handleDbError(err, '讀取專案清單失敗');
  }
}

export async function getProjectById(id: string): Promise<StickerProject | undefined> {
  try {
    return await db.projects.get(id);
  } catch (err) {
    throw handleDbError(err, `無法讀取專案 (ID: ${id})`);
  }
}

export async function createProject(
  params: Omit<StickerProject, 'id' | 'createdAt' | 'updatedAt'>
): Promise<StickerProject> {
  try {
    const now = Date.now();
    const newProject: StickerProject = {
      ...params,
      id: generateUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await db.projects.add(newProject);
    return newProject;
  } catch (err) {
    throw handleDbError(err, '建立專案失敗');
  }
}

export async function updateProject(
  id: string,
  params: Partial<Omit<StickerProject, 'id' | 'createdAt'>>
): Promise<StickerProject> {
  try {
    const existing = await db.projects.get(id);
    if (!existing) {
      throw new Error(`找不到欲更新的專案 (ID: ${id})`);
    }

    const updated: StickerProject = {
      ...existing,
      ...params,
      updatedAt: Date.now(),
    };

    await db.projects.put(updated);
    return updated;
  } catch (err) {
    throw handleDbError(err, '更新專案失敗');
  }
}

// 複製專案（包含專案設定與複製現有貼圖圖片）
export async function duplicateProject(id: string): Promise<StickerProject> {
  try {
    const original = await db.projects.get(id);
    if (!original) {
      throw new Error('找不到欲複製的原專案');
    }

    const now = Date.now();
    const newProjectId = generateUUID();

    const newProject: StickerProject = {
      ...original,
      id: newProjectId,
      name: `${original.name} (副本)`,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      coverImageId: undefined,
    };

    // 複製原專案所有圖片
    const originalImages = await db.images.where('projectId').equals(id).toArray();
    const newImages: StickerImage[] = originalImages.map((img) => ({
      ...img,
      id: generateUUID(),
      projectId: newProjectId,
      createdAt: now,
      updatedAt: now,
    }));

    await db.transaction('rw', db.projects, db.images, async () => {
      await db.projects.add(newProject);
      if (newImages.length > 0) {
        await db.images.bulkAdd(newImages);
      }
    });

    return newProject;
  } catch (err) {
    throw handleDbError(err, '複製專案失敗');
  }
}

// 封存 / 解除封存專案
export async function toggleArchiveProject(id: string): Promise<StickerProject> {
  try {
    const project = await db.projects.get(id);
    if (!project) throw new Error('找不到專案');

    const nextStatus = project.status === 'archived' ? 'in_progress' : 'archived';
    return await updateProject(id, { status: nextStatus });
  } catch (err) {
    throw handleDbError(err, '變更專案封存狀態失敗');
  }
}

// 刪除專案：依需求僅刪除資料庫中專案與儲存的資料，不影響使用者電腦原始檔案
export async function deleteProject(id: string): Promise<void> {
  try {
    await db.transaction('rw', db.projects, db.images, db.metadata, async () => {
      await db.images.where('projectId').equals(id).delete();
      await db.metadata.where('projectId').equals(id).delete();
      await db.projects.delete(id);
    });
  } catch (err) {
    throw handleDbError(err, '刪除專案失敗');
  }
}

// ========================
// 貼圖圖片管理 (Image CRUD)
// ========================

export async function getImagesByProjectId(projectId: string): Promise<StickerImage[]> {
  try {
    const list = await db.images.where('projectId').equals(projectId).sortBy('orderIndex');
    return list;
  } catch (err) {
    throw handleDbError(err, '讀取專案圖片清單失敗');
  }
}

export async function addStickerImages(
  images: Omit<StickerImage, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<StickerImage[]> {
  try {
    const now = Date.now();
    const newItems: StickerImage[] = images.map((item) => ({
      ...item,
      id: generateUUID(),
      createdAt: now,
      updatedAt: now,
    }));

    await db.images.bulkAdd(newItems);

    // 同步更新專案修改時間
    if (newItems.length > 0) {
      await db.projects.update(newItems[0].projectId, { updatedAt: now });
    }

    return newItems;
  } catch (err) {
    throw handleDbError(err, '匯入圖片失敗');
  }
}

// 替換單張圖片內容（保留 ID 與排序位置，替換 blob 與尺寸規格）
export async function replaceStickerImage(
  imageId: string,
  newProps: Pick<StickerImage, 'blob' | 'originalName' | 'mimeType' | 'fileSize' | 'width' | 'height' | 'hasAlphaChannel'>
): Promise<StickerImage> {
  try {
    const existing = await db.images.get(imageId);
    if (!existing) {
      throw new Error(`找不到欲替換的圖片 (ID: ${imageId})`);
    }

    const now = Date.now();
    const updated: StickerImage = {
      ...existing,
      ...newProps,
      updatedAt: now,
    };

    await db.images.put(updated);
    await db.projects.update(existing.projectId, { updatedAt: now });

    return updated;
  } catch (err) {
    throw handleDbError(err, '替換圖片失敗');
  }
}

// 更新圖片資訊（自訂名稱、備註）
export async function updateStickerImageMeta(
  imageId: string,
  meta: Partial<Pick<StickerImage, 'customName' | 'notes'>>
): Promise<void> {
  try {
    const now = Date.now();
    await db.images.update(imageId, { ...meta, updatedAt: now });
  } catch (err) {
    throw handleDbError(err, '更新圖片資訊失敗');
  }
}

// 批次重新排序
export async function reorderStickerImages(
  projectId: string,
  orderedImageIds: string[]
): Promise<void> {
  try {
    const now = Date.now();
    await db.transaction('rw', db.images, db.projects, async () => {
      for (let i = 0; i < orderedImageIds.length; i++) {
        await db.images.update(orderedImageIds[i], {
          orderIndex: i,
          updatedAt: now,
        });
      }
      await db.projects.update(projectId, { updatedAt: now });
    });
  } catch (err) {
    throw handleDbError(err, '更新圖片排序失敗');
  }
}

// 移除單張圖片（並重新壓縮剩餘圖片的 orderIndex）
export async function removeStickerImage(imageId: string): Promise<void> {
  try {
    const target = await db.images.get(imageId);
    if (!target) return;

    await db.transaction('rw', db.images, db.projects, async () => {
      await db.images.delete(imageId);
      // 取得其餘圖片並重編 orderIndex
      const remaining = await db.images
        .where('projectId')
        .equals(target.projectId)
        .sortBy('orderIndex');

      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].orderIndex !== i) {
          await db.images.update(remaining[i].id, { orderIndex: i });
        }
      }

      // 清理專案關聯：若刪除的圖片剛好被指定為 mainImageId, tabImageId 或 coverImageId，自動重設避免留下無效 ID
      const project = await db.projects.get(target.projectId);
      if (project) {
        const updates: Partial<StickerProject> = { updatedAt: Date.now() };
        if (project.mainImageId === imageId) updates.mainImageId = undefined;
        if (project.tabImageId === imageId) updates.tabImageId = undefined;
        if (project.coverImageId === imageId) updates.coverImageId = undefined;
        await db.projects.update(target.projectId, updates);
      }
    });
  } catch (err) {
    throw handleDbError(err, '移除圖片失敗');
  }
}

// 設定或取消專案的主圖 (mainImageId)、標籤圖 (tabImageId) 與封面 (coverImageId)
export async function setProjectSpecialImage(
  projectId: string,
  role: 'main' | 'tab' | 'cover',
  imageId: string | null
): Promise<StickerProject> {
  try {
    const project = await db.projects.get(projectId);
    if (!project) throw new Error('找不到專案');

    const now = Date.now();
    const updates: Partial<StickerProject> = { updatedAt: now };

    if (role === 'main') updates.mainImageId = imageId || undefined;
    if (role === 'tab') updates.tabImageId = imageId || undefined;
    if (role === 'cover') updates.coverImageId = imageId || undefined;

    await db.projects.update(projectId, updates);
    return { ...project, ...updates, updatedAt: now };
  } catch (err) {
    throw handleDbError(err, '更新素材關聯失敗');
  }
}
