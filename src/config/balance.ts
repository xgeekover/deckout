/**
 * Deckout 밸런스 · 튜닝 파라미터의 단일 출처.
 *
 * 게임의 "느낌"과 난이도를 바꾸고 싶으면 이 파일만 고치면 된다.
 * 다른 모듈은 여기서 숫자를 읽기만 하고, 자기 안에 매직 넘버를 두지 않는다.
 *
 * 의존성이 전혀 없는 순수 모듈이다 (어느 계층에서든, Node 에서도 그대로 import 가능).
 */

export const BALANCE = {
  /** 메인 루프 */
  loop: {
    /** 물리 고정 타임스텝(초) */
    fixedStep: 1 / 120,
    /** 프레임당 누적 시간 상한 — 탭 복귀 시 death-spiral 방지 */
    maxFrameTime: 0.25,
  },

  /** 논리 해상도. 실제 캔버스 픽셀은 DPR/컨테이너 크기에 맞춰 스케일된다. */
  field: { width: 900, height: 640 },

  render: {
    /**
     * 캔버스 백버퍼에 적용할 devicePixelRatio 상한.
     * 백버퍼 픽셀 수는 DPR² 로 늘어난다 (DPR 3 이면 9배 — 1200px 폭 창에서 900만 픽셀을
     * 매 프레임 지우고 다시 칠한다). 글로우 위주의 그래픽이라 2 를 넘겨도 눈에 띄는 이득이 없다.
     */
    maxDevicePixelRatio: 2,
  },

  /** 입력 판별 */
  input: {
    /**
     * 터치/펜에서 "탭"으로 인정하는 한계. 손가락을 댔다 떼는 동안 이보다 많이 움직였거나 오래 눌렀으면
     * 패들을 옮기던 드래그(또는 그냥 쥐고 있던 것)로 보고 발사하지 않는다.
     */
    tapMaxMovePx: 12,
    tapMaxMs: 500,
  },

  paddle: {
    /** 유물 보정 전 기본 너비 */
    baseWidth: 130,
    height: 16,
    /** 필드 바닥에서 패들 윗면까지의 거리 */
    bottomOffset: 64,
    /** 키보드 이동 속도 (px/s) */
    keyboardSpeed: 780,
    /** 마우스 추종 감쇠 계수. 클수록 빠르게 붙는다 */
    pointerSmoothing: 24,
    /** 패들 끝에 맞았을 때의 최대 반사각 (수직 기준, 도) */
    maxBounceAngleDeg: 60,
    /** 패들 이동 속도가 반사에 실리는 비율 (스핀) */
    spinFactor: 0.12,
    /**
     * 충돌 판정 여유 범위(px, 좌우 각각). 패들 "윗면 모서리"를 아슬아슬하게 빗나간 공을 받아준다.
     * 옆면은 넓히지 않는다 — 넓히면 패들 옆을 지나가던 공이 허공에 튕긴다.
     * 반사각은 실제 패들 기준으로 계산하므로 판정만 너그러워지고 조작감은 그대로다.
     */
    hitForgiveness: 4,
    /** 발사 대기 중 조준선이 기우는 최대각(rad)과, 그 각에 도달하는 패들 속도(px/s) */
    aimTiltMaxRad: Math.PI / 5,
    aimTiltVelocity: 700,
  },

  ball: {
    /**
     * 볼 속력 상한 (px/s). 유물 배율이 몇 개가 겹쳐도 이 값을 넘지 않는다.
     * 서브스텝당 이동량(maxSpeed × fixedStep = 6px)이 가장 얇은 충돌체(패들 16px)의
     * 절반을 넘지 않아야 이산 충돌 판정이 공을 놓치지 않는다 — validateBalance() 가 검사한다.
     */
    maxSpeed: 720,
    /** 한 턴에 동시에 존재할 수 있는 공의 상한 (분열이 겹쳐도 폭주하지 않게) */
    maxBalls: 12,
    /** 속력 대비 최소 수직 성분 비율 — 좌우로만 튀는 교착 방지 */
    minVerticalRatio: 0.22,
    /** 속력 대비 최소 수평 성분 비율 — 패들 정중앙 수직 무한 랠리 방지 */
    minHorizontalRatio: 0.02,
    /** 같은 벽돌을 다시 때릴 수 있기까지의 쿨다운(초). 관통 구체의 다중 타격 방지 */
    brickHitCooldown: 0.12,
    /** 타입별 수치. 색 같은 시각 요소는 types/game.ts 의 BALL_STATS 가 덧붙인다. */
    stats: {
      normal: { radius: 8, speed: 480, damage: 1, pierce: false },
      heavy: { radius: 12, speed: 390, damage: 3, pierce: false },
      pierce: { radius: 7, speed: 540, damage: 1, pierce: true },
      bomb: { radius: 11, speed: 420, damage: 1, pierce: false, explosionRadius: 74, explosionDamage: 2 },
      /** 첫 벽돌에 맞는 순간 splitCount 개의 분신이 좌우 splitAngleDeg 간격으로 갈라져 나온다 */
      split: { radius: 8, speed: 470, damage: 1, pierce: false, splitCount: 2, splitAngleDeg: 28 },
    },
  },

  bricks: {
    grid: { rows: 5, cols: 8, gap: 8, sideMargin: 48, top: 92, height: 28 },
    /** 행별 기본 HP (0번이 최상단) */
    rowHp: [2, 2, 1, 1, 1],
    bomb: {
      radius: 96,
      damage: 2,
      /** 칸이 폭탄 벽돌이 될 확률 = min(base + perTurn × turn, max) */
      chanceBase: 0.05,
      chancePerTurn: 0.006,
      chanceMax: 0.14,
    },
  },

  /** 웨이브 스케일링 */
  waves: {
    /** 웨이브당 모든 벽돌에 더해지는 HP. 보너스 = floor((wave-1) × hpPerWave) */
    hpPerWave: 0.75,
    /**
     * 후반 웨이브일수록 초기 배치가 더 낮은 곳에서 시작한다: N 웨이브마다 한 줄씩, 최대 max 줄.
     * HP 만 올리면 웨이브가 "위험해지는" 게 아니라 "길어질" 뿐이다 (봇 계측: 한 판 20분 이상).
     * 시작 위치를 내리면 데드라인까지의 여유 턴이 줄어, 길이를 늘리지 않고 압박을 올릴 수 있다.
     */
    startRowDropEveryWaves: 3,
    startRowDropMax: 3,
    /** 추가 +1 HP("단단한 벽돌") 확률 = min(perWave × (wave-1), max) */
    toughChancePerWave: 0.12,
    toughChanceMax: 0.6,
    /** 이 웨이브를 클리어하면 VICTORY */
    victoryWave: 10,
  },

  /** 턴 정산 때 상단에 새로 들어오는 행 */
  spawnRow: {
    /**
     * 신규 행 난이도(0~1) = 웨이브 진행분 + 그 웨이브를 오래 끈 만큼의 가산.
     *  - 웨이브 진행분: 1웨이브 0 → (1 + rampWaves)웨이브에서 1
     *  - 끌기 가산: 한 웨이브에서 stallTurns 턴에 걸쳐 최대 stallBonus
     *
     * "게임 시작부터의 누적 턴"을 기준으로 삼으면 안 된다. 느린 플레이어일수록 턴이 쌓여
     * 줄이 더 단단해지고, 그래서 더 느려지는 악순환이 된다 (봇 계측: 보통 실력의 3웨이브가 16턴짜리 늪).
     */
    rampWaves: 9,
    stallTurns: 16,
    stallBonus: 0.25,
    /**
     * 웨이브별 증원 한도: 새 줄은 웨이브마다 (base + perWave × (wave-1)) 줄까지만 들어온다.
     * 한도를 다 쓴 뒤에도 남은 벽돌은 매 턴 계속 내려오므로 데드라인의 압박은 그대로다.
     *
     * 한도가 없으면 새 줄은 끝없는 수도꼭지가 된다. 깎는 속도가 들어오는 속도와 비슷한 플레이어에게는
     * 웨이브 길이에 상한이 없어져, 지지도 이기지도 않는 소모전이 수십 턴 이어진다.
     */
    reinforcements: { base: 5, perWave: 1 },
    /** 빈 칸 확률: start → end. 0이 되면 공 하나로 줄을 걷어낼 수 없으니 남겨 둔다 */
    emptyChanceStart: 0.45,
    emptyChanceEnd: 0.2,
    /** 상위 HP 칸 확률 = base + ramp × 난이도, HP = hp + floor(hpRamp × 난이도) */
    high: { chanceBase: 0.06, chanceRamp: 0.34, hp: 3, hpRamp: 2 },
    mid: { chanceBase: 0.24, chanceRamp: 0.0, hp: 2, hpRamp: 1.5 },
  },

  turn: {
    /** 데드라인(경고선)은 패들 윗면에서 이만큼 위 */
    deadlineOffset: 40,
    /** 벽돌 하강 슬라이드 시간(초) */
    slideDuration: 0.34,
    /** 한 턴의 최대 길이(초) — 스톨 워치독 */
    maxTurnSeconds: 45,
    /** GAME_OVER/VICTORY 후 루프를 멈추기까지의 연출 정산 시간(초) */
    terminalSettleSeconds: 0.7,
  },

  rewards: {
    choices: 3,
    /** 등급 등장 확률. 후보가 없는 등급은 빼고 나머지를 비율대로 다시 나눈다. */
    rarityChance: { COMMON: 0.7, RARE: 0.25, LEGENDARY: 0.05 },
  },

  relics: {
    widePaddleWidthMul: 1.2,
    flameTrailSpeedMul: 1.15,
    flameTrailDamageAdd: 1,
    safetyNetChargesPerWave: 1,
    scrapCycleCombo: 5,
  },

  score: {
    /** 벽돌 파괴 점수 = perBrickHp × maxHp */
    perBrickHp: 100,
    waveClear: 500,
    /** 웨이브 클리어 시 드로우 더미에 남은 카드 1장당 보너스 */
    perUnusedCard: 120,
  },

  /** 타격감 연출. 난이도에는 영향이 없다. */
  feel: {
    /** 화면 흔들림: [강도(px), 지속시간(ms)] */
    shake: {
      brickHit: [1.5, 70],
      brickDestroy: [2.6, 100],
      explosion: [9, 250],
      paddle: [4, 150],
      ballLost: [4, 150],
    },
    /** 히트스탑 길이(초) */
    hitStop: { brickDestroy: 0.032, explosion: 0.05 },
    /** 이 콤보부터 팝업을 띄운다 */
    comboPopupMin: 3,
    /** 폭탄 연쇄 폭발 횟수 상한 */
    maxChainBlasts: 24,
    /** 안전망 발동 후 번쩍이는 시간(초) */
    netFlashSeconds: 0.45,
    /** 볼 잔상 프레임 수 */
    trailLength: 8,
  },
} as const;

/* ------------------------------------------------------------------ */
/* 스케일링 공식                                                        */
/* ------------------------------------------------------------------ */

/** 웨이브에 따라 모든 벽돌에 더해지는 HP: floor((wave - 1) × hpPerWave) */
export function waveHpBonus(wave: number): number {
  return Math.floor(Math.max(0, wave - 1) * BALANCE.waves.hpPerWave);
}

/** 이 웨이브의 초기 배치를 몇 줄 아래에서 시작하는가 */
export function waveStartRowDrop(wave: number): number {
  const { startRowDropEveryWaves, startRowDropMax } = BALANCE.waves;
  return Math.min(Math.floor(Math.max(0, wave - 1) / startRowDropEveryWaves), startRowDropMax);
}

/** 웨이브에서 칸 하나가 "단단한 벽돌"(+1 HP)이 될 확률 */
export function toughBrickChance(wave: number): number {
  const { toughChancePerWave, toughChanceMax } = BALANCE.waves;
  return Math.min(toughChancePerWave * Math.max(0, wave - 1), toughChanceMax);
}

/** 칸 하나가 폭탄 벽돌이 될 확률 */
export function bombBrickChance(turn: number): number {
  const { chanceBase, chancePerTurn, chanceMax } = BALANCE.bricks.bomb;
  return Math.min(chanceBase + chancePerTurn * Math.max(0, turn), chanceMax);
}

/** 이 웨이브에 들어올 수 있는 새 줄의 총수 */
export function reinforcementBudget(wave: number): number {
  const { base, perWave } = BALANCE.spawnRow.reinforcements;
  return Math.max(0, Math.floor(base + perWave * Math.max(0, wave - 1)));
}

/** 신규 행 난이도 0~1. 웨이브 진행이 주도하고, 한 웨이브를 오래 끌면 조금 더 오른다. */
export function spawnDifficulty(wave: number, turnsInWave: number): number {
  const { rampWaves, stallTurns, stallBonus } = BALANCE.spawnRow;
  const progress = Math.max(0, wave - 1) / rampWaves;
  const stall = Math.min(Math.max(0, turnsInWave) / stallTurns, 1) * stallBonus;
  return Math.min(progress + stall, 1);
}

/**
 * 신규 행의 칸 HP 를 난수 r(0~1) 로 결정한다. 0 은 빈 칸.
 * 난이도와 난수를 인자로 받아 공식 자체를 결정적으로 검증할 수 있다.
 */
export function spawnCellHp(difficulty: number, r: number): number {
  const { emptyChanceStart, emptyChanceEnd, high, mid } = BALANCE.spawnRow;
  const t = Math.min(Math.max(difficulty, 0), 1);
  const empty = emptyChanceStart + (emptyChanceEnd - emptyChanceStart) * t;
  if (r < empty) return 0;
  const highEnd = empty + high.chanceBase + high.chanceRamp * t;
  if (r < highEnd) return high.hp + Math.floor(high.hpRamp * t);
  const midEnd = highEnd + mid.chanceBase + mid.chanceRamp * t;
  if (r < midEnd) return mid.hp + Math.floor(mid.hpRamp * t);
  return 1;
}

/** 난이도 d 에서 신규 행 한 칸의 기대 HP (밸런스 점검용) */
export function expectedSpawnCellHp(difficulty: number): number {
  const N = 2000;
  let sum = 0;
  for (let i = 0; i < N; i++) sum += spawnCellHp(difficulty, (i + 0.5) / N);
  return sum / N;
}

/** 볼 속력을 상한으로 자른다. */
export function clampBallSpeed(speed: number): number {
  return Math.min(speed, BALANCE.ball.maxSpeed);
}

/**
 * 파라미터끼리의 정합성 검사. 문제가 없으면 빈 배열.
 * 수치를 만지다가 터널링 같은 물리 버그를 다시 들이는 것을 막는 안전장치다.
 * 개발 빌드에서는 main.tsx 가 시작할 때 호출해 문제를 콘솔에 올린다.
 */
export function validateBalance(): string[] {
  const issues: string[] = [];
  const stepTravel = BALANCE.ball.maxSpeed * BALANCE.loop.fixedStep;
  const thinnest = Math.min(BALANCE.paddle.height, BALANCE.bricks.grid.height);
  if (stepTravel > thinnest / 2) {
    issues.push(
      `ball.maxSpeed 가 너무 크다: 서브스텝당 ${stepTravel.toFixed(2)}px 이동 > 가장 얇은 충돌체의 절반 ${thinnest / 2}px (터널링 위험)`,
    );
  }
  for (const [type, s] of Object.entries(BALANCE.ball.stats)) {
    if (s.speed > BALANCE.ball.maxSpeed) issues.push(`ball.stats.${type}.speed 가 maxSpeed 를 넘는다`);
  }
  const chance = BALANCE.rewards.rarityChance;
  const total = chance.COMMON + chance.RARE + chance.LEGENDARY;
  if (Math.abs(total - 1) > 1e-9) issues.push(`rewards.rarityChance 합이 1이 아니다: ${total}`);
  if (BALANCE.spawnRow.emptyChanceEnd <= 0) issues.push('spawnRow.emptyChanceEnd 는 0보다 커야 한다');
  const { top, height, gap, rows } = BALANCE.bricks.grid;
  // 가장 낮게 시작하는 웨이브(startRowDropMax) 기준으로 본다.
  const lowest = top + (rows + BALANCE.waves.startRowDropMax) * (height + gap) - gap;
  const deadline = BALANCE.field.height - BALANCE.paddle.bottomOffset - BALANCE.turn.deadlineOffset;
  if (lowest >= deadline) issues.push('초기 그리드가 이미 데드라인에 닿아 있다');
  return issues;
}
