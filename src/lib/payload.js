/*!
 * QR 코드 만들기 — 종류별로 QR 코드에 담을 글 만들기
 * © 2026 티쳐무 · 모든 권리 보유. 학교 수업 목적으로만 이용해 주세요.
 *
 * QR 코드 자체는 「글」 하나만 담는다. 휴대폰이 그 글의 앞머리를 보고
 * 「이건 주소구나」, 「이건 와이파이구나」 하고 알아보는 것이다.
 *   https://…                       → 웹 주소
 *   WIFI:T:WPA;S:이름;P:비번;;      → 와이파이 접속
 *   BEGIN:VCARD … END:VCARD         → 연락처
 *   tel:01012345678                 → 전화 걸기
 *   SMSTO:번호:내용                 → 문자 보내기
 */

/** 와이파이 글에서 특별한 뜻을 가진 글자를 지운 뜻으로 바꾼다 */
export function escapeWifi(value) {
  return String(value).replace(/([\\;,":])/g, '\\$1');
}

/** vCard 에서 특별한 뜻을 가진 글자를 바꾼다 */
export function escapeVCard(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/** 주소 앞에 http(s) 가 없으면 붙여 준다 */
export function normalizeUrl(raw) {
  const text = String(raw).trim();
  if (!text) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(text)) return text; // 이미 http: mailto: 등이 있다
  return 'https://' + text;
}

/** 전화번호에서 숫자와 +만 남긴다 */
export function cleanPhone(raw) {
  return String(raw).replace(/[^\d+]/g, '');
}

export const TYPES = {
  url: {
    key: 'url',
    label: '웹 주소',
    icon: '🔗',
    hint: '학교 홈페이지, 구글 폼, 유튜브 영상처럼 열고 싶은 주소를 넣습니다.',
    fields: [
      { key: 'url', label: '주소', type: 'text', placeholder: 'https://trmoo.github.io/comedu_portal/', required: true, big: true },
    ],
    build: (v) => normalizeUrl(v.url || ''),
    check: (v) => {
      const text = String(v.url || '').trim();
      if (!text) return { error: '주소를 넣어 주세요.' };
      const url = normalizeUrl(text);
      const notes = [];
      if (/\s/.test(url)) notes.push('주소에 빈칸이 들어 있습니다. 빈칸은 %20 으로 바꿔 넣어야 제대로 열립니다.');
      if (/[가-힣]/.test(url)) notes.push('주소에 한글이 들어 있습니다. 휴대폰에 따라 안 열릴 수 있으니 영문 주소를 쓰는 편이 안전합니다.');
      if (!/^https?:/i.test(url) && /^[a-z]+:/i.test(url)) notes.push('http 나 https 로 시작하는 주소가 아닙니다. 그대로 담습니다.');
      return { notes };
    },
  },

  text: {
    key: 'text',
    label: '글',
    icon: '✏️',
    hint: '주소가 아니라 그냥 글을 담습니다. 스캔하면 휴대폰에 글이 그대로 보입니다.',
    fields: [
      { key: 'text', label: '담을 글', type: 'textarea', placeholder: '3학년 2반 과학 전시물 설명\n만든 사람: …', required: true },
    ],
    build: (v) => String(v.text || ''),
    check: (v) => (String(v.text || '').trim() ? { notes: [] } : { error: '담을 글을 넣어 주세요.' }),
  },

  wifi: {
    key: 'wifi',
    label: 'Wi-Fi',
    icon: '📶',
    hint: '스캔하면 비밀번호를 치지 않고 바로 접속됩니다. 교실·교무실 와이파이를 알려 줄 때 좋습니다.',
    fields: [
      { key: 'ssid', label: '네트워크 이름 (SSID)', type: 'text', placeholder: 'wawoo-class', required: true },
      { key: 'password', label: '비밀번호', type: 'text', placeholder: '비밀번호' },
      {
        key: 'security', label: '보안 방식', type: 'select', default: 'WPA',
        options: [
          { value: 'WPA', label: 'WPA / WPA2 / WPA3 (보통 이것)' },
          { value: 'WEP', label: 'WEP (아주 옛날 방식)' },
          { value: 'nopass', label: '비밀번호 없음' },
        ],
      },
      { key: 'hidden', label: '숨겨진 네트워크입니다', type: 'checkbox' },
    ],
    build: (v) => {
      const sec = v.security || 'WPA';
      const parts = [`T:${sec === 'nopass' ? 'nopass' : sec}`, `S:${escapeWifi(v.ssid || '')}`];
      if (sec !== 'nopass') parts.push(`P:${escapeWifi(v.password || '')}`);
      if (v.hidden) parts.push('H:true');
      return `WIFI:${parts.join(';')};;`;
    },
    check: (v) => {
      if (!String(v.ssid || '').trim()) return { error: '네트워크 이름을 넣어 주세요.' };
      const notes = [];
      const sec = v.security || 'WPA';
      if (sec !== 'nopass' && !String(v.password || '')) notes.push('비밀번호가 비어 있습니다. 비밀번호가 없는 와이파이라면 보안 방식을 「비밀번호 없음」으로 바꿔 주세요.');
      if (/[가-힣]/.test(String(v.ssid || ''))) notes.push('네트워크 이름에 한글이 있으면 휴대폰에 따라 접속이 안 될 수 있습니다.');
      notes.push('이 QR 코드에는 비밀번호가 그대로 들어 있습니다. 교실 밖에 붙이지 않도록 조심하세요.');
      return { notes };
    },
  },

  vcard: {
    key: 'vcard',
    label: '연락처',
    icon: '👤',
    hint: '스캔하면 연락처에 바로 저장됩니다. 명함이나 담당자 안내에 씁니다.',
    fields: [
      { key: 'name', label: '이름', type: 'text', placeholder: '홍길동', required: true },
      { key: 'org', label: '소속', type: 'text', placeholder: '와우고등학교' },
      { key: 'title', label: '직함', type: 'text', placeholder: '정보 교사' },
      { key: 'phone', label: '휴대전화', type: 'text', placeholder: '010-0000-0000' },
      { key: 'tel', label: '일반전화', type: 'text', placeholder: '031-000-0000' },
      { key: 'email', label: '이메일', type: 'text', placeholder: 'name@example.com' },
      { key: 'url', label: '홈페이지', type: 'text', placeholder: 'https://example.com' },
      { key: 'address', label: '주소', type: 'text', placeholder: '경기도 …' },
      { key: 'note', label: '메모', type: 'text', placeholder: '상담 가능 시간 …' },
    ],
    build: (v) => {
      const L = ['BEGIN:VCARD', 'VERSION:3.0'];
      const name = String(v.name || '').trim();
      L.push(`N:${escapeVCard(name)};;;;`);
      L.push(`FN:${escapeVCard(name)}`);
      if (v.org) L.push(`ORG:${escapeVCard(v.org)}`);
      if (v.title) L.push(`TITLE:${escapeVCard(v.title)}`);
      if (v.phone) L.push(`TEL;TYPE=CELL:${escapeVCard(cleanPhone(v.phone))}`);
      if (v.tel) L.push(`TEL;TYPE=WORK:${escapeVCard(cleanPhone(v.tel))}`);
      if (v.email) L.push(`EMAIL:${escapeVCard(v.email)}`);
      if (v.url) L.push(`URL:${escapeVCard(normalizeUrl(v.url))}`);
      if (v.address) L.push(`ADR;TYPE=WORK:;;${escapeVCard(v.address)};;;;`);
      if (v.note) L.push(`NOTE:${escapeVCard(v.note)}`);
      L.push('END:VCARD');
      return L.join('\r\n') + '\r\n';
    },
    check: (v) => {
      if (!String(v.name || '').trim()) return { error: '이름을 넣어 주세요.' };
      const notes = [];
      if (!v.phone && !v.tel && !v.email) notes.push('전화번호나 이메일 가운데 하나는 넣는 편이 좋습니다.');
      if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v.email).trim())) notes.push('이메일 모양이 올바르지 않습니다.');
      return { notes };
    },
  },

  tel: {
    key: 'tel',
    label: '전화',
    icon: '📞',
    hint: '스캔하면 전화 걸기 화면이 바로 뜹니다.',
    fields: [
      { key: 'phone', label: '전화번호', type: 'text', placeholder: '010-0000-0000', required: true, big: true },
    ],
    build: (v) => `tel:${cleanPhone(v.phone || '')}`,
    check: (v) => {
      const n = cleanPhone(v.phone || '');
      if (!n) return { error: '전화번호를 넣어 주세요.' };
      if (n.replace(/\D/g, '').length < 8) return { notes: ['번호가 너무 짧습니다. 지역번호까지 넣었는지 확인해 주세요.'] };
      return { notes: [] };
    },
  },

  sms: {
    key: 'sms',
    label: '문자',
    icon: '💬',
    hint: '스캔하면 받는 번호와 내용이 채워진 문자 쓰기 화면이 뜹니다. 보내기는 사람이 눌러야 합니다.',
    fields: [
      { key: 'phone', label: '받는 번호', type: 'text', placeholder: '010-0000-0000', required: true },
      { key: 'message', label: '미리 채울 내용', type: 'textarea', placeholder: '신청합니다' },
    ],
    build: (v) => `SMSTO:${cleanPhone(v.phone || '')}:${String(v.message || '')}`,
    check: (v) => {
      if (!cleanPhone(v.phone || '')) return { error: '받는 번호를 넣어 주세요.' };
      return { notes: ['휴대폰 종류에 따라 미리 채운 내용이 들어가지 않을 수 있습니다.'] };
    },
  },
};

export const TYPE_ORDER = ['url', 'text', 'wifi', 'vcard', 'tel', 'sms'];

/** 종류와 입력값으로 QR 코드에 담을 글을 만든다 */
export function buildPayload(typeKey, values) {
  const type = TYPES[typeKey];
  if (!type) throw new Error('모르는 종류입니다: ' + typeKey);
  const checked = type.check(values || {});
  return {
    text: checked.error ? '' : type.build(values || {}),
    error: checked.error || null,
    notes: checked.notes || [],
  };
}

/** 그 종류의 기본 입력값 */
export function defaultValues(typeKey) {
  const out = {};
  for (const f of TYPES[typeKey].fields) {
    out[f.key] = f.default !== undefined ? f.default : (f.type === 'checkbox' ? false : '');
  }
  return out;
}
