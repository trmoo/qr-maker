/*!
 * QR 코드 만들기 — 그리기 시험
 * © 2026 티쳐무 · 모든 권리 보유.
 *
 * ★ 가장 중요한 시험: SVG 를 거꾸로 읽어 모듈 격자를 되살려,
 *   encodeQR 이 만든 격자와 한 칸까지 같은지 본다.
 *   (그림이 한 칸이라도 빠지면 QR 코드가 안 읽히는데, 눈으로는 모른다)
 */
import { describe, ok, eq } from './harness.mjs';
import { encodeQR, PART } from '../src/lib/qr.js';
import { toSVG, toText, layoutFor, logoCoverage, SHAPES, DEFAULTS } from '../src/lib/render.js';

/** 우리가 만든 네모 SVG 를 거꾸로 읽어 격자로 되살린다 */
function svgToMatrix(svg, size, margin) {
  const grid = [];
  for (let i = 0; i < size; i++) grid.push(new Uint8Array(size));
  const pathMatch = svg.match(/<path fill="[^"]*" d="([^"]*)"/);
  if (!pathMatch) return grid;
  const re = /M(-?[\d.]+) (-?[\d.]+)h(-?[\d.]+)v(-?[\d.]+)h(-?[\d.]+)z/g;
  let m;
  while ((m = re.exec(pathMatch[1])) !== null) {
    const x = Number(m[1]) - margin;
    const y = Number(m[2]) - margin;
    const w = Number(m[3]);
    const h = Number(m[4]);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        if (y + dy >= 0 && y + dy < size && x + dx >= 0 && x + dx < size) grid[y + dy][x + dx] = 1;
      }
    }
  }
  return grid;
}

export default function run() {
  describe('SVG 가 격자와 한 칸까지 같은가', () => {
    const cases = [
      ['https://trmoo.github.io/comedu_portal/', 'M'],
      ['01234567', 'L'],
      ['와우고등학교 정보 수업 QR 코드 시험', 'Q'],
      ['WIFI:T:WPA;S:wawoo;P:1234;;', 'H'],
      ['x'.repeat(400), 'M'],   // 버전이 커서 정렬 무늬가 여러 개
      ['가'.repeat(300), 'H'],
    ];
    for (const [text, ecl] of cases) {
      const qr = encodeQR(text, { ecl });
      const margin = 4;
      const svg = toSVG(qr, { margin, shape: 'square' });
      const grid = svgToMatrix(svg, qr.size, margin);
      let diff = 0;
      for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) if (grid[y][x] !== qr.modules[y][x]) diff++;
      }
      eq(diff, 0, `v${qr.version}-${ecl} SVG 가 격자와 같다 ("${text.slice(0, 12)}")`);
    }
  });

  describe('SVG 모양새', () => {
    const qr = encodeQR('https://example.com', { ecl: 'M' });
    const svg = toSVG(qr, { margin: 4 });
    ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), 'SVG 로 시작한다');
    ok(svg.trimEnd().endsWith('</svg>'), 'SVG 로 끝난다');
    ok(svg.includes('티쳐무'), '저작권 표시가 들어간다');
    ok(svg.includes(`viewBox="0 0 ${qr.size + 8} ${qr.size + 8}"`), '여백 4모듈이 viewBox 에 들어간다');
    ok(svg.includes('<rect width='), '배경이 있다');
    ok(!toSVG(qr, { transparent: true }).includes('<rect width='), '투명 배경이면 배경을 안 그린다');
    ok(toSVG(qr, { fg: '#ff0000' }).includes('#ff0000'), '글자색이 쓰인다');
    // 둥근 네모·동그라미
    ok(toSVG(qr, { shape: 'dot' }).includes('<circle'), '동그라미 모양은 원을 쓴다');
    ok(toSVG(qr, { shape: 'round' }).includes('a0.3 0.3'), '둥근 네모는 둥근 길을 쓴다');
    // 위치 찾기 무늬는 언제나 들어간다
    for (const shape of Object.keys(SHAPES)) {
      const s = toSVG(qr, { shape });
      ok(s.includes('stroke') || s.includes('h7v1h-7z'), `${shape} 에도 위치 찾기 무늬가 있다`);
    }
    // 로고
    const withLogo = toSVG(qr, { logoDataUrl: 'data:image/png;base64,AAA', logoRatio: 0.2 });
    ok(withLogo.includes('<image'), '로고가 들어간다');
    ok(withLogo.includes('data:image/png;base64,AAA'), '로고 그림이 그대로 담긴다');
  });

  describe('동그라미 모양도 칸 수가 맞는가', () => {
    const qr = encodeQR('https://trmoo.github.io/', { ecl: 'M' });
    const svg = toSVG(qr, { shape: 'dot', margin: 4 });
    const circles = (svg.match(/<circle/g) || []).length;
    let expect = 0;
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (!qr.modules[y][x]) continue;
        const p = qr.part[y][x];
        if (p === PART.FINDER || p === PART.ALIGNMENT || p === PART.TIMING) continue;
        expect++;
      }
    }
    eq(circles, expect, '동그라미 수가 검은 데이터 칸 수와 같다');
  });

  describe('크기 셈', () => {
    const qr = encodeQR('https://example.com', { ecl: 'M' }); // 21~25
    const L = layoutFor(qr, { margin: 4, pixelSize: 1024 });
    eq(L.total, qr.size + 8, '여백까지 더한 칸 수');
    eq(L.px, L.cell * L.total, '그림 크기는 칸 크기의 정수배');
    ok(L.px <= 1024, '바라는 크기를 넘지 않는다');
    ok(L.cell >= 1, '칸은 적어도 1픽셀');
    eq(layoutFor(qr, { margin: 0, pixelSize: 100 }).total, qr.size, '여백 0도 된다');
    // 작은 크기를 넣어도 깨지지 않는다
    ok(layoutFor(qr, { pixelSize: 10 }).cell === 1, '아주 작게 해도 칸은 1픽셀');
    eq(DEFAULTS.margin, 4, '여백 기본값은 규격 권고대로 4모듈');
  });

  describe('가운데 그림이 덮는 넓이', () => {
    const qr = encodeQR('https://trmoo.github.io/comedu_portal/', { ecl: 'H' });
    const c = logoCoverage(qr, 0.2);
    ok(c.percent > 0 && c.percent < 30, '덮는 비율을 셈한다');
    ok(logoCoverage(qr, 0.3).percent > logoCoverage(qr, 0.1).percent, '크게 하면 많이 덮는다');
    eq(logoCoverage(qr, 0.9).side, logoCoverage(qr, 0.3).side, '0.3 을 넘겨 넣어도 0.3 으로 막는다');
  });

  describe('글자 그림', () => {
    const qr = encodeQR('01234567', { ecl: 'M', mask: 2 });
    const text = toText(qr, 1);
    const lines = text.split('\n');
    eq(lines.length, qr.size + 2, '여백 한 줄씩 붙는다');
    eq(lines[1].length, (qr.size + 2) * 2, '한 칸을 두 글자로 그린다');
    ok(text.includes('██'), '검은 칸이 보인다');
  });
}
