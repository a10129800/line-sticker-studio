import fs from 'node:fs';
import path from 'node:path';

const buildDir = path.resolve('build');
const pngPath = path.join(buildDir, 'line-sticker-studio-icon.png');
const icoPath = path.join(buildDir, 'icon.ico');
const oldIcoPath = path.join(buildDir, 'line-sticker-studio-icon.ico');

console.log('====================================================');
console.log('   LINE Sticker Studio - 應用程式圖示規格檢測報告');
console.log('====================================================\n');

console.log('1. 【原始高解析度 PNG 來源檢測】');
if (fs.existsSync(pngPath)) {
  const buf = fs.readFileSync(pngPath);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf.readUInt8(24);
  const colorType = buf.readUInt8(25);
  console.log(`   ✓ 檔案路徑: ${pngPath}`);
  console.log(`   ✓ 檔案大小: ${(buf.length / 1024).toFixed(1)} KB (${buf.length} bytes)`);
  console.log(`   ✓ 解析度: ${width} × ${height} px`);
  console.log(`   ✓ 色彩規格: ${bitDepth}-bit, 色彩模式: ${colorType === 6 ? 'RGBA (含透明通道)' : colorType}`);
} else {
  console.log('   ❌ 找不到 build/line-sticker-studio-icon.png');
}

console.log('\n2. 【目前生效的 build/icon.ico 檢測】');
if (fs.existsSync(icoPath)) {
  const buf = fs.readFileSync(icoPath);
  const idType = buf.readUInt16LE(2); // 1 = ICO
  const idCount = buf.readUInt16LE(4);
  console.log(`   ✓ 檔案大小: ${(buf.length / 1024).toFixed(1)} KB (${buf.length} bytes)`);
  console.log(`   ✓ 格式合規: ${idType === 1 ? '標準 Windows ICO 格式' : '非標準格式'}`);
  console.log(`   ✓ 內嵌尺寸數量: 共 ${idCount} 個圖示分頁`);

  const sizes = [];
  for (let i = 0; i < idCount; i++) {
    const offset = 6 + i * 16;
    let bWidth = buf.readUInt8(offset);
    let bHeight = buf.readUInt8(offset + 1);
    if (bWidth === 0) bWidth = 256;
    if (bHeight === 0) bHeight = 256;
    const wBitCount = buf.readUInt16LE(offset + 6);
    const dwBytesInRes = buf.readUInt32LE(offset + 8);
    const dwImageOffset = buf.readUInt32LE(offset + 12);

    // 檢查該區塊是 PNG 還是 DIB (BMP)
    const isPng = buf.length >= dwImageOffset + 8 &&
      buf[dwImageOffset] === 0x89 &&
      buf[dwImageOffset + 1] === 0x50 &&
      buf[dwImageOffset + 2] === 0x4E &&
      buf[dwImageOffset + 3] === 0x47;

    sizes.push(`${bWidth}×${bHeight}`);
    console.log(`     [${i + 1}] ${bWidth.toString().padStart(3, ' ')} × ${bHeight.toString().padStart(3, ' ')} px | ${wBitCount}bpp | 大小: ${dwBytesInRes.toString().padStart(6, ' ')} bytes | 格式: ${isPng ? 'PNG (現代無損壓縮)' : 'BMP (經典點陣)'}`);
  }
  console.log(`   ✓ 包含尺寸列表: ${sizes.join(', ')}`);
} else {
  console.log('   ❌ 找不到 build/icon.ico');
}

console.log('\n====================================================\n');
