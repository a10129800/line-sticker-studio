import fs from 'node:fs';
import path from 'node:path';

const buildDir = path.resolve('build');
const pngPath = path.join(buildDir, 'line-sticker-studio-icon.png');
const icoPath = path.join(buildDir, 'icon.ico');

console.log('=== 1. PNG 檔頭與二進位解構 ===');
const buf = fs.readFileSync(pngPath);
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
const bitDepth = buf.readUInt8(24);
const colorType = buf.readUInt8(25);
console.log(`檔案大小: ${buf.length} bytes`);
console.log(`尺寸: ${width} × ${height} px`);
console.log(`bitDepth: ${bitDepth}, colorType: ${colorType}`);

// 解構 PNG 的 chunk
let p = 8;
const chunks = [];
while (p < buf.length) {
  const len = buf.readUInt32BE(p);
  const type = buf.toString('ascii', p + 4, p + 8);
  chunks.push({ type, len });
  p += 12 + len;
}
console.log('PNG Chunks:', chunks.map(c => `${c.type}(${c.len})`).join(', '));
