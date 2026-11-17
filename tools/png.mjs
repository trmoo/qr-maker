/*!
 * QR 코드 만들기 — 아주 작은 PNG 만들기 (점검용)
 * © 2026 티쳐무 · 모든 권리 보유.
 *
 * 앱은 브라우저 캔버스로 PNG 를 만들지만, 점검은 node 에서 해야 한다.
 * 그래서 회색조 PNG 를 손으로 써 낸다(zlib 은 node 에 들어 있다).
 */
import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** 회색조 그림(0~255 값 배열)을 PNG 바이트로 */
export function grayPNG(width, height, pixels) {
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0; // 필터 없음
    for (let x = 0; x < width; x++) raw[y * (width + 1) + 1 + x] = pixels[y * width + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // 비트 깊이
  ihdr[9] = 0;  // 회색조
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** QR 격자를 PNG 로. damaged 에 든 칸('y,x')은 바탕색으로 지워 그린다 */
export function qrToPNG(qr, { scale = 6, margin = 4, invert = false, damaged = null } = {}) {
  const size = (qr.size + margin * 2) * scale;
  const px = new Uint8Array(size * size).fill(invert ? 0 : 255);
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (!qr.modules[y][x]) continue;
      if (damaged && damaged.has(`${y},${x}`)) continue;
      for (let dy = 0; dy < scale; dy++) {
        const row = ((y + margin) * scale + dy) * size;
        for (let dx = 0; dx < scale; dx++) px[row + (x + margin) * scale + dx] = invert ? 255 : 0;
      }
    }
  }
  return grayPNG(size, size, px);
}
