/*!
 * QR 코드 만들기 — 빌드 결과 점검
 * © 2026 티쳐무 · 모든 권리 보유.
 *
 * 글자 검사만으로는 흰 화면을 못 잡는다(house-budget 에서 실제로 겪었다).
 * 그래서 빌드본을 가짜 DOM 위에서 **실제로 돌려** 화면이 그려지는지까지 본다.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installFakeDom, countNodes, textOf } from './fake-dom.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const FILE = join(ROOT, 'dist', 'index.html');
const problems = [];

if (!existsSync(FILE)) {
  console.log('❌ dist/index.html 이 없습니다 — npm run build 를 먼저 돌리세요');
  process.exit(1);
}
const html = readFileSync(FILE, 'utf8');
const bytes = statSync(FILE).size;

// ───────── ① 크기 ─────────
if (bytes < 40_000) problems.push(`파일이 ${bytes}바이트뿐입니다 — 개발용 껍데기가 아닌지 확인하세요`);
if (bytes > 900_000) problems.push(`파일이 ${(bytes / 1024).toFixed(0)}KB 로 너무 큽니다`);

// ───────── ② 바깥 자원을 부르지 않는가 (오프라인 실행) ─────────
for (const m of html.matchAll(/(?:src|href)\s*=\s*["'](https?:)?\/\/[^"']+["']/g)) {
  problems.push(`바깥 자원을 부릅니다: ${m[0].slice(0, 70)}`);
}
if (/@import\s+url\(\s*["']?https?:/.test(html)) problems.push('CSS 가 바깥 글꼴·자원을 부릅니다');
if (/<script[^>]+src=/.test(html)) problems.push('따로 떨어진 스크립트 파일을 부릅니다 — 한 파일로 합쳐지지 않았습니다');
if (/<link[^>]+stylesheet/.test(html)) problems.push('따로 떨어진 CSS 파일을 부릅니다 — 한 파일로 합쳐지지 않았습니다');

// ───────── ③ 저작권 표시 세 곳 ─────────
// ⚠ 「티쳐무」 개수만 세면 배너가 지워져도 HTML 주석·푸터 때문에 통과한다.
//    그래서 배너는 **둘째 줄**로 확인한다 (Vite 8 은 postBanner 를 써야 남는다).
const count = (html.match(/티쳐무/g) || []).length;
if (count < 3) problems.push(`저작권 표시가 ${count}곳뿐입니다 (HTML 주석·스크립트 배너·화면 푸터 세 곳이어야 합니다)`);
if (!/<!--[\s\S]*티쳐무[\s\S]*-->/.test(html)) problems.push('HTML 머리 주석에 저작권 표시가 없습니다');
if (!html.includes('무단 배포 및 상업적 이용을 금합니다')) {
  problems.push('스크립트 배너(둘째 줄)가 압축에서 지워졌습니다 — vite.config.js 의 output.postBanner 를 확인하세요');
}
if (!html.includes('모든 권리 보유 — 학교 수업 목적으로만')) problems.push('화면 푸터의 저작권 문구가 없습니다');

// ───────── ④ 날 제어 문자 ─────────
// 인라인 스크립트에 섞이면 U+FFFD 가 되어 흰 화면이 된다(개발 서버에서는 멀쩡하다).
// eslint-disable-next-line no-control-regex
if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(html)) problems.push('날 제어 문자가 들어 있습니다 — 흰 화면이 됩니다');
if (html.includes('�')) problems.push('글자가 깨진 자리(U+FFFD)가 있습니다');

// ───────── ⑤ 실제로 돌려 본다 ─────────
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
if (scripts.length === 0) problems.push('안에 스크립트가 없습니다');
else {
  const tmp = join(tmpdir(), `qr-maker-dist-${process.pid}.mjs`);
  writeFileSync(tmp, scripts.join('\n;\n'), 'utf8');
  const { app } = installFakeDom();
  try {
    await import('file:///' + tmp.replace(/\\/g, '/'));
    const nodes = countNodes(app);
    const text = textOf(app);
    if (nodes < 20) problems.push(`빌드본을 돌렸는데 요소가 ${nodes}개뿐입니다 — 흰 화면입니다`);
    if (!text.includes('QR')) problems.push('빌드본이 그린 화면에 「QR」 글자가 없습니다');
    if (!text.includes('티쳐무')) problems.push('빌드본이 그린 화면에 푸터 저작권 표시가 없습니다');
    if (!problems.length) console.log(`  빌드본을 돌려 보았습니다 — 요소 ${nodes}개`);
  } catch (e) {
    problems.push(`빌드본을 돌리다 오류: ${e.message}`);
  }
}

console.log(`dist/index.html — ${(bytes / 1024).toFixed(1)}KB · 저작권 표시 ${count}곳`);
if (problems.length) {
  console.log('\n❌ 고칠 곳\n');
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log('✅ 빌드 결과 점검 통과');
