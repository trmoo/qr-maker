/*!
 * QR 코드 만들기 — 빌드 설정
 * © 2026 티쳐무 · 모든 권리 보유.
 */
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const BANNER = `/*!
 * QR 코드 만들기 — © 2026 티쳐무 · 모든 권리 보유
 * 학교 수업 목적으로만 이용해 주세요. 무단 배포 및 상업적 이용을 금합니다.
 * 오픈소스 라이선스를 붙이지 않았습니다.
 */`;

export default defineConfig({
  base: './', // 깃허브 Pages 하위 경로에서도 열리게 상대 경로를 쓴다
  plugins: [viteSingleFile()],
  build: {
    assetsInlineLimit: 100_000_000, // 자원을 모두 한 파일에 넣는다
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // ⚠ Vite 8(rolldown)에서는 banner 가 압축에서 지워진다. 압축 뒤에 붙는 postBanner 를 쓸 것.
        //   (확인은 배너의 둘째 줄로 한다 — 첫 줄 `/*!` 만 보면 CSS 머리 주석에 걸려 늘 통과한다)
        postBanner: BANNER,
      },
    },
  },
  esbuild: {
    legalComments: 'inline',
  },
});
