/*!
 * QR 코드 만들기 — 소스 점검
 * © 2026 티쳐무 · 모든 권리 보유.
 *
 *   npm run check:syntax
 *
 * 시험(npm test)은 화면 파일(DOM 을 쓰는 탭)을 부르지 않으므로, 여기서
 * 소스를 전부 불러 보고(문법·불러오기 오류) 규칙도 함께 본다.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { register } from 'node:module';
import { installFakeDom, countNodes, textOf } from './fake-dom.mjs';

register('./css-hook.mjs', import.meta.url); // import './style.css' 를 건너뛰게

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SRC = join(ROOT, 'src');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|css)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const problems = [];
const add = (file, msg) => problems.push(`${relative(ROOT, file)} — ${msg}`);

// ───────── ① 저작권 표시 ─────────
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  if (!text.includes('티쳐무')) add(f, '머리 주석에 저작권 표시(티쳐무)가 없습니다');
  if (!/^\/\*!/.test(text.trimStart())) add(f, '머리 주석을 /*! 로 시작해야 압축 뒤에도 남습니다');
}

// ───────── ② 기본 대화상자 금지 ─────────
// 크롬이 「…에 삽입된 페이지 내용:」 이라는 주소를 붙여 학생에게 보인다.
for (const f of files.filter((f) => f.endsWith('.js'))) {
  const text = stripComments(readFileSync(f, 'utf8'));
  for (const bad of ['alert(', 'confirm(', 'prompt(']) {
    const re = new RegExp(`(^|[^.\\w])${bad.replace('(', '\\(')}`, 'g');
    if (re.test(text)) add(f, `브라우저 기본 ${bad.slice(0, -1)} 을 쓰지 말고 ui.js 의 say()·ask() 를 쓰세요`);
  }
}

// ───────── ③ 화면 수명 규칙 ─────────
// 탭 파일에서 resize 리스너·setInterval 을 직접 쓰면 화면을 오갈 때마다 쌓인다.
for (const f of files.filter((f) => f.includes('tabs'))) {
  const text = stripComments(readFileSync(f, 'utf8'));
  if (/addEventListener\(\s*['"]resize/.test(text)) add(f, "탭 파일에서 resize 를 직접 걸지 말고 ui.js 의 onResize() 를 쓰세요");
  if (/setInterval\(/.test(text)) add(f, '탭 파일에서 setInterval 을 직접 쓰지 말고 ui.js 의 screenInterval() 을 쓰세요');
}

// ───────── ④ 담은 내용을 저장하지 않는가 ─────────
// 주소·연락처·와이파이 비밀번호를 브라우저에 남기지 않는다. 저장은 꾸미기 설정뿐.
for (const f of files.filter((f) => f.endsWith('.js'))) {
  const text = stripComments(readFileSync(f, 'utf8'));
  if (/localStorage|sessionStorage|indexedDB/.test(text) && !f.endsWith('store.js')) {
    add(f, '저장은 store.js 에서만 합니다 (담은 내용은 저장하지 않습니다)');
  }
}

// ───────── ⑤ 바깥으로 보내지 않는가 ─────────
for (const f of files.filter((f) => f.endsWith('.js'))) {
  const text = stripComments(readFileSync(f, 'utf8'));
  if (/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket/.test(text)) {
    add(f, '이 앱은 어디에도 접속하지 않습니다 — 통신 코드를 쓰지 마세요');
  }
  if (/https?:\/\//.test(text) && !/payload\.js|t1-make\.js|t2-why\.js|render\.js|download\.js|main\.js/.test(f)) {
    add(f, '바깥 주소가 들어 있습니다 (보기 글이라면 payload.js 쪽에 두세요)');
  }
}

// ───────── ⑥ 원문자를 이름에 쓰지 않았는가 ─────────
// 한글은 자바스크립트 식별자로 쓸 수 있지만 ①ⓐ 같은 원문자는 안 된다(빌드가 깨진다).
for (const f of files.filter((f) => f.endsWith('.js'))) {
  const text = stripComments(readFileSync(f, 'utf8'));
  const re = /(?:function|const|let|var|class)\s+([^\s(=]*[①-⑳Ⓐ-Ⓩⓐ-ⓩ⑴-⒇][^\s(=]*)/g;
  let m;
  while ((m = re.exec(text)) !== null) add(f, `이름에 원문자를 쓸 수 없습니다: ${m[1]}`);
}

// ───────── ⑦ 자식 자리에 태그를 글자로 넣지 않았는가 ─────────
// h('p', null, '…<b>굵게</b>…') 로 적으면 화면에 <b> 가 그대로 보인다. {html: …} 를 쓸 것.
for (const f of files.filter((f) => f.endsWith('.js'))) {
  const text = readFileSync(f, 'utf8');
  const re = /h\(\s*'[a-z]+'\s*,\s*(?:null|\{[^}]*\})\s*,\s*'([^']*<\/?[a-z][^']*)'/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    add(f, `h() 자식 자리의 글자에 태그가 있습니다 — {html: …} 를 쓰세요: ${m[1].slice(0, 40)}`);
  }
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ───────── ⑧ 소스를 전부 불러 본다 (문법·불러오기 오류 잡기) ─────────
installFakeDom();
let loaded = 0;
for (const f of files.filter((x) => x.endsWith('.js'))) {
  try {
    await import('file:///' + f.replace(/\\/g, '/'));
    loaded++;
  } catch (e) {
    add(f, `불러오다 오류: ${e.message}`);
  }
}

// ───────── ⑨ 앱을 실제로 한 번 그려 본다 ─────────
try {
  const { app } = installFakeDom();
  globalThis.document._byId.app = app;
  const main = await import('file:///' + join(SRC, 'main.js').replace(/\\/g, '/') + '?run=1');
  void main;
  const nodes = countNodes(app);
  const text = textOf(app);
  if (nodes < 20) problems.push(`main.js — 화면을 그렸는데 요소가 ${nodes}개뿐입니다 (흰 화면 의심)`);
  if (!text.includes('QR')) problems.push('main.js — 그린 화면에 「QR」 글자가 없습니다');
  if (!text.includes('티쳐무')) problems.push('main.js — 그린 화면에 저작권 표시가 없습니다');
  console.log(`  화면을 그려 보았습니다 — 요소 ${nodes}개`);
} catch (e) {
  problems.push(`main.js — 화면을 그리다 오류: ${e.message}`);
}

console.log(`소스 ${files.length}개 가운데 자바스크립트 ${loaded}개를 불러 보았습니다.`);
if (problems.length) {
  console.log('\n❌ 고칠 곳\n');
  for (const p of problems) console.log('  ' + p);
  process.exit(1);
}
console.log('✅ 소스 점검 통과');
