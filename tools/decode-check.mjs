/*!
 * QR 코드 만들기 — 「정말 읽히는가」 점검 (① 그림 만들기)
 * © 2026 티쳐무 · 모든 권리 보유.
 *
 *   npm run check:decode     (이 파일 → tools/decode.py 차례로 돈다)
 *
 * 기준 격자와 똑같다는 것(npm test)과 「휴대폰이 읽는다」는 것은 다른 이야기다.
 * 그래서 PNG 로 만들어 **다른 사람이 만든 해독기**(OpenCV)로 실제로 읽어 본다.
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { encodeQR, damageReport, PART } from '../src/lib/qr.js';
import { buildPayload } from '../src/lib/payload.js';
import { logoCells } from '../src/lib/advice.js';
import { qrToPNG } from './png.mjs';

const OUT = join(tmpdir(), 'qr-maker-decode');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const cases = [];
const lateCases = [];
const addCase = (name, text, opt = {}) => cases.push({ name, text, opt });

// 실제로 쓸 만한 내용들 × 오류 정정 네 수준
const TEXTS = [
  ['url', 'https://trmoo.github.io/comedu_portal/'],
  ['url2', 'https://www.google.com'],
  ['num', '01234567'],
  ['alnum', 'HTTPS://EXAMPLE.COM/ABC-123'],
  ['korean', '와우고등학교 정보 수업입니다'],
  ['long', '한글을 길게 넣어 보는 시험용 글입니다. '.repeat(8)],
  ['wifi', buildPayload('wifi', { ssid: 'wawoo-class', password: 'school1234', security: 'WPA' }).text],
  ['vcard', buildPayload('vcard', { name: '홍길동', org: '와우고등학교', phone: '010-1234-5678', email: 'a@b.com' }).text],
  ['tel', buildPayload('tel', { phone: '010-1234-5678' }).text],
  ['sms', buildPayload('sms', { phone: '010-1234-5678', message: '신청합니다' }).text],
];
for (const [name, text] of TEXTS) {
  for (const ecl of ['L', 'M', 'Q', 'H']) addCase(`${name}-${ecl}`, text, { ecl });
}
// 아주 큰 것도
addCase('big-v40', 'A1'.repeat(1400), { ecl: 'L' });
addCase('big-h', '가'.repeat(400), { ecl: 'H' });

// 가운데 그림(로고)을 넣었을 때 — 「이대로 괜찮다」는 판정이 맞는지
for (const [ecl, ratio] of [['H', 0.3], ['H', 0.2], ['Q', 0.2], ['L', 0.25]]) {
  const qr = encodeQR('https://trmoo.github.io/comedu_portal/', { ecl });
  const cells = logoCells(qr, ratio);
  const report = damageReport(qr, cells);
  const name = `logo-${ecl}-${Math.round(ratio * 100)}`;
  const file = join(OUT, `${name}.png`);
  writeFileSync(file, qrToPNG(qr, { scale: 8, margin: 4, damaged: cells }));
  lateCases.push({
    name, file, text: qr.text, version: qr.version, ecl: qr.ecl, size: qr.size,
    predict: report.readable, covered: cells.size,
  });
}

const manifest = [];
for (const c of cases) {
  const qr = encodeQR(c.text, c.opt);
  const scale = qr.size > 100 ? 10 : 8;
  const file = join(OUT, `${c.name}.png`);
  writeFileSync(file, qrToPNG(qr, { scale, margin: 4 }));
  manifest.push({ name: c.name, file, text: c.text, version: qr.version, ecl: qr.ecl, size: qr.size, predict: true });
}

// ───────── 「오류 정정 체험」 화면의 판정이 맞는지 ─────────
// 화면이 「아직 읽을 수 있습니다」 라고 했으면 진짜 해독기도 읽어야 한다.
// (거꾸로 「못 읽습니다」 는 넉넉하게 잡은 것이라 실제로는 읽힐 수도 있어 따지지 않는다)
const base = encodeQR('https://trmoo.github.io/comedu_portal/', { ecl: 'H' });
const dataCells = [];
for (let y = 0; y < base.size; y++) {
  for (let x = 0; x < base.size; x++) if (base.part[y][x] === PART.DATA) dataCells.push(`${y},${x}`);
}
let seed = 20261117; // 늘 같은 결과가 나오게 (시험이 흔들리지 않도록)
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (const n of [5, 15, 30, 60, 100, 150]) {
  const damaged = new Set();
  const pool = [...dataCells];
  for (let i = 0; i < n && pool.length; i++) damaged.add(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  const report = damageReport(base, damaged);
  const name = `damage-${n}`;
  const file = join(OUT, `${name}.png`);
  writeFileSync(file, qrToPNG(base, { scale: 8, margin: 4, damaged }));
  manifest.push({
    name, file, text: base.text, version: base.version, ecl: base.ecl, size: base.size,
    predict: report.readable, covered: n,
  });
}
manifest.push(...lateCases);
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1), 'utf8');
console.log(`PNG ${manifest.length}장을 만들었습니다 → ${OUT}`);
