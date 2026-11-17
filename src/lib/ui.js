/*!
 * QR 코드 만들기 — 화면 만들기 도구
 * © 2026 티쳐무 · 모든 권리 보유. 학교 수업 목적으로만 이용해 주세요.
 *
 * ⚠ 탭 파일에서 window.addEventListener('resize', …) 나 setInterval 을 직접 쓰지 말 것.
 *   화면을 옮기면 화면은 지워지지만 그 리스너와 타이머는 살아남아 오갈 때마다 쌓인다.
 *   여기 있는 onResize() · screenInterval() 을 쓰면 새 화면을 그리기 직전에 걷어 낸다.
 * ⚠ 브라우저 기본 alert·confirm·prompt 를 쓰지 말 것. say() · ask() 를 쓴다.
 */

/** 요소 만들기. 자식 자리의 글자는 「글자 그대로」 들어간다 — 태그를 쓰려면 {html: …} */
export function h(tag, attrs = null, ...children) {
  const el = document.createElement(tag);
  if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'html') el.innerHTML = v;
      else if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  } else if (attrs !== null && attrs !== undefined) {
    children.unshift(attrs);
  }
  add(el, children);
  return el;
}

/** 자식 붙이기 — null·undefined·false 는 그냥 건너뛴다(「null」 글자가 보이지 않게) */
export function add(parent, children) {
  for (const c of children.flat(4)) {
    if (c === null || c === undefined || c === false || c === '') continue;
    parent.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return parent;
}

/** 안을 통째로 바꿔 넣기 */
export function fill(parent, ...children) {
  parent.textContent = '';
  return add(parent, children);
}

// ───────────── 화면 수명 ─────────────
let resizeHandlers = [];
let timers = [];

/** 새 화면을 그리기 직전에 부른다 — 앞 화면이 걸어 둔 것을 걷어 낸다 */
export function beginScreen() {
  for (const fn of resizeHandlers) window.removeEventListener('resize', fn);
  resizeHandlers = [];
  for (const t of timers) clearInterval(t);
  timers = [];
}

/** 이 화면에서만 사는 창 크기 리스너 */
export function onResize(fn) {
  window.addEventListener('resize', fn);
  resizeHandlers.push(fn);
  return fn;
}

/** 이 화면에서만 사는 타이머 */
export function screenInterval(fn, ms) {
  const t = setInterval(fn, ms);
  timers.push(t);
  return t;
}

// ───────────── 대화상자 ─────────────
function dialogShell(title, bodyNodes, buttons) {
  const dlg = h('dialog', { class: 'modal' });
  const box = h('div', { class: 'modal-box' },
    h('h3', null, title),
    h('div', { class: 'modal-body' }, ...bodyNodes),
    h('div', { class: 'modal-btns' }, ...buttons),
  );
  dlg.appendChild(box);
  document.body.appendChild(dlg);
  // ⚠ 창을 닫을 때 정리를 미루지 않는다 — 가려진 탭에서는 close 알림이 늦게 온다
  const close = () => { try { dlg.close(); } catch { /* 이미 닫혔다 */ } dlg.remove(); };
  return { dlg, close };
}

/** 알림 — 기본 alert 대신 */
export function say(message, title = '알림') {
  return new Promise((resolve) => {
    const lines = String(message).split('\n').map((t) => h('p', null, t));
    const { dlg, close } = dialogShell(title, lines, [
      h('button', { class: 'btn primary', onclick: () => { close(); resolve(); } }, '확인'),
    ]);
    dlg.showModal();
  });
}

/** 예·아니오 — 기본 confirm 대신 */
export function ask(message, title = '확인', yes = '예', no = '아니요') {
  return new Promise((resolve) => {
    const lines = String(message).split('\n').map((t) => h('p', null, t));
    const { dlg, close } = dialogShell(title, lines, [
      h('button', { class: 'btn', onclick: () => { close(); resolve(false); } }, no),
      h('button', { class: 'btn primary', onclick: () => { close(); resolve(true); } }, yes),
    ]);
    dlg.showModal();
  });
}

/** 알약 단추 묶음 */
export function pills(items, current, onPick) {
  const wrap = h('div', { class: 'pills' });
  // ⚠ 가운데 맞추기는 justify-content:center 가 아니라 첫·마지막 항목의 margin:auto 로 한다
  //    (center 를 쓰면 줄이 넘칠 때 왼쪽 끝이 잘려 스크롤로도 닿지 못한다)
  items.forEach((it, i) => {
    const b = h('button', {
      class: 'pill' + (it.key === current ? ' on' : ''),
      onclick: () => onPick(it.key),
      type: 'button',
    }, it.icon ? `${it.icon} ${it.label}` : it.label);
    if (i === 0) b.style.marginLeft = 'auto';
    if (i === items.length - 1) b.style.marginRight = 'auto';
    wrap.appendChild(b);
  });
  return wrap;
}

/** 설명 상자 */
export function note(kind, ...children) {
  return h('div', { class: `note ${kind}` }, ...children);
}

/** 작은 안내 꼬리말 */
export function hint(text) {
  return h('p', { class: 'hint' }, text);
}
