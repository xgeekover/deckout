# Deckout

고전 벽돌깨기(Breakout) × 덱빌딩 로그라이트.

## 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # oxlint
```

## 조작

| 입력 | 동작 |
|---|---|
| 마우스 이동 | 패들 추종 (감쇠 보간) |
| `←` `→` / `A` `D` | 패들 이동 (키 입력 시 마우스 추종 해제) |
| 클릭 / `Space` | 대기 중인 공 발사 |

발사 전에는 공이 패들 위에 붙어 있고, **패들을 움직이는 방향으로 조준선이 기웁니다**(최대 ±36°).

## 아키텍처

```
React 렌더 트리            Canvas 60fps 루프
──────────────            ─────────────────
App / HUD / RewardModal   GameEngine (rAF, 고정 타임스텝 1/120s)
      ▲        │            ├─ Physics (순수 함수, DOM 무의존)
      │        │            ├─ ParticleSystem (풀링 + trauma 셰이크)
      │        ▼            └─ entities/ Paddle · Ball · Brick
  GameState  명령 호출
  스냅샷     (launch/chooseReward/restart)
      └──── GameCanvas ────┘
```

- **엔진은 React를 모른다.** DOM 이벤트도 직접 듣지 않고 `setPointer / setKeyDirection / launch` 공개 메서드로 입력을 주입받는다.
- **UI는 캔버스를 모른다.** `engine.subscribe(listener)` 로 `GameState` 스냅샷만 받는다. `patchState` 가 얕은 비교로 변경된 프레임에만 방출하므로 60fps 리렌더가 발생하지 않는다.
- 물리는 고정 타임스텝 서브스텝(1/120s)으로 돌아 프레임레이트와 무관하게 동일하게 동작하며, 탭 복귀 시 death-spiral을 막기 위해 프레임당 누적치를 0.25s로 클램프한다.

### 파일

| 경로 | 역할 |
|---|---|
| `src/types/game.ts` | `BallType`·`DeckCard`·`GameState` 등 엔진/UI 공용 계약, `BALL_STATS` 스탯 테이블 |
| `src/engine/Physics.ts` | 원-AABB 충돌·충돌 면 판정, 다중 사각형 동시 해소, 벽 처리, 패들 각도 반사 (순수 함수) |
| `src/engine/GameEngine.ts` | rAF 루프, 턴·웨이브·덱 상태 머신, 상태 방출 |
| `src/engine/ParticleSystem.ts` | 고정 풀 파티클 + trauma² 기반 스크린 셰이크 |
| `src/engine/entities/*.ts` | Paddle / Ball / Brick |
| `src/components/GameCanvas.tsx` | 캔버스 DOM 바인딩, DPR 리사이즈, 입력 → 엔진 전달 |
| `src/components/HUD.tsx` | 웨이브·턴·라이프·덱·현재 카드 |
| `src/components/RewardModal.tsx` | 웨이브 클리어 보상 카드 선택 |

## 충돌 처리 (Step 2)

벽돌 충돌은 `Physics.resolveAABBBounce` → `Physics.resolveCircleVsRects` 2단으로 처리한다.

**1. 충돌 면 판정** — `circleVsRect` 가 원 중심에서 AABB 최근접점까지의 벡터로 법선·침투 깊이·접점을 구하고, 법선의 지배 축으로 면(`top`/`bottom`/`left`/`right`)을 정한다. 중심이 사각형 내부에 있으면 네 변까지의 거리 중 최소 축으로 밀어낸다. 법선이 대각선에 가까운 모서리 충돌은 **진입 속도의 지배 축**으로 면을 다시 판별한다.

**2. 위치 보정 후 속도 반전** — 침투 깊이만큼 밀어내는 대신 **해당 면 바깥으로 스냅**해(`rect.x - r - skin` 등) 잔여 겹침을 0으로 만든 뒤, 그 축의 속도를 `-Math.abs()` / `+Math.abs()` 로 **부호까지 강제**한다. 단순 부호 반전이 아니므로 이미 빠져나가던 공을 다시 안으로 되돌리지 않는다 → 끼임이 원천적으로 불가능.

**3. 겹친 벽돌 전부를 한 번에** — 가장 깊은 벽돌 하나만 처리하면 두 벽돌 사이에 걸친 공이 매 스텝 번갈아 밀려나며 진동한다. `resolveCircleVsRects` 는 겹친 사각형을 모두 모아 **축(x/y)별로 최대 한 번씩만** 보정·반전한다.

**4. 양쪽에서 동시에 눌리는 경우** — 벽돌 틈(8px)은 공 지름(14~24px)보다 좁아, 그 축으로는 어떤 위치로도 분리할 수 없다. 이때는 그 축을 아예 건드리지 않고 **직교 축으로, 진행 방향을 거스르는 쪽(온 길)** 으로 되돌린다. 가까운 면으로 밀어내면 아래에서 파고든 공이 위로 빠져나가 벽돌 줄을 통과해 버린다.

검증: `src/engine/Physics.ts` 를 Node 24 타입 스트리핑으로 직접 구동해 11개 발사각 × 60초 시뮬레이션에서 잔여 겹침 0 · 필드 이탈 0 · 속력 오차 < 1e-13 · 끼임 프레임 0, 그리고 틈새/모서리 적대적 케이스 9종 전부 통과를 확인했다.

## 턴 사이클 & 상태 머신 (Step 3)

```
        발사 입력                공 낙하                하강 애니메이션 종료
AIMING ──────────▶ PLAYING ──────────▶ TURN_RESOLVING ──────────────────▶ AIMING
  ▲                   │                      │
  │                   │ 필드 전부 비움        │ 벽돌이 데드라인 도달
  │                   ▼                      ▼
  └── REWARD ◀── (wave < 3)              GAME_OVER
            (wave = 3) ▼
                   VICTORY
```

- **AIMING** — 카드를 한 장 뽑아 그 종류의 공을 패들 중앙 바로 위에 고정 배치한다. `turn.canLaunch = true` 인 동안에만 발사 입력을 받는다.
- **PLAYING** — 공이 바닥을 **완전히**(`y - radius > canvasHeight`) 벗어나면 `onBallLost` 훅이 울리고 턴 정산으로 넘어간다.
- **TURN_RESOLVING** — 남은 벽돌 전부가 한 행(`height + gap` = 36px) 아래로 내려가고, 비워진 맨 윗줄에 새 행이 위에서 미끄러져 들어온다. 0.34초 ease-out 보간이며 이 동안 패들은 계속 움직일 수 있다. 완료 시 턴 카운터 +1.
- **GAME_OVER** — 하강 직후 벽돌 하단이 데드라인(패들 위 40px, y=536)에 닿으면 전환. 캔버스에 반투명 오버레이 + "GAME OVER" + 재시작 안내를 그리고 루프를 멈춘다. `onGameOver(turn, score)` 훅 호출.
- **VICTORY** — 목표 웨이브(`VICTORY_WAVE = 3`) 클리어. 스펙에 조건이 정의돼 있지 않아 임의로 정한 값이라 상수 하나로 조정 가능하다.

### 턴이 끝나지 않는 상황 방지

패들이 정중앙에 멈춰 있으면 `aimAngle = -π/2` 라 `vx ≈ 0` 이고, 공이 벽돌 바닥면에 축 정렬 반사된 뒤 패들 정중앙(`offset = 0`, 패들 속도 0 → 스핀 0)으로 돌아와 **수직 왕복만 영원히 반복**한다. 두 겹으로 막는다.

1. `Physics.ensureMinHorizontalSpeed` — 패들 반사 직후 속력을 유지한 채 최소 수평 성분(속력의 2%)을 보장해 대칭을 깬다. 2%만 주는 이유는 "똑바로 위로 쏘는" 감각을 남기기 위해서다. 한 번 중심에서 벗어나면 offset 반사가 알아서 각을 키운다.
2. `MAX_TURN_SECONDS = 45` 스톨 워치독 — 어떤 이유로든 턴이 안 끝나면 강제로 정산한다. 정상 왕복이 2초 안팎이라 통상 플레이에서는 닿지 않는 보험이다.

검증: 패들 고정·정중앙·수직 발사 조건에서 수정 전 120초/패들 54타 동안 미종료(`|vx| = 2.9e-14`), 수정 후 5.7초에 정상 낙하. 패들 x를 450/449/451/300/600/120/780로 바꾼 7케이스 모두 유한 시간 내 종료.

신규 행의 칸별 HP는 턴이 오를수록 단단해지고 빈 칸 확률이 줄어든다(`rollSpawnHp`). 빈 칸을 반드시 남기는 이유는, 8칸이 매 턴 꽉 차면 공 한 발로는 줄을 걷어낼 수 없어 게임이 성립하지 않기 때문이다.

초기 배치 기준 가장 아래 행의 하단이 264px, 데드라인이 536px, 행 간격이 36px이므로 **손대지 않으면 8턴 만에 패배**한다.

## 게임 규칙 (Step 1 기준)

- 벽돌 그리드: 5행 8열. 폭은 `필드폭 - 좌우여백 - 간격합` 을 열 수로 나눠 산출하고 나머지는 좌우로 나눠 중앙 정렬하므로, `DEFAULT_GRID` 의 `cols`/`gap`/`sideMargin` 만 바꾸면 자동으로 다시 맞춰진다.
- 행별 초기 HP: 위에서부터 `3, 2, 2, 1, 1`. 웨이브가 2씩 오를 때마다 HP 2 이상인 행에 +1.
- 벽돌 색은 **현재 HP** 로 정해져서 맞을 때마다 한 단계씩 내려가며(주황 → 분홍 → 보라 → 파랑), 하단 체력 바와 숫자로도 남은 HP를 표시한다.
- 시작 덱: 기본 구체 ×4, 중량 구체 ×1.
- 웨이브 시작 시 덱을 셔플해 드로우 더미를 만들고, **한 턴 = 카드 한 장 = 공 한 발**. 드로우 더미가 비면 덱을 다시 섞는다.
- 벽돌을 전부 파괴하면 보상 카드 3장 중 1장을 덱에 추가하고 다음 웨이브로. 남은 카드 수만큼 보너스 점수.
- 패배 조건은 **벽돌이 데드라인에 닿는 것** 하나다. Step 1~2에 있던 라이프는 Step 3에서 제거했다 — 덱 소진이 더 이상 실패 경로가 아니게 되면서 라이프를 잃을 수단이 사라졌기 때문이다.

### 공 종류

| 타입 | 반경 | 속력 | 데미지 | 특성 |
|---|---|---|---|---|
| normal | 8 | 480 | 1 | 기본 |
| heavy | 12 | 390 | 3 | 느리고 무겁다 |
| pierce | 7 | 540 | 1 | 벽돌을 관통(반사하지 않음) |
| split | 8 | 470 | 1 | 타입만 정의, **미구현** |

## 엔진 훅

`engine.setHooks({ ... })` 로 게임플레이 이벤트를 구독한다. 사운드·연출·메타 진행 등 엔진 밖 로직을 붙이는 자리다.

```ts
engine.setHooks({
  onTurnStart: (turn) => {},
  onBallLost: (turn) => {},
  onTurnEnd: (turn) => {},                    // 하강 정산 완료
  onBrickDestroyed: (brick) => {},            // brick 은 순수 데이터 스냅샷
  onWaveClear: (wave, remainingCards) => {},
  onGameOver: (turn, score) => {},            // React 모달 연동 지점
  onVictory: (turn, score) => {},
});
engine.setGridConfig({ rows: 6, cols: 10 }); // 다음 웨이브부터 적용
```

`src/App.tsx` 가 `onGameOver` / `onVictory` 를 실제로 구독해 HUD에 직전 판 기록을 남기는 예시다.

## 다음 단계 (Step 3 이후 후보)

- `split` 구체 구현 (멀티볼) 및 멀티볼 상태의 턴 종료 판정
- 카드 강화·제거 등 덱 조작 보상, 렐릭/유물
- 벽돌 특수 속성(폭발, 이동, 회복), 보스 웨이브
- 오디오, 리플레이/시드 고정, 세이브
