/*!
 * QR 코드 만들기 — 꾸미기 설정 기억하기
 * © 2026 티쳐무 · 모든 권리 보유.
 *
 * ⚠ 기억하는 것은 「꾸미기 설정」뿐이다. QR 코드에 담은 내용(주소·연락처·와이파이
 *   비밀번호)은 어디에도 저장하지 않는다. 서버도 없다.
 */
const KEY = 'qr-maker:design';

export const DESIGN_DEFAULT = {
  ecl: 'M',
  shape: 'square',
  fg: '#111827',
  bg: '#ffffff',
  margin: 4,
  pixelSize: 1024,
  transparent: false,
  logoRatio: 0.2,
};

export const design = { ...DESIGN_DEFAULT };

export function loadDesign() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    for (const k of Object.keys(DESIGN_DEFAULT)) {
      if (saved[k] !== undefined) design[k] = saved[k];
    }
  } catch { /* 안 읽히면 기본값으로 쓴다 */ }
}

export function saveDesign() {
  try { localStorage.setItem(KEY, JSON.stringify(design)); } catch { /* 저장이 막혀도 그냥 쓴다 */ }
}

export function resetDesign() {
  Object.assign(design, DESIGN_DEFAULT);
  try { localStorage.removeItem(KEY); } catch { /* 지울 수 없어도 넘어간다 */ }
}
