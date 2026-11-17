/*!
 * QR 코드 만들기 — ① 만들기 화면
 * © 2026 티쳐무 · 모든 권리 보유. 학교 수업 목적으로만 이용해 주세요.
 *
 * ⚠ 글을 칠 때마다 화면을 통째로 다시 그리지 않는다 — 입력 칸의 깜박이는 자리가
 *   사라져 글을 이어 칠 수 없게 된다. 종류를 바꿀 때만 입력 칸을 다시 만들고,
 *   글을 칠 때는 미리보기와 안내만 고친다.
 */
import { encodeQR, ECL } from '../lib/qr.js';
import { TYPES, TYPE_ORDER, buildPayload, defaultValues } from '../lib/payload.js';
import { drawCanvas, SHAPES, layoutFor } from '../lib/render.js';
import { scanAdvice, minPrintMm } from '../lib/advice.js';
import { downloadPNG, downloadSVG, printQR, copyText, copyImage } from '../lib/download.js';
import { h, fill, note, say } from '../lib/ui.js';
import { design, saveDesign } from '../lib/store.js';

// 종류마다 입력값을 따로 기억한다 (탭을 오가도 남는다. 저장하지는 않는다)
const values = {};
for (const key of TYPE_ORDER) values[key] = defaultValues(key);
let current = 'url';
values.url.url = 'https://trmoo.github.io/comedu_portal/';

let logo = null;        // 가운데 그림 (Image)
let logoDataUrl = null;

const PRESETS = [
  { label: '기본', fg: '#111827', bg: '#ffffff' },
  { label: '남색', fg: '#1e3a8a', bg: '#ffffff' },
  { label: '초록', fg: '#166534', bg: '#ffffff' },
  { label: '자주', fg: '#6b21a8', bg: '#ffffff' },
  { label: '밤색', fg: '#7c2d12', bg: '#fff7ed' },
  { label: '어두운 바탕', fg: '#ffffff', bg: '#111827' },
];

export function render(root) {
  const typeRow = h('div', { class: 'typerow' });
  const formBox = h('div', { class: 'form' });
  const msgBox = h('div', { class: 'msgs' });
  const canvas = h('canvas', { class: 'qr-canvas' });
  const emptyNote = h('p', { class: 'muted empty-note' }, '왼쪽에 내용을 넣으면 여기에 QR 코드가 나옵니다.');
  const canvasWrap = h('div', { class: 'qr-wrap' }, canvas, emptyNote);
  const infoBox = h('div', { class: 'info' });
  const adviceBox = h('div', { class: 'advice' });
  const btnRow = h('div', { class: 'btnrow' });
  const designBox = h('div', { class: 'designbox' });

  let qr = null;
  let drawOpt = {};

  // ───────── 미리보기와 안내 고치기 ─────────
  // 만들 수 없을 때는 앞서 만든 QR 코드를 반드시 지운다
  // (안 지우면 이름을 비워 둔 채 앞 종류의 QR 코드가 남아 있어 학생이 헷갈린다)
  function clearPreview() {
    canvasWrap.classList.add('empty');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 1;
    canvas.height = 1;
    fill(infoBox);
    fill(adviceBox);
    btnRow.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    qr = null;
  }

  function update() {
    const built = buildPayload(current, values[current]);
    fill(msgBox);
    if (built.error) {
      msgBox.appendChild(note('bad', h('b', null, '⚠ '), built.error));
      clearPreview();
      return;
    }
    for (const n of built.notes) msgBox.appendChild(note('warn', h('b', null, '💡 '), n));

    try {
      qr = encodeQR(built.text, { ecl: design.ecl });
    } catch (e) {
      msgBox.appendChild(note('bad', h('b', null, '⚠ '), e.message));
      clearPreview();
      return;
    }
    canvasWrap.classList.remove('empty');
    btnRow.querySelectorAll('button').forEach((b) => { b.disabled = false; });

    drawOpt = {
      fg: design.fg,
      bg: design.bg,
      margin: Number(design.margin),
      shape: design.shape,
      pixelSize: design.pixelSize,
      transparent: design.transparent,
      logo,
      logoDataUrl,
      logoRatio: Number(design.logoRatio),
    };
    // 미리보기는 화면 크기에 맞춰 작게 그린다 (받을 때는 설정한 크기로 다시 그린다)
    drawCanvas(canvas, qr, { ...drawOpt, pixelSize: 720 });

    // 「이 QR 코드의 속」
    const L = layoutFor(qr, drawOpt);
    fill(infoBox,
      h('h3', null, '🔍 이 QR 코드의 속'),
      h('table', { class: 'kv' },
        row('담은 내용', `${qr.charLength}자 · ${qr.byteLength}바이트`),
        row('부호화 방식', `${qr.modeLabel} 모드`),
        row('크기(버전)', `버전 ${qr.version} · ${qr.size}×${qr.size} 칸`),
        row('오류 정정', `${qr.ecl} — ${ECL[qr.ecl].label}`),
        row('고른 마스크', `${qr.mask}번`),
        row('자리 쓰임', `${Math.round((qr.usedBits / qr.capacityBits) * 100)}% (${qr.usedBits} / ${qr.capacityBits}비트)`),
        row('블록', `${qr.layout.numBlocks}개 · 블록마다 오류 정정 ${qr.layout.eccLen}코드워드`),
        row('내려받을 크기', `${L.px} × ${L.px} 픽셀 (한 칸 ${L.cell}픽셀)`),
        row('인쇄 최소 크기', `약 ${minPrintMm(qr, drawOpt.margin)}mm`),
      ),
      h('details', { class: 'payload' },
        h('summary', null, '휴대폰이 실제로 읽는 글 보기'),
        h('pre', null, built.text),
        h('button', {
          class: 'btn small',
          onclick: async () => {
            const done = await copyText(built.text);
            say(done ? '담은 글을 복사했습니다.' : '복사가 막혀 있습니다. 위 글을 직접 골라 복사해 주세요.');
          },
        }, '글 복사'),
      ),
    );

    // 스캔이 될까
    const adv = scanAdvice(qr, drawOpt);
    const head = { good: '✅ 이대로 괜찮습니다', warn: '💡 살펴볼 점이 있습니다', bad: '⚠ 이대로는 안 읽힐 수 있습니다' }[adv.level];
    fill(adviceBox, h('h3', { class: `adv-${adv.level}` }, head));
    const list = h('ul');
    for (const it of adv.items) list.appendChild(h('li', { class: `adv-${it.level}` }, it.text));
    if (adv.items.length === 0) list.appendChild(h('li', { class: 'adv-good' }, '색·여백·모양이 모두 넉넉합니다. 만든 뒤에는 꼭 휴대폰으로 직접 찍어 확인하세요.'));
    adviceBox.appendChild(list);
  }

  function row(k, v) {
    return h('tr', null, h('th', null, k), h('td', null, v));
  }

  // ───────── 입력 칸 만들기 (종류를 바꿀 때만) ─────────
  function rebuildForm() {
    const type = TYPES[current];
    fill(formBox, h('p', { class: 'typehint' }, type.hint));
    for (const f of type.fields) {
      const id = `f-${current}-${f.key}`;
      let input;
      if (f.type === 'textarea') {
        input = h('textarea', { id, rows: 4, placeholder: f.placeholder || '' });
        input.value = values[current][f.key] || '';
      } else if (f.type === 'select') {
        input = h('select', { id });
        for (const o of f.options) input.appendChild(h('option', { value: o.value }, o.label));
        input.value = values[current][f.key] || f.default || f.options[0].value;
      } else if (f.type === 'checkbox') {
        input = h('input', { id, type: 'checkbox' });
        input.checked = !!values[current][f.key];
      } else {
        input = h('input', { id, type: 'text', placeholder: f.placeholder || '', class: f.big ? 'big' : null });
        input.value = values[current][f.key] || '';
      }
      const take = () => {
        values[current][f.key] = f.type === 'checkbox' ? input.checked : input.value;
        update();
      };
      input.addEventListener('input', take);
      input.addEventListener('change', take);

      if (f.type === 'checkbox') {
        formBox.appendChild(h('label', { class: 'check', for: id }, input, h('span', null, f.label)));
      } else {
        formBox.appendChild(h('div', { class: 'field' },
          h('label', { for: id }, f.label, f.required ? h('span', { class: 'req' }, ' *') : null),
          input,
        ));
      }
    }
  }

  // ───────── 종류 고르기 ─────────
  function rebuildTypes() {
    fill(typeRow);
    for (const key of TYPE_ORDER) {
      const t = TYPES[key];
      typeRow.appendChild(h('button', {
        class: 'typebtn' + (key === current ? ' on' : ''),
        type: 'button',
        onclick: () => { current = key; rebuildTypes(); rebuildForm(); update(); },
      }, h('span', { class: 'ti' }, t.icon), h('span', null, t.label)));
    }
  }

  // ───────── 내려받기 단추 ─────────
  fill(btnRow,
    h('button', {
      class: 'btn primary', onclick: async () => {
        if (!qr) return;
        await downloadPNG(qr, drawOpt);
      },
    }, '⬇ PNG 그림으로'),
    h('button', {
      class: 'btn', onclick: async () => {
        if (!qr) return;
        const r = await copyImage(qr, drawOpt);
        if (r === 'ok') {
          say(drawOpt.transparent
            ? '그림을 복사했습니다. 붙여넣기(Ctrl+V) 하세요 — 배경이 투명해서 붙이는 곳에 따라 어둡게 보일 수 있습니다.'
            : '그림을 복사했습니다. 한글·워드·카톡에 붙여넣기(Ctrl+V) 하세요.');
        } else if (r === 'unsupported') {
          say('이 브라우저는 그림 복사를 지원하지 않습니다. 「⬇ PNG 그림으로」 받아서 붙여 주세요.');
        } else {
          say('그림 복사가 막혀 있습니다. 「⬇ PNG 그림으로」 받아서 붙여 주세요.');
        }
      },
    }, '📋 그림 복사'),
    h('button', { class: 'btn', onclick: () => qr && downloadSVG(qr, drawOpt) }, '⬇ SVG(인쇄용)'),
    h('button', {
      class: 'btn', onclick: () => {
        if (!qr) return;
        const okWin = printQR(qr, drawOpt, TYPES[current].label + ' QR 코드');
        if (!okWin) say('새 창이 막혀 있습니다. 브라우저 주소창 오른쪽의 「팝업 차단」을 풀어 주세요.');
      },
    }, '🖨 인쇄하기'),
  );

  // ───────── 꾸미기 ─────────
  function rebuildDesign() {
    const change = (k, v) => { design[k] = v; saveDesign(); rebuildDesign(); update(); };

    const eclRow = h('div', { class: 'seg' });
    for (const name of ['L', 'M', 'Q', 'H']) {
      eclRow.appendChild(h('button', {
        class: 'segbtn' + (design.ecl === name ? ' on' : ''), type: 'button',
        onclick: () => change('ecl', name),
      }, name, h('small', null, ECL[name].recover + '%')));
    }

    const shapeRow = h('div', { class: 'seg' });
    for (const key of Object.keys(SHAPES)) {
      shapeRow.appendChild(h('button', {
        class: 'segbtn' + (design.shape === key ? ' on' : ''), type: 'button',
        onclick: () => change('shape', key),
      }, SHAPES[key].label));
    }

    const presetRow = h('div', { class: 'presets' });
    for (const p of PRESETS) {
      presetRow.appendChild(h('button', {
        class: 'preset' + (design.fg === p.fg && design.bg === p.bg ? ' on' : ''),
        type: 'button',
        title: p.label,
        style: { background: p.bg, color: p.fg, borderColor: p.fg },
        onclick: () => { design.fg = p.fg; design.bg = p.bg; saveDesign(); rebuildDesign(); update(); },
      }, p.label));
    }

    const fgInput = h('input', { type: 'color', value: design.fg });
    fgInput.addEventListener('input', () => { design.fg = fgInput.value; saveDesign(); update(); });
    const bgInput = h('input', { type: 'color', value: design.bg });
    bgInput.addEventListener('input', () => { design.bg = bgInput.value; saveDesign(); update(); });

    const marginInput = h('input', { type: 'range', min: 0, max: 8, step: 1, value: design.margin });
    const marginLabel = h('b', null, `${design.margin}칸`);
    marginInput.addEventListener('input', () => {
      design.margin = Number(marginInput.value);
      fill(marginLabel, `${design.margin}칸`);
      saveDesign(); update();
    });

    const sizeSel = h('select', null,
      ...[256, 512, 1024, 2048].map((n) => h('option', { value: n }, `${n} 픽셀`)));
    sizeSel.value = String(design.pixelSize);
    sizeSel.addEventListener('change', () => change('pixelSize', Number(sizeSel.value)));

    const transCheck = h('input', { type: 'checkbox' });
    transCheck.checked = !!design.transparent;
    transCheck.addEventListener('change', () => change('transparent', transCheck.checked));

    // 가운데 그림
    const fileInput = h('input', { type: 'file', accept: 'image/*' });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          logo = img;
          logoDataUrl = reader.result;
          if (design.ecl !== 'H') { design.ecl = 'H'; saveDesign(); } // 가려지는 만큼 복구력을 올린다
          rebuildDesign();
          update();
        };
        img.onerror = () => say('그림을 읽을 수 없습니다. PNG 나 JPG 파일을 골라 주세요.');
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

    const logoRatioInput = h('input', { type: 'range', min: 10, max: 30, step: 1, value: Math.round(design.logoRatio * 100) });
    const logoRatioLabel = h('b', null, `${Math.round(design.logoRatio * 100)}%`);
    logoRatioInput.addEventListener('input', () => {
      design.logoRatio = Number(logoRatioInput.value) / 100;
      fill(logoRatioLabel, `${Number(logoRatioInput.value)}%`);
      saveDesign(); update();
    });

    fill(designBox,
      h('h3', null, '🎨 꾸미기'),
      h('div', { class: 'dgrid' },
        h('div', { class: 'dcell' },
          h('label', null, '오류 정정 수준'),
          eclRow,
          h('p', { class: 'hint' }, '높이면 더러워지거나 가려져도 읽히지만, 담을 수 있는 양이 줄고 칸이 촘촘해집니다.'),
        ),
        h('div', { class: 'dcell' },
          h('label', null, '칸 모양'),
          shapeRow,
        ),
        h('div', { class: 'dcell' },
          h('label', null, '색'),
          presetRow,
          h('div', { class: 'inline' },
            h('span', null, '무늬'), fgInput,
            h('span', null, '바탕'), bgInput,
          ),
          h('p', { class: 'hint' }, '밝은 바탕에 어두운 무늬여야 읽힙니다. 거꾸로 하면 대부분의 휴대폰이 못 읽습니다.'),
        ),
        h('div', { class: 'dcell' },
          h('label', null, '여백 ', marginLabel),
          marginInput,
          h('p', { class: 'hint' }, '규격은 사방 4칸을 권합니다.'),
        ),
        h('div', { class: 'dcell' },
          h('label', null, '내려받을 크기'),
          sizeSel,
          h('label', { class: 'check' }, transCheck, h('span', null, '배경을 투명하게')),
        ),
        h('div', { class: 'dcell' },
          h('label', null, '가운데 그림 (로고)'),
          fileInput,
          logo ? h('div', { class: 'inline' },
            h('span', null, '크기 '), logoRatioLabel, logoRatioInput,
            h('button', {
              class: 'btn small', type: 'button',
              onclick: () => { logo = null; logoDataUrl = null; rebuildDesign(); update(); },
            }, '그림 지우기'),
          ) : h('p', { class: 'hint' }, '학교 로고를 넣을 수 있습니다. 넣으면 오류 정정 수준이 H 로 올라갑니다.'),
        ),
      ),
    );
  }

  fill(root,
    h('div', { class: 'cols' },
      h('section', { class: 'pane' },
        h('h2', null, '① 무엇을 담을까요?'),
        typeRow,
        msgBox, // 입력 칸이 길어도 안내가 묻히지 않게 위에 둔다
        formBox,
      ),
      h('section', { class: 'pane' },
        h('h2', null, '② QR 코드'),
        canvasWrap,
        btnRow,
        adviceBox,
      ),
    ),
    designBox,
    h('section', { class: 'pane' }, infoBox),
  );

  rebuildTypes();
  rebuildForm();
  rebuildDesign();
  update();
}
