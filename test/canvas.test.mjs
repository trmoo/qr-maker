/*!
 * QR 코드 만들기 — 캔버스에 그린 것이 격자와 같은가
 * © 2026 티쳐무 · 모든 권리 보유.
 *
 * ⚠⚠ 이 시험이 왜 생겼나 — 2026-11-17 에 **만들어진 QR 코드가 휴대폰에 인식되지
 *    않는다**는 일이 났다. 격자(`encodeQR`)는 기준 520가지와 한 칸까지 같았는데,
 *    **그리는 쪽**(`drawCanvas`)이 세 귀퉁이의 위치 찾기 무늬를 검은 5×5 덩어리로
 *    뭉개고 있었다. 휴대폰이 QR 코드를 「찾는」 무늬라 아예 못 읽는다.
 *    `drawCanvas()` 는 **화면 미리보기와 PNG 내려받기가 함께 쓰는 길**인데
 *    node 에 캔버스가 없다는 이유로 시험을 하나도 받지 않고 있었다.
 *
 * 그래서 가짜 캔버스(`fake-canvas.mjs`)로 「칸마다 가운데 점이 어두운가」를 되읽어
 * 격자와 맞대어 본다. 눈으로는 알 수 없는 종류의 결함이다.
 */
import { describe, ok, eq } from './harness.mjs';
import { encodeQR, PART } from '../src/lib/qr.js';
import { drawCanvas, drawDamaged, toSVG, SHAPES, DEFAULTS, RING, RING_OUTER } from '../src/lib/render.js';
import { makeCanvas, readModules } from './fake-canvas.mjs';

/** 캔버스에 그린 뒤 되읽어 격자와 어긋난 칸 수를 센다 */
function mismatch(qr, opt = {}) {
  const fg = opt.fg ?? DEFAULTS.fg;
  const canvas = makeCanvas();
  const info = drawCanvas(canvas, qr, opt);
  const got = readModules(canvas, qr, info, fg);
  let bad = 0;
  const where = [];
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (got[y][x] !== (qr.modules[y][x] ? 1 : 0)) { bad++; if (where.length < 5) where.push(`${y},${x}`); }
    }
  }
  return { bad, where, info, canvas, got };
}

export default function run() {
  describe('캔버스에 그린 것이 격자와 같은가', () => {
    const texts = [
      ['짧은 주소', 'https://a.com'],
      ['앱스 스크립트 주소', 'https://script.google.com/macros/s/AKfycbzjS12s_xYz-7Qw9/exec'],
      ['한글', '와우고등학교 정보 수업'],
      ['숫자', '01234567'],
      ['긴 글', '한글을 길게 넣어 보는 시험용 글입니다. '.repeat(6)],
    ];
    for (const [name, text] of texts) {
      for (const ecl of ['L', 'M', 'Q', 'H']) {
        for (const shape of Object.keys(SHAPES)) {
          const qr = encodeQR(text, { ecl });
          const r = mismatch(qr, { ecl, shape, margin: 4, pixelSize: 720 });
          ok(r.bad === 0, `${name} · ${ecl} · ${SHAPES[shape].label} — 어긋난 칸 ${r.bad}개 (${r.where.join(' ')})`);
        }
      }
    }
  });

  describe('위치 찾기 무늬 — 휴대폰이 QR 코드를 찾는 곳', () => {
    // 겉테두리 7×7 · 흰 틈 · 가운데 3×3 이 모두 살아 있어야 한다.
    // (예전에는 흰 틈이 메워져 검은 5×5 덩어리가 되어 아예 못 읽었다)
    for (const shape of Object.keys(SHAPES)) {
      const qr = encodeQR('https://trmoo.github.io/qr-maker/', { ecl: 'M' });
      const { got } = mismatch(qr, { shape, margin: 4, pixelSize: 720 });
      const corners = [[0, 0], [0, qr.size - 7], [qr.size - 7, 0]];
      for (const [oy, ox] of corners) {
        const ring = [];     // 겉테두리 (거리 3)
        const gap = [];      // 흰 틈 (거리 2)
        const core = [];     // 가운데 3×3 (거리 0~1)
        for (let dy = 0; dy < 7; dy++) {
          for (let dx = 0; dx < 7; dx++) {
            const d = Math.max(Math.abs(dy - 3), Math.abs(dx - 3));
            const v = got[oy + dy][ox + dx];
            if (d === 3) ring.push(v); else if (d === 2) gap.push(v); else core.push(v);
          }
        }
        ok(ring.every((v) => v === 1), `${SHAPES[shape].label} · (${oy},${ox}) 겉테두리 24칸이 모두 칠해진다`);
        ok(gap.every((v) => v === 0), `${SHAPES[shape].label} · (${oy},${ox}) 흰 틈 16칸이 모두 비어 있다`);
        ok(core.every((v) => v === 1), `${SHAPES[shape].label} · (${oy},${ox}) 가운데 3×3 이 칠해진다`);
      }
    }
  });

  describe('둥근 위치 찾기 무늬 — 칸 가운데가 확실히 칠해지는가', () => {
    // ⚠⚠ 왜 이 시험이 있나 (2026-11-17) —
    //   SVG 의 겉테두리는 **테두리선**이라 길의 가운데를 따라 두껍게 그려진다.
    //   7×7 겉면을 그대로 따라 그리면 고리가 반 칸 밀려 40칸이 어긋났고(둥근 네모·동그라미),
    //   모서리를 많이 둥글리면 네 귀퉁이 칸이 **반만 칠해진 회색**이 되어 휴대폰이 헷갈린다.
    //   node 에는 SVG 를 그려 볼 수단이 없으니, 렌더러가 쓰는 `RING` 값 그대로
    //   「칸 가운데가 선 안에 들어오는가」를 자리로 셈해서 지킨다.
    const SAFE = 0.12;   // 가장자리에서 이만큼은 떨어져 있어야 회색이 안 된다

    /** 둥근 네모의 바깥까지 거리 (안쪽이면 음수) */
    const sdRoundRect = (px, py, cx, cy, hx, hy, r) => {
      const qx = Math.abs(px - cx) - (hx - r);
      const qy = Math.abs(py - cy) - (hy - r);
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
    };

    const qr = encodeQR('https://trmoo.github.io/qr-maker/', { ecl: 'M' });
    const margin = 4;

    // ① SVG — 테두리선이 겉 한 줄만 덮는가
    // ⚠ 7×7 만 보면 「선이 밖(분리 여백)으로 삐져나가는」 결함을 놓친다 — 9×9 로 본다
    let svgBad = 0, svgEdge = 0;
    for (let dy = -1; dy < 8; dy++) {
      for (let dx = -1; dx < 8; dx++) {
        const cx = margin + 3.5, cy = margin + 3.5;            // 7×7 의 가운데
        const half = 3.5 - RING.inset;                          // 들여 그린 길의 반지름
        const sd = sdRoundRect(margin + dx + 0.5, margin + dy + 0.5, cx, cy, half, half, RING.radius);
        const inStroke = Math.abs(sd) <= RING.width / 2;
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;  // 가운데 3×3
        const d = Math.max(Math.abs(dy - 3), Math.abs(dx - 3));
        const want = d === 3 || core;                           // d === 4 는 흰 분리 여백
        if ((inStroke || core) !== want) svgBad++;
        // 선이 덮는 칸은 가장자리에서 넉넉히 떨어져 있어야 한다
        if (inStroke && Math.abs(Math.abs(sd) - RING.width / 2) < SAFE) svgEdge++;
      }
    }
    eq(svgBad, 0, 'SVG 테두리선이 겉 한 줄과 가운데 3×3 을 정확히 덮는다');
    eq(svgEdge, 0, 'SVG 테두리선이 덮는 칸은 가운데가 가장자리에 걸치지 않는다');
    ok(toSVG(qr, { margin, shape: 'round' }).includes(`M${margin + RING.inset} `),
      `둥근 겉테두리를 ${RING.inset}칸 들여 그린다 (안 들이면 반 칸 밀린다)`);

    // ② 캔버스 — 짝홀(evenodd) 고리가 겉 한 줄만 덮는가
    let cvBad = 0, cvEdge = 0;
    for (let dy = -1; dy < 8; dy++) {
      for (let dx = -1; dx < 8; dx++) {
        const px = dx + 0.5, py = dy + 0.5;
        const outer = sdRoundRect(px, py, 3.5, 3.5, 3.5, 3.5, RING_OUTER);
        const inner = sdRoundRect(px, py, 3.5, 3.5, 2.5, 2.5, Math.max(0, RING_OUTER - 1));
        const ring = outer <= 0 && inner > 0;
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        const want = Math.max(Math.abs(dy - 3), Math.abs(dx - 3)) === 3 || core;  // 밖 한 줄은 흰 여백
        if ((ring || core) !== want) cvBad++;
        if (ring && (Math.abs(outer) < SAFE || Math.abs(inner) < SAFE)) cvEdge++;
      }
    }
    eq(cvBad, 0, '캔버스 고리가 겉 한 줄과 가운데 3×3 을 정확히 덮는다');
    eq(cvEdge, 0, '캔버스 고리가 덮는 칸은 가운데가 가장자리에 걸치지 않는다');
    ok(RING_OUTER <= 1.2, '겉 모서리를 1.2칸보다 더 둥글리면 귀퉁이 칸이 회색이 된다');
  });

  describe('색·여백·투명 배경', () => {
    const qr = encodeQR('https://trmoo.github.io/qr-maker/', { ecl: 'M' });

    // 색을 바꿔도 격자는 그대로
    eq(mismatch(qr, { fg: '#1d4ed8', bg: '#fef3c7', margin: 4 }).bad, 0, '색을 바꿔도 칸은 그대로다');

    // 여백 — 칸 수와 그림 크기
    for (const margin of [0, 1, 4, 8]) {
      const r = mismatch(qr, { margin, pixelSize: 720 });
      eq(r.bad, 0, `여백 ${margin}칸에서도 칸이 어긋나지 않는다`);
      eq(r.info.margin, margin, `여백 ${margin}칸이 그대로 쓰인다`);
      eq(r.canvas.width, r.info.cell * (qr.size + margin * 2), `여백 ${margin}칸이면 그림 크기도 그만큼 는다`);
    }

    // 투명 배경이면 바탕을 칠하지 않는다 — 그래도 어두운 칸은 그대로
    const clear = makeCanvas();
    const info = drawCanvas(clear, qr, { transparent: true, margin: 4 });
    eq(clear.colorAt(info.cell / 2, info.cell / 2), null, '투명 배경이면 여백이 비어 있다');
    eq(mismatch(qr, { transparent: true, margin: 4 }).bad, 0, '투명 배경에서도 칸은 그대로다');

    // 그림 크기 — 한 칸이 정수 픽셀이라야 눈금이 흐려지지 않는다
    for (const pixelSize of [240, 512, 720, 1024, 2048]) {
      const r = mismatch(qr, { pixelSize, margin: 4 });
      ok(Number.isInteger(r.info.cell) && r.info.cell >= 1, `${pixelSize}px 로 받으면 한 칸이 정수 픽셀`);
      ok(r.canvas.width <= pixelSize, `${pixelSize}px 를 넘지 않는다`);
      eq(r.bad, 0, `${pixelSize}px 에서도 칸이 어긋나지 않는다`);
    }
  });

  describe('가운데 그림(로고)', () => {
    const qr = encodeQR('https://trmoo.github.io/qr-maker/', { ecl: 'H' });
    const canvas = makeCanvas();
    const fakeImg = { width: 100, height: 100 };
    const info = drawCanvas(canvas, qr, { logo: fakeImg, logoRatio: 0.2, margin: 4, pixelSize: 720 });
    const mid = canvas.width / 2;
    eq(canvas.colorAt(mid, mid), '#image', '가운데는 그림이 덮는다');
    // 그림은 가운데만 덮고 위치 찾기 무늬는 건드리지 않는다
    const got = readModules(canvas, qr, info);
    const corner = [[3, 3], [3, qr.size - 4], [qr.size - 4, 3]];
    for (const [y, x] of corner) eq(got[y][x], 1, `(${y},${x}) 위치 찾기 무늬 가운데는 그림에 가려지지 않는다`);
  });

  describe('오류 정정 체험 — 가린 칸만 바탕색이 된다', () => {
    const qr = encodeQR('https://trmoo.github.io/qr-maker/', { ecl: 'H' });
    const damaged = new Set();
    const picked = [];
    for (let y = 0; y < qr.size && picked.length < 8; y++) {
      for (let x = 0; x < qr.size && picked.length < 8; x++) {
        if (qr.part[y][x] === PART.DATA && qr.modules[y][x]) { damaged.add(`${y},${x}`); picked.push([y, x]); }
      }
    }
    const canvas = makeCanvas();
    const info = drawDamaged(canvas, qr, damaged, { margin: 4, pixelSize: 720, bg: '#ffffff', hideMarks: true });
    const got = readModules(canvas, qr, info);
    for (const [y, x] of picked) eq(got[y][x], 0, `(${y},${x}) 가린 칸은 바탕색이 된다`);
    // 가리지 않은 칸은 그대로여야 한다 — 특히 위치 찾기 무늬
    let bad = 0;
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (damaged.has(`${y},${x}`)) continue;
        if (got[y][x] !== (qr.modules[y][x] ? 1 : 0)) bad++;
      }
    }
    eq(bad, 0, '가리지 않은 칸은 하나도 바뀌지 않는다');
  });
}
