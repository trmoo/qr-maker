/*!
 * QR 코드 만들기 — 「이대로 스캔이 될까」 판정 시험
 * © 2026 티쳐무 · 모든 권리 보유.
 *
 * 사용자에게 「안 읽힐 수 있습니다」라고 말하는 부분이라 근거가 맞아야 한다.
 */
import { describe, ok, eq } from './harness.mjs';
import { encodeQR, damageReport } from '../src/lib/qr.js';
import { scanAdvice, contrastRatio, luminance, parseColor, minPrintMm, logoCells } from '../src/lib/advice.js';

export default function run() {
  describe('색 셈', () => {
    eq(parseColor('#ffffff'), [255, 255, 255], '흰색');
    eq(parseColor('#000'), [0, 0, 0], '세 자리도 읽는다');
    eq(parseColor('fff'), [255, 255, 255], '# 이 없어도 된다');
    eq(parseColor('헛소리'), null, '모르는 값은 null');
    eq(luminance('#ffffff'), 1, '흰색 밝기는 1');
    eq(luminance('#000000'), 0, '검정 밝기는 0');
    // WCAG 의 널리 알려진 값 — 흑백은 21배
    eq(Math.round(contrastRatio('#000000', '#ffffff')), 21, '흑백 대비는 21배');
    eq(Math.round(contrastRatio('#ffffff', '#ffffff')), 1, '같은 색은 1배');
    ok(Math.abs(contrastRatio('#1d4ed8', '#ffffff') - 7.0) < 1.5, '진한 파랑과 흰색은 7배쯤');
  });

  describe('스캔 판정', () => {
    const qr = encodeQR('https://trmoo.github.io/comedu_portal/', { ecl: 'M' });

    const good = scanAdvice(qr, { fg: '#111827', bg: '#ffffff', margin: 4, shape: 'square' });
    eq(good.level, 'good', '검정·흰색·여백 4칸이면 괜찮다');
    eq(good.items.length, 0, '괜찮으면 짚을 것이 없다');

    // ① 색을 거꾸로 쓰면 — 가장 흔한 실수
    const inverted = scanAdvice(qr, { fg: '#ffffff', bg: '#111827', margin: 4 });
    eq(inverted.level, 'bad', '밝은 무늬 + 어두운 바탕은 안 된다');
    ok(inverted.items.some((i) => i.text.includes('거꾸로')), '거꾸로 썼다고 알려 준다');

    // ② 밝기 차이가 모자라면
    const pale = scanAdvice(qr, { fg: '#9ca3af', bg: '#ffffff', margin: 4 });
    ok(pale.level === 'bad' || pale.level === 'warn', '연한 회색 무늬는 짚는다');
    ok(pale.items.some((i) => i.text.includes('밝기 차이')), '밝기 차이를 말해 준다');

    // ③ 여백
    eq(scanAdvice(qr, { margin: 0 }).level, 'bad', '여백이 없으면 안 된다');
    ok(scanAdvice(qr, { margin: 2 }).items.some((i) => i.text.includes('4모듈')), '규격 권고를 알려 준다');
    eq(scanAdvice(qr, { margin: 4 }).items.filter((i) => i.text.includes('여백')).length, 0, '4칸이면 말하지 않는다');

    // ④ 모양
    ok(scanAdvice(qr, { shape: 'dot' }).items.some((i) => i.text.includes('동그라미')), '동그라미는 알려 준다');
    eq(scanAdvice(qr, { shape: 'round' }).items.length, 0, '둥근 네모는 짚지 않는다');

    // ⑤ 투명 배경
    ok(scanAdvice(qr, { transparent: true }).items.some((i) => i.text.includes('투명')), '투명 배경을 짚는다');
  });

  describe('가운데 그림 판정', () => {
    // 넓이 비율이 아니라 「블록이 한도를 넘는가」로 따진다.
    // 오류 정정은 블록마다 따로 셈하는데 가운데 그림은 한곳에 몰려 있어서다.
    const text = 'https://trmoo.github.io/comedu_portal/';
    const qrL = encodeQR(text, { ecl: 'L' });
    const qrH = encodeQR(text, { ecl: 'H' });

    ok(scanAdvice(qrH, { logo: {}, logoRatio: 0.1 }).items.some((i) => i.text.includes('%')), '덮는 비율을 말해 준다');
    // 수준 L 은 작은 그림도 금방 깨진다
    eq(scanAdvice(qrL, { logo: {}, logoRatio: 0.25 }).level, 'bad', '수준 L 에 25% 그림은 못 읽는다');
    ok(scanAdvice(qrL, { logo: {}, logoRatio: 0.25 }).items.some((i) => i.text.includes('한도')), '한도를 넘었다고 말해 준다');
    // 수준 H 는 30% 그림도 버틴다 — 로고를 넣을 때 H 를 쓰는 까닭
    ok(scanAdvice(qrH, { logo: {}, logoRatio: 0.3 }).items.every((i) => i.level !== 'bad'), '수준 H 는 30% 그림도 읽힌다');
    ok(damageReport(qrH, logoCells(qrH, 0.3)).readable, '수준 H · 30% 는 블록 한도 안');
    ok(!damageReport(qrL, logoCells(qrL, 0.25)).readable, '수준 L · 25% 는 블록 한도 밖');
    // 수준을 올리라는 안내
    ok(scanAdvice(qrH, { logo: {}, logoRatio: 0.2 }).items.every((i) => !i.text.includes('H 로 올려')), '이미 H 면 올리라고 하지 않는다');
    ok(scanAdvice(encodeQR(text, { ecl: 'M' }), { logo: {}, logoRatio: 0.2 }).items.some((i) => i.text.includes('H(높음)')),
      'H 가 아니면 올리라고 알려 준다');
    // 그림이 커질수록 망가지는 칸이 는다
    const worst = (r) => Math.max(...damageReport(qrH, logoCells(qrH, r)).perBlock);
    ok(worst(0.3) > worst(0.1), '그림이 크면 더 많이 망가진다');
  });

  describe('인쇄 최소 크기', () => {
    const small = encodeQR('https://a.com', { ecl: 'M' });
    const big = encodeQR('가'.repeat(300), { ecl: 'H' });
    ok(minPrintMm(big) > minPrintMm(small), '칸이 많을수록 크게 인쇄해야 한다');
    eq(minPrintMm(small, 4), Math.ceil((small.size + 8) * 0.5), '한 칸 0.5mm 로 셈한다');
    ok(minPrintMm(small) >= 15, '가장 작은 QR 코드도 15mm 는 넘는다');
  });
}
