/*!
 * QR 코드 만들기 — 그리기 (캔버스·SVG)
 * © 2026 티쳐무 · 모든 권리 보유. 학교 수업 목적으로만 이용해 주세요.
 *
 * 한 가지 중요한 점 — 위치 찾기 무늬(세 귀퉁이의 큰 네모)와 정렬 무늬는
 * 휴대폰이 QR 코드를 「찾는」 데 쓰는 부분이라 모양을 바꾸지 않는다.
 * 둥글게·동그라미 모양은 데이터 칸에만 준다.
 */
import { PART } from './qr.js';

export const SHAPES = {
  square: { key: 'square', label: '각진 네모', radius: 0 },
  round: { key: 'round', label: '둥근 네모', radius: 0.3 },
  dot: { key: 'dot', label: '동그라미', radius: 0.5 },
};

export const DEFAULTS = {
  fg: '#111827',
  bg: '#ffffff',
  margin: 4,      // 조용한 여백 (모듈 수). 규격은 4모듈을 권한다.
  shape: 'square',
  pixelSize: 1024,
  transparent: false,
  logoRatio: 0.2,
};

/** 모듈 하나가 몇 픽셀이 되는지 — 눈금이 흐려지지 않게 정수로 맞춘다 */
export function layoutFor(qr, opt = {}) {
  const margin = opt.margin ?? DEFAULTS.margin;
  const total = qr.size + margin * 2;
  const wanted = opt.pixelSize ?? DEFAULTS.pixelSize;
  const cell = Math.max(1, Math.floor(wanted / total));
  return { margin, total, cell, px: cell * total };
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** 위치 찾기 무늬인가 (세 귀퉁이) */
function isFinderArea(qr, y, x) {
  const p = qr.part[y][x];
  return p === PART.FINDER;
}

/**
 * 캔버스에 그린다.
 * @param {HTMLCanvasElement} canvas
 * @param {object} qr encodeQR 결과
 * @param {object} opt { fg, bg, margin, shape, pixelSize, transparent, logo, logoRatio, highlight }
 */
export function drawCanvas(canvas, qr, opt = {}) {
  const { margin, cell, px } = layoutFor(qr, opt);
  const fg = opt.fg ?? DEFAULTS.fg;
  const bg = opt.bg ?? DEFAULTS.bg;
  const shape = SHAPES[opt.shape] ? SHAPES[opt.shape] : SHAPES.square;
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, px, px);
  if (!opt.transparent) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, px, px);
  }
  ctx.fillStyle = fg;

  const at = (i) => (i + margin) * cell;

  // ① 위치 찾기 무늬 — 모양을 바꾸지 않고 통째로 그린다
  const finderOrigins = [[0, 0], [0, qr.size - 7], [qr.size - 7, 0]];
  const ringRadius = shape.radius > 0 ? cell * 1.6 : 0;
  for (const [oy, ox] of finderOrigins) {
    // 겉테두리 (7×7 가운데 1칸 두께)
    roundRectPath(ctx, at(ox), at(oy), cell * 7, cell * 7, ringRadius);
    roundRectPath(ctx, at(ox) + cell, at(oy) + cell, cell * 5, cell * 5, Math.max(0, ringRadius - cell));
    ctx.fill('evenodd');
    // 가운데 3×3
    roundRectPath(ctx, at(ox) + cell * 2, at(oy) + cell * 2, cell * 3, cell * 3,
      shape.radius > 0 ? cell * 0.7 : 0);
    ctx.fill();
  }

  // ② 나머지 모듈
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (!qr.modules[y][x]) continue;
      if (isFinderArea(qr, y, x)) continue;
      const keepSquare = qr.part[y][x] === PART.ALIGNMENT || qr.part[y][x] === PART.TIMING;
      const r = keepSquare ? 0 : shape.radius * cell;
      if (r <= 0) ctx.fillRect(at(x), at(y), cell, cell);
      else { roundRectPath(ctx, at(x), at(y), cell, cell, r); ctx.fill(); }
    }
  }

  // ③ 가운데 그림(로고)
  if (opt.logo) {
    const ratio = Math.min(0.3, Math.max(0.1, opt.logoRatio ?? DEFAULTS.logoRatio));
    const box = Math.round(qr.size * ratio) * cell;
    const pad = Math.max(cell, Math.round(box * 0.08));
    const cx = (px - box) / 2;
    ctx.fillStyle = opt.transparent ? '#ffffff' : bg;
    roundRectPath(ctx, cx - pad, cx - pad, box + pad * 2, box + pad * 2, cell * 1.2);
    ctx.fill();
    try {
      ctx.drawImage(opt.logo, cx, cx, box, box);
    } catch { /* 그림을 못 그려도 QR 코드는 남는다 */ }
  }

  return { px, cell, margin };
}

/** 가운데 그림이 덮는 모듈 수와 비율 */
export function logoCoverage(qr, logoRatio) {
  const ratio = Math.min(0.3, Math.max(0.1, logoRatio ?? DEFAULTS.logoRatio));
  const side = Math.round(qr.size * ratio) + 2; // 흰 테두리까지
  const covered = side * side;
  const dataModules = qr.size * qr.size;
  return { side, covered, percent: (covered / dataModules) * 100 };
}

/** SVG 글자로 만든다 (인쇄·확대에 좋다) */
export function toSVG(qr, opt = {}) {
  const margin = opt.margin ?? DEFAULTS.margin;
  const fg = opt.fg ?? DEFAULTS.fg;
  const bg = opt.bg ?? DEFAULTS.bg;
  const shape = SHAPES[opt.shape] ? SHAPES[opt.shape] : SHAPES.square;
  const total = qr.size + margin * 2;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total * 10}" height="${total * 10}" shape-rendering="${shape.radius > 0 ? 'geometricPrecision' : 'crispEdges'}">`);
  parts.push('<!-- QR 코드 만들기 · © 2026 티쳐무 · 모든 권리 보유 -->');
  if (!opt.transparent) parts.push(`<rect width="${total}" height="${total}" fill="${bg}"/>`);

  const d = [];
  const finderOrigins = [[0, 0], [0, qr.size - 7], [qr.size - 7, 0]];
  const isFinder = (y, x) => qr.part[y][x] === PART.FINDER;

  // 위치 찾기 무늬
  for (const [oy, ox] of finderOrigins) {
    const X = ox + margin, Y = oy + margin;
    if (shape.radius > 0) {
      parts.push(`<path d="M${X} ${Y + 1.6}a1.6 1.6 0 0 1 1.6-1.6h3.8a1.6 1.6 0 0 1 1.6 1.6v3.8a1.6 1.6 0 0 1-1.6 1.6h-3.8a1.6 1.6 0 0 1-1.6-1.6z" fill="none" stroke="${fg}" stroke-width="1"/>`);
      parts.push(`<rect x="${X + 2}" y="${Y + 2}" width="3" height="3" rx="0.7" fill="${fg}"/>`);
    } else {
      // 겉테두리를 네 조각으로
      d.push(`M${X} ${Y}h7v1h-7z`, `M${X} ${Y + 6}h7v1h-7z`, `M${X} ${Y + 1}h1v5h-1z`, `M${X + 6} ${Y + 1}h1v5h-1z`);
      d.push(`M${X + 2} ${Y + 2}h3v3h-3z`);
    }
  }

  // 나머지 모듈
  const circles = [];
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (!qr.modules[y][x] || isFinder(y, x)) continue;
      const keepSquare = qr.part[y][x] === PART.ALIGNMENT || qr.part[y][x] === PART.TIMING;
      const X = x + margin, Y = y + margin;
      if (shape.key === 'dot' && !keepSquare) circles.push(`<circle cx="${X + 0.5}" cy="${Y + 0.5}" r="0.5"/>`);
      else if (shape.key === 'round' && !keepSquare) d.push(`M${X + 0.3} ${Y}h0.4a0.3 0.3 0 0 1 0.3 0.3v0.4a0.3 0.3 0 0 1-0.3 0.3h-0.4a0.3 0.3 0 0 1-0.3-0.3v-0.4a0.3 0.3 0 0 1 0.3-0.3z`);
      else d.push(`M${X} ${Y}h1v1h-1z`);
    }
  }
  if (d.length) parts.push(`<path fill="${fg}" d="${d.join('')}"/>`);
  if (circles.length) parts.push(`<g fill="${fg}">${circles.join('')}</g>`);

  if (opt.logoDataUrl) {
    const ratio = Math.min(0.3, Math.max(0.1, opt.logoRatio ?? DEFAULTS.logoRatio));
    const box = Math.round(qr.size * ratio);
    const pad = Math.max(1, Math.round(box * 0.08));
    const at = (total - box) / 2;
    parts.push(`<rect x="${at - pad}" y="${at - pad}" width="${box + pad * 2}" height="${box + pad * 2}" rx="1.2" fill="${opt.transparent ? '#ffffff' : bg}"/>`);
    parts.push(`<image x="${at}" y="${at}" width="${box}" height="${box}" href="${opt.logoDataUrl}" preserveAspectRatio="xMidYMid meet"/>`);
  }
  parts.push('</svg>');
  return parts.join('\n');
}

// ───────────────────────── 「원리」 화면용 그리기 ─────────────────────────
/** 모듈의 종류마다 쓰는 색 */
export const PART_COLORS = {
  [PART.DATA]: { dark: '#111827', light: '#f8fafc', name: '데이터와 오류 정정 코드' },
  [PART.FINDER]: { dark: '#dc2626', light: '#fee2e2', name: '위치 찾기 무늬' },
  [PART.SEPARATOR]: { dark: '#fca5a5', light: '#fef2f2', name: '분리 여백' },
  [PART.TIMING]: { dark: '#2563eb', light: '#dbeafe', name: '타이밍 무늬' },
  [PART.ALIGNMENT]: { dark: '#16a34a', light: '#dcfce7', name: '정렬 무늬' },
  [PART.FORMAT]: { dark: '#b45309', light: '#fef3c7', name: '형식 정보' },
  [PART.VERSION]: { dark: '#7e22ce', light: '#f3e8ff', name: '버전 정보' },
  [PART.DARK]: { dark: '#0e7490', light: '#cffafe', name: '늘 검은 모듈' },
};

/**
 * 모듈의 종류를 색으로 갈라 그린다 (해부도).
 * @param {object} opt { pixelSize, only: PART 값이면 그것만 도드라지게, grid: 눈금 }
 */
export function drawParts(canvas, qr, opt = {}) {
  const margin = 2;
  const total = qr.size + margin * 2;
  const cell = Math.max(2, Math.floor((opt.pixelSize || 720) / total));
  const px = cell * total;
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, px, px);
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      const p = qr.part[y][x];
      const c = PART_COLORS[p];
      const dim = opt.only !== undefined && opt.only !== null && opt.only !== p;
      ctx.fillStyle = qr.modules[y][x] ? c.dark : c.light;
      if (dim) ctx.globalAlpha = 0.18;
      ctx.fillRect((x + margin) * cell, (y + margin) * cell, cell, cell);
      ctx.globalAlpha = 1;
    }
  }
  if (opt.grid && cell >= 6) {
    ctx.strokeStyle = 'rgba(0,0,0,.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= qr.size; i++) {
      const at = (i + margin) * cell + 0.5;
      ctx.beginPath(); ctx.moveTo(at, margin * cell); ctx.lineTo(at, (qr.size + margin) * cell); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(margin * cell, at); ctx.lineTo((qr.size + margin) * cell, at); ctx.stroke();
    }
  }
  return { cell, margin, px };
}

/**
 * 일부를 가린 QR 코드를 그린다 (오류 정정 체험).
 * 가린 칸은 바탕색으로 칠한다 — 실제로 스티커를 붙인 것과 같은 상태가 되어,
 * 휴대폰으로 찍어 정말 읽히는지 확인할 수 있다.
 */
export function drawDamaged(canvas, qr, damaged, opt = {}) {
  const info = drawCanvas(canvas, qr, { ...opt, logo: null });
  const { cell, margin } = info;
  const ctx = canvas.getContext('2d');
  for (const key of damaged) {
    const [y, x] = key.split(',').map(Number);
    ctx.fillStyle = opt.bg || '#ffffff';
    ctx.fillRect((x + margin) * cell, (y + margin) * cell, cell, cell);
    if (!opt.hideMarks) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = Math.max(1, cell * 0.12);
      ctx.strokeRect((x + margin) * cell + 1, (y + margin) * cell + 1, cell - 2, cell - 2);
    }
  }
  return info;
}

/** 캔버스 위에서 누른 자리가 몇 번째 칸인지 */
export function cellAt(canvas, event, qr, margin) {
  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  const cell = canvas.width / (qr.size + margin * 2);
  const x = Math.floor(((event.clientX - rect.left) * scale) / cell) - margin;
  const y = Math.floor(((event.clientY - rect.top) * scale) / cell) - margin;
  if (x < 0 || y < 0 || x >= qr.size || y >= qr.size) return null;
  return { x, y };
}

/** 글자로 그린 QR 코드 (시험·터미널 확인용) */
export function toText(qr, margin = 2) {
  const lines = [];
  const blank = '  '.repeat(qr.size + margin * 2);
  for (let i = 0; i < margin; i++) lines.push(blank);
  for (let y = 0; y < qr.size; y++) {
    let line = '  '.repeat(margin);
    for (let x = 0; x < qr.size; x++) line += qr.modules[y][x] ? '██' : '  ';
    lines.push(line + '  '.repeat(margin));
  }
  for (let i = 0; i < margin; i++) lines.push(blank);
  return lines.join('\n');
}
