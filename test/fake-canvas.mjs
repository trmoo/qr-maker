/*!
 * QR 코드 만들기 — 가짜 캔버스 (시험 도구)
 * © 2026 티쳐무 · 모든 권리 보유.
 *
 * 왜 이것이 필요한가 —
 * node 에는 캔버스가 없어서 `drawCanvas()`(화면 미리보기와 PNG 내려받기가 쓰는 길)가
 * 시험을 하나도 받지 않고 있었다. 격자(`encodeQR`)가 규격과 한 칸까지 같아도,
 * **그리는 쪽**이 틀리면 휴대폰은 QR 코드를 못 읽는다. 실제로 그런 일이 났다
 * (위치 찾기 무늬가 통째로 뭉개져 있었다 — 자세한 내용은 CLAUDE.md ④).
 *
 * 그래서 「칸 하나의 가운데 점이 무슨 색이 되는가」만 셈하는 작은 캔버스를 만들었다.
 * 그림을 진짜로 그리지는 않고, 칠하기 명령을 차례로 쌓아 두었다가 점을 물어보면
 * **마지막으로 그 점을 덮은 명령의 색**을 돌려준다.
 *
 * ⚠ 네모(둥근 네모·원 포함)의 **가운데 점**만 묻는 데 쓴다. 모서리가 둥근 정도나
 *   테두리 두께는 알 수 없다. 칸이 칠해졌는지 아닌지를 보는 데는 그것으로 충분하다.
 */

const EPS = 1e-9;

function bbox(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

const inside = (b, x, y) =>
  x >= b.x0 - EPS && x <= b.x1 + EPS && y >= b.y0 - EPS && y <= b.y1 + EPS;

/** 캔버스 하나와 그 2D 그림판을 만든다 */
export function makeCanvas() {
  const ops = [];
  let sub = [];      // 지금 그리는 길 — 네모(점 꾸러미) 여러 개
  let cur = null;

  const ctx = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1,

    beginPath() { sub = []; cur = null; },
    moveTo(x, y) { cur = [[x, y]]; sub.push(cur); },
    lineTo(x, y) { if (!cur) this.moveTo(x, y); else cur.push([x, y]); },
    arcTo(x1, y1, x2, y2) { if (cur) { cur.push([x1, y1], [x2, y2]); } },
    closePath() { },
    arc(cx, cy, r) { cur = [[cx - r, cy - r], [cx + r, cy + r]]; sub.push(cur); },
    rect(x, y, w, h) { cur = [[x, y], [x + w, y + h]]; sub.push(cur); },

    fill(rule) {
      if (!sub.length) return;
      ops.push({ boxes: sub.map(bbox), rule: rule === 'evenodd' ? 'evenodd' : 'nonzero', color: this.fillStyle, alpha: this.globalAlpha });
    },
    fillRect(x, y, w, h) {
      ops.push({ boxes: [bbox([[x, y], [x + w, y + h]])], rule: 'nonzero', color: this.fillStyle, alpha: this.globalAlpha });
    },
    clearRect(x, y, w, h) {
      ops.push({ boxes: [bbox([[x, y], [x + w, y + h]])], rule: 'nonzero', color: null, alpha: 1 });
    },
    // 테두리와 그림은 칸 색 셈에 넣지 않는다 (가운데 점을 묻는 데 쓰므로)
    stroke() { },
    strokeRect() { },
    drawImage(img, x, y, w, h) {
      ops.push({ boxes: [bbox([[x, y], [x + w, y + h]])], rule: 'nonzero', color: '#image', alpha: 1 });
    },
    save() { }, restore() { }, translate() { }, scale() { },
    setTransform() { }, measureText() { return { width: 0 }; }, fillText() { },
  };

  const canvas = {
    width: 0,
    height: 0,
    getContext() { return ctx; },
    /** 그 점이 무슨 색이 되는가 (아무것도 안 칠해졌으면 null) */
    colorAt(x, y) {
      let color = null;
      for (const op of ops) {
        if (op.alpha < 1) continue; // 반투명은 겹침 셈이 복잡해 건너뛴다 (해부도에만 쓴다)
        let hits = 0;
        for (const b of op.boxes) if (inside(b, x, y)) hits++;
        const covered = op.rule === 'evenodd' ? hits % 2 === 1 : hits > 0;
        if (covered) color = op.color;
      }
      return color;
    },
    get ops() { return ops; },
  };
  return canvas;
}

/**
 * 그려진 캔버스를 다시 격자로 읽어 낸다 — 「칸마다 가운데 점이 어두운가」.
 * @returns {number[][]} 0/1 격자 (QR 코드 본체만, 여백은 뺀다)
 */
export function readModules(canvas, qr, info, fg = '#111827') {
  const { cell, margin } = info;
  const out = [];
  for (let y = 0; y < qr.size; y++) {
    const row = [];
    for (let x = 0; x < qr.size; x++) {
      const cx = (x + margin) * cell + cell / 2;
      const cy = (y + margin) * cell + cell / 2;
      row.push(canvas.colorAt(cx, cy) === fg ? 1 : 0);
    }
    out.push(row);
  }
  return out;
}
