/**
 * Deckout - Canvas 메인 루프.
 *
 * 설계 원칙
 *  - React 를 전혀 모른다. DOM 이벤트도 직접 듣지 않는다 (입력은 공개 메서드로 주입받는다).
 *  - 물리는 고정 타임스텝으로 서브스텝을 돌려 프레임레이트와 무관하게 동일하게 동작한다.
 *  - UI 로 나가는 것은 subscribe(listener) 로 방출되는 GameState 스냅샷뿐이며,
 *    값이 실제로 바뀐 프레임에만 방출한다 (60fps React 리렌더 방지).
 */

import { ParticleSystem } from './ParticleSystem';
import {
  clamp,
  ensureMinHorizontalSpeed,
  ensureMinVerticalSpeed,
  paddleReflect,
  resolveAABBBounce,
  resolveCircleVsRects,
  resolveWalls,
  withSpeed,
} from './Physics';
import type { Rect } from './Physics';
import { Ball } from './entities/Ball';
import { Brick } from './entities/Brick';
import { Paddle } from './entities/Paddle';
import {
  BALL_STATS,
  DEFAULT_GRID,
  GAME_HEIGHT,
  GAME_WIDTH,
  createInitialGameState,
  rowPitch,
} from '../types/game';
import type {
  BallType,
  Brick as BrickModel,
  BrickGridConfig,
  DeckCard,
  GameState,
  RewardCard,
} from '../types/game';

const FIXED_STEP = 1 / 120;
const MAX_FRAME_TIME = 0.25;

const FIELD: Rect = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT };
export const PADDLE_Y = GAME_HEIGHT - 64;

/** 데드라인은 패들 위 40px. 벽돌 하단이 여기 닿으면 패배. */
export const DEADLINE_OFFSET = 40;
export const DEADLINE_Y = PADDLE_Y - DEADLINE_OFFSET;

/** 벽돌 하강 슬라이드 시간(초) */
const SLIDE_DURATION = 0.34;

/**
 * 한 턴의 최대 길이(초). 어떤 이유로든 공이 끝없이 랠리를 이어가면 턴을 강제 종료한다.
 * 정상 왕복이 2초 안팎이므로 45초는 통상 플레이에서 닿지 않는 보험이다.
 */
const MAX_TURN_SECONDS = 45;

/** 이 웨이브를 클리어하면 VICTORY */
const VICTORY_WAVE = 3;

/**
 * 행별 기본 HP (0번이 최상단). 위로 갈수록 단단하다.
 * 웨이브가 오르면 여기에 보정치가 더해진다.
 */
const ROW_HP = [3, 2, 2, 1, 1];

/** 엔진이 바깥으로 알리는 게임플레이 이벤트 훅. */
export interface EngineHooks {
  /** 새 턴이 시작되어 발사 대기에 들어갔을 때 */
  onTurnStart?: (turn: number) => void;
  /** 공이 바닥을 완전히 벗어났을 때 */
  onBallLost?: (turn: number) => void;
  /** 턴 정산(벽돌 하강 + 신규 행 스폰)이 끝났을 때 */
  onTurnEnd?: (turn: number) => void;
  /** 벽돌 하나가 파괴될 때마다 */
  onBrickDestroyed?: (brick: BrickModel) => void;
  /** 필드의 벽돌을 모두 비웠을 때 */
  onWaveClear?: (wave: number, remainingCards: number) => void;
  /** 벽돌이 데드라인에 도달해 패배했을 때 */
  onGameOver?: (turn: number, score: number) => void;
  /** 목표 웨이브까지 클리어했을 때 */
  onVictory?: (turn: number, score: number) => void;
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
const makeCard = (ballType: BallType, name: string, description: string): DeckCard => ({
  id: `card-${ballType}-${cardSeq++}`,
  ballType,
  name,
  description,
});

const STARTING_DECK = (): DeckCard[] => [
  makeCard('normal', '기본 구체', '평범하지만 믿음직한 한 발.'),
  makeCard('normal', '기본 구체', '평범하지만 믿음직한 한 발.'),
  makeCard('normal', '기본 구체', '평범하지만 믿음직한 한 발.'),
  makeCard('normal', '기본 구체', '평범하지만 믿음직한 한 발.'),
  makeCard('heavy', '중량 구체', '느리지만 벽돌을 3 만큼 부순다.'),
];

const REWARD_POOL: Array<Omit<RewardCard, 'id'>> = [
  {
    ballType: 'normal',
    name: '기본 구체',
    description: '덱을 두껍게 — 턴을 한 번 더 번다.',
    rarity: 'common',
  },
  {
    ballType: 'heavy',
    name: '중량 구체',
    description: '데미지 3. 단단한 벽돌 처리용.',
    rarity: 'common',
  },
  {
    ballType: 'pierce',
    name: '관통 구체',
    description: '벽돌을 뚫고 지나간다. 한 줄을 통째로.',
    rarity: 'rare',
  },
];

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
  private bricks: Brick[] = [];
  /** this.bricks 와 인덱스가 1:1 인 충돌용 rect 캐시 (서브스텝마다 재생성하지 않기 위함) */
  private brickRects: Rect[] = [];
  private particles = new ParticleSystem();

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

  /** 아직 뽑지 않은 카드 (덱의 부분집합) */
  private drawPile: DeckCard[] = [];
  private deck: DeckCard[] = [];

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D 컨텍스트를 생성할 수 없습니다.');
    this.canvas = canvas;
    this.ctx = ctx;
    this.paddle = new Paddle(GAME_WIDTH / 2, PADDLE_Y);
    this.reset();
  }

  /* ---------------------------------------------------------------- */
  /* 외부 API (React 에서 호출)                                         */
  /* ---------------------------------------------------------------- */

  /** 웨이브 클리어 등 게임플레이 이벤트 훅을 등록한다. */
  setHooks(hooks: EngineHooks): void {
    this.hooks = hooks;
  }

  /** 벽돌 그리드 배치 파라미터를 바꾼다 (다음 웨이브부터 적용). */
  setGridConfig(config: Partial<BrickGridConfig>): void {
    this.grid = { ...this.grid, ...config };
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
    this.patchState({ phase: 'PLAYING', turn: { ...this.state.turn, canLaunch: false } });
  }

  /** 보상 카드 선택 → 덱에 추가하고 다음 웨이브로. */
  chooseReward(cardId: string): void {
    if (this.state.phase !== 'REWARD') return;
    const picked = this.state.rewardChoices.find((c) => c.id === cardId);
    if (!picked) return; // 알 수 없는 id 로 웨이브만 넘어가 버리는 것을 막는다

    this.deck = [...this.deck, makeCard(picked.ballType, picked.name, picked.description)];
    this.patchState({ wave: this.state.wave + 1, rewardChoices: [] });
    this.startWave();
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
    this.notify();
    this.startWave();
  }

  /* ---------------------------------------------------------------- */
  /* 웨이브 / 턴 흐름                                                    */
  /* ---------------------------------------------------------------- */

  private startWave(): void {
    this.buildBricks(this.state.wave);
    this.refillDrawPile();
    this.patchState({ bricksRemaining: this.bricks.length, deck: this.deck });
    this.beginTurn();
  }

  /**
   * 상단에 벽돌 그리드를 배치한다.
   * 벽돌 폭은 필드 폭에서 좌우 여백과 간격을 뺀 나머지를 열 수로 나눠 산출하므로,
   * cols/gap/sideMargin 을 바꾸면 자동으로 다시 맞춰진다.
   */
  private buildBricks(wave: number): void {
    const { rows } = this.grid;
    const waveBonus = Math.floor((wave - 1) / 2);
    this.bricks = [];

    for (let row = 0; row < rows; row++) {
      const baseHp = ROW_HP[Math.min(row, ROW_HP.length - 1)];
      const hp = baseHp + (baseHp > 1 ? waveBonus : 0);
      const y = this.grid.top + row * rowPitch(this.grid);
      for (const brick of this.spawnRow(y, () => hp)) this.bricks.push(brick);
    }
    this.syncBrickRects();
  }

  /**
   * y 위치에 한 행을 만든다. 폭/여백은 그리드 설정에서 매번 다시 계산하므로
   * cols 나 sideMargin 을 바꿔도 정확히 중앙 정렬된다.
   */
  private spawnRow(y: number, hpFor: (col: number) => number): Brick[] {
    const { cols, gap, sideMargin, height } = this.grid;
    const usableWidth = FIELD.w - sideMargin * 2;
    const brickWidth = (usableWidth - gap * (cols - 1)) / cols;
    const gridWidth = brickWidth * cols + gap * (cols - 1);
    const originX = FIELD.x + (FIELD.w - gridWidth) / 2;

    const row: Brick[] = [];
    for (let col = 0; col < cols; col++) {
      const hp = hpFor(col);
      if (hp <= 0) continue; // 빈 칸
      row.push(new Brick(originX + col * (brickWidth + gap), y, brickWidth, height, hp));
    }
    return row;
  }

  /**
   * 신규 행의 칸별 HP 추첨. 턴이 오를수록 단단한 벽돌이 자주 나오고 빈 칸은 줄어든다.
   * 빈 칸이 전혀 없으면 공 하나로는 줄을 걷어낼 수 없어 금방 막히므로 반드시 남긴다.
   */
  private rollSpawnHp(turn: number): number {
    const t = Math.min(turn / 24, 1); // 24턴에 걸쳐 최대 난이도
    const emptyChance = 0.3 - 0.15 * t;
    const r = Math.random();
    if (r < emptyChance) return 0;
    if (r < emptyChance + 0.18 + 0.3 * t) return 3 + Math.floor(t * 2);
    if (r < emptyChance + 0.5 + 0.2 * t) return 2 + Math.floor(t * 1.5);
    return 1;
  }

  private syncBrickRects(): void {
    this.brickRects = this.bricks.map((b) => b.rect);
  }

  private refillDrawPile(): void {
    // Fisher-Yates 셔플
    const pile = [...this.deck];
    for (let i = pile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pile[i], pile[j]] = [pile[j], pile[i]];
    }
    this.drawPile = pile;
  }

  /** 드로우 더미가 비면 덱을 다시 섞는다 (덱빌딩 게임의 표준 처리). */
  private takeCard(): DeckCard | null {
    if (this.drawPile.length === 0) this.refillDrawPile();
    return this.drawPile.pop() ?? null;
  }

  /** 카드를 뽑아 공을 패들 위에 올리고 발사 대기(AIMING)로 들어간다. */
  private beginTurn(): void {
    const card = this.takeCard();
    if (!card) {
      // 덱이 비어 있으면 진행이 불가능하다. 정상 경로에서는 도달하지 않는다.
      this.triggerGameOver();
      return;
    }

    const ball = new Ball(this.paddle.x, this.paddle.y, card.ballType);
    ball.attachTo(this.paddle.x, this.paddle.y);
    this.balls = [ball];
    this.aimAngle = -Math.PI / 2;

    this.patchState({
      phase: 'AIMING',
      currentCard: card,
      drawPileCount: this.drawPile.length,
      turn: { ...this.state.turn, canLaunch: true },
      turnsUntilDeadline: this.computeTurnsUntilDeadline(),
    });
    this.hooks.onTurnStart?.(this.state.turn.currentTurn);
  }

  /** 공이 바닥을 완전히 벗어났을 때 호출된다. */
  private onBallLost(): void {
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
    const incoming = this.spawnRow(this.grid.top - pitch, () => this.rollSpawnHp(turn));
    for (const brick of incoming) {
      brick.beginSlide(pitch);
      this.bricks.push(brick);
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
    this.particles.addTrauma(1);
    this.patchState({
      phase: 'GAME_OVER',
      currentCard: null,
      turn: { ...this.state.turn, canLaunch: false },
    });
    // 훅이 엔진을 다시 건드릴 때 "phase 는 종료인데 루프는 도는" 상태를 보지 않도록
    // stop() 을 먼저 부른다. 이번 프레임의 render() 는 그대로 실행되어 오버레이가 그려진다.
    this.stop();
    this.hooks.onGameOver?.(this.state.turn.currentTurn, this.state.score);
  }

  /** 필드의 벽돌을 모두 비웠을 때 */
  private clearWave(): void {
    this.balls = [];
    this.hooks.onWaveClear?.(this.state.wave, this.drawPile.length);
    const bonus = 500 + this.drawPile.length * 120; // 카드를 아낄수록 보너스

    if (this.state.wave >= VICTORY_WAVE) {
      this.patchState({
        phase: 'VICTORY',
        currentCard: null,
        score: this.state.score + bonus,
        bricksRemaining: 0,
        turnsUntilDeadline: -1,
        turn: { ...this.state.turn, canLaunch: false },
      });
      this.stop();
      this.hooks.onVictory?.(this.state.turn.currentTurn, this.state.score);
      return;
    }

    this.patchState({
      phase: 'REWARD',
      currentCard: null,
      rewardChoices: this.rollRewards(),
      score: this.state.score + bonus,
      bricksRemaining: 0,
      turnsUntilDeadline: -1,
      turn: { ...this.state.turn, canLaunch: false },
    });
  }

  private rollRewards(): RewardCard[] {
    const pool = [...REWARD_POOL];
    const picks: RewardCard[] = [];
    const count = Math.min(3, pool.length);
    for (let i = 0; i < count; i++) {
      const [entry] = pool.splice(Math.floor(Math.random() * pool.length), 1);
      picks.push({
        ...entry,
        id: `reward-${this.state.wave}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      });
    }
    return picks;
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

    this.accumulator += delta;
    while (this.accumulator >= FIXED_STEP) {
      this.step(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }

    this.particles.update(delta);
    for (const brick of this.bricks) brick.update(delta);
    for (const ball of this.balls) ball.recordTrail();

    this.render();
  };

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
        const target = -Math.PI / 2 + clamp(this.paddle.velocity / 700, -1, 1) * (Math.PI / 5);
        const t = 1 - Math.exp(-12 * dt);
        this.aimAngle += (target - this.aimAngle) * t;
        continue;
      }

      ball.step(dt);
      this.collideWalls(ball);
      this.collidePaddle(ball);
      this.collideBricks(ball);

      // 공이 바닥을 "완전히" 벗어나면 낙하 처리.
      if (ball.isBelow(FIELD.y + FIELD.h)) {
        ball.alive = false;
        this.particles.burst(ball.x, GAME_HEIGHT - 4, 14, '#ff6b6b', { speed: 220, gravity: -120 });
        this.particles.addTrauma(0.35);
      }
    }

    // 스톨 워치독: 어떤 이유로든 턴이 끝나지 않으면 강제로 정산한다.
    if (phase === 'PLAYING') {
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
    this.particles.burst(ball.x, ball.y, 6, BALL_STATS[ball.type].color, { speed: 130 });
    this.particles.addTrauma(0.08);
  }

  private collidePaddle(ball: Ball): void {
    if (ball.vy <= 0) return; // 올라가는 중이면 무시 (패들 내부 끼임 방지)
    const rect = this.paddle.rect;
    const hit = resolveAABBBounce(ball.circle, ball.velocity, rect);
    if (!hit) return;

    ball.x = hit.position.x;
    ball.y = hit.position.y;

    if (hit.face === 'top') {
      // 윗면은 물리 법선 대신 "맞은 위치"로 각도를 만든다 (클래식 브레이크아웃 감각).
      const reflected = paddleReflect(ball.x, rect, ball.baseSpeed);
      // 패들을 움직이며 맞히면 약간의 스핀이 실린다.
      reflected.x += this.paddle.velocity * 0.12;
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

    this.particles.burst(ball.x, rect.y, 12, '#8be9ff', { speed: 210, spread: Math.PI, gravity: 260 });
    this.particles.addTrauma(0.12);
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

    let destroyedAny = false;
    let gainedScore = 0;

    for (const { index, result } of resolved.contacts) {
      const brick = this.bricks[index];
      if (!brick || brick.isDestroyed) continue;
      // 벽돌별 쿨다운: 관통 구체가 같은 벽돌을 매 서브스텝 때리는 것을 막는다.
      if (!ball.canHit(brick.id)) continue;

      ball.markHit(brick.id);
      const destroyed = brick.hit(ball.damage);

      this.particles.burst(
        result.collision.contact.x,
        result.collision.contact.y,
        destroyed ? 22 : 8,
        destroyed ? brick.tier.edge : '#ffffff',
        { speed: destroyed ? 260 : 150 },
      );
      this.particles.addTrauma(destroyed ? 0.3 : 0.12);

      if (destroyed) {
        destroyedAny = true;
        gainedScore += 100 * brick.maxHp;
        this.hooks.onBrickDestroyed?.(brick.toModel());
      }
    }

    if (destroyedAny) {
      this.bricks = this.bricks.filter((b) => !b.isDestroyed);
      this.syncBrickRects();
      this.patchState({
        score: this.state.score + gainedScore,
        bricksRemaining: this.bricks.length,
      });
    }

    // 마지막 벽돌이었다면 공이 떨어질 때까지 기다리지 않고 즉시 웨이브를 끝낸다.
    if (this.bricks.length === 0) {
      this.clearWave();
      return;
    }

    // 관통 구체는 벽돌을 뚫고 지나가므로 위치 보정/반사를 하지 않는다.
    if (ball.pierce) return;

    ball.x = resolved.position.x;
    ball.y = resolved.position.y;
    ball.setVelocity(ensureMinVerticalSpeed(withSpeed(resolved.velocity, ball.baseSpeed)));
  }

  /* ---------------------------------------------------------------- */
  /* 렌더                                                               */
  /* ---------------------------------------------------------------- */

  private render(): void {
    const ctx = this.ctx;
    const shake = this.particles.shakeOffset;

    // canvas.width/height 는 이미 디바이스 픽셀이다. 변환이 걸린 채 지우면
    // dpr 이 한 번 더 곱해져 dpr < 1 인 환경에서 우/하단이 지워지지 않는다.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.setTransform(
      this.dpr * this.scale,
      0,
      0,
      this.dpr * this.scale,
      this.dpr * this.scale * shake.x,
      this.dpr * this.scale * shake.y,
    );

    this.drawBackground(ctx);
    this.drawDeadline(ctx);
    for (const brick of this.bricks) brick.draw(ctx);
    this.paddle.draw(ctx);
    for (const ball of this.balls) ball.draw(ctx);
    this.particles.draw(ctx);

    if (this.state.phase === 'AIMING') this.drawAimHint(ctx);
    if (this.state.phase === 'GAME_OVER') {
      this.drawOverlay(ctx, 'GAME OVER', `턴 ${this.state.turn.currentTurn} · 점수 ${this.state.score.toLocaleString()}`, '#ff6b6b');
    } else if (this.state.phase === 'VICTORY') {
      this.drawOverlay(ctx, 'VICTORY', `턴 ${this.state.turn.currentTurn} · 점수 ${this.state.score.toLocaleString()}`, '#7ef0a8');
    }
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

  /** 게임오버 / 승리 오버레이. React 모달 없이도 상태를 알 수 있게 캔버스에 직접 그린다. */
  private drawOverlay(
    ctx: CanvasRenderingContext2D,
    title: string,
    subtitle: string,
    accent: string,
  ): void {
    ctx.save();
    ctx.fillStyle = 'rgba(7, 10, 20, 0.78)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = accent;
    ctx.shadowBlur = 26;
    ctx.fillStyle = accent;
    ctx.font = '800 58px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(title, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 34);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#c9d4e8';
    ctx.font = '500 17px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(subtitle, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 14);

    ctx.fillStyle = 'rgba(201, 212, 232, 0.65)';
    ctx.font = '500 14px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('R 키를 눌러 재시작', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 48);
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
