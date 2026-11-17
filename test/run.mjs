/*!
 * QR 코드 만들기 — 시험 모으기
 * © 2026 티쳐무 · 모든 권리 보유.
 *
 *   npm test
 */
import { report } from './harness.mjs';
import qrTests from './qr.test.mjs';
import payloadTests from './payload.test.mjs';
import renderTests from './render.test.mjs';
import adviceTests from './advice.test.mjs';

qrTests();
payloadTests();
renderTests();
adviceTests();

process.exit(report() ? 0 : 1);
