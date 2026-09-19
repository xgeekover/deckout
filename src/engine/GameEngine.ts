/**
 * Deckout - Canvas 메인 루프.
 *
 * 설계 원칙
 *  - React 를 전혀 모른다. DOM 이벤트도 직접 듣지 않는다 (입력은 공개 메서드로 주입받는다).
 *  - 물리는 고정 타임스텝으로 서브스텝을 돌려 프레임레이트와 무관하게 동일하게 동작한다.
 *  - UI 로 나가는 것은 subscribe(listener) 로 방출되는 GameState 스냅샷뿐이며,
 *    값이 실제로 바뀐 프레임에만 방출한다 (60fps React 리렌더 방지).
 */

import {
  BALANCE,
  bombBrickChance,
  clampBallSpeed,
  reinforcementBudget,
  spawnCellHp,
  spawnDifficulty,
  waveStartRowDrop,
} from '../config/balance';
import { FloatingTextSystem } from './FloatingText';
import { ParticleSystem } from './ParticleSystem';
import { resolveModifiers } from './Relics';
import type { ResolvedModifiers } from './Relics';
import { rollRewards } from './Rewards';
import { ScreenShake } from './ScreenShake';
import { FULL, patternForWave, waveCellHp } from './WavePatterns';
import type { WavePattern } from './WavePatterns';
import {
  circleVsRect,
  clamp,
  ensureMinHorizontalSpeed,
  ensureMinVerticalSpeed,
  paddleReflect,
  resolveAABBBounce,
  resolveCircleVsRects,
  resolveWalls,
  rotate,
  withSpeed,
} from './Physics';
import type { Rect } from './Physics';
import { Ball } from './entities/Ball';
import { Brick } from './entities/Brick';
import { Paddle } from './entities/Paddle';
import {
  BALL_CARD_DATA,
  BALL_STATS,
  DEFAULT_GRID,
  GAME_HEIGHT,
  GAME_WIDTH,
  createInitialGameState,
  rowPitch,
} from '../types/game';
import type {
  Brick as BrickModel,
  BrickGridConfig,
  BrickType,
  BallData,
  DeckCard,
  GameState,
  Relic,
  RelicContext,
  RewardItem,
  RunSummary,
} from '../types/game';

// 수치는 전부 config/balance.ts 에 있다. 여기서는 자주 쓰는 것에 짧은 이름만 붙인다.
const FIXED_STEP = BALANCE.loop.fixedStep;
const MAX_FRAME_TIME = BALANCE.loop.maxFrameTime;

const FIELD: Rect = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT };
export const PADDLE_Y = GAME_HEIGHT - BALANCE.paddle.bottomOffset;
/** 데드라인(경고선). 벽돌 하단이 여기 닿으면 패배. */
export const DEADLINE_Y = PADDLE_Y - BALANCE.turn.deadlineOffset;

const BASE_PADDLE_WIDTH = BALANCE.paddle.baseWidth;
const SLIDE_DURATION = BALANCE.turn.slideDuration;
const MAX_TURN_SECONDS = BALANCE.turn.maxTurnSeconds;
const VICTORY_WAVE = BALANCE.waves.victoryWave;
/**
 * GAME_OVER / VICTORY 로 넘어간 뒤 루프를 실제로 멈추기까지의 여유.
 * 곧바로 stop() 하면 그 순간 걸려 있던 흔들림이 감쇠할 프레임을 못 얻어
 * 0이 아닌 오프셋으로 영구 고정된다. 파티클/셰이크가 마무리될 시간을 준다.
 */
const TERMINAL_SETTLE_SECONDS = BALANCE.turn.terminalSettleSeconds;

const SHAKE = BALANCE.feel.shake;
const HITSTOP = BALANCE.feel.hitStop;
const NET_FLASH_SECONDS = BALANCE.feel.netFlashSeconds;
const COMBO_POPUP_MIN = BALANCE.feel.comboPopupMin;
const MAX_CHAIN_BLASTS = BALANCE.feel.maxChainBlasts;

/** 엔진이 바깥으로 알리는 게임플레이 이벤트 훅. */
export interface EngineHooks {
  /** 새 턴이 시작되어 발사 대기에 들어갔을 때 */
  onTurnStart?: (turn: number) => void;
  /** 공을 발사했을 때 */
  onLaunch?: () => void;
  /** 공이 패들 윗면에 맞았을 때 */
  onPaddleHit?: () => void;
  /** 벽돌을 때렸지만 파괴하지는 못했을 때 */
  onBrickHit?: () => void;
  /** 벽돌 하나가 파괴될 때마다 */
  onBrickDestroyed?: (brick: BrickModel) => void;
  /** 폭발이 일어날 때마다 (연쇄면 여러 번) */
  onExplosion?: () => void;
  /** 분열 구체가 갈라졌을 때. count 는 새로 생긴 분신 수 */
  onBallSplit?: (count: number) => void;
  /** 공이 바닥을 완전히 벗어났을 때 */
  onBallLost?: (turn: number) => void;
  /** 턴 정산(벽돌 하강 + 신규 행 스폰)이 끝났을 때 */
  onTurnEnd?: (turn: number) => void;
  /**
   * 필드의 벽돌을 모두 비웠을 때. 추첨된 보상 선택지가 함께 전달된다
   * (마지막 웨이브라 보상 없이 VICTORY 로 가는 경우 빈 배열).
   */
  onWaveClear?: (rewards: RewardItem[], wave: number) => void;
  /** 보상을 골랐거나 스킵했을 때 */
  onRewardResolved?: (picked: RewardItem | null) => void;
  /** 벽돌이 데드라인에 도달해 패배했을 때 */
  onGameOver?: (summary: RunSummary) => void;
  /** 목표 웨이브까지 클리어했을 때 */
  onVictory?: (summary: RunSummary) => void;
}

interface Blast {
  x: number;
  y: number;
  radius: number;
  damage: number;
}

/**
 * patchState 용 비교. 배열/평면 객체는 한 단계 얕게 비교해,
 * 매번 새로 만들어지는 turn 같은 중첩 값이 불필요한 리렌더를 유발하지 않게 한다.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    return (
      ka.length === kb.length &&
      ka.every(
        (k) => (a as Record<string, unknown>)[k] === (b as Record<string, unknown>)[k],
      )
    );
  }
  return false;
}

let cardSeq = 0;
const makeCard = (ball: BallData, temporary = false): DeckCard => ({
  ...ball,
  id: `card-${ball.ballType}-${cardSeq++}`,
  ...(temporary ? { temporary: true } : {}),
});

const STARTING_DECK = (): DeckCard[] => [
  makeCard(BALL_CARD_DATA.normal),
  makeCard(BALL_CARD_DATA.normal),
  makeCard(BALL_CARD_DATA.normal),
  makeCard(BALL_CARD_DATA.normal),
  makeCard(BALL_CARD_DATA.heavy),
];

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type EngineListener = (state: GameState) => void;

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private rafId = 0;
  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private scale = 1;
  private dpr = 1;

  private paddle: Paddle;
  private balls: Ball[] = [];
  /** 이번 서브스텝에 태어난 분신. balls 를 순회하는 도중에 직접 넣지 않고 끝난 뒤에 합친다. */
  private pendingBalls: Ball[] = [];
  private bricks: Brick[] = [];
  /** this.bricks 와 인덱스가 1:1 인 충돌용 rect 캐시 (서브스텝마다 재생성하지 않기 위함) */
  private brickRects: Rect[] = [];
  private particles = new ParticleSystem();
  private floating = new FloatingTextSystem(GAME_WIDTH);
  private shake = new ScreenShake();
  /** 남은 히트스탑 시간(초). 0보다 크면 물리/파티클이 멈춘다. */
  private hitStop = 0;
  /** 0보다 크면 이 시간이 지난 뒤 루프를 멈춘다 (종료 연출 정산 창) */
  private stopDelay = 0;
  /** 일시정지 — 정보 패널을 열어 둔 동안 공이 혼자 돌아다니지 않게 한다 */
  private paused = false;
  /** 현재 턴 누적 연속 타격 수 */
  private combo = 0;
  /** 안전망 발동 직후 번쩍임 타이머(초) */
  private netFlash = 0;
  /** 이번 판에서 파괴한 벽돌 수 */
  private bricksDestroyed = 0;
  /** 현재 웨이브가 시작된 턴 — 신규 행 난이도의 "이 웨이브를 얼마나 끌었나" 계산용 */
  private waveStartTurn = 1;
  /** 이번 웨이브에 앞으로 더 들어올 수 있는 새 줄의 수 */
  private reinforcementsLeft = 0;
  /** 한 번의 충돌 처리에서 모은 점수/파괴 여부/연쇄 폭발 */
  private scoreBuffer = 0;
  private destroyedBuffer = false;
  private pendingBlasts: Blast[] = [];

  private hooks: EngineHooks = {};
  /** 턴 정산 중인 하강 애니메이션 진행 상태 */
  private slideElapsed = 0;
  /** 현재 턴에서 공이 필드에 있던 시간(초) — 스톨 워치독용 */
  private playElapsed = 0;
  private grid: BrickGridConfig = DEFAULT_GRID;
  private keyDir = 0;
  /** 발사 대기 중 조준 각도 (패들 이동 방향으로 기운다) */
  private aimAngle = -Math.PI / 2;
  private state: GameState = createInitialGameState();
  private listeners = new Set<EngineListener>();

  /** 영구 보유 덱. 웨이브가 시작될 때마다 이걸 섞어 드로우 더미를 만든다. */
  private deck: DeckCard[] = [];
  /** 아직 뽑지 않은 카드 */
  private drawPile: DeckCard[] = [];
  /** 이미 쓴 카드 + 웨이브 도중 생성된 임시 카드. 드로우 더미가 비면 섞여 들어간다. */
  private discardPile: DeckCard[] = [];
  /** 지금 필드에 나가 있는 공의 카드 */
  private cardInPlay: DeckCard | null = null;

  /** 보유 유물과 그 런타임 상태 */
  private relics: Relic[] = [];
  private relicCharges = new Map<string, number>();
  private modifiers: ResolvedModifiers = resolveModifiers([]);
  /** 유물 훅에 넘겨주는 엔진 조작 창구 */
  private relicCtx: RelicContext;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create a 2D canvas context.');
    this.canvas = canvas;
    this.ctx = ctx;
    this.paddle = new Paddle(GAME_WIDTH / 2, PADDLE_Y, BASE_PADDLE_WIDTH);
    this.relicCtx = this.createRelicContext();
    this.reset();
  }

  /* ---------------------------------------------------------------- */
  /* 외부 API (React 에서 호출)                                         */
  /* ---------------------------------------------------------------- */

  /**
   * 일시정지/재개. 멈춰 있는 동안에도 rAF 는 계속 돌지만 시간은 흐르지 않는다
   * (lastTime 을 계속 당겨 두므로 재개하는 순간 밀린 시간이 한꺼번에 들어오지 않는다).
   */
  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /** 현재 phase (입력 계층이 키 처리 여부를 판단할 때 쓴다) */
  get phase(): GameState['phase'] {
    return this.state.phase;
  }

  /** 웨이브 클리어 등 게임플레이 이벤트 훅을 등록한다. */
  setHooks(hooks: EngineHooks): void {
    this.hooks = hooks;
  }

  /** 벽돌 그리드 배치 파라미터를 바꾼다 (다음 웨이브부터 적용). */
  setGridConfig(config: Partial<BrickGridConfig>): void {
    const next = { ...this.grid, ...config };
    // 0행/0열이면 벽돌이 하나도 없는 웨이브가 되어 클리어 판정이 영영 오지 않는다.
    next.rows = Math.max(1, Math.floor(next.rows));
    next.cols = Math.max(1, Math.floor(next.cols));
    this.grid = next;
  }

  subscribe(listener: EngineListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    this.stopDelay = 0;
    // 멈춘 뒤 resize() 가 render() 를 부를 수 있으므로 흔들림을 확실히 0으로 되돌린다.
    this.shake.reset();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  destroy(): void {
    this.stop();
    this.listeners.clear();
  }

  /** CSS 픽셀 크기를 받아 백버퍼를 DPR 에 맞춰 재설정한다. */
  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.dpr = dpr;
    this.scale = cssWidth / GAME_WIDTH;
    this.canvas.width = Math.round(cssWidth * dpr);
    this.canvas.height = Math.round(cssHeight * dpr);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.render();
  }

  /** 논리 좌표계 기준 x. null 이면 마우스 추종 해제. */
  setPointer(logicalX: number | null): void {
    this.paddle.pointerTarget = logicalX;
  }

  /** -1(왼쪽) | 0 | 1(오른쪽) */
  setKeyDirection(dir: number): void {
    this.keyDir = dir;
  }

  /** 스페이스바 / 클릭 — 대기 중인 공을 발사한다. */
  launch(): void {
    if (this.state.phase !== 'AIMING' || !this.state.turn.canLaunch) return;
    const ball = this.balls.find((b) => !b.launched);
    if (!ball) return;

    ball.launch(this.aimAngle);
    this.playElapsed = 0;
    this.hooks.onLaunch?.();
    this.patchState({ phase: 'PLAYING', turn: { ...this.state.turn, canLaunch: false } });
  }

  /**
   * 보상 선택 → 볼이면 덱에, 유물이면 보유 목록에 넣고 다음 웨이브를 시작한다.
   * 유물의 패시브 효과는 이 시점에 즉시 반영된다.
   */
  chooseReward(itemId: string): void {
    if (this.state.phase !== 'REWARD') return;
    const picked = this.state.rewardChoices.find((c) => c.id === itemId);
    if (!picked) return; // 알 수 없는 id 로 웨이브만 넘어가 버리는 것을 막는다

    if (picked.type === 'BALL') {
      this.deck = [...this.deck, makeCard(picked.ball)];
    } else {
      this.addRelic(picked.relic);
    }
    this.hooks.onRewardResolved?.(picked);
    this.advanceWave();
  }

  /** 키보드 1·2·3 선택용. 범위를 벗어난 인덱스는 무시한다. */
  chooseRewardByIndex(index: number): void {
    if (this.state.phase !== 'REWARD') return;
    const item = this.state.rewardChoices[index];
    if (item) this.chooseReward(item.id);
  }

  /** 보상을 받지 않고 다음 웨이브로 넘어간다 (원치 않는 카드를 억지로 넣지 않도록). */
  skipReward(): void {
    if (this.state.phase !== 'REWARD') return;
    this.hooks.onRewardResolved?.(null);
    this.advanceWave();
  }

  /** 지금까지의 판 요약. 끝난 판이면 결과, 진행 중이면 중간 집계. */
  getRunSummary(): RunSummary {
    const phase = this.state.phase;
    return {
      outcome: phase === 'VICTORY' ? 'victory' : phase === 'GAME_OVER' ? 'defeat' : 'in-progress',
      wave: this.state.wave,
      turn: this.state.turn.currentTurn,
      score: this.state.score,
      bestCombo: this.state.bestCombo,
      bricksDestroyed: this.bricksDestroyed,
      deck: this.deck,
      relics: this.relics,
    };
  }

  /**
   * 개발용: 남은 벽돌을 정상 피해 경로로 모두 파괴해 웨이브 클리어 흐름을 재현한다.
   * 자동화 검증에서 "필드를 전부 비우는" 상황을 결정적으로 만들기 위한 것으로,
   * DEV 빌드의 window.__deckout 을 통해서만 닿는다.
   */
  debugClearBricks(): void {
    if (this.state.phase !== 'AIMING' && this.state.phase !== 'PLAYING') return;
    const comboBefore = this.combo;
    for (const brick of [...this.bricks]) {
      this.damageBrick(brick, brick.hp, brick.center.x, brick.center.y);
    }
    this.resolveBlasts();
    this.notifyComboGain(comboBefore);
    if (this.flushBrickChanges()) this.clearWave();
  }

  /** 게임오버/승리 후 재시작 (R 키) */
  restart(): void {
    this.reset();
    this.start();
  }

  /* ---------------------------------------------------------------- */
  /* 상태 관리                                                          */
  /* ---------------------------------------------------------------- */

  /**
   * 값이 실제로 바뀐 경우에만 새 스냅샷을 만들어 방출한다.
   * turn 같은 중첩 객체는 매번 새로 만들어지므로 한 단계 얕은 비교까지 해준다.
   */
  private patchState(patch: Partial<GameState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as Array<keyof GameState>) {
      if (!sameValue(this.state[key], patch[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.state);
  }

  private reset(): void {
    this.deck = STARTING_DECK();
    this.drawPile = [];
    this.discardPile = [];
    this.cardInPlay = null;
    this.pendingBalls = [];
    this.relics = [];
    this.relicCharges.clear();
    this.modifiers = resolveModifiers([]);
    this.paddle.width = BASE_PADDLE_WIDTH;
    this.balls = [];
    this.bricks = [];
    this.brickRects = [];
    this.state = { ...createInitialGameState(), deck: this.deck };
    this.aimAngle = -Math.PI / 2;
    this.slideElapsed = 0;
    this.playElapsed = 0;
    this.paddle.x = GAME_WIDTH / 2;
    this.paddle.pointerTarget = null;
    this.particles.clear();
    this.floating.clear();
    this.shake.reset();
    this.hitStop = 0;
    this.stopDelay = 0;
    this.paused = false;
    this.netFlash = 0;
    this.bricksDestroyed = 0;
    this.waveStartTurn = 1;
    this.combo = 0;
    this.pendingBlasts.length = 0;
    this.scoreBuffer = 0;
    this.destroyedBuffer = false;
    this.notify();
    this.startWave();
  }

  /* ---------------------------------------------------------------- */
  /* 웨이브 / 턴 흐름                                                    */
  /* ---------------------------------------------------------------- */

  private advanceWave(): void {
    this.patchState({ wave: this.state.wave + 1, rewardChoices: [] });
    this.startWave();
  }

  private startWave(): void {
    const wave = this.state.wave;
    this.waveStartTurn = this.state.turn.currentTurn;
    this.reinforcementsLeft = reinforcementBudget(wave);
    let pattern = patternForWave(wave);
    this.buildBricks(wave, pattern);
    // 아주 작은 그리드(예: 2x2)에서는 다이아몬드 같은 패턴이 한 칸도 못 채울 수 있다.
    // 벽돌 0개로 시작한 웨이브는 "마지막 벽돌 파괴" 순간이 오지 않아 영원히 끝나지 않으므로
    // 기본 진형으로 되돌린다.
    if (this.bricks.length === 0) {
      pattern = FULL;
      this.buildBricks(wave, pattern);
    }

    // 덱 순환은 웨이브 단위: 영구 덱을 섞어 새 드로우 더미를 만들고, 버린 더미와
    // 웨이브 도중 생성된 임시 카드는 여기서 사라진다.
    this.drawPile = shuffled(this.deck);
    this.discardPile = [];
    this.cardInPlay = null;

    // 안전망 같은 웨이브당 1회성 효과를 다시 충전한다.
    this.rechargeRelics();

    this.patchState({
      wavePattern: pattern.name,
      wavePatternId: pattern.id,
      reinforcementsLeft: this.reinforcementsLeft,
      bricksRemaining: this.bricks.length,
      deck: this.deck,
      discardPileCount: 0,
    });
    this.beginTurn();
  }

  /**
   * 웨이브의 패턴과 HP 스케일에 맞춰 상단에 벽돌을 배치한다.
   * 칸의 유무는 WavePatterns, 폭/여백 계산은 spawnRow 가 맡는다.
   */
  private buildBricks(wave: number, pattern: WavePattern): void {
    const { rows, cols } = this.grid;
    const drop = waveStartRowDrop(wave); // 후반 웨이브는 더 낮은 곳에서 시작한다 (데드라인까지의 여유 턴 감소)
    this.bricks = [];

    for (let row = 0; row < rows; row++) {
      const y = this.grid.top + (row + drop) * rowPitch(this.grid);
      const cells = this.spawnRow(y, (col) => {
        if (!pattern.has(row, col, rows, cols)) return { hp: 0 };
        const hp = waveCellHp(wave, row) + (pattern.hpBonus?.(row, col, rows, cols) ?? 0);
        // 신규 행(beginTurnResolution)과 같은 기준으로 굴린다. 예전에는 0 으로 고정되어 있어서
        // 몇 턴째든 웨이브 시작 배치의 폭탄 확률이 항상 최저(5%)였다.
        return this.rollCell(hp, this.state.turn.currentTurn);
      });
      for (const brick of cells) this.bricks.push(brick);
    }
    this.syncBrickRects();
  }

  /**
   * y 위치에 한 행을 만든다. 폭/여백은 그리드 설정에서 매번 다시 계산하므로
   * cols 나 sideMargin 을 바꿔도 정확히 중앙 정렬된다.
   */
  private spawnRow(
    y: number,
    cellFor: (col: number) => { hp: number; type?: BrickType },
  ): Brick[] {
    const { cols, gap, sideMargin, height } = this.grid;
    const usableWidth = FIELD.w - sideMargin * 2;
    const brickWidth = (usableWidth - gap * (cols - 1)) / cols;
    const gridWidth = brickWidth * cols + gap * (cols - 1);
    const originX = FIELD.x + (FIELD.w - gridWidth) / 2;

    const row: Brick[] = [];
    for (let col = 0; col < cols; col++) {
      const { hp, type } = cellFor(col);
      if (hp <= 0) continue; // 빈 칸
      row.push(new Brick(originX + col * (brickWidth + gap), y, brickWidth, height, hp, type));
    }
    return row;
  }

  /**
   * HP 가 정해진 칸을 폭탄 벽돌로 승격할지 추첨한다.
   * 확률 공식은 config/balance.ts 의 bombBrickChance.
   */
  private rollCell(hp: number, turn: number): { hp: number; type?: BrickType } {
    if (hp <= 0) return { hp: 0 };
    return Math.random() < bombBrickChance(turn) ? { hp: 1, type: 'bomb' } : { hp };
  }

  private syncBrickRects(): void {
    this.brickRects = this.bricks.map((b) => b.rect);
  }

  /**
   * 드로우 더미에서 한 장 뽑는다. 비어 있으면 버린 더미를 섞어 새 드로우 더미로 만든다
   * (덱빌딩 게임의 표준 순환). 웨이브 도중 생성된 임시 카드도 이때 섞여 들어온다.
   */
  private takeCard(): DeckCard | null {
    if (this.drawPile.length === 0) {
      this.drawPile = shuffled(this.discardPile);
      this.discardPile = [];
    }
    // 두 더미가 모두 비는 것은 덱이 0장일 때뿐이다. 영구 덱으로 복구를 시도한다.
    if (this.drawPile.length === 0) this.drawPile = shuffled(this.deck);
    return this.drawPile.pop() ?? null;
  }

  /** 필드에 나가 있던 카드를 버린 더미로 보낸다. */
  private discardCardInPlay(): void {
    if (!this.cardInPlay) return;
    this.discardPile.push(this.cardInPlay);
    this.cardInPlay = null;
  }

  /** 카드를 뽑아 공을 패들 위에 올리고 발사 대기(AIMING)로 들어간다. */
  private beginTurn(): void {
    const card = this.takeCard();
    if (!card) {
      // 덱이 비어 있으면 진행이 불가능하다. 정상 경로에서는 도달하지 않는다.
      this.triggerGameOver();
      return;
    }

    this.cardInPlay = card;
    const ball = new Ball(this.paddle.x, this.paddle.y, card.ballType);
    // 유물의 상시 보정치는 공이 만들어질 때 반영된다.
    // 배율이 몇 개가 겹쳐도 상한을 넘지 않는다 (서브스텝당 이동량이 커지면 터널링이 생긴다).
    ball.baseSpeed = clampBallSpeed(ball.baseSpeed * this.modifiers.ballSpeedMul);
    ball.damage += this.modifiers.ballDamageAdd;
    ball.attachTo(this.paddle.x, this.paddle.y);
    this.balls = [ball];
    this.aimAngle = -Math.PI / 2;
    // 콤보는 패들 반사로는 끊기지 않고, 공을 잃어 턴이 끝날 때만 초기화된다.
    this.combo = 0;

    this.patchState({
      phase: 'AIMING',
      currentCard: card,
      combo: 0, // 웨이브 클리어로 턴이 끝난 경로에서도 확실히 초기화된다
      drawPileCount: this.drawPile.length,
      discardPileCount: this.discardPile.length,
      turn: { ...this.state.turn, canLaunch: true },
      turnsUntilDeadline: this.computeTurnsUntilDeadline(),
    });
    this.hooks.onTurnStart?.(this.state.turn.currentTurn);
  }

  /** 공이 바닥을 완전히 벗어났을 때 호출된다. */
  private onBallLost(): void {
    this.discardCardInPlay();
    this.forEachRelic((relic) => relic.onTurnEnd?.(this.relicCtx));
    this.patchState({ combo: 0, discardPileCount: this.discardPile.length });
    this.hooks.onBallLost?.(this.state.turn.currentTurn);
    this.beginTurnResolution();
  }

  /**
   * 턴 정산 시작: 남은 벽돌을 한 행 아래로 내리고, 비워진 맨 윗줄에 새 행을 스폰한다.
   * 실제 이동은 step() 에서 SLIDE_DURATION 동안 보간된다.
   */
  private beginTurnResolution(): void {
    this.balls = [];
    this.patchState({ phase: 'TURN_RESOLVING', currentCard: null });

    const pitch = rowPitch(this.grid);
    for (const brick of this.bricks) brick.beginSlide(pitch);

    // 신규 행은 그리드 상단보다 한 칸 위에서 시작해 함께 미끄러져 들어온다.
    const turn = this.state.turn.currentTurn;
    // 증원 한도가 남아 있을 때만 새 줄이 들어온다. 다 쓴 뒤에도 위의 하강은 계속된다.
    if (this.reinforcementsLeft > 0) {
      this.reinforcementsLeft -= 1;
      const difficulty = spawnDifficulty(this.state.wave, turn - this.waveStartTurn);
      const incoming = this.spawnRow(this.grid.top - pitch, () =>
        this.rollCell(spawnCellHp(difficulty, Math.random()), turn),
      );
      for (const brick of incoming) {
        brick.beginSlide(pitch);
        this.bricks.push(brick);
      }
    }

    this.slideElapsed = 0;
  }

  /** TURN_RESOLVING 동안 매 스텝 호출되어 하강 애니메이션을 진행한다. */
  private advanceTurnResolution(dt: number): void {
    this.slideElapsed += dt;
    const t = clamp(this.slideElapsed / SLIDE_DURATION, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    for (const brick of this.bricks) brick.applySlide(eased);

    if (t < 1) return;

    this.syncBrickRects();
    this.finishTurnResolution();
  }

  private finishTurnResolution(): void {
    // 방금 끝난 턴 번호로 알린다 (onTurnStart(N) ↔ onTurnEnd(N) 대칭).
    const endedTurn = this.state.turn.currentTurn;
    this.patchState({
      bricksRemaining: this.bricks.length,
      reinforcementsLeft: this.reinforcementsLeft,
      turnsUntilDeadline: this.computeTurnsUntilDeadline(),
    });
    this.hooks.onTurnEnd?.(endedTurn);

    // 패배도 "버텨낸 턴 수"로 보고해야 하므로 카운터를 올리기 전에 판정한다.
    if (this.isDeadlineBreached()) {
      this.triggerGameOver();
      return;
    }

    this.patchState({ turn: { currentTurn: endedTurn + 1, canLaunch: false } });
    this.beginTurn();
  }

  /** 벽돌 하단이 데드라인(=패들 위 40px)에 닿았는가. */
  private isDeadlineBreached(): boolean {
    return this.bricks.some((b) => b.bottom >= DEADLINE_Y);
  }

  /** 가장 아래 벽돌이 데드라인에 닿기까지 남은 턴 수. 벽돌이 없으면 -1. */
  private computeTurnsUntilDeadline(): number {
    if (this.bricks.length === 0) return -1;
    const pitch = rowPitch(this.grid);
    let lowest = -Infinity;
    for (const b of this.bricks) lowest = Math.max(lowest, b.settledY + b.height);
    return Math.max(0, Math.ceil((DEADLINE_Y - lowest) / pitch));
  }

  private triggerGameOver(): void {
    this.balls = [];
    this.shake.shake(...SHAKE.explosion);
    this.patchState({
      phase: 'GAME_OVER',
      currentCard: null,
      turn: { ...this.state.turn, canLaunch: false },
    });
    // 곧바로 멈추지 않고 정산 창을 둔다 (TERMINAL_SETTLE_SECONDS 주석 참고).
    this.stopDelay = TERMINAL_SETTLE_SECONDS;
    this.hooks.onGameOver?.(this.getRunSummary());
  }

  /**
   * 필드의 활성 벽돌을 모두 비웠을 때.
   * 물리를 멈추고(REWARD 에서는 step 이 아무것도 하지 않는다) 공을 패들 중앙에 고정한 뒤,
   * 보상 3장을 추첨해 상태와 onWaveClear 훅으로 내보낸다.
   */
  private clearWave(): void {
    // 분열로 공이 여럿이어도 하나만 남겨 패들에 고정하고 나머지(방금 태어난 분신 포함)는 치운다.
    const ball = this.balls[0];
    if (ball) {
      ball.attachTo(this.paddle.x, this.paddle.y);
      this.balls = [ball];
    }
    this.pendingBalls = [];
    this.discardCardInPlay();
    this.forEachRelic((relic) => relic.onTurnEnd?.(this.relicCtx));

    const wave = this.state.wave;
    // 카드를 아낄수록 보너스
    const bonus = BALANCE.score.waveClear + this.drawPile.length * BALANCE.score.perUnusedCard;

    if (wave >= VICTORY_WAVE) {
      this.patchState({
        phase: 'VICTORY',
        currentCard: null,
        score: this.state.score + bonus,
        bricksRemaining: 0,
        turnsUntilDeadline: -1,
        discardPileCount: this.discardPile.length,
        turn: { ...this.state.turn, canLaunch: false },
      });
      this.stopDelay = TERMINAL_SETTLE_SECONDS;
      this.hooks.onWaveClear?.([], wave);
      this.hooks.onVictory?.(this.getRunSummary());
      return;
    }

    const rewards = rollRewards(new Set(this.relics.map((r) => r.id)), wave);
    this.patchState({
      phase: 'REWARD',
      currentCard: null,
      rewardChoices: rewards,
      score: this.state.score + bonus,
      bricksRemaining: 0,
      turnsUntilDeadline: -1,
      discardPileCount: this.discardPile.length,
      turn: { ...this.state.turn, canLaunch: false },
    });
    this.hooks.onWaveClear?.(rewards, wave);
  }

  /* ---------------------------------------------------------------- */
  /* 유물                                                               */
  /* ---------------------------------------------------------------- */

  private createRelicContext(): RelicContext {
    // 화살표 함수로 this 를 고정하고, 값은 getter 로 매번 최신 상태를 읽게 한다.
    // eslint 없이도 의도가 보이도록 self 별칭 대신 클로저를 쓴다.
    const getState = () => this.state;
    const getCombo = () => this.combo;
    return {
      get wave() {
        return getState().wave;
      },
      get turn() {
        return getState().turn.currentTurn;
      },
      get combo() {
        return getCombo();
      },
      consumeCharge: (relicId) => {
        const left = this.relicCharges.get(relicId) ?? 0;
        if (left <= 0) return false;
        this.relicCharges.set(relicId, left - 1);
        this.syncRelicState();
        return true;
      },
      addCardToDiscard: (ball, temporary = false) => {
        this.discardPile.push(makeCard(ball, temporary));
        this.patchState({ discardPileCount: this.discardPile.length });
      },
      announce: (text) => {
        this.floating.spawnNotice(this.paddle.x, this.paddle.y - 56, text);
      },
    };
  }

  private forEachRelic(fn: (relic: Relic) => void): void {
    for (const relic of this.relics) fn(relic);
  }

  /** 유물을 보유 목록에 넣고 패시브 효과를 즉시 반영한다. 중복 획득은 무시. */
  private addRelic(relic: Relic): void {
    if (this.relics.some((r) => r.id === relic.id)) return;
    this.relics = [...this.relics, relic];
    if (relic.chargesPerWave) this.relicCharges.set(relic.id, relic.chargesPerWave);
    this.applyModifiers();
    this.syncRelicState();
  }

  /** 상시 보정치를 다시 계산해 패들 등에 반영한다. 볼 보정은 다음 공 생성 시 적용된다. */
  private applyModifiers(): void {
    this.modifiers = resolveModifiers(this.relics);
    this.paddle.width = BASE_PADDLE_WIDTH * this.modifiers.paddleWidthMul;
    // 넓어진 패들이 벽 밖으로 삐져나가지 않게 위치를 다시 가둔다.
    const half = this.paddle.width / 2;
    this.paddle.x = clamp(this.paddle.x, FIELD.x + half, FIELD.x + FIELD.w - half);
  }

  /** 웨이브당 1회성 효과를 다시 채운다. */
  private rechargeRelics(): void {
    for (const relic of this.relics) {
      if (relic.chargesPerWave) this.relicCharges.set(relic.id, relic.chargesPerWave);
    }
    this.syncRelicState();
  }

  private syncRelicState(): void {
    this.patchState({
      relics: this.relics,
      relicCharges: Object.fromEntries(this.relicCharges),
    });
  }

  /** 바닥에 닿은 공을 살려낼 유물이 있는가 (렌더에서 안전망을 그릴지 판단) */
  private hasFallGuard(): boolean {
    return this.relics.some(
      (r) => r.onBallFall && (!r.chargesPerWave || (this.relicCharges.get(r.id) ?? 0) > 0),
    );
  }

  /** 바닥에 닿은 공을 유물로 구해낸다. 구했으면 true. */
  private tryRescueBall(ball: Ball): boolean {
    const rescued = this.relics.some((relic) => relic.onBallFall?.(this.relicCtx) === true);
    if (!rescued) return false;

    // 되튕긴 공은 올라가는 길에 패들을 "통과"한다 (collidePaddle 은 상승 중인 공을 무시).
    // 의도된 동작이다 — 패들 아랫면에 막히면 공이 다시 바닥으로 떨어져, 패들이 공 위에
    // 있을 때마다 안전망이 무용지물이 된다. 패들을 아래에서만 뚫리는 단방향 발판으로 본다.
    ball.y = FIELD.y + FIELD.h - ball.radius - 1;
    ball.setVelocity(
      ensureMinVerticalSpeed(withSpeed({ x: ball.vx, y: -Math.abs(ball.vy) }, ball.baseSpeed)),
    );
    ball.fallChecked = false; // 다음 낙하 때 다시 물어볼 수 있게
    // 구조한 공에게 온전한 시간을 새로 준다. 안 그러면 45초 워치독 직전에 구조된 공이
    // 충전과 연출만 쓰고 0.1초도 안 돼 강제 종료된다 (구조 → 77~90ms 뒤 소멸을 실측으로 확인).
    this.playElapsed = 0;
    this.netFlash = NET_FLASH_SECONDS;
    this.particles.emit(ball.x, FIELD.y + FIELD.h - 2, 26, '#7ef0ff', {
      speed: 300,
      spread: Math.PI,
      direction: -Math.PI / 2,
      life: 0.5,
      gravity: 120,
      drag: 2,
    });
    this.shake.shake(...SHAKE.paddle);
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* 루프                                                               */
  /* ---------------------------------------------------------------- */

  private frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    let delta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    if (delta > MAX_FRAME_TIME) delta = MAX_FRAME_TIME; // 탭 복귀 시 death-spiral 방지

    if (this.paused) return; // lastTime 은 위에서 이미 갱신됐다 — 멈춘 동안의 시간은 버려진다

    // 종료 연출 정산 창이 끝나면 루프를 멈춘다. 이번 프레임은 끝까지 그린다.
    if (this.stopDelay > 0) {
      this.stopDelay -= delta;
      if (this.stopDelay <= 0) this.stop();
    }

    // ── 히트스탑: 물리·파티클을 멈춘 채 셰이크만 돌려 타격을 "묵직하게" 만든다.
    // accumulator 를 건드리지 않고 빠져나가므로, 멈춘 시간만큼 물리 시간이 흐르지 않는다
    // (= time-scale 0). 누적해 뒀다가 몰아서 돌면 오히려 순간 가속이 되어버린다.
    if (this.hitStop > 0) {
      this.hitStop -= delta;
      this.shake.update(delta);
      this.render();
      return;
    }

    // 보상 화면에서는 모달이 캔버스를 덮고 물리도 멈춰 있다. 클리어 순간의 파티클·텍스트·흔들림이
    // 가라앉은 뒤에는 장면이 더 달라지지 않으므로, 갱신과 렌더를 통째로 건너뛴다.
    // (건너뛰지 않으면 보이지도 않는 캔버스를 초당 60번 다시 칠해 코어 하나의 ~11% 를 쓴다.)
    if (this.state.phase === 'REWARD' && this.isSceneSettled()) return;

    this.accumulator += delta;
    while (this.accumulator >= FIXED_STEP) {
      this.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;

      // 서브스텝 도중 강한 타격이 나오면 이번 프레임의 남은 서브스텝도 즉시 멈춘다.
      // 남은 누적 시간은 버린다 — 모아 뒀다가 몰아 돌리면 정지 직후 순간 가속이 된다.
      if (this.hitStop > 0) {
        this.accumulator = 0;
        break;
      }
    }

    this.particles.update(delta);
    this.floating.update(delta);
    this.shake.update(delta);
    for (const brick of this.bricks) brick.update(delta);
    for (const ball of this.balls) {
      ball.recordHistory();
      // 화염 도선: 날아가는 공 뒤로 불씨를 흘린다.
      if (this.modifiers.emberTrail && ball.launched) {
        this.particles.emit(ball.x, ball.y, 1, '#ff8a3d', {
          speed: 46,
          life: 0.38,
          size: 2.2,
          gravity: -70,
          drag: 2.4,
        });
      }
    }
    if (this.netFlash > 0) this.netFlash = Math.max(0, this.netFlash - delta);

    this.render();
  };

  /** 움직이는 연출이 하나도 남지 않았는가 */
  private isSceneSettled(): boolean {
    return (
      this.particles.count === 0 &&
      this.floating.count === 0 &&
      !this.shake.active &&
      this.hitStop <= 0 &&
      this.netFlash <= 0
    );
  }

  private step(dt: number): void {
    const phase = this.state.phase;

    // 턴 정산 중에는 벽돌 하강만 진행한다 (패들은 계속 움직일 수 있게 둔다).
    if (phase === 'TURN_RESOLVING') {
      this.paddle.update(dt, this.keyDir, FIELD);
      this.advanceTurnResolution(dt);
      return;
    }

    if (phase !== 'AIMING' && phase !== 'PLAYING') return;

    this.paddle.update(dt, this.keyDir, FIELD);

    for (const ball of this.balls) {
      if (!ball.launched) {
        // 발사 전에는 패들 중앙 바로 위에 고정되어 함께 움직인다.
        ball.x = this.paddle.x;
        ball.y = this.paddle.y - ball.radius - 2;
        // 패들을 움직이는 방향으로 조준선이 기운다 (최대 ±36도).
        const target =
          -Math.PI / 2 +
          clamp(this.paddle.velocity / BALANCE.paddle.aimTiltVelocity, -1, 1) *
            BALANCE.paddle.aimTiltMaxRad;
        const t = 1 - Math.exp(-12 * dt);
        this.aimAngle += (target - this.aimAngle) * t;
        continue;
      }

      ball.step(dt);
      this.collideWalls(ball);
      this.collidePaddle(ball);
      this.collideBricks(ball);

      // 이 공이 마지막 벽돌을 깼다면 clearWave() 가 this.balls 를 갈아 끼웠다. 지금 돌고 있는 것은
      // 옛 배열이므로, 남은 공들을 더 굴리면 끝난 웨이브에서 소리와 파티클만 낸다.
      if (this.state.phase !== 'PLAYING') break;

      // 바닥에 닿는 순간 유물에게 한 번 기회를 준다 (비상 안전망).
      if (ball.vy > 0 && !ball.fallChecked && ball.y + ball.radius >= FIELD.y + FIELD.h) {
        ball.fallChecked = true;
        if (this.tryRescueBall(ball)) continue;
      }

      // 공이 바닥을 "완전히" 벗어나면 낙하 처리.
      if (ball.isBelow(FIELD.y + FIELD.h)) {
        ball.alive = false;
        this.particles.ballLost(ball.x, GAME_HEIGHT - 4);
        this.shake.shake(...SHAKE.ballLost);
      }
    }

    // 이번 서브스텝에 갈라져 나온 분신을 합류시킨다 (순회가 끝난 뒤에).
    if (this.pendingBalls.length > 0) {
      if (this.state.phase === 'PLAYING') this.balls.push(...this.pendingBalls);
      this.pendingBalls = [];
    }

    // 스톨 워치독: 어떤 이유로든 턴이 끝나지 않으면 강제로 정산한다.
    // 진입 때 잡아 둔 phase 가 아니라 최신 값을 본다 — 이번 스텝에서 웨이브가 클리어됐다면
    // 보상 화면에 고정해 둔 공을 워치독이 죽여 버릴 수 있다.
    if (this.state.phase === 'PLAYING') {
      this.playElapsed += dt;
      if (this.playElapsed > MAX_TURN_SECONDS) {
        for (const ball of this.balls) ball.alive = false;
      }
    }

    const before = this.balls.length;
    this.balls = this.balls.filter((b) => b.alive);
    // clearWave 등으로 이미 phase 가 바뀌었을 수 있으므로 PLAYING 을 다시 확인한다.
    if (before > 0 && this.balls.length === 0 && this.state.phase === 'PLAYING') {
      this.onBallLost();
    }
  }

  private collideWalls(ball: Ball): void {
    const { position, velocity, hits } = resolveWalls(ball.circle, ball.velocity, FIELD);
    ball.x = position.x;
    ball.y = position.y;
    if (hits.length === 0) return;

    ball.setVelocity(ensureMinVerticalSpeed(withSpeed(velocity, ball.baseSpeed)));
    this.particles.sparks(ball.x, ball.y, BALL_STATS[ball.type].color);
  }

  private collidePaddle(ball: Ball): void {
    if (ball.vy <= 0) return; // 올라가는 중이면 무시 (패들 내부 끼임 방지)
    const rect = this.paddle.rect;
    const hit = resolveAABBBounce(ball.circle, ball.velocity, rect) ?? this.forgivePaddleMiss(ball, rect);
    if (!hit) return;

    // 패들 옆면에 맞은 공은 패들 바깥쪽으로 스냅되는데, 패들이 벽에 붙어 있으면 그 자리가 벽 너머다
    // (패들 왼쪽 끝 5px − 반지름 8px = −3px). 그대로 두면 다음 스텝에 벽이 안으로, 패들이 다시 밖으로
    // 밀면서 공이 필드 밖을 드나든다. 벽 안쪽으로 가둔다.
    ball.x = clamp(hit.position.x, FIELD.x + ball.radius, FIELD.x + FIELD.w - ball.radius);
    ball.y = hit.position.y;

    if (hit.face === 'top') {
      // 윗면은 물리 법선 대신 "맞은 위치"로 각도를 만든다 (클래식 브레이크아웃 감각).
      const reflected = paddleReflect(ball.x, rect, ball.baseSpeed);
      // 패들을 움직이며 맞히면 약간의 스핀이 실린다.
      reflected.x += this.paddle.velocity * BALANCE.paddle.spinFactor;
      this.hooks.onPaddleHit?.();
      this.forEachRelic((relic) => relic.onPaddleHit?.(this.relicCtx));
      // 최소 수평 성분을 보장해 "패들 정중앙 ↔ 벽돌" 수직 무한 랠리를 방지한다.
      ball.setVelocity(
        ensureMinVerticalSpeed(
          ensureMinHorizontalSpeed(withSpeed(reflected, ball.baseSpeed)),
        ),
      );
    } else {
      // 옆면/아랫면을 맞았을 때 각도 반사를 쓰면 패들을 뚫고 올라간다. 축 반전을 그대로 쓴다.
      ball.setVelocity(withSpeed(hit.velocity, ball.baseSpeed));
    }

    this.particles.emit(ball.x, rect.y, 12, '#8be9ff', {
      speed: 230,
      spread: Math.PI,
      direction: -Math.PI / 2,
      life: 0.34,
      gravity: 300,
      drag: 2.2,
    });
    this.shake.shake(...SHAKE.paddle);
  }

  /**
   * 패들 판정 여유: 윗면 모서리를 아슬아슬하게 빗나간 공만 받아준다.
   *
   * 패들 전체를 좌우로 넓혀서 판정하면 안 된다. 그러면 옆면까지 넓어져서, 패들 옆을
   * 그냥 지나가던 공(화면상 닿지도 않은)이 허공에 부딪혀 튕기는 "유령 패들"이 생긴다.
   * 그래서 (1) 실제 패들에 안 맞았을 때만, (2) 공 중심이 패들 윗면보다 위에 있고,
   * (3) 넓힌 판정에서도 "윗면" 충돌로 나올 때만 인정한다. 옆면/아랫면은 절대 넓히지 않는다.
   */
  private forgivePaddleMiss(ball: Ball, rect: Rect): ReturnType<typeof resolveAABBBounce> {
    const margin = BALANCE.paddle.hitForgiveness;
    if (margin <= 0 || ball.y >= rect.y) return null;

    const widened = { x: rect.x - margin, y: rect.y, w: rect.w + margin * 2, h: rect.h };
    const hit = resolveAABBBounce(ball.circle, ball.velocity, widened);
    return hit && hit.face === 'top' ? hit : null;
  }

  /**
   * 공 - 벽돌 충돌.
   *
   * 겹친 벽돌을 전부 Physics 로 넘겨 한 번에 해소한다. 가장 깊은 하나만 처리하면
   * 두 벽돌 사이에 걸친 공이 매 스텝 번갈아 밀려나며 진동하거나,
   * 반사되지 않은 채 틈을 그대로 통과해 버린다.
   */
  private collideBricks(ball: Ball): void {
    const resolved = resolveCircleVsRects(ball.circle, ball.velocity, this.brickRects);
    if (!resolved) return;

    const stats = BALL_STATS[ball.type];
    const comboBefore = this.combo;
    const anchor = resolved.contacts[0].result.collision.contact;
    let directHit = false;

    for (const { index, result } of resolved.contacts) {
      const brick = this.bricks[index];
      if (!brick || brick.isDestroyed) continue;
      // 벽돌별 쿨다운: 관통 구체가 같은 벽돌을 매 서브스텝 때리는 것을 막는다.
      if (!ball.canHit(brick.id)) continue;

      ball.markHit(brick.id);
      directHit = true;
      const destroyed = this.damageBrick(
        brick,
        ball.damage,
        result.collision.contact.x,
        result.collision.contact.y,
      );

      // 폭탄 구체는 벽돌을 부술 때마다 타격 지점에서 터진다.
      if (destroyed && stats.explosionRadius) {
        this.pendingBlasts.push({
          x: result.collision.contact.x,
          y: result.collision.contact.y,
          radius: stats.explosionRadius,
          damage: stats.explosionDamage ?? 1,
        });
      }
    }

    this.resolveBlasts();
    this.popCombo(comboBefore, anchor.x, anchor.y);
    this.notifyComboGain(comboBefore);
    const cleared = this.flushBrickChanges();

    // 마지막 벽돌이었다면 공이 떨어질 때까지 기다리지 않고 즉시 웨이브를 끝낸다.
    if (cleared) {
      this.clearWave();
      return;
    }

    // 관통 구체는 벽돌을 뚫고 지나가므로 위치 보정/반사를 하지 않는다.
    if (!ball.pierce) {
      // resolved 는 피해를 주기 "전" 기하로 계산한 값이다. 그 사이 폭발이 그 벽돌들을
      // 날려버렸을 수 있으므로, 살아남은 벽돌로 반사를 다시 계산한다.
      // 그러지 않으면 이미 사라진 벽돌에 튕기는 유령 반사가 생긴다.
      // (null 이면 부딪힐 것이 남지 않은 것 — 그대로 지나간다.)
      const bounce = resolveCircleVsRects(ball.circle, ball.velocity, this.brickRects);
      if (bounce) {
        ball.x = bounce.position.x;
        ball.y = bounce.position.y;
        ball.setVelocity(ensureMinVerticalSpeed(withSpeed(bounce.velocity, ball.baseSpeed)));
      }
    }

    // 분열은 반사까지 끝난 "튕겨 나가는 방향"을 기준으로 한다.
    if (directHit && ball.canSplit) this.splitBall(ball);
  }

  /**
   * 분열 구체를 갈라놓는다. 본체는 그대로 가고, 분신들이 좌우로 번갈아 벌어진다 (+θ, −θ, +2θ …).
   * 분신은 다시 갈라지지 않으므로 공의 수가 기하급수로 불지 않는다.
   */
  private splitBall(ball: Ball): void {
    ball.canSplit = false;
    const stats = BALL_STATS[ball.type];
    const count = stats.splitCount ?? 0;
    const spread = ((stats.splitAngleDeg ?? 25) * Math.PI) / 180;

    let spawned = 0;
    for (let i = 0; i < count; i++) {
      if (this.balls.length + this.pendingBalls.length >= BALANCE.ball.maxBalls) break;
      const angle = (i % 2 === 0 ? 1 : -1) * (Math.floor(i / 2) + 1) * spread;
      const velocity = ensureMinVerticalSpeed(withSpeed(rotate(ball.velocity, angle), ball.baseSpeed));
      this.pendingBalls.push(ball.spawnChild(velocity));
      spawned++;
    }
    if (spawned === 0) return;

    this.particles.emit(ball.x, ball.y, 14, stats.trail, { speed: 190, life: 0.4, gravity: 0, drag: 2.2 });
    this.floating.spawnNotice(ball.x, ball.y - 26, 'SPLIT!', stats.trail);
    this.hooks.onBallSplit?.(spawned);
  }

  /* ---------------------------------------------------------------- */
  /* 타격 연출 (파티클 · 셰이크 · 히트스탑 · 콤보)                        */
  /* ---------------------------------------------------------------- */

  /**
   * 벽돌 하나에 피해를 주고 그에 맞는 연출을 낸다.
   * 직접 타격과 폭발 피해 양쪽이 이 경로를 공유한다.
   */
  private damageBrick(brick: Brick, damage: number, cx: number, cy: number): boolean {
    if (brick.isDestroyed) return false;

    const destroyed = brick.hit(damage);
    const center = brick.center;

    // 콤보는 "벽돌을 때린 횟수". 폭발에 휩쓸린 벽돌도 포함된다.
    // 팝업은 여기서 띄우지 않는다 — 연쇄 폭발이면 벽돌마다 하나씩 동시에 떠서
    // 서로 겹쳐 읽을 수 없게 된다. 충돌 처리가 끝난 뒤 최종값으로 한 번만 띄운다.
    this.combo += 1;
    this.floating.spawnDamage(cx, cy, damage, brick.tier.text);

    if (destroyed) {
      this.destroyedBuffer = true;
      this.bricksDestroyed += 1;
      this.scoreBuffer += BALANCE.score.perBrickHp * brick.maxHp;
      this.particles.debris(center.x, center.y, brick.tier.edge);
      this.shake.shake(...SHAKE.brickDestroy);
      this.requestHitStop(HITSTOP.brickDestroy);
      const model = brick.toModel();
      this.hooks.onBrickDestroyed?.(model);
      this.forEachRelic((relic) => relic.onBrickDestroy?.(this.relicCtx, model));

      // 폭탄 벽돌은 파괴되면서 주변을 휩쓴다 (연쇄 가능).
      if (brick.isBomb) {
        this.pendingBlasts.push({
          x: center.x,
          y: center.y,
          radius: BALANCE.bricks.bomb.radius,
          damage: BALANCE.bricks.bomb.damage,
        });
      }
    } else {
      this.particles.sparks(cx, cy, '#ffffff');
      this.shake.shake(...SHAKE.brickHit);
      this.hooks.onBrickHit?.();
    }

    return destroyed;
  }

  /** 대기 중인 폭발을 큐로 처리한다. 연쇄는 MAX_CHAIN_BLASTS 회로 제한. */
  private resolveBlasts(): void {
    let processed = 0;
    while (this.pendingBlasts.length > 0 && processed < MAX_CHAIN_BLASTS) {
      const blast = this.pendingBlasts.shift() as Blast;
      processed++;

      this.particles.explosion(blast.x, blast.y, blast.radius);
      this.hooks.onExplosion?.();
      // 24연쇄면 BOOM! 이 24개 겹친다. 앞의 두 번만 띄우고 나머지는 파티클로만 보여준다.
      if (processed <= 2) this.floating.spawnBoom(blast.x, blast.y);
      this.shake.shake(...SHAKE.explosion);
      this.requestHitStop(HITSTOP.explosion);

      const circle = { x: blast.x, y: blast.y, r: blast.radius };
      // 배열을 복사해서 순회한다 — damageBrick 이 pendingBlasts 를 늘릴 수 있다.
      for (const brick of [...this.bricks]) {
        if (brick.isDestroyed) continue;
        if (!circleVsRect(circle, brick.rect)) continue;
        this.damageBrick(brick, blast.damage, brick.center.x, brick.center.y);
      }
    }
    this.pendingBlasts.length = 0;
  }

  /** 누적된 점수/파괴를 상태에 반영한다. 웨이브가 비었으면 true. */
  private flushBrickChanges(): boolean {
    if (this.destroyedBuffer) {
      this.bricks = this.bricks.filter((b) => !b.isDestroyed);
      this.syncBrickRects();
    }

    this.patchState({
      score: this.state.score + this.scoreBuffer,
      bricksRemaining: this.bricks.length,
      bricksDestroyed: this.bricksDestroyed,
      combo: this.combo,
      bestCombo: Math.max(this.state.bestCombo, this.combo),
    });

    this.scoreBuffer = 0;
    this.destroyedBuffer = false;
    return this.bricks.length === 0;
  }

  /**
   * 이번 충돌로 오른 콤보를 팝업 하나로 알린다.
   *  - 평범한 랠리(한 번에 1타)에서는 홀수 콤보에서만 띄워 화면이 시끄럽지 않게 하고,
   *  - 폭발처럼 한 번에 여러 개를 때린 경우에는 최종 콤보를 반드시 보여준다.
   */
  private popCombo(before: number, x: number, y: number): void {
    const gained = this.combo - before;
    if (gained <= 0 || this.combo < COMBO_POPUP_MIN) return;
    if (gained === 1 && this.combo % 2 === 0) return;
    this.floating.spawnCombo(x, y - 40, this.combo);
  }

  /** 콤보가 올랐으면 유물에게 알린다. 벽돌에 피해를 주는 모든 경로가 끝에 이걸 불러야 한다. */
  private notifyComboGain(before: number): void {
    if (this.combo <= before) return;
    const after = this.combo;
    this.forEachRelic((relic) => relic.onCombo?.(this.relicCtx, before, after));
  }

  private requestHitStop(seconds: number): void {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  /* ---------------------------------------------------------------- */
  /* 렌더                                                               */
  /* ---------------------------------------------------------------- */

  private render(): void {
    const ctx = this.ctx;
    const shake = this.shake.offset;

    // canvas.width/height 는 이미 디바이스 픽셀이다. 변환이 걸린 채 지우면
    // dpr 이 한 번 더 곱해져 dpr < 1 인 환경에서 우/하단이 지워지지 않는다.
    // 지우기는 흔들림 밖에서 해야 화면 가장자리에 잔상이 남지 않는다.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // ── 흔들림 구간 시작
    ctx.save();
    const unit = this.dpr * this.scale;
    ctx.setTransform(unit, 0, 0, unit, 0, 0);
    // 논리 좌표계 위에서 흔들기 때문에 캔버스 크기가 달라져도 체감 강도가 같다.
    ctx.translate(shake.x, shake.y);

    this.drawBackground(ctx);
    this.drawDeadline(ctx);
    this.drawSafetyNet(ctx);
    for (const brick of this.bricks) brick.draw(ctx);
    this.paddle.draw(ctx);
    for (const ball of this.balls) ball.draw(ctx);
    this.particles.draw(ctx);

    this.floating.draw(ctx);

    if (this.state.phase === 'AIMING') this.drawAimHint(ctx);

    ctx.restore(); // ── 흔들림 구간 끝
    // 게임오버/승리 화면은 React 의 GameOverModal 이 그린다. 캔버스는 장면만 책임진다.
  }

  /**
   * 데드라인(경고선). 벽돌이 가까워질수록 붉게 진해지고 맥동한다.
   * 남은 턴이 2 이하면 채워진 경고 밴드까지 그린다.
   */
  private drawDeadline(ctx: CanvasRenderingContext2D): void {
    const remaining = this.state.turnsUntilDeadline;
    const danger = remaining >= 0 && remaining <= 2;
    const urgency = remaining < 0 ? 0 : clamp(1 - remaining / 6, 0, 1);
    const pulse = danger ? 0.55 + 0.45 * Math.sin(performance.now() / 140) : 1;

    ctx.save();
    if (urgency > 0.01) {
      const band = ctx.createLinearGradient(0, DEADLINE_Y - 26, 0, DEADLINE_Y);
      band.addColorStop(0, 'rgba(255, 82, 82, 0)');
      band.addColorStop(1, `rgba(255, 82, 82, ${0.16 * urgency * pulse})`);
      ctx.fillStyle = band;
      ctx.fillRect(0, DEADLINE_Y - 26, GAME_WIDTH, 26);
    }

    ctx.strokeStyle = `rgba(255, 92, 92, ${(0.3 + 0.55 * urgency) * pulse})`;
    ctx.lineWidth = danger ? 2.5 : 1.5;
    ctx.setLineDash([14, 9]);
    ctx.beginPath();
    ctx.moveTo(0, DEADLINE_Y);
    ctx.lineTo(GAME_WIDTH, DEADLINE_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = `rgba(255, 138, 138, ${(0.5 + 0.5 * urgency) * pulse})`;
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('DEADLINE', 10, DEADLINE_Y - 5);
    ctx.restore();
  }

  /** 낙하 방지 유물이 충전돼 있으면 바닥에 그물을 친다. 발동 직후에는 번쩍인다. */
  private drawSafetyNet(ctx: CanvasRenderingContext2D): void {
    const armed = this.hasFallGuard();
    if (!armed && this.netFlash <= 0) return;

    const flash = this.netFlash / NET_FLASH_SECONDS; // 1 → 0
    const y = GAME_HEIGHT - 5;
    const alpha = armed ? 0.55 + 0.25 * Math.sin(performance.now() / 260) : 0;

    ctx.save();
    ctx.strokeStyle = `rgba(126, 240, 255, ${Math.max(alpha, flash)})`;
    ctx.shadowColor = 'rgba(126, 240, 255, 0.9)';
    ctx.shadowBlur = 8 + 22 * flash;
    ctx.lineWidth = 2 + 3 * flash;
    ctx.beginPath();
    // 지그재그 그물
    for (let x = 0; x <= GAME_WIDTH; x += 18) {
      const yy = y + ((x / 18) % 2 === 0 ? -4 : 4);
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    grad.addColorStop(0, '#0d1424');
    grad.addColorStop(1, '#070a14');
    ctx.fillStyle = grad;
    ctx.fillRect(-40, -40, GAME_WIDTH + 80, GAME_HEIGHT + 80);

    ctx.strokeStyle = 'rgba(76, 201, 240, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= GAME_WIDTH; x += 45) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, GAME_HEIGHT);
      ctx.stroke();
    }

    // 좌/우/상 벽 표시
    ctx.strokeStyle = 'rgba(76, 201, 240, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(1, GAME_HEIGHT);
    ctx.lineTo(1, 1);
    ctx.lineTo(GAME_WIDTH - 1, 1);
    ctx.lineTo(GAME_WIDTH - 1, GAME_HEIGHT);
    ctx.stroke();

    // 바닥(사망선)
    ctx.strokeStyle = 'rgba(255, 107, 107, 0.35)';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, GAME_HEIGHT - 6);
    ctx.lineTo(GAME_WIDTH, GAME_HEIGHT - 6);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawAimHint(ctx: CanvasRenderingContext2D): void {
    const ball = this.balls[0];
    if (!ball) return;
    const angle = this.aimAngle;

    ctx.save();
    ctx.strokeStyle = 'rgba(247, 181, 56, 0.65)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(ball.x + Math.cos(angle) * 90, ball.y + Math.sin(angle) * 90);
    ctx.stroke();
    ctx.restore();
  }
}
