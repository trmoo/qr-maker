/*!
 * QR 코드 만들기 — 내려받기와 인쇄
 * © 2026 티쳐무 · 모든 권리 보유. 학교 수업 목적으로만 이용해 주세요.
 *
 * 서버에 아무것도 보내지 않는다. 모두 이 브라우저 안에서 만들어 받는다.
 */
import { drawCanvas, toSVG } from './render.js';

/** 파일 이름에 쓸 수 없는 글자를 바꾼다 */
export function safeName(text, fallback = 'qr') {
  const base = String(text || '')
    .replace(/^https?:\/\//i, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '_')
    .slice(0, 40)
    .replace(/[-_.]+$/, '');
  return base || fallback;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** PNG 로 받기 */
export function downloadPNG(qr, opt, filename) {
  const canvas = document.createElement('canvas');
  drawCanvas(canvas, qr, opt);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      saveBlob(blob, filename || `${safeName(qr.text)}_QR.png`);
      resolve();
    }, 'image/png');
  });
}

/** SVG 로 받기 (인쇄·확대에 좋다) */
export function downloadSVG(qr, opt, filename) {
  const svg = toSVG(qr, opt);
  saveBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename || `${safeName(qr.text)}_QR.svg`);
}

/** 인쇄용 창을 띄운다 — 종이에 붙일 안내문 꼴로 */
export function printQR(qr, opt, caption) {
  const svg = toSVG(qr, opt);
  const win = window.open('', '_blank');
  if (!win) return false;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  win.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>QR 코드 인쇄</title>
<!-- QR 코드 만들기 · © 2026 티쳐무 · 모든 권리 보유 -->
<style>
  @page { margin: 15mm; }
  body { font-family: "맑은 고딕", "Malgun Gothic", system-ui, sans-serif; text-align: center; margin: 0; padding: 20mm 10mm; }
  .qr { width: 120mm; height: 120mm; margin: 0 auto; }
  .qr svg { width: 100%; height: 100%; }
  h1 { font-size: 24pt; margin: 0 0 8mm; }
  p.sub { font-size: 14pt; color: #444; margin: 6mm 0 0; word-break: break-all; }
  p.foot { font-size: 9pt; color: #888; margin-top: 12mm; }
  @media print { .noprint { display: none; } }
  .noprint { margin-top: 8mm; }
  button { font-size: 14pt; padding: 8px 20px; }
</style></head><body>
${caption ? `<h1>${esc(caption)}</h1>` : ''}
<div class="qr">${svg}</div>
<p class="sub">${esc(qr.text.length > 120 ? qr.text.slice(0, 120) + '…' : qr.text)}</p>
<p class="foot">QR 코드 만들기 · © 2026 티쳐무</p>
<div class="noprint"><button onclick="window.print()">인쇄하기</button></div>
</body></html>`);
  win.document.close();
  return true;
}

/** 담은 글을 글자판에 복사 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 보안 제약으로 막히면 옛 방식으로
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let done = false;
    try { done = document.execCommand('copy'); } catch { done = false; }
    ta.remove();
    return done;
  }
}
