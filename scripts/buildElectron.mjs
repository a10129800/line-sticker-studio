import fs from 'node:fs';
import path from 'node:path';

// 1. 確保 dist-electron 目錄存在並標記其模組類型為 CommonJS
const distDir = path.resolve('dist-electron');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

fs.writeFileSync(
  path.join(distDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2),
  'utf-8'
);
console.log('✓ 已建立 dist-electron/package.json (CommonJS 橋接設定)');

// 2. 檢查 build/icon.ico 狀態（絕對不覆蓋已優化之新圖示）
const buildDir = path.resolve('build');
const targetIcon = path.join(buildDir, 'icon.ico');
const sourceIcon = path.join(buildDir, 'line-sticker-studio-icon.ico');

if (fs.existsSync(targetIcon)) {
  console.log('✓ build/icon.ico 已就緒 (保留最新多尺寸優化圖示)');
} else if (fs.existsSync(sourceIcon)) {
  fs.copyFileSync(sourceIcon, targetIcon);
  console.log('✓ 建立 build/icon.ico 備援圖示');
} else {
  console.warn('⚠️ 警告: 找不到 build/icon.ico，請執行 npm run build:icon 產出專屬圖示');
}
