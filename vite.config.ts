import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // 상대 경로 base: 빌드 결과물이 어느 하위 경로에 놓여도 자산을 찾는다.
  // GitHub Pages 는 https://<user>.github.io/deckout/ 처럼 "저장소 이름 하위 경로"에서 서빙하므로,
  // 기본값('/')으로 빌드하면 /assets/... 를 도메인 루트에서 찾다가 404 가 나 빈 화면이 된다.
  // 이 앱은 클라이언트 라우팅이 없어서 상대 base 로 충분하다.
  base: './',
  plugins: [react(), tailwindcss()],
})
