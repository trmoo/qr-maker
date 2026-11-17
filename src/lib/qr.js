/*!
 * QR 코드 만들기 — QR 인코더
 * © 2026 티쳐무 · 모든 권리 보유. 학교 수업 목적으로만 이용해 주세요.
 *
 * 외부 라이브러리를 쓰지 않고 ISO/IEC 18004(QR Code Model 2) 규격을 그대로 구현했다.
 * 버전 1~40, 오류 정정 L·M·Q·H, 숫자·영숫자·바이트(UTF-8) 모드를 지원한다.
 *
 * 만들어지는 순서 (규격 7장)
 *   ① 담을 글을 보고 모드를 고른다           → chooseMode
 *   ② 모드·길이·내용을 비트로 바꾼다          → encodeSegment
 *   ③ 버전을 고르고 남는 자리를 채운다        → buildDataCodewords
 *   ④ 블록으로 나눠 오류 정정 코드를 붙인다    → interleave (리드-솔로몬)
 *   ⑤ 격자에 기능 무늬를 놓는다               → buildFunctionMatrix
 *   ⑥ 코드워드를 지그재그로 채운다            → placeCodewords
 *   ⑦ 마스크 8가지를 겨뤄 가장 좋은 것을 쓴다  → chooseMask
 *   ⑧ 형식·버전 정보를 넣는다                 → addFormatInfo / addVersionInfo
 */

// ───────────────────────── 오류 정정 수준 ─────────────────────────
// 값은 형식 정보에 들어가는 두 비트다(규격 표 12).
export const ECL = {
  L: { name: 'L', bits: 1, recover: 7, label: '낮음 (7% 복구)' },
  M: { name: 'M', bits: 0, recover: 15, label: '보통 (15% 복구)' },
  Q: { name: 'Q', bits: 3, recover: 25, label: '조금 높음 (25% 복구)' },
  H: { name: 'H', bits: 2, recover: 30, label: '높음 (30% 복구)' },
};
const ECL_ORDER = ['L', 'M', 'Q', 'H'];

// 블록 하나에 붙는 오류 정정 코드워드 수 (버전 1~40, L·M·Q·H 순서)
const ECC_PER_BLOCK = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

// 블록 수 (버전 1~40)
const NUM_BLOCKS = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

// 모듈의 종류 — 「원리」 화면에서 색으로 가르는 데 쓴다.
export const PART = {
  DATA: 0,       // 데이터와 오류 정정 코드
  FINDER: 1,     // 위치 찾기 무늬 (세 귀퉁이)
  SEPARATOR: 2,  // 분리 여백
  TIMING: 3,     // 타이밍 무늬 (좌표의 자)
  ALIGNMENT: 4,  // 정렬 무늬
  FORMAT: 5,     // 형식 정보 (오류 정정 수준·마스크)
  VERSION: 6,    // 버전 정보 (7 이상)
  DARK: 7,       // 늘 검은 모듈 하나
};

// ───────────────────────── GF(256) 산술 ─────────────────────────
// 리드-솔로몬은 0~255를 하나의 「수」로 보는 유한체 위에서 계산한다.
const EXP = new Uint8Array(256);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x = x << 1;
    if (x & 0x100) x ^= 0x11d; // 넘치면 원시 다항식으로 줄인다
  }
}
function gmul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a] + LOG[b]) % 255];
}

/** 오류 정정 코드 n개를 만드는 생성 다항식(최고차 계수는 뺀 n개) */
function rsGenerator(n) {
  const poly = new Uint8Array(n);
  poly[n - 1] = 1;
  let root = 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      poly[j] = gmul(poly[j], root);
      if (j + 1 < n) poly[j] ^= poly[j + 1];
    }
    root = gmul(root, 2);
  }
  return poly;
}

/** 데이터 코드워드를 생성 다항식으로 나눈 나머지 = 오류 정정 코드워드 */
function rsRemainder(data, divisor) {
  const n = divisor.length;
  const res = new Uint8Array(n);
  for (const b of data) {
    const factor = b ^ res[0];
    res.copyWithin(0, 1);
    res[n - 1] = 0;
    for (let i = 0; i < n; i++) res[i] ^= gmul(divisor[i], factor);
  }
  return res;
}

// ───────────────────────── 비트 모으기 ─────────────────────────
class Bits {
  constructor() { this.arr = []; }
  push(value, length) {
    for (let i = length - 1; i >= 0; i--) this.arr.push((value >>> i) & 1);
  }
  get length() { return this.arr.length; }
}

// ───────────────────────── 모드 ─────────────────────────
const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

export const MODE = {
  numeric: { name: 'numeric', label: '숫자', bits: 1, countBits: [10, 12, 14] },
  alphanumeric: { name: 'alphanumeric', label: '영숫자', bits: 2, countBits: [9, 11, 13] },
  byte: { name: 'byte', label: '바이트(UTF-8)', bits: 4, countBits: [8, 16, 16] },
};

/** 글을 UTF-8 바이트로 */
export function toUtf8(text) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
  return Uint8Array.from(Buffer.from(text, 'utf8'));
}

/** 담을 글에 맞는 가장 효율이 좋은 모드를 고른다 */
export function chooseMode(text) {
  if (text.length > 0 && /^[0-9]+$/.test(text)) return MODE.numeric;
  if (text.length > 0 && [...text].every((c) => ALNUM.includes(c))) return MODE.alphanumeric;
  return MODE.byte;
}

function countBitsFor(mode, version) {
  const i = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  return mode.countBits[i];
}

/** 모드별로 내용을 비트로 바꾼다 */
function encodeSegment(text, mode, bits) {
  if (mode === MODE.numeric) {
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.slice(i, i + 3);
      bits.push(parseInt(chunk, 10), chunk.length * 3 + 1); // 3자→10비트, 2자→7비트, 1자→4비트
    }
  } else if (mode === MODE.alphanumeric) {
    for (let i = 0; i < text.length; i += 2) {
      if (i + 1 < text.length) {
        bits.push(ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11);
      } else {
        bits.push(ALNUM.indexOf(text[i]), 6);
      }
    }
  } else {
    for (const b of toUtf8(text)) bits.push(b, 8);
  }
}

/** 내용만으로 몇 비트가 되는지 (버전 고를 때 쓴다) */
function contentBits(text, mode) {
  if (mode === MODE.numeric) {
    const full = Math.floor(text.length / 3);
    const rest = text.length % 3;
    return full * 10 + (rest === 2 ? 7 : rest === 1 ? 4 : 0);
  }
  if (mode === MODE.alphanumeric) {
    return Math.floor(text.length / 2) * 11 + (text.length % 2) * 6;
  }
  return toUtf8(text).length * 8;
}

// ───────────────────────── 격자 크기와 자리 수 ─────────────────────────
export function sizeOf(version) { return version * 4 + 17; }

/** 기능 무늬를 뺀, 데이터가 들어갈 수 있는 모듈 수 (규격 부속서 D) */
function rawDataModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36; // 버전 정보 자리 (18비트 × 두 곳)
  }
  return result;
}

/** 버전·오류 정정 수준별 블록 구성 */
export function blockLayout(version, eclName) {
  const total = Math.floor(rawDataModules(version) / 8);
  const numBlocks = NUM_BLOCKS[eclName][version - 1];
  const eccLen = ECC_PER_BLOCK[eclName][version - 1];
  const shortLen = Math.floor(total / numBlocks);
  const numShort = numBlocks - (total % numBlocks);
  return {
    total,                          // 전체 코드워드 수
    numBlocks,
    eccLen,                         // 블록마다 붙는 오류 정정 코드워드 수
    numShort,                       // 짧은 블록 수
    shortData: shortLen - eccLen,   // 짧은 블록의 데이터 코드워드 수
    longData: shortLen - eccLen + 1,
    dataTotal: total - numBlocks * eccLen,
    remainderBits: rawDataModules(version) % 8, // 끝에 남는 0 비트
  };
}

/** 그 버전·수준에 담을 수 있는 데이터 비트 수 */
export function capacityBits(version, eclName) {
  return blockLayout(version, eclName).dataTotal * 8;
}

/** 글·모드·수준으로 가장 작은 버전을 고른다. 안 들어가면 null */
export function pickVersion(text, mode, eclName, minVersion = 1, maxVersion = 40) {
  const body = contentBits(text, mode);
  for (let v = Math.max(1, minVersion); v <= Math.min(40, maxVersion); v++) {
    const need = 4 + countBitsFor(mode, v) + body;
    if (need <= capacityBits(v, eclName)) return v;
  }
  return null;
}

// ───────────────────────── 데이터 코드워드 만들기 ─────────────────────────
function buildDataCodewords(text, mode, version, eclName, padStyle = 'spec') {
  const layout = blockLayout(version, eclName);
  const capacity = layout.dataTotal * 8;
  const bits = new Bits();
  bits.push(mode.bits, 4);
  bits.push(mode === MODE.byte ? toUtf8(text).length : text.length, countBitsFor(mode, version));
  encodeSegment(text, mode, bits);
  if (bits.length > capacity) throw new Error('내용이 이 버전에 들어가지 않습니다');
  const contentLength = bits.length; // 끝 표시·채움 앞까지 — 실제로 쓴 비트

  // 끝 표시 0000 (자리가 모자라면 들어가는 만큼만)
  bits.push(0, Math.min(4, capacity - bits.length));
  // 바이트 경계까지 0으로 채운다.
  // ⚠ 'segno' 는 시험에서만 쓴다 — 파이썬 segno 는 이미 경계에 딱 맞을 때도
  //    0 바이트를 하나 더 넣는다(규격 7.4.10 과 다르고, 널리 쓰이는 다른 구현들과도 다르다).
  //    읽히는 데는 지장이 없지만 격자가 달라지므로, 대조할 때만 그 방식을 흉내 낸다.
  const need = 8 - (bits.length % 8);
  const padBits = padStyle === 'segno' ? need : need % 8;
  bits.push(0, Math.min(padBits, capacity - bits.length));

  const data = new Uint8Array(layout.dataTotal);
  for (let i = 0; i < bits.arr.length; i++) {
    if (bits.arr[i]) data[i >> 3] |= 0x80 >> (i & 7);
  }
  // 남는 자리는 0xEC, 0x11을 번갈아 넣는다(규격 7.4.10)
  for (let i = bits.arr.length >> 3, pad = 0xec; i < data.length; i++, pad ^= 0xec ^ 0x11) {
    data[i] = pad;
  }
  return { data, layout, usedBits: contentLength, paddedBits: bits.length };
}

/** 블록으로 나눠 오류 정정 코드를 붙이고 번갈아 섞는다(규격 7.6) */
function interleave(data, layout) {
  const { numBlocks, numShort, shortData, eccLen } = layout;
  const divisor = rsGenerator(eccLen);
  const dataBlocks = [];
  const eccBlocks = [];
  let at = 0;
  for (let b = 0; b < numBlocks; b++) {
    const len = shortData + (b < numShort ? 0 : 1);
    const block = data.subarray(at, at + len);
    at += len;
    dataBlocks.push(block);
    eccBlocks.push(rsRemainder(block, divisor));
  }
  const result = new Uint8Array(layout.total);
  // 어느 코드워드가 어느 블록에서 왔는지 — 「오류 정정 체험」에서 쓴다
  const owner = new Int16Array(layout.total);
  let k = 0;
  const maxData = shortData + 1;
  for (let i = 0; i < maxData; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < dataBlocks[b].length) {
        owner[k] = b;
        result[k++] = dataBlocks[b][i];
      }
    }
  }
  for (let i = 0; i < eccLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      owner[k] = b;
      result[k++] = eccBlocks[b][i];
    }
  }
  return { codewords: result, owner };
}

// ───────────────────────── 격자 ─────────────────────────
const UNSET = 2; // 아직 아무것도 안 들어간 자리

/** 정렬 무늬의 중심 좌표 (규격 부속서 E) */
export function alignmentPositions(version) {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = sizeOf(version) - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

function buildFunctionMatrix(version) {
  const size = sizeOf(version);
  const m = []; // 모듈 값 (0·1 또는 UNSET)
  const part = [];
  for (let i = 0; i < size; i++) {
    m.push(new Uint8Array(size).fill(UNSET));
    part.push(new Uint8Array(size).fill(PART.DATA));
  }
  const set = (y, x, v, p) => { m[y][x] = v; part[y][x] = p; };

  // 버전 정보 자리 비워 두기 (버전 7 이상)
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let d = 9; d <= 11; d++) {
        set(i, size - d, 0, PART.VERSION);
        set(size - d, i, 0, PART.VERSION);
      }
    }
  }
  // 형식 정보 자리 비워 두기
  for (let i = 0; i < 9; i++) {
    set(i, 8, 0, PART.FORMAT);
    set(8, i, 0, PART.FORMAT);
  }
  for (let i = 1; i <= 8; i++) {
    set(size - i, 8, 0, PART.FORMAT);
    set(8, size - i, 0, PART.FORMAT);
  }
  set(size - 8, 8, 1, PART.DARK); // 늘 검은 모듈

  // 타이밍 무늬 — 6번째 줄과 칸
  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0 ? 1 : 0;
    set(i, 6, bit, PART.TIMING);
    set(6, i, bit, PART.TIMING);
  }

  // 위치 찾기 무늬와 분리 여백
  for (const [oy, ox] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const y = oy + dy, x = ox + dx;
        if (y < 0 || y >= size || x < 0 || x >= size) continue;
        const inner = dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6;
        if (inner) {
          // 가운데에서의 거리(체비쇼프)가 2인 테두리만 밝다 — 7×7 이라 5×5 정렬 무늬와 다르다
          const d = Math.max(Math.abs(dy - 3), Math.abs(dx - 3));
          set(y, x, d === 2 ? 0 : 1, PART.FINDER);
        } else {
          set(y, x, 0, PART.SEPARATOR);
        }
      }
    }
  }

  // 정렬 무늬
  const pos = alignmentPositions(version);
  for (const cy of pos) {
    for (const cx of pos) {
      const corner = (cy === pos[0] && cx === pos[0])
        || (cy === pos[0] && cx === pos[pos.length - 1])
        || (cy === pos[pos.length - 1] && cx === pos[0]);
      if (corner) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const d = Math.max(Math.abs(dy), Math.abs(dx));
          set(cy + dy, cx + dx, d === 1 ? 0 : 1, PART.ALIGNMENT);
        }
      }
    }
  }
  return { m, part, size };
}

/** 코드워드를 두 칸 너비 기둥마다 위아래로 번갈아 채운다(규격 7.7.3) */
function placeCodewords(m, size, codewords, cwIndexMap) {
  let idx = 0; // 비트 번호
  const totalBits = codewords.length * 8;
  // ⚠ base 와 right 를 따로 둔다 — 6번 칸을 건너뛰려고 right 를 줄일 때
  //    그것이 다음 기둥 번호까지 밀면 기둥 하나가 통째로 비어 버린다.
  for (let base = size - 1; base > 0; base -= 2) {
    const right = base <= 6 ? base - 1 : base; // 타이밍 무늬가 있는 6번 칸은 건너뛴다
    for (let vert = 0; vert < size; vert++) {
      for (let z = 0; z < 2; z++) {
        const x = right - z;
        let upwards = (right & 2) === 0;
        if (x < 6) upwards = !upwards;
        const y = upwards ? size - 1 - vert : vert;
        if (m[y][x] !== UNSET) continue;
        if (idx < totalBits) {
          const cw = idx >> 3;
          m[y][x] = (codewords[cw] >> (7 - (idx & 7))) & 1;
          cwIndexMap[y][x] = cw;
          idx++;
        } else {
          m[y][x] = 0; // 남는 모듈은 밝게
          cwIndexMap[y][x] = -1;
        }
      }
    }
  }
  return idx;
}

// ───────────────────────── 마스크 ─────────────────────────
export const MASK_FN = [
  (y, x) => (y + x) % 2 === 0,
  (y, x) => y % 2 === 0,
  (y, x) => x % 3 === 0,
  (y, x) => (y + x) % 3 === 0,
  (y, x) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (y, x) => ((y * x) % 2) + ((y * x) % 3) === 0,
  (y, x) => ((((y * x) % 2) + ((y * x) % 3)) % 2) === 0,
  (y, x) => ((((y + x) % 2) + ((y * x) % 3)) % 2) === 0,
];

/** 마스크를 데이터 영역에만 덧씌운다 */
function applyMask(m, part, size, maskNo) {
  const fn = MASK_FN[maskNo];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (part[y][x] === PART.DATA && fn(y, x)) m[y][x] ^= 1;
    }
  }
}

const N3_PATTERN = [1, 0, 1, 1, 1, 0, 1];

function n3Occurrences(seq, size) {
  let count = 0;
  for (let i = 0; i + 7 <= size; i++) {
    let hit = true;
    for (let k = 0; k < 7; k++) if (seq[i + k] !== N3_PATTERN[k]) { hit = false; break; }
    if (!hit) continue;
    // 1:1:3:1:1 무늬 앞이나 뒤에 밝은 모듈이 4칸 있어야 벌점
    let beforeClear = true;
    for (let k = Math.max(i - 4, 0); k < i; k++) if (seq[k]) { beforeClear = false; break; }
    let afterClear = true;
    for (let k = i + 7; k < Math.min(i + 11, size); k++) if (seq[k]) { afterClear = false; break; }
    if (i === 0 || i === size - 7 || beforeClear || afterClear) {
      count += 40;
      i += 6; // 무늬 끝까지 건너뛴다
    } else {
      i += 3;
    }
  }
  return count;
}

/** 마스크 벌점 (규격 7.8.3, 표 11) */
export function maskPenalty(m, size) {
  let n1 = 0, n2 = 0, n3 = 0, dark = 0;
  const col = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const row = m[i];
    let rowPrev = -1, colPrev = -1, rowRun = 0, colRun = 0;
    for (let j = 0; j < size; j++) {
      const rb = row[j];
      const cb = m[j][i];
      col[j] = cb;
      dark += rb;
      if (rb === rowPrev) rowRun++;
      else { if (rowRun >= 5) n1 += rowRun - 2; rowRun = 1; }
      if (cb === colPrev) colRun++;
      else { if (colRun >= 5) n1 += colRun - 2; colRun = 1; }
      if (i > 0 && j > 0 && rb === rowPrev && rb === m[i - 1][j] && rb === m[i - 1][j - 1]) n2 += 3;
      rowPrev = rb;
      colPrev = cb;
    }
    if (rowRun >= 5) n1 += rowRun - 2;
    if (colRun >= 5) n1 += colRun - 2;
    n3 += n3Occurrences(row, size);
    n3 += n3Occurrences(col, size);
  }
  const percent = dark / (size * size);
  const n4 = 10 * Math.floor(Math.abs(percent * 100 - 50) / 5);
  return { n1, n2, n3, n4, total: n1 + n2 + n3 + n4 };
}

/**
 * 마스크 8가지를 겨뤄 벌점이 가장 낮은 것을 고른다.
 * ⚠ 겨루는 격자에는 형식·버전 정보가 아직 들어 있지 않다(규격 7.8).
 *   그래서 다 만들어진 QR 코드로 벌점을 다시 재면 다른 숫자가 나온다 —
 *   「마스크 겨루기」 화면은 반드시 여기서 돌려주는 값을 써야 한다.
 */
function chooseMask(m, part, size) {
  let best = 0, bestScore = Infinity;
  const scores = [];
  for (let k = 0; k < 8; k++) {
    const copy = m.map((r) => Uint8Array.from(r));
    applyMask(copy, part, size, k);
    const score = maskPenalty(copy, size);
    scores.push(score);
    if (score.total < bestScore) { bestScore = score.total; best = k; }
  }
  return { mask: best, scores };
}

// ───────────────────────── 형식·버전 정보 ─────────────────────────
/** BCH(15,5) 형식 정보 (규격 7.9) */
export function formatInfo(eclName, maskNo) {
  const data = (ECL[eclName].bits << 3) | maskNo;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

/** BCH(18,6) 버전 정보 (규격 7.10) */
export function versionInfo(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

function addFormatInfo(m, size, eclName, maskNo) {
  const info = formatInfo(eclName, maskNo);
  let voff = 0, hoff = 0;
  for (let i = 0; i < 8; i++) {
    const vbit = (info >> i) & 1;
    const hbit = (info >> (14 - i)) & 1;
    if (i === 6) { voff += 1; hoff = 1; } // 타이밍 무늬 건너뛰기
    m[i + voff][8] = vbit;
    m[8][i + hoff] = hbit;
    m[8][size - 1 - i] = vbit;
    m[size - 1 - i][8] = hbit;
  }
  m[size - 8][8] = 1; // 늘 검은 모듈
}

function addVersionInfo(m, size, version) {
  if (version < 7) return;
  const info = versionInfo(version);
  for (let i = 0; i < 6; i++) {
    for (let k = 0; k < 3; k++) {
      const bit = (info >> (i * 3 + k)) & 1;
      m[size - 11 + k][i] = bit;
      m[i][size - 11 + k] = bit;
    }
  }
}

// ───────────────────────── 바깥에서 쓰는 함수 ─────────────────────────
/**
 * QR 코드를 만든다.
 * @param {string} text 담을 글
 * @param {object} opt { ecl:'L'|'M'|'Q'|'H', minVersion, maxVersion, mask, mode }
 * @returns 모듈 격자와 설명 정보
 */
export function encodeQR(text, opt = {}) {
  const eclName = ECL[opt.ecl] ? opt.ecl : 'M';
  if (typeof text !== 'string' || text.length === 0) throw new Error('담을 내용이 없습니다');
  const mode = opt.mode ? MODE[opt.mode] : chooseMode(text);
  const version = opt.version || pickVersion(text, mode, eclName, opt.minVersion || 1, opt.maxVersion || 40);
  if (!version) throw new Error('내용이 너무 길어 QR 코드 한 장에 담을 수 없습니다');

  const { data, layout, usedBits } = buildDataCodewords(text, mode, version, eclName, opt.padStyle);
  const { codewords, owner } = interleave(data, layout);

  const { m, part, size } = buildFunctionMatrix(version);
  const cwIndexMap = [];
  for (let i = 0; i < size; i++) cwIndexMap.push(new Int16Array(size).fill(-1));
  const placedBits = placeCodewords(m, size, codewords, cwIndexMap);
  // ⚠ 비어 있는 칸이 남으면 QR 코드가 안 읽힌다. 눈으로는 모르니 여기서 막는다.
  if (placedBits !== codewords.length * 8) {
    throw new Error(`자리 채우기 오류: ${placedBits}/${codewords.length * 8} 비트`);
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (m[y][x] > 1) throw new Error(`자리 채우기 오류: (${y},${x}) 칸이 비어 있습니다`);
    }
  }

  const picked = opt.mask !== undefined && opt.mask !== null
    ? { mask: opt.mask, scores: null }
    : chooseMask(m, part, size);
  applyMask(m, part, size, picked.mask);
  addFormatInfo(m, size, eclName, picked.mask);
  addVersionInfo(m, size, version);

  return {
    modules: m,          // m[y][x] = 1이면 검은 칸
    part,                // 모듈의 종류 (PART)
    size,
    version,
    ecl: eclName,
    mask: picked.mask,
    maskScores: picked.scores, // 마스크 8가지의 벌점 {n1,n2,n3,n4,total} — 마스크를 정해 주면 null
    mode: mode.name,
    modeLabel: mode.label,
    byteLength: toUtf8(text).length,
    charLength: text.length,
    usedBits,
    capacityBits: layout.dataTotal * 8,
    layout,
    cwIndexMap,          // 모듈 → 코드워드 번호
    codewords,           // 섞어 놓은 코드워드 (데이터 + 오류 정정)
    codewordOwner: owner, // 코드워드 번호 → 블록 번호
    text,
  };
}

/** 그 글이 수준별로 몇 번 버전이 되는지 (안내용) */
export function versionTable(text) {
  const mode = chooseMode(text);
  const out = {};
  for (const e of ECL_ORDER) out[e] = pickVersion(text, mode, e);
  return out;
}

/**
 * 가린 모듈 때문에 QR 코드를 읽을 수 없게 되었는지 셈한다.
 * 블록마다 오류 정정 코드워드의 절반까지 고칠 수 있다(규격 7.5).
 * @param {object} qr encodeQR 결과
 * @param {Set<string>} damaged 'y,x' 꼴의 가린 모듈 자리
 */
export function damageReport(qr, damaged) {
  const perBlock = new Int32Array(qr.layout.numBlocks);
  const seen = new Set();
  let functionHit = 0;
  let noChange = 0;
  for (const key of damaged) {
    const [y, x] = key.split(',').map(Number);
    // ⚠ 본래 흰 칸을 바탕색으로 덮으면 아무것도 바뀌지 않는다 — 망가진 것이 아니다.
    //   (이것을 빼먹으면 앱이 「못 읽습니다」라고 하는데 실제로는 읽혀 버린다)
    if (!qr.modules[y][x]) { noChange++; continue; }
    if (qr.part[y][x] !== PART.DATA) { functionHit++; continue; } // 기능 무늬는 되살릴 수 없다
    const cw = qr.cwIndexMap[y][x];
    if (cw < 0 || seen.has(cw)) continue;
    seen.add(cw);
    perBlock[qr.codewordOwner[cw]]++;
  }
  const limit = Math.floor(qr.layout.eccLen / 2);
  const over = [...perBlock].filter((n) => n > limit).length;
  return {
    perBlock: [...perBlock],
    limit,
    brokenBlocks: over,
    damagedCodewords: seen.size,
    functionHit,
    noChange,          // 가렸지만 본래 흰 칸이라 달라진 것이 없는 칸 수
    readable: over === 0 && functionHit === 0,
  };
}
