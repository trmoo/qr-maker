/*!
 * QR 코드 만들기 — 들어가는 곳
 * © 2026 티쳐무 · 모든 권리 보유. 학교 수업 목적으로만 이용해 주세요.
 *
 * 링크·글·Wi-Fi·연락처를 QR 코드로 만들고, QR 코드가 어떻게 생겼는지도 살펴본다.
 * 외부 라이브러리를 쓰지 않아 인터넷 없이도 열린다. 서버도 없고, 담은 내용은
 * 이 브라우저 밖으로 한 글자도 나가지 않는다.
 */
import './style.css';
import { h, fill, beginScreen } from './lib/ui.js';
import { loadDesign } from './lib/store.js';
import * as makeTab from './tabs/t1-make.js';
import * as whyTab from './tabs/t2-why.js';

const TABS = [
  { key: 'make', icon: '✨', label: 'QR 코드 만들기', mod: makeTab },
  { key: 'why', icon: '🔬', label: 'QR 코드 원리', mod: whyTab },
];

let currentTab = 'make';

function routeFromHash() {
  const raw = location.hash.replace(/^#/, '');
  const [tab, sub] = raw.split('/');
  return { tab: TABS.some((t) => t.key === tab) ? tab : 'make', sub };
}

function render() {
  const { tab, sub } = routeFromHash();
  currentTab = tab;
  const tabRow = h('nav', { class: 'tabs' });
  for (const t of TABS) {
    tabRow.appendChild(h('button', {
      class: 'tab' + (t.key === currentTab ? ' on' : ''),
      type: 'button',
      onclick: () => { location.hash = `#${t.key}`; },
    }, `${t.icon} ${t.label}`));
  }

  const main = h('main', { id: 'screen' });
  fill(document.getElementById('app'),
    h('header', { class: 'top' },
      h('h1', null, '📱 QR 코드 만들기'),
      h('p', { class: 'sub' }, '링크를 넣으면 QR 코드가 됩니다. 인터넷 없이도 되고, 담은 내용은 이 컴퓨터 밖으로 나가지 않습니다.'),
    ),
    tabRow,
    main,
    h('footer', { class: 'foot' },
      h('p', null, 'QR 코드 만들기 · © 2026 티쳐무 · 모든 권리 보유 — 학교 수업 목적으로만 이용해 주세요.'),
      h('p', { class: 'hint' }, 'QR Code 는 데소 웨이브(DENSO WAVE) 주식회사의 등록 상표입니다. 이 앱은 ISO/IEC 18004 규격을 보고 직접 구현한 것입니다.'),
    ),
  );

  beginScreen();
  TABS.find((t) => t.key === currentTab).mod.render(main, sub);
  window.scrollTo({ top: 0 });
}

loadDesign();
window.addEventListener('hashchange', render);
render();
