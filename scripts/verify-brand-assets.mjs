import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const LIGHT_BG = [247, 247, 245];
const failures = [];

function fail(message) {
  failures.push(message);
}

function readFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`Missing ${relativePath}`);
    return null;
  }
  return fs.readFileSync(absolutePath);
}

function pngRows(buffer, width, height) {
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const rowLength = 1 + width * 4;
  return Array.from({ length: height }, (_, row) => raw.subarray(row * rowLength, (row + 1) * rowLength));
}

function checkPng(relativePath, width, height, cornerExpectation) {
  const buffer = readFile(relativePath);
  if (!buffer) return;
  if (buffer.toString('ascii', 1, 4) !== 'PNG') {
    fail(`${relativePath} is not a PNG`);
    return;
  }
  const actualWidth = buffer.readUInt32BE(16);
  const actualHeight = buffer.readUInt32BE(20);
  if (actualWidth !== width || actualHeight !== height) {
    fail(`${relativePath} expected ${width}x${height}, got ${actualWidth}x${actualHeight}`);
  }
  if (!cornerExpectation || buffer[24] !== 8 || buffer[25] !== 6) return;
  const firstPixel = pngRows(buffer, actualWidth, actualHeight)[0].subarray(1, 5);
  const expected =
    Array.isArray(cornerExpectation) ? { rgb: cornerExpectation } : cornerExpectation;
  if (expected.rgb && !expected.rgb.every((value, index) => firstPixel[index] === value)) {
    fail(`${relativePath} corner expected rgb(${expected.rgb.join(', ')}), got rgb(${[...firstPixel.subarray(0, 3)].join(', ')})`);
  }
  if (typeof expected.alpha === 'number' && firstPixel[3] !== expected.alpha) {
    fail(`${relativePath} corner expected alpha ${expected.alpha}, got ${firstPixel[3]}`);
  }
}

function checkIco(relativePath) {
  const buffer = readFile(relativePath);
  if (!buffer) return;
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1 || buffer.readUInt16LE(4) < 1) {
    fail(`${relativePath} is not a valid ICO file`);
  }
}

function checkIcns(relativePath) {
  const buffer = readFile(relativePath);
  if (!buffer) return;
  if (buffer.toString('ascii', 0, 4) !== 'icns') {
    fail(`${relativePath} is not a valid ICNS file`);
  }
}

checkPng('assets/platform/web/favicon-32.png', 32, 32, LIGHT_BG);
checkPng('assets/platform/web/apple-touch-icon.png', 180, 180, LIGHT_BG);
checkPng('assets/platform/linux/icon.png', 512, 512, LIGHT_BG);
checkPng('assets/platform/macos/icon.png', 1024, 1024, { alpha: 0 });
checkIco('assets/platform/windows/icon.ico');
checkIcns('assets/platform/macos/icon.icns');
checkPng('src-tauri/icons/32x32.png', 32, 32, LIGHT_BG);
checkPng('src-tauri/icons/128x128.png', 128, 128, LIGHT_BG);
checkPng('src-tauri/icons/128x128@2x.png', 256, 256, LIGHT_BG);
checkPng('src-tauri/icons/icon.png', 512, 512, LIGHT_BG);
checkIco('src-tauri/icons/icon.ico');
checkIcns('src-tauri/icons/icon.icns');

if (failures.length) {
  console.error(failures.map((message) => `- ${message}`).join('\n'));
  process.exit(1);
}

console.log('Moondown app brand asset checks passed.');
