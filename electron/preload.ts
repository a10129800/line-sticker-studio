import { contextBridge, ipcRenderer } from 'electron';

/**
 * LINE Sticker Studio - Electron 安全預載橋接層 (Preload)
 * 遵循最高安全性準則：
 * 1. 啟用 contextIsolation (隔離主進程與渲染進程)
 * 2. 停用 nodeIntegration
 * 3. 僅透過 contextBridge 暴露白名單限制之安全 API
 * 4. 嚴格防止渲染進程直接呼叫未經審核之 Node.js 或系統命令
 */

export interface DesktopAPI {
  isDesktop: boolean;
  platform: string;
  appVersion: string;
  getAppInfo: () => Promise<{ version: string; name: string }>;
}

const desktopAPI: DesktopAPI = {
  isDesktop: true,
  platform: process.platform,
  appVersion: process.env.npm_package_version || '1.0.1',
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
};

// 暴露至 window.desktopAPI
contextBridge.exposeInMainWorld('desktopAPI', desktopAPI);
