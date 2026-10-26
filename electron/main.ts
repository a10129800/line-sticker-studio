import { app, BrowserWindow, shell, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

/**
 * LINE Sticker Studio - Electron 主進程 (Main Process)
 * 負責視窗生命週期、安全性原則、本地資源載入與 IndexedDB 穩定儲存區設定
 */

// 確保應用程式名稱固定，使 IndexedDB 的儲存路徑在每次重啟時穩定持久
app.name = 'line-sticker-studio';

let mainWindow: BrowserWindow | null = null;

// 判斷是否處於開發模式
const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1' || !app.isPackaged;

/**
 * 取得 Windows 應用程式視窗專屬圖示路徑
 */
function getAppIconPath(): string | undefined {
  const candidates = [
    path.join(__dirname, '../build/icon.ico'),
    path.join(__dirname, '../build/line-sticker-studio-icon.ico'),
    path.join(process.resourcesPath, 'build/icon.ico'),
    path.join(process.resourcesPath, 'build/line-sticker-studio-icon.ico'),
    path.join(process.resourcesPath, 'app.asar/build/icon.ico'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function createMainWindow(): void {
  const iconPath = getAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: 'LINE Sticker Studio',
    icon: iconPath,
    backgroundColor: '#f8fafc', // slate-50 底色避免白屏閃爍
    show: false, // 載入完成後優雅顯示
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // 視窗準備好時優雅呈現
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      if (isDev) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });

  // 外部超連結攔截，透過系統預設瀏覽器開啟，防止在 Electron 視窗內跳轉
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // 監聽載入失敗事件，提供創作者易懂的錯誤訊息
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    if (errorCode === -3) return; // 忽略 ABORTED
    console.error(`頁面載入失敗: [${errorCode}] ${errorDescription}`);

    if (mainWindow) {
      const errorHtml = `
        <!DOCTYPE html>
        <html lang="zh-TW">
          <head>
            <meta charset="UTF-8" />
            <title>LINE Sticker Studio - 載入失敗</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; text-align: center; background: #f8fafc; color: #1e293b; }
              .card { background: white; border-radius: 16px; padding: 32px; max-width: 500px; margin: 40px auto; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
              h2 { color: #e11d48; margin-top: 0; }
              p { color: #64748b; font-size: 14px; line-height: 1.6; }
              button { background: #06C755; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px; }
              button:hover { background: #05a847; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>應用程式頁面載入失敗</h2>
              <p>無法載入本地介面資源 (${errorDescription}，代碼: ${errorCode})。</p>
              <p>請確認是否已正確執行桌面建置 (npm run build:desktop)。</p>
              <button onclick="location.reload()">重新整理</button>
            </div>
          </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
    }
  });

  // 資源載入路由
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    // 開發伺服器模式
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev && !app.isPackaged) {
    // 開發未打包：嘗試連線至本機 Vite (預設 port 3000)
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      // 若 Vite server 尚未啟動，回退至載入 dist 目錄
      const distPath = path.join(__dirname, '../dist/index.html');
      mainWindow?.loadFile(distPath);
    });
  } else {
    // 正式發布版：直接載入本機打包之 dist/index.html (使用 file:// 協定)
    const distPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(distPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 註冊安全 IPC 處理程序
ipcMain.handle('app:get-info', () => {
  return {
    version: app.getVersion(),
    name: 'LINE Sticker Studio',
    userDataPath: app.getPath('userData'),
  };
});

// 確保單一實例執行 (防止使用者重複點擊開啟多個實體)
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
}

// 關閉所有視窗時退出程式 (Windows 標準行為)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
