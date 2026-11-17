/*!
 * QR 코드 만들기 — ② QR 코드 원리 화면
 * © 2026 티쳐무 · 모든 권리 보유. 학교 수업 목적으로만 이용해 주세요.
 *
 * 「정보」 Ⅱ 데이터(부호화·오류 정정) 수업에 쓸 수 있는 네 화면.
 *   해부도 — QR 코드의 어느 부분이 무엇인가
 *   오류 정정 — 가려도 읽히는 까닭을 직접 가려 보며
 *   마스크 — 여덟 가지 가운데 왜 그것을 골랐나
 *   담기는 과정 — 글이 비트·코드워드를 거쳐 격자가 되기까지
 */
import { encodeQR, ECL, PART, damageReport, chooseMode, blockLayout, toUtf8 } from '../lib/qr.js';
import { drawParts, drawDamaged, cellAt, PART_COLORS, toSVG } from '../lib/render.js';
import { h, fill, pills, note, say, beginScreen, onResize } from '../lib/ui.js';

const SCREENS = [
  { key: 'anatomy', icon: '🧩', label: '해부도' },
  { key: 'ec', icon: '🛡️', label: '오류 정정 체험' },
  { key: 'mask', icon: '🎭', label: '마스크 겨루기' },
  { key: 'steps', icon: '🔢', label: '담기는 과정' },
];

let screen = 'anatomy';
let sample = 'https://trmoo.github.io/comedu_portal/';
let sampleEcl = 'M';

export function render(root, sub) {
  if (sub && SCREENS.some((s) => s.key === sub)) screen = sub;
  beginScreen();

  const body = h('div', { class: 'why-body' });
  fill(root,
    pills(SCREENS, screen, (key) => { location.hash = `#why/${key}`; }),
    body,
  );
  const draw = { anatomy, ec, mask, steps }[screen];
  draw(body);
}

/** 화면마다 쓰는 「견본 글」 입력 줄 */
function sampleRow(onChange) {
  const input = h('input', { type: 'text', class: 'big', value: sample });
  input.addEventListener('input', () => { sample = input.value; onChange(); });
  const sel = h('select', null, ...['L', 'M', 'Q', 'H'].map((e) => h('option', { value: e }, `${e} · ${ECL[e].recover}%`)));
  sel.value = sampleEcl;
  sel.addEventListener('change', () => { sampleEcl = sel.value; onChange(); });
  return h('div', { class: 'samplerow' },
    h('label', null, '살펴볼 내용'), input,
    h('label', null, '오류 정정'), sel,
  );
}

function makeQR() {
  try {
    return encodeQR(sample || ' ', { ecl: sampleEcl });
  } catch {
    return encodeQR('https://example.com', { ecl: sampleEcl });
  }
}

// ───────────────────────── ① 해부도 ─────────────────────────
function anatomy(box) {
  let only = null;
  const canvas = h('canvas', { class: 'big-canvas' });
  const legend = h('div', { class: 'legend' });
  const detail = h('div', { class: 'partdetail' });

  const EXPLAIN = {
    [PART.FINDER]: '세 귀퉁이의 큰 네모. 휴대폰이 「여기에 QR 코드가 있다」를 가장 먼저 찾는 곳이고, 세 개의 자리로 기울어진 각도까지 알아낸다. 1:1:3:1:1 비율이라 어느 방향으로 선을 그어도 같은 비율로 읽힌다.',
    [PART.SEPARATOR]: '위치 찾기 무늬 바로 옆을 한 칸 비워 둔 띠. 데이터가 붙어 버리면 무늬를 못 알아보기 때문이다.',
    [PART.TIMING]: '검-흰이 번갈아 가는 한 줄. 칸의 폭을 재는 자 노릇을 해서, 사진이 조금 늘어나거나 비뚤어져도 몇 번째 칸인지 셀 수 있다.',
    [PART.ALIGNMENT]: '작은 네모들. 큰 QR 코드는 종이가 휘거나 비스듬히 찍히면 칸이 밀리는데, 이 무늬로 중간중간 자리를 다시 맞춘다. 버전 2부터 생기고 버전이 커질수록 많아진다.',
    [PART.FORMAT]: '오류 정정 수준과 몇 번 마스크를 썼는지를 적어 둔 15비트. 이것부터 읽어야 나머지를 해석할 수 있어, 두 곳에 똑같이 넣고 자체 오류 정정(BCH)까지 붙인다.',
    [PART.VERSION]: '버전 번호 18비트. 버전 7(45×45칸)부터 들어간다. 그보다 작으면 칸 수만 세어도 버전을 알 수 있어 넣지 않는다.',
    [PART.DARK]: '늘 검은 칸 하나. 규격이 그렇게 정했다. 흰 칸만 있는 자리가 생기지 않게 하는 기준점이다.',
    [PART.DATA]: '실제 내용과 오류 정정 코드가 들어가는 곳. 오른쪽 아래에서 시작해 두 칸 너비로 위아래를 오가며 채운다.',
  };

  function redraw() {
    const qr = makeQR();
    drawParts(canvas, qr, { pixelSize: 760, grid: qr.size <= 60, only });
    const counts = {};
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) counts[qr.part[y][x]] = (counts[qr.part[y][x]] || 0) + 1;
    }
    fill(legend);
    for (const key of Object.keys(PART_COLORS)) {
      const p = Number(key);
      if (!counts[p]) continue;
      legend.appendChild(h('button', {
        class: 'legend-item' + (only === p ? ' on' : ''),
        type: 'button',
        onclick: () => { only = only === p ? null : p; redraw(); },
      },
        h('span', { class: 'swatch', style: { background: PART_COLORS[p].dark } }),
        h('span', { class: 'lname' }, PART_COLORS[p].name),
        h('span', { class: 'lcount' }, `${counts[p]}칸`),
      ));
    }
    fill(detail,
      only === null
        ? note('info', '위의 이름을 누르면 그 부분만 도드라지고 설명이 나옵니다. 그림의 칸을 눌러도 됩니다.')
        : note('info', h('b', null, PART_COLORS[only].name + ' — '), EXPLAIN[only]),
      h('p', { class: 'hint' },
        `버전 ${qr.version} · ${qr.size}×${qr.size} = ${qr.size * qr.size}칸 가운데 `
        + `데이터와 오류 정정에 쓰는 칸이 ${counts[PART.DATA]}칸(${Math.round((counts[PART.DATA] / (qr.size * qr.size)) * 100)}%)입니다. `
        + '나머지는 모두 「찾고 맞추는 데」 쓰는 무늬입니다.'),
    );
  }

  canvas.addEventListener('click', (e) => {
    const qr = makeQR();
    const at = cellAt(canvas, e, qr, 2);
    if (!at) return;
    only = qr.part[at.y][at.x];
    redraw();
  });

  fill(box,
    h('h2', null, '🧩 QR 코드 해부도'),
    sampleRow(redraw),
    h('div', { class: 'cols' },
      h('section', { class: 'pane' }, canvas),
      h('section', { class: 'pane' }, h('h3', null, '부분 이름'), legend, detail),
    ),
  );
  redraw();
}

// ───────────────────────── ② 오류 정정 체험 ─────────────────────────
function ec(box) {
  let damaged = new Set();
  let hideMarks = false;
  const canvas = h('canvas', { class: 'big-canvas clickable' });
  const panel = h('div', { class: 'ecpanel' });
  let qr = makeQR();

  function redraw() {
    drawDamaged(canvas, qr, damaged, { pixelSize: 760, margin: 2, hideMarks });
    const r = damageReport(qr, damaged);
    const dataCells = qr.size * qr.size;
    const bars = h('div', { class: 'blocks' });
    r.perBlock.forEach((n, i) => {
      const over = n > r.limit;
      bars.appendChild(h('div', { class: 'blockbar' },
        h('span', { class: 'bname' }, `${i + 1}번 블록`),
        h('div', { class: 'btrack' },
          h('div', {
            class: 'bfill' + (over ? ' over' : ''),
            style: { width: `${Math.min(100, (n / Math.max(1, r.limit)) * 100)}%` },
          }),
        ),
        h('span', { class: 'bnum' + (over ? ' over' : '') }, `${n} / ${r.limit}`),
      ));
    });

    fill(panel,
      h('div', { class: 'verdict ' + (r.readable ? 'good' : 'bad') },
        r.readable ? '✅ 아직 읽을 수 있습니다' : '❌ 이제 읽을 수 없습니다',
        h('small', null, r.functionHit > 0
          ? `위치 찾기·타이밍 같은 기능 무늬를 ${r.functionHit}칸 가렸습니다. 이쪽은 오류 정정으로 되살릴 수 없습니다.`
          : r.readable
            ? `가린 칸 ${damaged.size}개 (전체의 ${((damaged.size / dataCells) * 100).toFixed(1)}%) · 망가진 코드워드 ${r.damagedCodewords}개`
            : `블록 ${r.brokenBlocks}개가 고칠 수 있는 한도(${r.limit}개)를 넘었습니다.`),
      ),
      h('p', { class: 'hint' },
        `오류 정정은 블록마다 따로 셈합니다. 이 QR 코드는 블록이 ${qr.layout.numBlocks}개이고, `
        + `블록마다 오류 정정 코드워드가 ${qr.layout.eccLen}개 있어 그 절반인 ${r.limit}개까지 고칠 수 있습니다. `
        + '그래서 한 곳에 몰아서 가리는 쪽이 골고루 가리는 쪽보다 위험합니다.'),
      bars,
      h('div', { class: 'btnrow' },
        h('button', { class: 'btn', onclick: () => { randomCover(20); } }, '무작위로 20칸 가리기'),
        h('button', { class: 'btn', onclick: () => { blockCover(); } }, '가운데를 네모로 가리기'),
        h('button', { class: 'btn', onclick: () => { damaged = new Set(); redraw(); } }, '모두 지우기'),
      ),
      h('label', { class: 'check' },
        (() => {
          const c = h('input', { type: 'checkbox' });
          c.checked = hideMarks;
          c.addEventListener('change', () => { hideMarks = c.checked; redraw(); });
          return c;
        })(),
        h('span', null, '빨간 표시 숨기기 (휴대폰으로 찍어 보기)'),
      ),
      note('info', h('b', null, '📷 해 보기 — '),
        '20칸쯤 가린 뒤 빨간 표시를 숨기고, 휴대폰 카메라로 화면을 찍어 보세요. '
        + '정말로 읽힙니다. 그다음 가운데를 크게 가려 「읽을 수 없음」이 될 때까지 늘려 보세요.'),
    );
  }

  function randomCover(n) {
    const cells = [];
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) if (qr.part[y][x] === PART.DATA) cells.push(`${y},${x}`);
    }
    for (let i = 0; i < n && cells.length; i++) {
      damaged.add(cells.splice(Math.floor(Math.random() * cells.length), 1)[0]);
    }
    redraw();
  }

  function blockCover() {
    const side = Math.max(3, Math.round(qr.size * 0.2));
    const start = Math.floor((qr.size - side) / 2);
    for (let y = start; y < start + side; y++) {
      for (let x = start; x < start + side; x++) damaged.add(`${y},${x}`);
    }
    redraw();
  }

  canvas.addEventListener('click', (e) => {
    const at = cellAt(canvas, e, qr, 2);
    if (!at) return;
    const key = `${at.y},${at.x}`;
    if (damaged.has(key)) damaged.delete(key);
    else damaged.add(key);
    redraw();
  });

  fill(box,
    h('h2', null, '🛡️ 가려도 읽히는 까닭'),
    sampleRow(() => { qr = makeQR(); damaged = new Set(); redraw(); }),
    h('div', { class: 'cols' },
      h('section', { class: 'pane' },
        canvas,
        h('p', { class: 'hint' }, '칸을 눌러 하나씩 가려 보세요. 다시 누르면 되돌아옵니다.'),
      ),
      h('section', { class: 'pane' }, panel),
    ),
  );
  redraw();
}

// ───────────────────────── ③ 마스크 겨루기 ─────────────────────────
function mask(box) {
  const grid = h('div', { class: 'maskgrid' });
  const info = h('div');

  function redraw() {
    const qr = makeQR();
    fill(grid);
    // ⚠ 벌점은 인코더가 겨룰 때 쓴 값을 그대로 가져온다.
    //   다 만들어진 QR 코드로 다시 재면 형식 정보가 섞여 숫자가 달라지고,
    //   「선택」 표시가 실제로 고른 마스크와 어긋난다.
    const scores = qr.maskScores;
    const best = qr.mask;
    for (let k = 0; k < 8; k++) {
      const one = encodeQR(sample || ' ', { ecl: sampleEcl, mask: k });
      const c = h('canvas', { class: 'mini-canvas' });
      // 작은 그림이라 여백 없이 그린다
      const cell = Math.max(2, Math.floor(260 / one.size));
      c.width = cell * one.size;
      c.height = cell * one.size;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#111827';
      for (let y = 0; y < one.size; y++) {
        for (let x = 0; x < one.size; x++) if (one.modules[y][x]) ctx.fillRect(x * cell, y * cell, cell, cell);
      }
      const s = scores[k];
      grid.appendChild(h('div', { class: 'maskcard' + (k === best ? ' best' : '') },
        h('div', { class: 'mhead' }, `${k}번 마스크`, k === best ? h('span', { class: 'badge' }, '선택') : null),
        c,
        h('table', { class: 'kv small' },
          h('tr', null, h('th', null, '같은 색 줄'), h('td', null, String(s.n1))),
          h('tr', null, h('th', null, '2×2 덩어리'), h('td', null, String(s.n2))),
          h('tr', null, h('th', null, '가짜 찾기 무늬'), h('td', null, String(s.n3))),
          h('tr', null, h('th', null, '검은 칸 치우침'), h('td', null, String(s.n4))),
          h('tr', { class: 'total' }, h('th', null, '벌점 합계'), h('td', null, String(s.total))),
        ),
      ));
    }
    fill(info,
      note('info',
        h('b', null, '왜 마스크를 씌울까 — '),
        '데이터를 그대로 칠하면 흰 칸이나 검은 칸이 크게 뭉치거나, 위치 찾기 무늬와 똑같은 무늬가 '
        + '데이터 안에 우연히 생길 수 있습니다. 그러면 휴대폰이 엉뚱한 곳을 모서리로 착각합니다. '
        + '그래서 여덟 가지 규칙으로 번갈아 뒤집어 보고, 위 네 가지 벌점의 합이 가장 낮은 것을 씁니다.'),
      h('p', { class: 'hint' },
        `지금 고른 것은 ${best}번(벌점 ${scores[best].total})이고, 가장 나쁜 것은 `
        + `${scores.reduce((a, b, i) => (b.total > scores[a].total ? i : a), 0)}번(벌점 `
        + `${Math.max(...scores.map((s) => s.total))})입니다. 몇 번을 썼는지는 형식 정보에 적어 두어 `
        + '휴대폰이 그대로 벗겨 냅니다. (벌점은 형식 정보를 넣기 전 격자로 셈합니다 — 규격 7.8)'),
      h('p', { class: 'hint' }, `버전 ${qr.version} · ${qr.size}×${qr.size}칸`),
    );
  }

  fill(box,
    h('h2', null, '🎭 마스크 여덟 가지 겨루기'),
    sampleRow(redraw),
    info,
    grid,
  );
  redraw();
}

// ───────────────────────── ④ 담기는 과정 ─────────────────────────
function steps(box) {
  const out = h('div');

  function redraw() {
    const text = sample || ' ';
    const qr = makeQR();
    const mode = chooseMode(text);
    const bytes = toUtf8(text);
    const layout = blockLayout(qr.version, qr.ecl);
    const cwHex = (arr, from, to) => [...arr.slice(from, to)]
      .map((v) => v.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    const svg = toSVG(qr, { margin: 2, shape: 'square' });

    fill(out,
      step(1, '모드를 고른다',
        h('p', null, `담을 글은 ${text.length}자(UTF-8 로 ${bytes.length}바이트)입니다. `
          + `숫자만이면 숫자 모드(한 글자 3⅓비트), 대문자와 몇 가지 기호까지면 영숫자 모드(5½비트), `
          + `그 밖에는 바이트 모드(8비트)를 씁니다.`),
        h('p', null, h('b', null, `→ ${mode.label} 모드`)),
      ),
      step(2, '버전과 오류 정정 수준을 정한다',
        h('p', null, `오류 정정 ${qr.ecl}(${ECL[qr.ecl].recover}% 복구)로 이 내용이 들어가는 `
          + `가장 작은 크기는 버전 ${qr.version}(${qr.size}×${qr.size}칸)입니다.`),
        h('p', null, `데이터 코드워드 ${layout.dataTotal}개 가운데 ${Math.ceil(qr.usedBits / 8)}개를 쓰고, `
          + `남은 자리는 EC·11 을 번갈아 채웁니다.`),
      ),
      step(3, '비트로 바꾼다',
        h('p', null, '모드 번호 4비트 + 글자 수 + 내용 순서로 이어 붙입니다.'),
        h('pre', { class: 'bits' },
          `모드 ${mode.bits.toString(2).padStart(4, '0')} (${mode.label})\n`
          + `글자 수 ${(mode.name === 'byte' ? bytes.length : text.length)}\n`
          + `내용 ${qr.usedBits - 4 - (qr.version <= 9 ? mode.countBits[0] : qr.version <= 26 ? mode.countBits[1] : mode.countBits[2])}비트\n`
          + `합계 ${qr.usedBits}비트 (담을 수 있는 자리 ${qr.capacityBits}비트)`),
      ),
      step(4, '블록으로 나눠 오류 정정 코드를 만든다',
        h('p', null, `리드-솔로몬 방식으로 블록마다 ${layout.eccLen}개의 검사 코드워드를 더합니다. `
          + `블록은 ${layout.numBlocks}개이고, 그래서 블록마다 ${Math.floor(layout.eccLen / 2)}개까지 틀려도 되살립니다.`),
        h('pre', { class: 'bits' },
          `데이터 코드워드 (앞 16개)\n${cwHex(qr.codewords, 0, 16)}\n\n`
          + `오류 정정 코드워드 (앞 16개)\n${cwHex(qr.codewords, layout.dataTotal, layout.dataTotal + 16)}`),
      ),
      step(5, '격자에 채우고 마스크를 씌운다',
        h('p', null, '기능 무늬를 먼저 놓고, 남은 자리를 오른쪽 아래에서 두 칸 너비로 위아래를 오가며 채웁니다. '
          + `그다음 마스크 여덟 가지를 겨뤄 ${qr.mask}번을 골랐습니다.`),
        h('div', { class: 'svgbox', html: svg }),
      ),
    );
  }

  function step(n, title, ...children) {
    return h('section', { class: 'pane step' },
      h('h3', null, h('span', { class: 'stepno' }, String(n)), title),
      ...children,
    );
  }

  fill(box,
    h('h2', null, '🔢 글이 QR 코드가 되기까지'),
    sampleRow(redraw),
    out,
  );
  redraw();
}
