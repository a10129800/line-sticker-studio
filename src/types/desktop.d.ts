/**
 * LINE Sticker Studio - 桌面版 Window 全域擴充型別宣告
 */

export interface DesktopAPI {
  isDesktop: boolean;
  platform: string;
  appVersion: string;
  getAppInfo: () => Promise<{ version: string; name: string }>;
}

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}

export {};
