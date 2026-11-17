/*!
 * QR 코드 만들기 — 「이대로 스캔이 될까」 살펴보기
 * © 2026 티쳐무 · 모든 권리 보유. 학교 수업 목적으로만 이용해 주세요.
 *
 * 색을 바꾸고 로고를 넣으면 보기는 좋아지지만 스캔이 안 될 수 있다.
 * 여기서 미리 재어 보고 까닭과 함께 알려 준다. (DOM 을 쓰지 않으므로 시험할 수 있다)
 */
import { logoCoverage } from './render.js';
import { damageReport } from './qr.js';

/**
 * 가운데 그림이 덮는 모듈 자리를 모은다 (그림과 같은 자리로 셈한다).
 * 덮는 넓이만 보면 「30% 까지 복구되니 괜찮다」고 잘못 말하게 된다 —
 * 오류 정정은 블록마다 따로 셈하는데 가운데 그림은 한곳에 몰려 있기 때문이다.
 */
export function logoCells(qr, logoRatio) {
  const { side } = logoCoverage(qr, logoRatio); // 흰 테두리까지 더한 한 변
  const start = Math.floor((qr.size - side) / 2);
  const cells = new Set();
  for (let y = start; y < start + side; y++) {
    for (let x = start; x < start + side; x++) {
      if (y >= 0 && x >= 0 && y < qr.size && x < qr.size) cells.add(`${y},${x}`);
    }
  }
  return cells;
}

/** #rrggbb 또는 #rgb 을 0~255 세 값으로 */
export function parseColor(hex) {
  let s = String(hex || '').trim().replace(/^#/, '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

/** 상대 밝기 (WCAG 식) */
export function luminance(hex) {
  const rgb = parseColor(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 두 색의 밝기 차이 비 (1~21) */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * 지금 설정으로 스캔이 잘 될지 살펴본다.
 * @returns {{level:'good'|'warn'|'bad', items:Array<{level,text}>}}
 */
export function scanAdvice(qr, opt = {}) {
  const items = [];
  const fg = opt.fg ?? '#111827';
  const bg = opt.bg ?? '#ffffff';

  // ① 색 — 밝은 바탕에 어두운 무늬여야 한다
  const ratio = contrastRatio(fg, bg);
  const lf = luminance(fg);
  const lb = luminance(bg);
  if (ratio === null) {
    items.push({ level: 'warn', text: '색을 읽을 수 없습니다. #RRGGBB 꼴로 넣어 주세요.' });
  } else if (lf > lb) {
    items.push({
      level: 'bad',
      text: `무늬가 바탕보다 밝습니다(색을 거꾸로 쓴 상태). 대부분의 휴대폰은 「밝은 바탕 + 어두운 무늬」만 읽습니다.`,
    });
  } else if (ratio < 3) {
    items.push({ level: 'bad', text: `무늬와 바탕의 밝기 차이가 ${ratio.toFixed(1)}배뿐입니다. 7배 이상으로 하세요.` });
  } else if (ratio < 7) {
    items.push({ level: 'warn', text: `밝기 차이가 ${ratio.toFixed(1)}배입니다. 종이에 인쇄하면 안 읽힐 수 있어 7배 이상을 권합니다.` });
  }

  // ② 조용한 여백 — 규격은 4모듈
  const margin = opt.margin ?? 4;
  if (margin === 0) items.push({ level: 'bad', text: '여백이 없습니다. QR 코드는 사방에 빈 테두리가 있어야 휴대폰이 끝을 찾습니다.' });
  else if (margin < 4) items.push({ level: 'warn', text: `여백이 ${margin}모듈입니다. 규격은 4모듈을 권합니다.` });

  // ③ 모양
  if (opt.shape === 'dot') items.push({ level: 'warn', text: '동그라미 모양은 칸 사이가 떨어져 보여, 멀리서 찍거나 어두운 곳에서는 잘 안 읽힐 수 있습니다.' });

  // ④ 가운데 그림(로고) — 넓이가 아니라 실제로 망가지는 블록으로 따진다
  if (opt.logo || opt.logoDataUrl) {
    const cov = logoCoverage(qr, opt.logoRatio);
    const dmg = damageReport(qr, logoCells(qr, opt.logoRatio));
    if (!dmg.readable) {
      items.push({
        level: 'bad',
        text: `가운데 그림이 너무 큽니다 — 블록 ${dmg.brokenBlocks}개가 고칠 수 있는 한도(${dmg.limit}개)를 넘습니다. `
          + `그림을 줄이거나 오류 정정 수준을 올려 주세요. (덮는 넓이 ${cov.percent.toFixed(1)}%)`,
      });
    } else {
      const worst = Math.max(0, ...dmg.perBlock);
      const level = worst > dmg.limit * 0.8 ? 'warn' : 'good';
      items.push({
        level,
        text: `가운데 그림이 ${cov.percent.toFixed(1)}% 를 덮습니다. 가장 많이 망가진 블록이 `
          + `${worst}개로 한도 ${dmg.limit}개 안에 있어 읽을 수 있습니다`
          + (level === 'warn' ? ' — 다만 아슬아슬하니 인쇄 전에 꼭 찍어 보세요.' : '.'),
      });
    }
    if (qr.ecl !== 'H') items.push({ level: 'warn', text: '가운데 그림을 넣을 때는 오류 정정 수준을 H(높음)로 두는 편이 안전합니다.' });
  }

  // ⑤ 크기 — 종이에 인쇄할 때
  if (qr.version >= 10) {
    items.push({
      level: qr.version >= 20 ? 'warn' : 'good',
      text: `담은 내용이 많아 격자가 ${qr.size}×${qr.size} 칸입니다. 칸이 잘게 나뉘므로 종이에 인쇄할 때 `
        + `${Math.ceil(qr.size * 0.5)}mm 보다 작게 만들지 마세요.`,
    });
  }

  // ⑥ 투명 배경
  if (opt.transparent) items.push({ level: 'warn', text: '투명 배경으로 받으면 어두운 바탕에 올렸을 때 안 읽힙니다. 흰 종이나 밝은 곳에만 쓰세요.' });

  const level = items.some((i) => i.level === 'bad') ? 'bad'
    : items.some((i) => i.level === 'warn') ? 'warn' : 'good';
  return { level, items, ratio };
}

/** 인쇄할 때 권하는 최소 크기 (mm) — 한 칸이 0.5mm 는 되어야 한다 */
export function minPrintMm(qr, margin = 4) {
  return Math.ceil((qr.size + margin * 2) * 0.5);
}
