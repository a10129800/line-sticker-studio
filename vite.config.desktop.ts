import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// LINE Sticker Studio - 桌面版專用 Vite 設定
// 使用相對路徑 base: './' 確保在 Electron file:// 協定下靜態資源能正確載入
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
