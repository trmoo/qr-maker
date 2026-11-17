/*!
 * QR 코드 만들기 — 가짜 DOM
 * © 2026 티쳐무 · 모든 권리 보유.
 *
 * 브라우저 없이 node 에서 앱을 「실제로 한 번 돌려 보기」 위한 아주 작은 DOM.
 * 글자 검사(크기·저작권 표시)만 하면 흰 화면을 못 잡는다 — 돌려 봐야 안다.
 */

class FakeClassList {
  constructor(el) { this.el = el; }
  get set() {
    return new Set(String(this.el.className || '').split(/\s+/).filter(Boolean));
  }
  _write(s) { this.el.className = [...s].join(' '); }
  add(...c) { const s = this.set; c.forEach((x) => s.add(x)); this._write(s); }
  remove(...c) { const s = this.set; c.forEach((x) => s.delete(x)); this._write(s); }
  toggle(c, on) { const s = this.set; if (on === undefined ? s.has(c) : !on) s.delete(c); else s.add(c); this._write(s); }
  contains(c) { return this.set.has(c); }
}

const CTX_NOOP = new Proxy({}, {
  get(target, prop) {
    if (prop === 'canvas') return target.canvas;
    if (prop in target) return target[prop];
    return () => {};
  },
  set(target, prop, value) { target[prop] = value; return true; },
});

class FakeElement {
  constructor(tag, doc) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = doc;
    this.children = [];
    this.childNodes = this.children;
    this.parentNode = null;
    this.attributes = {};
    this.style = new Proxy({}, { get: (t, p) => t[p] ?? '', set: (t, p, v) => { t[p] = v; return true; } });
    this.dataset = {};
    this.className = '';
    this.classList = new FakeClassList(this);
    this._listeners = {};
    this._text = '';
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.files = null;
    if (this.tagName === 'CANVAS') {
      this.width = 300;
      this.height = 150;
    }
  }
  appendChild(node) {
    if (node === null || node === undefined) throw new Error('appendChild 에 null 을 넣었습니다');
    node.parentNode = this;
    this.children.push(node);
    return node;
  }
  append(...nodes) { nodes.forEach((n) => this.appendChild(typeof n === 'string' ? this.ownerDocument.createTextNode(n) : n)); }
  replaceChildren(...nodes) { this.children.length = 0; this.append(...nodes); }
  removeChild(node) { const i = this.children.indexOf(node); if (i >= 0) this.children.splice(i, 1); return node; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  insertBefore(node, ref) { const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, node); node.parentNode = this; return node; }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k === 'class') this.className = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  removeAttribute(k) { delete this.attributes[k]; }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    const a = this._listeners[type];
    if (a) this._listeners[type] = a.filter((f) => f !== fn);
  }
  dispatch(type, ev = {}) {
    for (const fn of this._listeners[type] || []) fn({ type, target: this, preventDefault() {}, ...ev });
  }
  click() { this.dispatch('click', { clientX: 0, clientY: 0 }); }
  focus() {}
  select() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width || 300, height: this.height || 150 }; }
  getContext() { const c = Object.create(CTX_NOOP); c.canvas = this; return c; }
  toBlob(cb) { cb({ type: 'image/png', size: 1 }); }
  toDataURL() { return 'data:image/png;base64,'; }
  showModal() { this._open = true; }
  close() { this._open = false; }
  get textContent() {
    if (this.children.length === 0) return this._text;
    return this.children.map((c) => c.textContent ?? '').join('');
  }
  set textContent(v) { this.children.length = 0; this._text = String(v); }
  get innerHTML() { return this._html || ''; }
  set innerHTML(v) { this._html = String(v); }
  get firstChild() { return this.children[0] || null; }
  querySelectorAll(sel) {
    const tag = sel.replace(/[^a-zA-Z]/g, '').toUpperCase();
    const out = [];
    const walk = (n) => {
      for (const c of n.children || []) {
        if (c.tagName === tag) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

class FakeText {
  constructor(t) { this._text = String(t); this.children = []; }
  get textContent() { return this._text; }
}

/** 가짜 DOM 을 전역에 깔고, 생긴 오류를 모아 돌려준다 */
export function installFakeDom(url = 'http://localhost/') {
  const errors = [];
  const doc = {
    createElement: (tag) => new FakeElement(tag, doc),
    createTextNode: (t) => new FakeText(t),
    createElementNS: (ns, tag) => new FakeElement(tag, doc),
    getElementById: (id) => doc._byId[id] || null,
    querySelector: (s) => doc.body.querySelector(s),
    querySelectorAll: (s) => doc.body.querySelectorAll(s),
    addEventListener() {},
    removeEventListener() {},
    execCommand: () => true,
    _byId: {},
  };
  doc.body = new FakeElement('body', doc);
  doc.head = new FakeElement('head', doc);
  doc.documentElement = new FakeElement('html', doc);

  const app = new FakeElement('div', doc);
  app.setAttribute('id', 'app');
  doc.body.appendChild(app);
  doc._byId.app = app;

  const store = new Map();
  const win = {
    document: doc,
    location: { href: url, hash: '', search: '', pathname: '/' },
    addEventListener() {},
    removeEventListener() {},
    scrollTo() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    open: () => null,
    devicePixelRatio: 1,
  };

  // node 24 는 navigator·location 을 읽기 전용으로 두어 그냥 넣으면 막힌다
  const put = (name, value) => {
    try { Object.defineProperty(globalThis, name, { value, writable: true, configurable: true }); }
    catch { /* 못 바꾸면 그대로 쓴다 */ }
  };
  globalThis.window = win;
  globalThis.document = doc;
  put('navigator', { clipboard: { writeText: async () => {} }, userAgent: 'fake' });
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  globalThis.sessionStorage = globalThis.localStorage;
  put('location', win.location);
  globalThis.Image = class { set src(v) { this._src = v; setTimeout(() => this.onload && this.onload(), 0); } };
  globalThis.FileReader = class { readAsDataURL() { this.result = 'data:image/png;base64,'; this.onload && this.onload(); } };
  globalThis.Blob = globalThis.Blob || class { constructor(p, o) { this.parts = p; this.type = o && o.type; } };
  globalThis.URL.createObjectURL = () => 'blob:fake';
  globalThis.URL.revokeObjectURL = () => {};
  globalThis.HTMLElement = FakeElement;
  globalThis.Node = FakeElement;
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  // 비테가 넣는 「모듈 미리 불러오기」 코드가 쓰는 것들
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  doc.createElement = ((orig) => (tag) => {
    const el = orig(tag);
    if (String(tag).toLowerCase() === 'link') el.relList = { supports: () => true };
    return el;
  })(doc.createElement);

  process.on('uncaughtException', (e) => errors.push(String(e && e.message)));
  return { document: doc, window: win, app, errors };
}

/** 요소 나무에서 글자를 모두 긁어모은다 */
export function textOf(el) {
  if (!el) return '';
  if (el._text !== undefined && (!el.children || el.children.length === 0)) return el._text;
  return (el.children || []).map(textOf).join(' ') + (el._html ? ' ' + el._html : '');
}

/** 나무에 있는 요소 수 */
export function countNodes(el) {
  let n = 1;
  for (const c of el.children || []) n += countNodes(c);
  return n;
}
