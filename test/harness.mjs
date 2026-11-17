/*!
 * QR 코드 만들기 — 시험 도구
 * © 2026 티쳐무 · 모든 권리 보유.
 */
let passed = 0;
let failed = 0;
const fails = [];
let group = '';

export function describe(name, fn) {
  group = name;
  fn();
  group = '';
}

export function ok(cond, msg) {
  if (cond) passed++;
  else { failed++; fails.push(`${group} — ${msg}`); }
}

export function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else { failed++; fails.push(`${group} — ${msg}\n    받음: ${a}\n    기대: ${b}`); }
}

export function throws(fn, msg) {
  try { fn(); failed++; fails.push(`${group} — ${msg} (오류가 나야 하는데 안 났다)`); }
  catch { passed++; }
}

export function report() {
  if (fails.length) {
    console.log('\n❌ 실패한 시험\n');
    for (const f of fails.slice(0, 40)) console.log('  ' + f);
    if (fails.length > 40) console.log(`  … 그리고 ${fails.length - 40}가지 더`);
  }
  console.log(`\n${failed ? '❌' : '✅'} 시험 ${passed + failed}가지 가운데 ${passed}가지 통과, ${failed}가지 실패`);
  return failed === 0;
}
