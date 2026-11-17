/*!
 * QR 코드 만들기 — 종류별 담을 글 시험
 * © 2026 티쳐무 · 모든 권리 보유.
 */
import { describe, ok, eq } from './harness.mjs';
import {
  TYPES, TYPE_ORDER, buildPayload, defaultValues,
  normalizeUrl, cleanPhone, escapeWifi, escapeVCard,
} from '../src/lib/payload.js';
import { encodeQR } from '../src/lib/qr.js';

export default function run() {
  describe('종류 표가 성한가', () => {
    eq(TYPE_ORDER.length, 6, '종류는 여섯 가지');
    for (const key of TYPE_ORDER) {
      const t = TYPES[key];
      ok(t, `${key} 종류가 있다`);
      eq(t.key, key, `${key} 열쇠가 맞다`);
      ok(t.label && t.icon && t.hint, `${key} 에 이름·그림·설명이 있다`);
      ok(t.fields.length > 0, `${key} 에 입력 칸이 있다`);
      ok(typeof t.build === 'function' && typeof t.check === 'function', `${key} 에 만들기·검사가 있다`);
      // 필수 칸을 비워 두면 반드시 안내가 나온다
      const empty = buildPayload(key, defaultValues(key));
      ok(empty.error, `${key} 는 빈 입력에 안내를 준다`);
      eq(empty.text, '', `${key} 는 빈 입력으로 QR 을 만들지 않는다`);
      // 입력 칸 열쇠가 겹치지 않는다
      const keys = t.fields.map((f) => f.key);
      eq(keys.length, new Set(keys).size, `${key} 의 입력 칸 열쇠가 겹치지 않는다`);
    }
  });

  describe('웹 주소', () => {
    eq(normalizeUrl('trmoo.github.io'), 'https://trmoo.github.io', 'http 가 없으면 https 를 붙인다');
    eq(normalizeUrl('https://a.com'), 'https://a.com', '이미 있으면 그대로');
    eq(normalizeUrl('http://a.com'), 'http://a.com', 'http 도 그대로');
    eq(normalizeUrl('mailto:a@b.com'), 'mailto:a@b.com', 'mailto 도 그대로');
    eq(normalizeUrl('  a.com  '), 'https://a.com', '앞뒤 빈칸을 없앤다');
    eq(normalizeUrl(''), '', '빈 값은 빈 값');
    eq(buildPayload('url', { url: 'example.com' }).text, 'https://example.com', '주소를 다듬어 담는다');
    ok(buildPayload('url', { url: 'a.com/내 파일' }).notes.length >= 2, '빈칸과 한글을 함께 짚는다');
  });

  describe('Wi-Fi', () => {
    eq(escapeWifi('a;b'), 'a\\;b', '세미콜론을 지운 뜻으로');
    eq(escapeWifi('a:b"c,d\\e'), 'a\\:b\\"c\\,d\\\\e', '특별한 글자 다섯 가지를 모두');
    eq(
      buildPayload('wifi', { ssid: 'wawoo-class', password: 'school1234', security: 'WPA' }).text,
      'WIFI:T:WPA;S:wawoo-class;P:school1234;;',
      '보통 와이파이 글',
    );
    eq(
      buildPayload('wifi', { ssid: 'guest', security: 'nopass' }).text,
      'WIFI:T:nopass;S:guest;;',
      '비밀번호가 없으면 P 를 넣지 않는다',
    );
    eq(
      buildPayload('wifi', { ssid: 'hid', password: 'p', security: 'WPA', hidden: true }).text,
      'WIFI:T:WPA;S:hid;P:p;H:true;;',
      '숨겨진 네트워크는 H:true',
    );
    eq(
      buildPayload('wifi', { ssid: 'my;net', password: 'a:b', security: 'WPA' }).text,
      'WIFI:T:WPA;S:my\\;net;P:a\\:b;;',
      '이름과 비밀번호의 특별한 글자를 지운 뜻으로 바꾼다',
    );
    ok(buildPayload('wifi', { ssid: 'a', security: 'WPA' }).notes.some((n) => n.includes('비밀번호가 비어')), '빈 비밀번호를 짚는다');
    ok(buildPayload('wifi', { ssid: 'a', password: 'b', security: 'WPA' }).notes.some((n) => n.includes('비밀번호가 그대로')), '비밀번호가 들어간다고 알린다');
  });

  describe('연락처(vCard)', () => {
    const text = buildPayload('vcard', {
      name: '홍길동', org: '와우고등학교', title: '정보 교사',
      phone: '010-1234-5678', email: 'a@b.com', url: 'example.com',
    }).text;
    ok(text.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n'), 'vCard 3.0 으로 시작한다');
    ok(text.endsWith('END:VCARD\r\n'), 'END:VCARD 로 끝난다');
    ok(text.includes('\r\n'), '줄 끝은 CRLF');
    ok(text.includes('FN:홍길동'), '전체 이름이 들어간다');
    ok(text.includes('TEL;TYPE=CELL:01012345678'), '휴대전화에서 붙임표를 뺀다');
    ok(text.includes('URL:https://example.com'), '홈페이지 주소를 다듬는다');
    ok(!text.includes('ADR'), '안 넣은 칸은 줄이 생기지 않는다');
    eq(escapeVCard('a,b;c\\d'), 'a\\,b\\;c\\\\d', 'vCard 특별한 글자');
    eq(escapeVCard('한\n줄'), '한\\n줄', '줄바꿈은 \\n 으로');
    ok(buildPayload('vcard', { name: '홍길동' }).notes.length > 0, '연락 방법이 없으면 알려 준다');
    ok(buildPayload('vcard', { name: '홍', email: 'wrong' }).notes.some((n) => n.includes('이메일')), '이메일 모양을 본다');
  });

  describe('전화와 문자', () => {
    eq(cleanPhone('010-1234-5678'), '01012345678', '붙임표를 뺀다');
    eq(cleanPhone('+82 10 1234 5678'), '+821012345678', '나라 번호는 남긴다');
    eq(buildPayload('tel', { phone: '010-1234-5678' }).text, 'tel:01012345678', '전화 글');
    eq(buildPayload('sms', { phone: '010-1234-5678', message: '신청합니다' }).text,
      'SMSTO:01012345678:신청합니다', '문자 글');
    eq(buildPayload('sms', { phone: '0101234', message: '' }).text, 'SMSTO:0101234:', '내용이 없어도 된다');
    ok(buildPayload('tel', { phone: '123' }).notes.length > 0, '너무 짧은 번호를 짚는다');
  });

  describe('만든 글이 실제로 QR 코드가 되는가', () => {
    const samples = {
      url: { url: 'https://trmoo.github.io/comedu_portal/' },
      text: { text: '3학년 2반 전시물 안내입니다.' },
      wifi: { ssid: 'wawoo-class', password: 'school1234', security: 'WPA' },
      vcard: { name: '홍길동', org: '와우고', phone: '010-1234-5678', email: 'a@b.com' },
      tel: { phone: '010-1234-5678' },
      sms: { phone: '010-1234-5678', message: '신청합니다' },
    };
    for (const key of TYPE_ORDER) {
      const { text, error } = buildPayload(key, samples[key]);
      eq(error, null, `${key} 예시에 오류가 없다`);
      const qr = encodeQR(text, { ecl: 'M' });
      ok(qr.size >= 21, `${key} 가 QR 코드로 만들어진다`);
      eq(qr.text, text, `${key} 의 글이 그대로 담긴다`);
    }
  });
}
