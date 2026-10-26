import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const buildDir = path.resolve('build');
const pngPath = path.join(buildDir, 'line-sticker-studio-icon.png');

const buf = fs.readFileSync(pngPath);
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
const bitDepth = buf.readUInt8(24);
const colorType = buf.readUInt8(25);
const compression = buf.readUInt8(26);
const filter = buf.readUInt8(27);
const interlace = buf.readUInt8(28);

console.log(`PNG 基礎資訊: ${width} × ${height}, bitDepth: ${bitDepth}, colorType: ${colorType}, interlace: ${interlace}`);

// 收集所有 IDAT chunk
const idatChunks = [];
let p = 8;
while (p < buf.length) {
  const len = buf.readUInt32BE(p);
  const type = buf.toString('ascii', p + 4, p + 8);
  if (type === 'IDAT') {
    idatChunks.push(buf.subarray(p + 8, p + 8 + len));
  }
  p += 12 + len;
}

const compressed = Buffer.concat(idatChunks);
console.log(`IDAT 總壓縮位元組: ${compressed.length} bytes`);

const decompressed = zlib.inflateSync(compressed);
console.log(`解壓後點陣大小: ${decompressed.length} bytes (預期: ${(width * 4 + 1) * height} bytes)`);

// 每個 scanline: 1 byte filter type + width * 4 bytes (RGBA)
const bytesPerPixel = 4;
const stride = 1 + width * bytesPerPixel;
const rgba = Buffer.alloc(width * height * 4);

let prevRow = Buffer.alloc(width * bytesPerPixel);
for (let y = 0; y < height; y++) {
  const rowOffset = y * stride;
  const filterType = decompressed[rowOffset];
  const currentRow = decompressed.subarray(rowOffset + 1, rowOffset + stride);
  const destRow = rgba.subarray(y * width * 4, (y + 1) * width * 4);

  // PNG filter un-filtering
  for (let x = 0; x < width * bytesPerPixel; x++) {
    const raw = currentRow[x];
    const a = x >= bytesPerPixel ? destRow[x - bytesPerPixel] : 0;
    const b = prevRow[x];
    const c = x >= bytesPerPixel ? prevRow[x - bytesPerPixel] : 0;

    let val = 0;
    if (filterType === 0) { // None
      val = raw;
    } else if (filterType === 1) { // Sub
      val = (raw + a) & 0xff;
    } else if (filterType === 2) { // Up
      val = (raw + b) & 0xff;
    } else if (filterType === 3) { // Average
      val = (raw + Math.floor((a + b) / 2)) & 0xff;
    } else if (filterType === 4) { // Paeth
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      let pr = c;
      if (pa <= pb && pa <= pc) pr = a;
      else if (pb <= pc) pr = b;
      val = (raw + pr) & 0xff;
    }
    destRow[x] = val;
  }
  prevRow = Buffer.from(destRow);
}

console.log('✓ 成功無損還原 RGBA 點陣圖！開始分析 Alpha 透明通道分佈...');

// 分析不同 Alpha 閾值下的有效邊界
const thresholds = [1, 5, 10, 20, 50, 100, 150, 200];
for (const th of thresholds) {
  let minX = width, maxX = 0, minY = height, maxY = 0, count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = rgba[(y * width + x) * 4 + 3];
      if (a >= th) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        count++;
      }
    }
  }
  if (count > 0) {
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const ratioW = ((w / width) * 100).toFixed(1);
    const ratioH = ((h / height) * 100).toFixed(1);
    console.log(`閾值 Alpha >= ${th.toString().padStart(3, ' ')}: 像素數: ${count.toString().padStart(7, ' ')} | 邊界 X[${minX.toString().padStart(4, ' ')} ~ ${maxX.toString().padStart(4, ' ')}], Y[${minY.toString().padStart(4, ' ')} ~ ${maxY.toString().padStart(4, ' ')}] | 寬: ${w} (${ratioW}%), 高: ${h} (${ratioH}%)`);
  }
}
