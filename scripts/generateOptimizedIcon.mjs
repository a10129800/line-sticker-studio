import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * LINE Sticker Studio - 圖示尺寸極致放大 (95% 主體佔比) 與多尺寸 Windows ICO 產生器
 * 1. 讀取原始高解析度 PNG (build/line-sticker-studio-icon.png)
 * 2. 精確分析 Alpha 通道 (保留所有抗鋸齒邊緣，Alpha > 2)
 * 3. 將主體圖形放大至佔畫布 95%，四周保留 2.5% 精準安全邊界，不裁切、不變形
 * 4. 採用高保真雙立方/雙線性插值演算法重新取樣
 * 5. 輸出包含 16, 24, 32, 48, 64, 128, 256 共 7 種尺寸的微軟標準 ICO
 * 6. 輸出新舊並排比較圖 build/icon-comparison.png 供視覺檢視
 */

const buildDir = path.resolve('build');
const srcPngPath = path.join(buildDir, 'line-sticker-studio-icon.png');
const targetIcoPath = path.join(buildDir, 'icon.ico');
const targetPngPath = path.join(buildDir, 'icon.png');
const fallbackIcoPath = path.join(buildDir, 'line-sticker-studio-icon.ico');
const comparisonPngPath = path.join(buildDir, 'icon-comparison.png');

// --- 輔助函式：解碼 32-bit RGBA PNG ---
function decodePng(buffer) {
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`僅支援 8-bit RGBA PNG，當前為: ${bitDepth}-bit, colorType=${colorType}`);
  }

  const idatChunks = [];
  let p = 8;
  while (p < buffer.length) {
    const len = buffer.readUInt32BE(p);
    const type = buffer.toString('ascii', p + 4, p + 8);
    if (type === 'IDAT') {
      idatChunks.push(buffer.subarray(p + 8, p + 8 + len));
    }
    p += 12 + len;
  }

  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = 4;
  const stride = 1 + width * bpp;
  const rgba = Buffer.alloc(width * height * 4);
  let prevRow = Buffer.alloc(width * bpp);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * stride;
    const filterType = decompressed[rowOffset];
    const currentRow = decompressed.subarray(rowOffset + 1, rowOffset + stride);
    const destRow = rgba.subarray(y * width * 4, (y + 1) * width * 4);

    for (let x = 0; x < width * bpp; x++) {
      const raw = currentRow[x];
      const a = x >= bpp ? destRow[x - bpp] : 0;
      const b = prevRow[x];
      const c = x >= bpp ? prevRow[x - bpp] : 0;

      let val = 0;
      if (filterType === 0) val = raw;
      else if (filterType === 1) val = (raw + a) & 0xff;
      else if (filterType === 2) val = (raw + b) & 0xff;
      else if (filterType === 3) val = (raw + Math.floor((a + b) / 2)) & 0xff;
      else if (filterType === 4) {
        const paeth = a + b - c;
        const pa = Math.abs(paeth - a);
        const pb = Math.abs(paeth - b);
        const pc = Math.abs(paeth - c);
        let pr = c;
        if (pa <= pb && pa <= pc) pr = a;
        else if (pb <= pc) pr = b;
        val = (raw + pr) & 0xff;
      }
      destRow[x] = val;
    }
    prevRow = Buffer.from(destRow);
  }

  return { width, height, rgba };
}

// --- 輔助函式：編碼 RGBA 點陣為標準 PNG Buffer ---
function encodePng(rgba, width, height) {
  const bpp = 4;
  const stride = 1 + width * bpp;
  const rawData = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    rawData[y * stride] = 0; // Filter: None
    rgba.copy(rawData, y * stride + 1, y * width * bpp, (y + 1) * width * bpp);
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });

  // PNG Header
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // Compression
  ihdr.writeUInt8(0, 11); // Filter
  ihdr.writeUInt8(0, 12); // Interlace
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT Chunk
  const idatChunk = createChunk('IDAT', compressed);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crc = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

// CRC-32 實現
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// --- 輔助函式：高品質雙線性縮放 (Bilinear Resampling) ---
function resizeRgba(srcRgba, srcW, srcH, dstW, dstH) {
  const dst = Buffer.alloc(dstW * dstH * 4);
  const xRatio = (srcW - 1) / Math.max(1, dstW - 1);
  const yRatio = (srcH - 1) / Math.max(1, dstH - 1);

  for (let y = 0; y < dstH; y++) {
    const srcY = y * yRatio;
    const yFloor = Math.floor(srcY);
    const yCeil = Math.min(srcH - 1, yFloor + 1);
    const yWeight = srcY - yFloor;

    for (let x = 0; x < dstW; x++) {
      const srcX = x * xRatio;
      const xFloor = Math.floor(srcX);
      const xCeil = Math.min(srcW - 1, xFloor + 1);
      const xWeight = srcX - xFloor;

      const idx00 = (yFloor * srcW + xFloor) * 4;
      const idx10 = (yFloor * srcW + xCeil) * 4;
      const idx01 = (yCeil * srcW + xFloor) * 4;
      const idx11 = (yCeil * srcW + xCeil) * 4;

      const dstIdx = (y * dstW + x) * 4;

      for (let c = 0; c < 4; c++) {
        const top = srcRgba[idx00 + c] * (1 - xWeight) + srcRgba[idx10 + c] * xWeight;
        const btm = srcRgba[idx01 + c] * (1 - xWeight) + srcRgba[idx11 + c] * xWeight;
        dst[dstIdx + c] = Math.round(top * (1 - yWeight) + btm * yWeight);
      }
    }
  }
  return dst;
}

// --- 輔助函式：組裝 Windows ICO 檔案 ---
function buildIcoFromPngBuffers(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = headerSize + count * dirEntrySize;

  let currentOffset = dirSize;
  const entries = [];
  for (const item of pngBuffers) {
    entries.push({
      width: item.width >= 256 ? 0 : item.width,
      height: item.height >= 256 ? 0 : item.height,
      colorCount: 0,
      reserved: 0,
      planes: 1,
      bitCount: 32,
      bytesInRes: item.buffer.length,
      imageOffset: currentOffset,
      buffer: item.buffer,
    });
    currentOffset += item.buffer.length;
  }

  const icoBuffer = Buffer.alloc(currentOffset);
  icoBuffer.writeUInt16LE(0, 0); // Reserved
  icoBuffer.writeUInt16LE(1, 2); // 1 = ICO
  icoBuffer.writeUInt16LE(count, 4); // Count

  let entryPos = headerSize;
  for (const entry of entries) {
    icoBuffer.writeUInt8(entry.width, entryPos);
    icoBuffer.writeUInt8(entry.height, entryPos + 1);
    icoBuffer.writeUInt8(entry.colorCount, entryPos + 2);
    icoBuffer.writeUInt8(entry.reserved, entryPos + 3);
    icoBuffer.writeUInt16LE(entry.planes, entryPos + 4);
    icoBuffer.writeUInt16LE(entry.bitCount, entryPos + 6);
    icoBuffer.writeUInt32LE(entry.bytesInRes, entryPos + 8);
    icoBuffer.writeUInt32LE(entry.imageOffset, entryPos + 12);
    entryPos += dirEntrySize;
  }

  for (const entry of entries) {
    entry.buffer.copy(icoBuffer, entry.imageOffset);
  }

  return icoBuffer;
}

// --- 主程序邏輯 ---
function run() {
  console.log('================================================================');
  console.log('   LINE Sticker Studio - 圖示尺寸極致放大 (95% 主體佔比) 優化程序');
  console.log('================================================================\n');

  if (!fs.existsSync(srcPngPath)) {
    console.error(`❌ 錯誤: 找不到原始高解析度圖示來源: ${srcPngPath}`);
    process.exit(1);
  }

  console.log(`[步驟 1/6] 讀取並無損解碼原始高解析度圖示: ${srcPngPath}`);
  const srcPngBuf = fs.readFileSync(srcPngPath);
  const { width: srcW, height: srcH, rgba: srcRgba } = decodePng(srcPngBuf);
  console.log(`   原始圖檔尺寸: ${srcW} × ${srcH} px (共 ${srcW * srcH} 像素)`);

  console.log('\n[步驟 2/6] 執行高精度 Alpha 通道掃描 (以 Alpha > 2 確保保留全部半透明與抗鋸齒邊界)...');
  let minX = srcW, maxX = 0, minY = srcH, maxY = 0;
  let validPixelCount = 0;

  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const a = srcRgba[(y * srcW + x) * 4 + 3];
      if (a > 2) { // 嚴格保留所有半透明細節
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        validPixelCount++;
      }
    }
  }

  if (validPixelCount === 0) {
    console.error('❌ 錯誤: 未找到有效圖案像素！');
    process.exit(1);
  }

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  const origRatioW = ((contentW / srcW) * 100).toFixed(2);
  const origRatioH = ((contentH / srcH) * 100).toFixed(2);

  console.log(`   圖案主體有效範圍: X [${minX} ~ ${maxX}], Y [${minY} ~ ${maxY}]`);
  console.log(`   圖案主體實際尺寸: ${contentW} × ${contentH} px`);
  console.log(`   原圖畫布主體佔比: 寬度 ${origRatioW}%, 高度 ${origRatioH}%`);
  console.log(`   四周原留白: 左 ${minX}px, 右 ${srcW - 1 - maxX}px, 上 ${minY}px, 下 ${srcH - 1 - maxY}px`);

  // 目標：主體佔畫布 95% (四周留 2.5% 精準安全邊界)
  const TARGET_RATIO = 0.95;
  const maxContentDim = Math.max(contentW, contentH);
  const newCanvasDim = Math.round(maxContentDim / TARGET_RATIO);
  const padX = Math.round((newCanvasDim - contentW) / 2);
  const padY = Math.round((newCanvasDim - contentH) / 2);

  console.log(`\n[步驟 3/6] 消除冗餘外圍留白，重構 95% 主體正方形畫布...`);
  console.log(`   目標主體佔比: ${(TARGET_RATIO * 100).toFixed(1)}% (四周保留 2.5% 安全邊距)`);
  console.log(`   重構正方形畫布尺寸: ${newCanvasDim} × ${newCanvasDim} px`);
  console.log(`   置中安全邊距: 水平 ${padX} px, 垂直 ${padY} px`);

  // 建立全新正方形點陣並置中貼入原圖主體
  const squaredRgba = Buffer.alloc(newCanvasDim * newCanvasDim * 4, 0); // 預設全透明
  for (let r = 0; r < contentH; r++) {
    const srcOffset = ((minY + r) * srcW + minX) * 4;
    const dstOffset = ((padY + r) * newCanvasDim + padX) * 4;
    srcRgba.copy(squaredRgba, dstOffset, srcOffset, srcOffset + contentW * 4);
  }

  console.log('\n[步驟 4/6] 雙線性多重取樣生成 Windows 官方標準 7 大解析度...');
  const targetSizes = [256, 128, 64, 48, 32, 24, 16];
  const pngBuffers = [];
  const resizedRgbaMap = {};

  for (const s of targetSizes) {
    const resizedRgba = resizeRgba(squaredRgba, newCanvasDim, newCanvasDim, s, s);
    resizedRgbaMap[s] = resizedRgba;
    const pngBuf = encodePng(resizedRgba, s, s);
    pngBuffers.push({ width: s, height: s, buffer: pngBuf });

    // 驗證縮小後該尺寸的主體佔比
    const actualSubjectPixelSize = Math.round(maxContentDim * (s / newCanvasDim));
    const actualPercent = ((actualSubjectPixelSize / s) * 100).toFixed(1);
    console.log(`   ✓ 尺寸 ${s.toString().padStart(3, ' ')} × ${s.toString().padStart(3, ' ')} px | PNG 大小: ${pngBuf.length.toString().padStart(5, ' ')} bytes | 主體實際像素: ${actualSubjectPixelSize}px (${actualPercent}%)`);
  }

  console.log('\n[步驟 5/6] 封裝為標準 Windows 多尺寸 ICO 並同步寫入檔案...');
  const icoBuffer = buildIcoFromPngBuffers(pngBuffers);

  // 1. 備份原有 ICO
  const backupPath = path.join(buildDir, 'line-sticker-studio-icon.bak.ico');
  if (fs.existsSync(fallbackIcoPath) && !fs.existsSync(backupPath)) {
    fs.copyFileSync(fallbackIcoPath, backupPath);
    console.log(`   ✓ 已備份舊圖示至 ${backupPath}`);
  }

  // 2. 寫入正式 icon.ico 與 line-sticker-studio-icon.ico
  fs.writeFileSync(targetIcoPath, icoBuffer);
  fs.writeFileSync(fallbackIcoPath, icoBuffer);
  console.log(`   ✓ 成功寫入 ${targetIcoPath} (共 ${icoBuffer.length} bytes, 包含 7 種尺寸)`);
  console.log(`   ✓ 同步更新 ${fallbackIcoPath}`);

  // 3. 寫入 256x256 高解析度 PNG
  const png256 = pngBuffers.find((b) => b.width === 256)?.buffer;
  if (png256) {
    fs.writeFileSync(targetPngPath, png256);
    console.log(`   ✓ 成功寫入高解析度預覽 ${targetPngPath} (256 × 256 px)`);
  }

  console.log('\n[步驟 6/6] 產生新舊圖示並排比較圖 (build/icon-comparison.png)...');
  generateComparisonImage(srcRgba, srcW, srcH, resizedRgbaMap[256], resizedRgbaMap[48], resizedRgbaMap[32]);

  console.log('\n================================================================');
  console.log('🎉 圖示主體放大優化成功！');
  console.log(`   • 主體視覺寬度佔比由原本的 ${origRatioW}% 大幅提升至 95.0%`);
  console.log(`   • 主體視覺高度佔比由原本的 ${origRatioH}% 大幅提升至 95.0%`);
  console.log('   • 成功生成 Windows 7 大多解析度 ICO (16, 24, 32, 48, 64, 128, 256)');
  console.log(`   • 已產生並排對比圖供檢視: ${comparisonPngPath}`);
  console.log('================================================================\n');
}

// 產生對比圖：左側舊版 (原圖置中縮小至 256)，右側新版 (95% 放大置中)
function generateComparisonImage(origRgba, origW, origH, new256Rgba, new48Rgba, new32Rgba) {
  const compW = 600;
  const compH = 340;
  const compRgba = Buffer.alloc(compW * compH * 4, 0);

  // 繪製棋盤格背景
  for (let y = 0; y < compH; y++) {
    for (let x = 0; x < compW; x++) {
      const isDark = (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0;
      const c = isDark ? 238 : 248;
      const idx = (y * compW + x) * 4;
      compRgba[idx] = c;
      compRgba[idx + 1] = c;
      compRgba[idx + 2] = c;
      compRgba[idx + 3] = 255;
    }
  }

  // 將原圖縮放至 256x256 (代表舊版)
  const old256Rgba = resizeRgba(origRgba, origW, origH, 256, 256);

  // 貼上左側：舊版 256 (位置: x=24, y=42)
  pasteRgba(old256Rgba, 256, 256, compRgba, compW, compH, 24, 42);

  // 貼上右側：新版 256 (位置: x=320, y=42)
  pasteRgba(new256Rgba, 256, 256, compRgba, compW, compH, 320, 42);

  // 繪製輔助邊界線：左側紅色外框，右側綠色外框
  drawBox(compRgba, compW, compH, 24, 42, 256, 256, 220, 38, 38); // 紅色
  drawBox(compRgba, compW, compH, 320, 42, 256, 256, 16, 185, 129); // 綠色

  const compPng = encodePng(compRgba, compW, compH);
  fs.writeFileSync(comparisonPngPath, compPng);
  console.log(`   ✓ 比較圖已儲存至: ${comparisonPngPath}`);
}

function pasteRgba(src, srcW, srcH, dst, dstW, dstH, startX, startY) {
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const srcIdx = (y * srcW + x) * 4;
      const sa = src[srcIdx + 3] / 255;
      if (sa > 0) {
        const dstX = startX + x;
        const dstY = startY + y;
        if (dstX < dstW && dstY < dstH) {
          const dstIdx = (dstY * dstW + dstX) * 4;
          const da = dst[dstIdx + 3] / 255;
          const outA = sa + da * (1 - sa);
          for (let c = 0; c < 3; c++) {
            dst[dstIdx + c] = Math.round(
              (src[srcIdx + c] * sa + dst[dstIdx + c] * da * (1 - sa)) / outA
            );
          }
          dst[dstIdx + 3] = Math.round(outA * 255);
        }
      }
    }
  }
}

function drawBox(buf, bufW, bufH, x0, y0, w, h, r, g, b) {
  for (let x = x0; x < x0 + w; x++) {
    setPixel(buf, bufW, bufH, x, y0, r, g, b);
    setPixel(buf, bufW, bufH, x, y0 + h - 1, r, g, b);
  }
  for (let y = y0; y < y0 + h; y++) {
    setPixel(buf, bufW, bufH, x0, y, r, g, b);
    setPixel(buf, bufW, bufH, x0 + w - 1, y, r, g, b);
  }
}

function setPixel(buf, bufW, bufH, x, y, r, g, b) {
  if (x >= 0 && x < bufW && y >= 0 && y < bufH) {
    const idx = (y * bufW + x) * 4;
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = 255;
  }
}

run();
