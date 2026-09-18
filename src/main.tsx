import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { validateBalance } from './config/balance.ts'

// 밸런스 수치끼리의 정합성(터널링 한계 등)을 개발 중에 바로 알려준다.
// 검사 함수가 있어도 아무도 부르지 않으면 없는 것과 같다.
if (import.meta.env.DEV) {
  for (const issue of validateBalance()) console.error(`[balance] ${issue}`)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
