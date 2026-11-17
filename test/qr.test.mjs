/*!
 * QR 코드 만들기 — QR 인코더 시험
 * © 2026 티쳐무 · 모든 권리 보유.
 *
 * ① 규격 예제 대조 — ISO/IEC 18004 의 "01234567" 코드워드
 * ② 기준 대조 — segno(다른 사람의 규격 구현)가 만든 520가지와 모듈 한 칸까지
 * ③ 표·수식 점검 — 자리 수, 정렬 무늬 좌표, 형식 정보
 * ④ 오류 정정 체험이 블록을 바르게 세는가
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, ok, eq, throws } from './harness.mjs';
import {
  encodeQR, chooseMode, pickVersion, capacityBits, blockLayout, sizeOf,
  alignmentPositions, formatInfo, versionInfo, damageReport, PART, MODE, ECL,
} from '../src/lib/qr.js';

const here = dirname(fileURLToPath(import.meta.url));

export default function run() {
  // ───────────── ① 규격 예제 ─────────────
  describe('규격 예제 (ISO/IEC 18004)', () => {
    // 규격 부속서 I.2 — "01234567" 을 버전 1·수준 M 으로 담으면 나오는 코드워드
    const qr = encodeQR('01234567', { ecl: 'M', mask: 2 });
    eq(qr.version, 1, '버전은 1');
    eq(qr.size, 21, '격자는 21×21');
    eq(qr.mode, 'numeric', '숫자 모드로 고른다');
    eq(qr.layout.dataTotal, 16, '버전1-M 의 데이터 코드워드는 16개');
    eq(qr.layout.eccLen, 10, '버전1-M 의 오류 정정 코드워드는 10개');
    eq(qr.layout.numBlocks, 1, '버전1-M 의 블록은 1개');

    const expectData = [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11];
    const expectEcc = [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55];
    eq([...qr.codewords.slice(0, 16)], expectData, '데이터 코드워드가 규격 예제와 같다');
    eq([...qr.codewords.slice(16)], expectEcc, '오류 정정 코드워드가 규격 예제와 같다');
  });

  // ───────────── ③ 표와 수식 ─────────────
  describe('자리 수와 표', () => {
    eq(sizeOf(1), 21, '버전1 은 21×21');
    eq(sizeOf(40), 177, '버전40 은 177×177');
    // 널리 알려진 값들 (규격 표 7·9)
    eq(blockLayout(1, 'L').dataTotal, 19, '버전1-L 데이터 19코드워드');
    eq(blockLayout(1, 'H').dataTotal, 9, '버전1-H 데이터 9코드워드');
    eq(blockLayout(40, 'L').dataTotal, 2956, '버전40-L 데이터 2956코드워드');
    eq(blockLayout(40, 'H').dataTotal, 1276, '버전40-H 데이터 1276코드워드');
    eq(blockLayout(5, 'Q').numBlocks, 4, '버전5-Q 블록 4개');
    eq(blockLayout(5, 'Q').shortData, 15, '버전5-Q 짧은 블록 데이터 15개');
    eq(blockLayout(40, 'H').total, 3706, '버전40 전체 코드워드 3706개');

    // 담을 수 있는 글자 수 — 널리 알려진 최대치
    eq(pickVersion('1'.repeat(7089), MODE.numeric, 'L'), 40, '숫자는 버전40-L 에 7089자');
    eq(pickVersion('1'.repeat(7090), MODE.numeric, 'L'), null, '7090자는 안 들어간다');
    eq(pickVersion('A'.repeat(4296), MODE.alphanumeric, 'L'), 40, '영숫자는 4296자');
    eq(pickVersion('A'.repeat(4297), MODE.alphanumeric, 'L'), null, '4297자는 안 들어간다');
    eq(pickVersion('a'.repeat(2953), MODE.byte, 'L'), 40, '바이트는 2953자');
    eq(pickVersion('a'.repeat(2954), MODE.byte, 'L'), null, '2954자는 안 들어간다');
    eq(pickVersion('1'.repeat(41), MODE.numeric, 'L'), 1, '버전1-L 에 숫자 41자');
    eq(pickVersion('1'.repeat(42), MODE.numeric, 'L'), 2, '42자면 버전2');

    eq(alignmentPositions(1), [], '버전1 은 정렬 무늬가 없다');
    eq(alignmentPositions(2), [6, 18], '버전2 의 정렬 무늬');
    eq(alignmentPositions(7), [6, 22, 38], '버전7 의 정렬 무늬');
    // 버전32 만 규격 표가 계산식과 어긋난다(간격 28이 아니라 26) — 표를 따른다
    eq(alignmentPositions(32), [6, 34, 60, 86, 112, 138], '버전32 는 예외 간격');
    eq(alignmentPositions(35), [6, 30, 54, 78, 102, 126, 150], '버전35 부터 7줄');
    eq(alignmentPositions(40), [6, 30, 58, 86, 114, 142, 170], '버전40 의 정렬 무늬');

    // 형식 정보 — 규격 부속서 C 표 C.1
    eq(formatInfo('L', 0), 0b111011111000100, '수준L·마스크0 형식 정보');
    eq(formatInfo('M', 0), 0b101010000010010, '수준M·마스크0 형식 정보');
    eq(formatInfo('L', 7), 0b110100101110110, '수준L·마스크7 형식 정보');
    eq(formatInfo('Q', 0), 0b011010101011111, '수준Q·마스크0 형식 정보');
    eq(formatInfo('Q', 7), 0b010101111101101, '수준Q·마스크7 형식 정보');
    eq(formatInfo('H', 0), 0b001011010001001, '수준H·마스크0 형식 정보');
    eq(formatInfo('H', 7), 0b000100000111011, '수준H·마스크7 형식 정보');
    // 버전 정보 — 규격 부속서 D 표 D.1 (18비트)
    eq(versionInfo(7), 0b000111110010010100, '버전7 정보');
    eq(versionInfo(40), 0b101000110001101001, '버전40 정보');
  });

  describe('모드 고르기', () => {
    eq(chooseMode('12345').name, 'numeric', '숫자만이면 숫자 모드');
    eq(chooseMode('ABC 123').name, 'alphanumeric', '대문자와 기호는 영숫자 모드');
    eq(chooseMode('abc').name, 'byte', '소문자는 바이트 모드');
    eq(chooseMode('가나다').name, 'byte', '한글은 바이트 모드');
    eq(chooseMode('ABC!').name, 'byte', '영숫자 표에 없는 기호는 바이트 모드');
    eq(chooseMode('https://A.COM').name, 'byte', '소문자가 섞인 주소는 바이트 모드');
    throws(() => encodeQR(''), '빈 글은 오류');
    throws(() => encodeQR('가'.repeat(1000), { ecl: 'H', maxVersion: 1 }), '넘치면 오류');
  });

  describe('기능 무늬 자리', () => {
    const qr = encodeQR('https://trmoo.github.io/', { ecl: 'Q' });
    eq(qr.part[0][0], PART.FINDER, '왼쪽 위는 위치 찾기 무늬');
    eq(qr.part[0][7], PART.SEPARATOR, '그 옆은 분리 여백');
    eq(qr.part[6][10], PART.TIMING, '6번 줄은 타이밍 무늬');
    eq(qr.part[qr.size - 8][8], PART.DARK, '늘 검은 모듈 자리');
    eq(qr.modules[qr.size - 8][8], 1, '늘 검은 모듈은 검다');
    eq(qr.part[8][0], PART.FORMAT, '8번 줄 왼쪽은 형식 정보');
    const big = encodeQR('x'.repeat(200), { ecl: 'H' });
    ok(big.version >= 7, '200자면 버전 7 이상');
    eq(big.part[0][big.size - 11], PART.VERSION, '버전 7 이상은 버전 정보 자리가 있다');
    // 타이밍 무늬는 검-흰이 번갈아 나온다
    let alt = true;
    for (let i = 8; i < qr.size - 8; i++) if (qr.modules[6][i] !== (i % 2 === 0 ? 1 : 0)) alt = false;
    ok(alt, '타이밍 무늬가 번갈아 칠해진다');
  });

  describe('오류 정정 체험 셈', () => {
    const qr = encodeQR('https://trmoo.github.io/comedu_portal/', { ecl: 'H' });
    eq(damageReport(qr, new Set()).readable, true, '아무것도 안 가리면 읽힌다');
    // 데이터 모듈을 블록 하나에서만 조금 가린다 → 읽힌다
    // 본래 검은 칸만 센다 — 흰 칸을 덮는 것은 아무것도 바꾸지 않기 때문
    const dataCells = [];
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) if (qr.part[y][x] === PART.DATA && qr.modules[y][x]) dataCells.push([y, x]);
    }
    // 흰 칸을 아무리 덮어도 읽히는 데 지장이 없다
    const whites = new Set();
    for (let y = 0; y < qr.size && whites.size < 40; y++) {
      for (let x = 0; x < qr.size && whites.size < 40; x++) {
        if (qr.part[y][x] === PART.DATA && !qr.modules[y][x]) whites.add(`${y},${x}`);
      }
    }
    eq(damageReport(qr, whites).readable, true, '흰 칸만 덮으면 그대로 읽힌다');
    eq(damageReport(qr, whites).damagedCodewords, 0, '흰 칸을 덮은 것은 망가진 것이 아니다');
    eq(damageReport(qr, whites).noChange, whites.size, '달라진 것이 없는 칸 수를 센다');
    const one = new Set();
    for (const [y, x] of dataCells) {
      const cw = qr.cwIndexMap[y][x];
      if (cw >= 0 && qr.codewordOwner[cw] === 0) { one.add(`${y},${x}`); if (one.size > 3) break; }
    }
    const r1 = damageReport(qr, one);
    ok(r1.damagedCodewords <= r1.limit, '조금 가리면 고칠 수 있는 범위');
    eq(r1.readable, true, '조금 가려도 읽힌다');

    // 한 블록을 한도보다 많이 가린다 → 못 읽는다
    const many = new Set();
    const seen = new Set();
    for (const [y, x] of dataCells) {
      const cw = qr.cwIndexMap[y][x];
      if (cw >= 0 && qr.codewordOwner[cw] === 0 && !seen.has(cw)) {
        seen.add(cw);
        many.add(`${y},${x}`);
        if (seen.size > Math.floor(qr.layout.eccLen / 2)) break;
      }
    }
    eq(damageReport(qr, many).readable, false, '한 블록을 한도 넘게 가리면 못 읽는다');
    eq(damageReport(qr, many).brokenBlocks, 1, '망가진 블록이 1개');

    // 위치 찾기 무늬를 가리면 바로 못 읽는다
    eq(damageReport(qr, new Set(['0,0'])).readable, false, '위치 찾기 무늬를 가리면 못 읽는다');
    eq(damageReport(qr, new Set(['0,0'])).functionHit, 1, '기능 무늬를 가린 수를 센다');
  });

  // ───────────── ② segno 기준 대조 (가장 중요) ─────────────
  describe('기준 대조 — segno 와 모듈 한 칸까지', () => {
    let golden;
    try {
      golden = JSON.parse(gunzipSync(readFileSync(join(here, 'golden.json.gz'))).toString('utf8'));
    } catch {
      ok(false, '기준 파일(test/golden.json.gz)이 없습니다 — python tools/golden.py 를 돌리세요');
      return;
    }
    let same = 0;
    const problems = [];
    for (const c of golden.cases) {
      let qr;
      try {
        // padStyle:'segno' — segno 의 자리 채우기 버릇을 흉내 내어 격자를 꼭 맞게 견준다.
        // (우리 기본값은 규격대로이고, 그것이 파이썬 qrcode 와 같다 — 아래 교차 대조)
        qr = encodeQR(c.text, { ecl: c.ecl, version: c.version, mask: c.mask, mode: c.mode, padStyle: 'segno' });
      } catch (e) {
        problems.push(`${c.text.slice(0, 20)} ${c.ecl} v${c.version} → 오류 ${e.message}`);
        continue;
      }
      if (qr.size !== c.size) { problems.push(`크기 다름 v${c.version}`); continue; }
      let diff = 0;
      for (let y = 0; y < c.size; y++) {
        const row = c.rows[y];
        for (let x = 0; x < c.size; x++) if (Number(row[x]) !== qr.modules[y][x]) diff++;
      }
      if (diff === 0) same++;
      else problems.push(`v${c.version}-${c.ecl} 마스크${c.mask} "${c.text.slice(0, 16)}" → 다른 칸 ${diff}개`);
    }
    eq(problems.slice(0, 5), [], '기준과 다른 곳이 없다');
    eq(same, golden.cases.length, `${golden.cases.length}가지가 모두 기준과 같다`);
  });

  // ───────────── ②-2 다른 구현으로 교차 대조 ─────────────
  // 자리 채우기에서 segno 와 갈리는 곳이 있어, 주류 구현인 파이썬 qrcode 와도 맞대어 본다.
  // 이쪽은 우리 기본값(규격대로)으로 견주고, 버전·마스크까지 저절로 고르게 둔다.
  describe('교차 대조 — 파이썬 qrcode 와 (기본 설정으로)', () => {
    let golden;
    try {
      golden = JSON.parse(gunzipSync(readFileSync(join(here, 'golden.json.gz'))).toString('utf8'));
    } catch { return; }
    const cross = golden.cross || [];
    ok(cross.length > 0, '교차 기준이 있다');
    let same = 0;
    let sameMask = 0;
    const problems = [];
    for (const c of cross) {
      // 버전은 저절로 고르게 두고, 마스크는 기준이 고른 것에 맞춘다.
      // (qrcode 의 마스크 벌점 셈법이 규격과 조금 달라 고르는 번호가 다를 수 있다.
      //  우리가 바르게 고르는지는 아래 「마스크를 바르게 고르는가」 에서 따로 본다)
      const auto = encodeQR(c.text, { ecl: c.ecl });
      if (auto.version !== c.version) { problems.push(`버전 다름 "${c.text.slice(0, 14)}" ${c.ecl}: ${auto.version} ↔ ${c.version}`); continue; }
      if (auto.mask === c.mask) sameMask++;
      const qr = encodeQR(c.text, { ecl: c.ecl, mask: c.mask });
      let diff = 0;
      for (let y = 0; y < c.size; y++) {
        for (let x = 0; x < c.size; x++) if (Number(c.rows[y][x]) !== qr.modules[y][x]) diff++;
      }
      if (diff === 0) same++;
      else problems.push(`v${c.version}-${c.ecl} "${c.text.slice(0, 14)}" 마스크${c.mask} → 다른 칸 ${diff}개`);
    }
    eq(problems.slice(0, 5), [], '교차 기준과 다른 곳이 없다');
    eq(same, cross.length, `${cross.length}가지가 모두 교차 기준과 같다 (버전·코드워드·오류 정정·자리 채우기)`);
    ok(sameMask > cross.length * 0.3, `마스크 선택도 ${sameMask}/${cross.length} 가지에서 같다`);
  });

  describe('마스크를 바르게 고르는가', () => {
    // 여덟 가지를 모두 만들어 벌점을 재고, 우리가 고른 것이 정말 가장 낮은지 본다
    for (const text of ['https://trmoo.github.io/comedu_portal/', '와우고 정보 수업', '01234567', 'A'.repeat(120)]) {
      for (const e of ['L', 'H']) {
        const auto = encodeQR(text, { ecl: e });
        eq(auto.maskScores.length, 8, '여덟 가지를 모두 겨룬다');
        const totals = auto.maskScores.map((s) => s.total);
        const min = Math.min(...totals);
        eq(totals[auto.mask], min, `"${text.slice(0, 12)}" ${e}: 고른 마스크 ${auto.mask}번의 벌점이 가장 낮다`);
        // 같은 벌점이 여럿이면 번호가 작은 것을 쓴다
        eq(auto.mask, totals.indexOf(min), '벌점이 같으면 번호가 작은 마스크');
        // 벌점은 네 가지를 더한 값이다
        for (const s of auto.maskScores) eq(s.n1 + s.n2 + s.n3 + s.n4, s.total, '벌점 네 가지의 합이 합계');
        // 마스크를 손으로 정해 주면 겨루지 않는다
        eq(encodeQR(text, { ecl: e, mask: 3 }).maskScores, null, '마스크를 정해 주면 겨루기를 건너뛴다');
        eq(encodeQR(text, { ecl: e, mask: 3 }).mask, 3, '정해 준 마스크를 쓴다');
      }
    }
  });

  describe('자리 채우기 방식 차이', () => {
    // 비트열이 이미 바이트 경계에 딱 맞을 때만 두 방식이 갈린다
    const text = 'https://trmoo.github.io/comedu_portal/';
    const spec = encodeQR(text, { ecl: 'L', version: 3, mask: 1 });
    const segno = encodeQR(text, { ecl: 'L', version: 3, mask: 1, padStyle: 'segno' });
    eq((spec.usedBits + 4) % 8, 0, '이 글은 끝 표시까지 넣으면 바이트 경계에 딱 맞는다');
    ok(spec.codewords.some((v, i) => v !== segno.codewords[i]), '두 방식의 코드워드가 다르다');
    eq(spec.codewords[40], 0xec, '규격대로면 바로 채움 코드워드 0xEC');
    eq(segno.codewords[40], 0x00, 'segno 방식은 0 바이트가 하나 더 들어간다');
    // 바이트 모드는 늘 경계에 맞으므로(4+8+8n+4), 숫자 모드로 어긋나는 보기를 든다
    const other = '01234567';
    const a = encodeQR(other, { ecl: 'L', version: 1, mask: 1 });
    const b = encodeQR(other, { ecl: 'L', version: 1, mask: 1, padStyle: 'segno' });
    ok((a.usedBits + 4) % 8 !== 0, '숫자 모드 보기는 경계에 안 맞는다');
    eq([...a.codewords], [...b.codewords], '경계에 안 맞으면 두 방식이 같다');
  });

  describe('수준별 안내값', () => {
    for (const name of ['L', 'M', 'Q', 'H']) {
      ok(ECL[name].label.length > 0, `${name} 수준 설명이 있다`);
      const qr = encodeQR('https://example.com', { ecl: name });
      eq(qr.ecl, name, `${name} 수준이 그대로 쓰인다`);
      ok(qr.capacityBits >= qr.usedBits, `${name} 수준에서 자리가 모자라지 않다`);
    }
    // 수준이 높아지면 같은 글이 더 큰 버전을 쓰거나 같다
    const vs = ['L', 'M', 'Q', 'H'].map((e) => encodeQR('가'.repeat(60), { ecl: e }).version);
    ok(vs[0] <= vs[1] && vs[1] <= vs[2] && vs[2] <= vs[3], '수준이 높을수록 버전이 크거나 같다');
  });
}
