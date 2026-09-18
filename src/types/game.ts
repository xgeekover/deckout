/**
 * Deckout - 공용 타입 정의
 * 엔진(Canvas)과 UI(React)가 함께 참조하는 유일한 계약(contract) 레이어.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** 논리 해상도. 실제 캔버스 픽셀은 DPR/컨테이너 크기에 맞춰 스케일된다. */
export const GAME_WIDTH = 900;
export const GAME_HEIGHT = 640;

/* ------------------------------------------------------------------ */
/* Ball                                                                */
/* ------------------------------------------------------------------ */

/** 덱에 들어갈 수 있는 공의 종류. split 은 타입만 정의돼 있고 미구현. */
export type BallType = 'normal' | 'heavy' | 'pierce' | 'bomb' | 'split';

export interface BallStats {
  label: string;
  radius: number;
  /** px per second */
  speed: number;
  damage: number;
  /** 벽돌을 관통하는가 (파괴 시에도 반사되지 않음) */
  pierce: boolean;
  color: string;
  glow: string;
  /** 잔상(trail) 색 */
  trail: string;
  /** 0보다 크면 벽돌을 부술 때마다 이 반경으로 폭발한다 */
  explosionRadius?: number;
  explosionDamage?: number;
}

export const BALL_STATS: Record<BallType, BallStats> = {
  normal: {
    label: '기본 구체',
    radius: 8,
    speed: 480,
    damage: 1,
    pierce: false,
    color: '#eef4ff',
    glow: 'rgba(120, 190, 255, 0.55)',
    trail: '#ffffff',
  },
  heavy: {
    label: '중량 구체',
    radius: 12,
    speed: 390,
    damage: 3,
    pierce: false,
    color: '#ffd98a',
    glow: 'rgba(247, 181, 56, 0.55)',
    trail: '#f7b538',
  },
  pierce: {
    label: '관통 구체',
    radius: 7,
    speed: 540,
    damage: 1,
    pierce: true,
    color: '#8ad8ff',
    glow: 'rgba(56, 189, 248, 0.6)',
    trail: '#38bdf8',
  },
  bomb: {
    label: '폭탄 구체',
    radius: 11,
    speed: 420,
    damage: 1,
    pierce: false,
    color: '#ffb066',
    glow: 'rgba(255, 138, 61, 0.65)',
    trail: '#ff8a3d',
    explosionRadius: 74,
    explosionDamage: 2,
  },
  split: {
    label: '분열 구체',
    radius: 8,
    speed: 470,
    damage: 1,
    pierce: false,
    color: '#ff9de2',
    glow: 'rgba(255, 157, 226, 0.55)',
    trail: '#ff9de2',
  },
};

/* ------------------------------------------------------------------ */
/* Deck / Card                                                         */
/* ------------------------------------------------------------------ */

/** 카드 한 장이 담는 공의 정보 (id 없는 순수 데이터) */
export interface BallData {
  ballType: BallType;
  name: string;
  description: string;
}

export interface DeckCard extends BallData {
  id: string;
  /** 유물 등이 웨이브 도중 만들어낸 카드. 웨이브가 끝나면 사라진다. */
  temporary?: boolean;
}

/** 볼 타입별 기본 카드 문구 */
export const BALL_CARD_DATA: Record<BallType, BallData> = {
  normal: { ballType: 'normal', name: '기본 구체', description: '평범하지만 믿음직한 한 발.' },
  heavy: { ballType: 'heavy', name: '중량 구체', description: '느리지만 벽돌을 3 만큼 부순다.' },
  pierce: { ballType: 'pierce', name: '관통 구체', description: '벽돌을 뚫고 지나간다. 한 줄을 통째로.' },
  bomb: { ballType: 'bomb', name: '폭탄 구체', description: '부순 자리에서 폭발해 주변까지 쓸어버린다.' },
  split: { ballType: 'split', name: '분열 구체', description: '(미구현)' },
};

export type Rarity = 'COMMON' | 'RARE' | 'LEGENDARY';

/* ------------------------------------------------------------------ */
/* Relic (패시브 유물)                                                  */
/* ------------------------------------------------------------------ */

/** 보유하는 것만으로 적용되는 상시 보정치. 여러 유물의 값은 곱/합으로 누적된다. */
export interface RelicModifiers {
  /** 패들 너비 배율 (1.2 = +20%) */
  paddleWidthMul?: number;
  /** 볼 이동 속도 배율 */
  ballSpeedMul?: number;
  /** 볼 기본 대미지 가산 */
  ballDamageAdd?: number;
  /** 볼 뒤로 불씨 파티클을 흘린다 (연출) */
  emberTrail?: boolean;
}

/**
 * 유물 훅이 엔진에 영향을 주는 유일한 통로.
 * 유물은 엔진 내부를 직접 만지지 못하고 이 인터페이스로만 상호작용한다.
 */
export interface RelicContext {
  readonly wave: number;
  readonly turn: number;
  readonly combo: number;
  /** relicId 의 이번 웨이브 충전을 1 소모한다. 남아 있었으면 true. */
  consumeCharge(relicId: string): boolean;
  /** 버린 카드 더미에 카드를 생성한다. temporary 면 웨이브 종료 시 사라진다. */
  addCardToDiscard(ball: BallData, temporary?: boolean): void;
  /** 캔버스에 떠오르는 알림 문구를 띄운다. */
  announce(text: string): void;
}

export interface Relic {
  id: string;
  name: string;
  description: string;
  /** 간단한 이모지 또는 텍스트 아이콘 */
  icon: string;
  rarity: Rarity;
  /** 상시 보정치 */
  modifiers?: RelicModifiers;
  /** 웨이브 시작 때마다 이 횟수로 충전되는 1회성 효과 */
  chargesPerWave?: number;

  /** 공이 패들 윗면에 맞을 때 */
  onPaddleHit?(ctx: RelicContext): void;
  /** 벽돌이 파괴될 때 */
  onBrickDestroy?(ctx: RelicContext, brick: Brick): void;
  /** 턴이 끝날 때 (공을 잃었거나 웨이브를 비웠을 때) */
  onTurnEnd?(ctx: RelicContext): void;
  /** 콤보가 before → after 로 올랐을 때. 폭발이면 한 번에 여러 단계가 오를 수 있다. */
  onCombo?(ctx: RelicContext, before: number, after: number): void;
  /** 공이 바닥에 닿았을 때. true 를 돌려주면 공을 살려 위로 튕겨낸다. */
  onBallFall?(ctx: RelicContext): boolean;
}

/* ------------------------------------------------------------------ */
/* Reward                                                              */
/* ------------------------------------------------------------------ */

/** 웨이브 클리어 보상 선택지 — 새 볼 카드 또는 패시브 유물 */
export type RewardItem =
  | { id: string; type: 'BALL'; rarity: Rarity; ball: BallData }
  | { id: string; type: 'RELIC'; rarity: Rarity; relic: Relic };

/* ------------------------------------------------------------------ */
/* Brick                                                               */
/* ------------------------------------------------------------------ */

/** 일반 / 단단함 / 핵심 / 폭탄 */
export type BrickType = 'normal' | 'tough' | 'core' | 'bomb';

/** 폭탄 벽돌이 파괴될 때의 폭발 반경과 주변 피해량 */
export const BOMB_BRICK_RADIUS = 96;
export const BOMB_BRICK_DAMAGE = 2;

/**
 * 벽돌의 데이터 계약. `engine/entities/Brick.ts` 의 클래스가 이 형태를 구현하며,
 * UI·훅·세이브 등 엔진 바깥으로 나갈 때는 항상 이 순수 데이터 형태로 다룬다.
 */
export interface Brick {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  isDestroyed: boolean;
  type: BrickType;
}

/** 그리드 배치 파라미터 (논리 좌표계 기준) */
export interface BrickGridConfig {
  rows: number;
  cols: number;
  /** 벽돌 사이 간격 */
  gap: number;
  /** 필드 좌우 여백 */
  sideMargin: number;
  /** 그리드 상단 y */
  top: number;
  height: number;
}

/** 한 행이 차지하는 세로 간격 = 벽돌 높이 + 간격 */
export const rowPitch = (g: BrickGridConfig): number => g.height + g.gap;

export const DEFAULT_GRID: BrickGridConfig = {
  rows: 5,
  cols: 8,
  gap: 8,
  sideMargin: 48,
  top: 92,
  height: 28,
};

/* ------------------------------------------------------------------ */
/* GameState (엔진 -> React 로 방출되는 스냅샷)                          */
/* ------------------------------------------------------------------ */

/**
 * 턴 사이클:
 *   AIMING --(발사)--> PLAYING --(공 낙하)--> TURN_RESOLVING --(하강 애니메이션)--> AIMING
 * 필드를 전부 비우면 REWARD 로 빠졌다가 다음 웨이브의 AIMING 으로 돌아온다.
 */
export type GamePhase =
  | 'AIMING' // 카드를 뽑아 공이 패들 위에 대기 중. 발사 입력을 받는다.
  | 'PLAYING' // 공이 필드에 있음
  | 'TURN_RESOLVING' // 턴 정산 — 벽돌 하강 + 신규 행 스폰 애니메이션
  | 'REWARD' // 필드를 전부 비움. 보상 카드 선택 대기
  | 'GAME_OVER' // 벽돌이 데드라인에 도달
  | 'VICTORY'; // 목표 웨이브까지 클리어

/** 턴 진행 상태 */
export interface TurnState {
  /** 게임 시작부터 누적된 턴 수 (1부터 시작) */
  currentTurn: number;
  /** 지금 발사 입력을 받을 수 있는가 */
  canLaunch: boolean;
}

export interface GameState {
  phase: GamePhase;
  turn: TurnState;
  wave: number;
  score: number;
  /** 이번 웨이브의 배치 패턴 이름 */
  wavePattern: string;
  /** 보유 덱 전체 (영구 카드) */
  deck: DeckCard[];
  /** 아직 뽑지 않은 카드 수 */
  drawPileCount: number;
  /** 버린 카드 더미. 드로우 더미가 비면 섞여서 다시 드로우 더미가 된다. */
  discardPileCount: number;
  /** 보유 중인 패시브 유물 */
  relics: Relic[];
  /** 유물 id → 이번 웨이브 남은 충전 횟수 */
  relicCharges: Record<string, number>;
  /** 현재 턴에 뽑힌 카드 (없으면 null) */
  currentCard: DeckCard | null;
  bricksRemaining: number;
  /** 현재 턴에서 공이 바닥에 떨어지기 전까지 누적된 연속 타격 수 */
  combo: number;
  /** 이번 판 최고 콤보 */
  bestCombo: number;
  /** phase === 'REWARD' 일 때 제시되는 선택지 */
  rewardChoices: RewardItem[];
  /**
   * 가장 아래 벽돌이 데드라인에 닿기까지 남은 턴 수.
   * 벽돌이 없으면 Infinity 대신 -1 로 둔다 (직렬화 안전).
   */
  turnsUntilDeadline: number;
}

export const createInitialGameState = (): GameState => ({
  phase: 'AIMING',
  turn: { currentTurn: 1, canLaunch: false },
  wave: 1,
  wavePattern: '',
  score: 0,
  deck: [],
  drawPileCount: 0,
  discardPileCount: 0,
  relics: [],
  relicCharges: {},
  currentCard: null,
  bricksRemaining: 0,
  combo: 0,
  bestCombo: 0,
  rewardChoices: [],
  turnsUntilDeadline: -1,
});
