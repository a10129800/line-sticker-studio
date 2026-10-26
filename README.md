# LINE Sticker Studio

一套專為本機執行的 LINE 貼圖專案管理軟體，協助貼圖創作者管理手繪或繪圖軟體產出的靜態貼圖、商品資訊、即時檢查規格與打包官方上架 ZIP。

---

## 一、核心特色 (V1.0 第三階段已完成)

1. **純本機離線運作 (Offline-First)**：
   - 採用 IndexedDB (Dexie.js) 儲存專案設定與圖片二進位 Blob。
   - 不需註冊帳號、不需連網、無任何雲端上傳，保障創作智慧財產權。
2. **非破壞性圖片管理**：
   - 匯入圖片保留完整二進位資料。
   - 刪除或替換專案/圖片時，絕不會覆寫或刪除創作者電腦硬碟中的原始檔案。
3. **專案管理 (CRUD)**：
   - 支援新增、編輯、複製副本、封存/解除封存及二次確認刪除。
   - 專案支援自訂目標張數（8、16、24、32、40 張）與角色描述。
4. **貼圖工作區 (Workspace)**：
   - 支援多選匯入與拖放匯入（PNG、JPG、JPEG、WebP）。
   - 即時顯示解析度 (寬高)、檔案容量、透明通道 (Alpha Channel 檢測)。
   - 貼圖微調上下排序、單張名稱與備註自訂、放大彈窗預覽。
   - 單張圖片原位替換（不更動排序與其他設定）。

---

## 二、技術堆疊

- **框架**：React 18 + TypeScript + Vite
- **介面樣式**：Tailwind CSS + Lucide React 圖標
- **本機資料庫**：Dexie.js (IndexedDB)
- **像素分析**：HTML5 Canvas API
- **測試**：Vitest + Happy-DOM

---

## 三、快速開始與測試指引

### 1. 安裝相依套件
請於專案目錄開啟終端機（PowerShell 或 CMD），執行：
```bash
npm install
```

### 2. 啟動開發伺服器
```bash
npm run dev
```
啟動後於瀏覽器開啟 `http://localhost:3000` 即可操作。

### 3. 執行單元測試
```bash
npm run test
```
包含專案 UUID 唯一性、formatBytes 轉換、LINE 官方靜態貼圖規格限制（張數、尺寸、偶數像素、容量）與排序重編測試。

### 4. 產品正式打包
```bash
npm run build
```
產出靜態發布包至 `dist/` 目錄。
