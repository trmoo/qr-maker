/*!
 * QR 코드 만들기 — node 에서 CSS 를 불러올 때 건너뛰게 하는 고리
 * © 2026 티쳐무 · 모든 권리 보유.
 *
 * 비테는 `import './style.css'` 를 알아듣지만 node 는 모른다.
 * 점검 도구가 소스를 그대로 불러 볼 수 있도록 CSS 는 빈 모듈로 바꿔 준다.
 */
export function resolve(specifier, context, next) {
  if (specifier.endsWith('.css')) {
    return { url: 'data:text/javascript,export default {}', shortCircuit: true, format: 'module' };
  }
  return next(specifier, context);
}
