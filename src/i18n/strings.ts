/**
 * 화면에 나가는 모든 문구의 단일 출처. 기본 언어는 영어이고, 한국어는 설정에서 고른다.
 *
 * DOM 무의존 순수 모듈이다 — 엔진 쪽 데이터(볼 · 유물 · 웨이브 패턴의 이름)도 여기의 영어 문구를
 * 가져다 쓰므로 같은 문장이 두 군데에 적히지 않는다. UI 는 id(볼 타입 · 유물 id · 패턴 id)로
 * 현재 언어의 문구를 다시 찾는다.
 *
 * 수치가 들어가는 설명은 balance.ts 의 값으로 만든다. 밸런스를 바꾸면 설명도 따라 바뀐다.
 */

import { BALANCE } from '../config/balance.ts';
import type { BallType, GamePhase } from '../types/game.ts';

export type Language = 'en' | 'ko';

export const LANGUAGES: readonly Language[] = ['en', 'ko'];
export const DEFAULT_LANGUAGE: Language = 'en';

/** 언어 이름은 번역하지 않는다 — 각자의 언어로 적어야 그 언어 사용자가 찾을 수 있다. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', ko: '한국어' };

export type RelicId =
  | 'wide-paddle'
  | 'flame-trail'
  | 'safety-net'
  | 'scrap-cycle'
  | 'lucky-charm'
  | 'iron-core'
  | 'demolition'
  | 'anchor'
  | 'overcharge'
  | 'phoenix';
export type PatternId = 'full' | 'checker' | 'inverted-triangle' | 'shield' | 'diamond' | 'columns' | 'boss';

export interface NameAndDescription {
  name: string;
  description: string;
}

/** 굵은 글씨가 끼는 문장: [앞, 굵게, 뒤] */
export type EmphasizedSentence = readonly [before: string, strong: string, after: string];

export interface Strings {
  tagline: string;
  /** 일반 HUD 의 phase 배지 */
  phase: Record<GamePhase, string>;
  /** 요약 HUD 용 짧은 표기 */
  phaseShort: Record<GamePhase, string>;

  balls: Record<BallType, NameAndDescription>;
  relics: Record<RelicId, NameAndDescription>;
  /** 벽돌 속 아이템 (턴 한정 효과) — id 는 engine/Items.ts */
  items: Record<string, NameAndDescription>;
  itemsTitle: string;
  itemsEmpty: string;
  patterns: Record<PatternId, string>;

  common: {
    score: string;
    turn: string;
    combo: string;
    turns: (n: number) => string;
    mute: string;
    unmute: string;
    enterFullscreen: string;
    exitFullscreen: string;
    retry: string;
  };

  hud: {
    currentWave: string;
    reinforcementsLeft: (rows: number) => string;
    reinforcementsDone: string;
    discarded: string;
    bricksLeft: string;
    currentCard: string;
    cardsLeft: string;
    temporary: string;
    waiting: string;
    deck: string;
    records: string;
    recordWave: string;
    recordBricks: string;
    settings: string;
    sound: string;
    soundOn: string;
    soundMuted: string;
    paddleControl: string;
    paddleControlAria: string;
    mouse: string;
    keyboard: string;
    keyboardModeNote: string;
    display: string;
    crt: string;
    crtOn: string;
    crtOff: string;
    language: string;
    relics: string;
    relicCount: (n: number) => string;
    relicsEmpty: string;
    chargesLeft: (left: number, total: number) => string;
    chargesLeftRun: (left: number, total: number) => string;
    /** 보스 웨이브의 코어 체력 라벨 */
    bossCore: string;
    /** 무한 모드 안내 (웨이브 칸 아래) */
    endless: string;
    comboBest: (n: number) => string;
    comboUnit: string;
    untilDeadline: string;
    deadlineWarning: string;
    newGame: string;
    confirmRestart: string;
  };

  /** 오락실 스코어라인 (픽셀 폰트, 짧은 대문자 라벨) */
  arcade: {
    score: string;
    hiScore: string;
    wave: string;
    combo: string;
    turn: string;
    deadline: string;
    incoming: string;
    incomingDone: string;
    waiting: string;
    relicsAria: string;
    openInfo: string;
    /** 점수줄의 보스 체력 라벨 (픽셀 폰트 — 짧은 대문자) */
    boss: string;
    promptLaunchKeyboard: string;
    promptLaunchTouch: string;
    promptPlaying: string;
    promptResolving: string;
    promptReward: string;
    promptRewardTouch: string;
    promptGameOver: string;
    promptGameOverTouch: string;
    promptVictory: string;
  };

  hints: {
    move: string;
    launch: string;
    pickCard: string;
    skip: string;
    tap: string;
    drag: string;
    movePaddle: string;
    pickOrSkip: string;
    keyboardAria: string;
    touchAria: string;
    /** 승리 화면의 터치 안내 */
    continueOrRetry: string;
  };

  reward: {
    aria: string;
    title: string;
    subtitle: string;
    skip: string;
    typeRelic: string;
    typeBall: string;
    relicAlwaysOn: string;
    statPierce: string;
    statBlast: string;
    statSplit: (pieces: number) => string;
    statChain: (targets: number) => string;
    statBounce: string;
    currentDeck: string;
    relics: string;
  };

  result: {
    ariaVictory: string;
    ariaGameOver: string;
    finalWave: string;
    totalScore: string;
    bestCombo: string;
    bricksDestroyed: string;
    highScore: string;
    previous: (score: string) => string;
    bestWave: string;
    totalBricks: string;
    finalDeck: (cards: number) => string;
    relics: (n: number) => string;
    noRelics: string;
    retryHint: string;
    /** 승리 화면의 "계속하기" 버튼과 그 설명 */
    continueEndless: string;
    continueHint: string;
    endlessNote: string;
  };

  app: {
    rotateHint: EmphasizedSentence;
    homeScreenHint: EmphasizedSentence;
    infoAria: string;
    paused: string;
    closeInfo: string;
  };
}

const percent = (mul: number): number => Math.round((mul - 1) * 100);
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

const R = BALANCE.relics;
const HEAVY_DAMAGE = BALANCE.ball.stats.heavy.damage;
const SPLIT_PIECES = BALANCE.ball.stats.split.splitCount + 1;
const GIANT_DAMAGE = BALANCE.ball.stats.giant.damage;
const CHAIN_TARGETS = BALANCE.ball.stats.chain.chainCount;
const BOSS_REGEN = BALANCE.boss.regenPerTurn;

const en: Strings = {
  tagline: 'Breakout × deckbuilding roguelite',
  phase: {
    AIMING: 'Ready — click to launch',
    PLAYING: 'In play',
    TURN_RESOLVING: 'Resolving turn',
    REWARD: 'Choose a reward',
    GAME_OVER: 'Game over',
    VICTORY: 'Victory',
  },
  phaseShort: {
    AIMING: 'Ready',
    PLAYING: 'In play',
    TURN_RESOLVING: 'Resolving',
    REWARD: 'Reward',
    GAME_OVER: 'Game over',
    VICTORY: 'Victory',
  },

  balls: {
    normal: { name: 'Basic Ball', description: 'Plain, but dependable.' },
    heavy: { name: 'Heavy Ball', description: `Slow, but hits bricks for ${HEAVY_DAMAGE}.` },
    pierce: { name: 'Pierce Ball', description: 'Punches straight through bricks. A whole row at once.' },
    bomb: { name: 'Bomb Ball', description: 'Explodes wherever it breaks a brick, taking the neighbors with it.' },
    split: { name: 'Split Ball', description: `Splits into ${SPLIT_PIECES} the moment it hits its first brick.` },
    giant: { name: 'Giant Ball', description: `Big and heavy — hits for ${GIANT_DAMAGE}, and wide enough to strike two bricks at once.` },
    chain: { name: 'Chain Ball', description: `Every brick it breaks sends lightning to the ${CHAIN_TARGETS} nearest bricks.` },
    bouncy: { name: 'Bouncy Ball', description: 'Bounces back up from the floor once per turn on its own.' },
  },
  relics: {
    'wide-paddle': {
      name: 'Wide Paddle',
      description: `Your paddle is ${percent(R.widePaddleWidthMul)}% wider.`,
    },
    'lucky-charm': {
      name: 'Lucky Charm',
      description: `Bricks hide items ${percent(R.luckyCharmDropMul)}% more often, and bad items are ${-percent(R.luckyCharmBadMul)}% rarer.`,
    },
    'iron-core': {
      name: 'Iron Core',
      description: `Basic Balls deal +${R.ironCoreDamageAdd} damage.`,
    },
    demolition: {
      name: 'Demolition Charge',
      description: `Once per wave, the first brick you destroy explodes (radius ${R.demolitionRadius}, damage ${R.demolitionDamage}).`,
    },
    anchor: {
      name: 'Anchor',
      description: 'Once per wave, losing a ball does not bring the bricks down — and no new row comes in.',
    },
    overcharge: {
      name: 'Overcharge',
      description: `Reach a ${R.overchargeCombo}-hit combo in one turn and every ball in flight deals +${R.overchargeDamageAdd} damage for the rest of the turn.`,
    },
    phoenix: {
      name: 'Phoenix Feather',
      description: `Once per run, when the bricks reach the deadline, the lowest ${R.phoenixRows} rows burn away instead and the run goes on.`,
    },
    'flame-trail': {
      name: 'Flame Trail',
      description: `All balls move ${percent(R.flameTrailSpeedMul)}% faster and deal +${R.flameTrailDamageAdd} base damage.`,
    },
    'safety-net': {
      name: 'Safety Net',
      description: 'Once per wave, catches a ball falling off the bottom and bounces it back up.',
    },
    'scrap-cycle': {
      name: 'Scrap Cycle',
      description: `Reach a ${R.scrapCycleCombo}-hit combo in one turn to add a Bomb Ball to your discard pile. (It vanishes when the wave ends.)`,
    },
  },
  items: {
    wide: { name: 'Wide', description: 'Paddle 1.5× wider this turn.' },
    multi: { name: 'x3', description: 'Every ball splits into three.' },
    slow: { name: 'Slow', description: 'Balls move 25% slower this turn.' },
    power: { name: 'Power', description: 'Balls deal +1 damage this turn.' },
    shield: { name: 'Shield', description: 'A floor barrier bounces one falling ball back up.' },
    narrow: { name: 'Narrow', description: 'Bad — paddle shrinks to 60% this turn.' },
    fast: { name: 'Fast', description: 'Bad — balls move 30% faster this turn.' },
    advance: { name: 'Down', description: 'Bad — the bricks drop one row right now.' },
  },
  itemsTitle: 'Items this turn',
  itemsEmpty: 'Bricks hide items — catch the falling capsules with the paddle. Effects last until you lose the ball. Red ones are bad.',
  patterns: {
    full: 'Standard',
    checker: 'Checkerboard',
    'inverted-triangle': 'Inverted Triangle',
    shield: 'Shield Wall',
    diamond: 'Diamond',
    columns: 'Columns',
    boss: 'Boss — The Core',
  },

  common: {
    score: 'Score',
    turn: 'Turn',
    combo: 'Combo',
    turns: (n) => plural(n, 'turn'),
    mute: 'Mute',
    unmute: 'Unmute',
    enterFullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
    retry: 'Try again',
  },

  hud: {
    currentWave: 'Current wave',
    reinforcementsLeft: (rows) => `${plural(rows, 'more row')} incoming`,
    reinforcementsDone: 'No more rows coming',
    discarded: 'Discarded',
    bricksLeft: 'Bricks left',
    currentCard: 'Current card',
    cardsLeft: 'Cards left',
    temporary: 'TEMP',
    waiting: 'Waiting…',
    deck: 'Your deck',
    records: 'Best records',
    recordWave: 'Wave',
    recordBricks: 'Bricks',
    settings: 'Settings',
    sound: 'Sound',
    soundOn: '🔊 On',
    soundMuted: '🔇 Muted',
    paddleControl: 'Paddle control',
    paddleControlAria: 'Paddle control mode',
    mouse: 'Mouse',
    keyboard: 'Keyboard',
    keyboardModeNote:
      'The paddle will not follow the mouse. Use A/D or ←/→. Touch dragging always works, whatever this is set to.',
    display: 'Display',
    crt: 'CRT effect',
    crtOn: 'On',
    crtOff: 'Off',
    language: 'Language',
    relics: 'Passive relics',
    relicCount: (n) => `${n} held`,
    relicsEmpty: 'Clear a wave to earn one.',
    chargesLeft: (left, total) => `Uses left this wave: ${left} / ${total}`,
    chargesLeftRun: (left, total) => `Uses left this run: ${left} / ${total}`,
    bossCore: `Boss core — heals ${BOSS_REGEN} every time you lose a ball`,
    endless: `Endless mode — no last wave. A boss every ${BALANCE.boss.everyWaves} waves.`,
    comboBest: (n) => `Best ${n}`,
    comboUnit: 'hits in a row',
    untilDeadline: 'Until deadline',
    deadlineWarning: 'If a brick reaches the warning line, you lose on the spot.',
    newGame: 'New game',
    confirmRestart: 'This abandons your current run — press again to confirm',
  },

  arcade: {
    score: 'SCORE',
    hiScore: 'HI',
    wave: 'WAVE',
    combo: 'COMBO',
    turn: 'TURN',
    deadline: 'DEADLINE',
    incoming: 'ROWS',
    incomingDone: '--',
    waiting: 'DRAWING…',
    relicsAria: 'Relics held',
    openInfo: 'Details · settings · new game',
    boss: 'BOSS',
    promptLaunchKeyboard: 'PRESS SPACE TO LAUNCH',
    promptLaunchTouch: 'TAP TO LAUNCH · DRAG TO MOVE',
    promptPlaying: '',
    promptResolving: 'BRICKS ADVANCING',
    promptReward: 'CHOOSE A REWARD  1 · 2 · 3',
    promptRewardTouch: 'CHOOSE A REWARD',
    promptGameOver: 'GAME OVER · PRESS R',
    promptGameOverTouch: 'GAME OVER',
    promptVictory: 'YOU WIN',
  },

  hints: {
    move: 'Move',
    launch: 'Launch',
    pickCard: 'Pick a card',
    skip: 'Skip',
    tap: 'Tap',
    drag: 'Drag',
    movePaddle: 'Move paddle',
    pickOrSkip: 'Pick a card · skip',
    keyboardAria: 'Keyboard controls',
    touchAria: 'Touch controls',
    continueOrRetry: 'Continue (endless) or try again',
  },

  reward: {
    aria: 'Wave clear reward',
    title: 'Choose one reward',
    subtitle: 'Balls join your deck. Relics take effect right away.',
    skip: 'Skip — take nothing and go to the next wave',
    typeRelic: 'Relic',
    typeBall: 'New ball',
    relicAlwaysOn: 'Active while held',
    statPierce: 'Pierce',
    statBlast: 'Blast',
    statSplit: (pieces) => `Split ×${pieces}`,
    statChain: (targets) => `Chain ×${targets}`,
    statBounce: 'Floor bounce',
    currentDeck: 'Deck',
    relics: 'Relics',
  },

  result: {
    ariaVictory: 'Victory results',
    ariaGameOver: 'Game over results',
    finalWave: 'Final wave',
    totalScore: 'Total score',
    bestCombo: 'Best combo',
    bricksDestroyed: 'Bricks broken',
    highScore: 'High score',
    previous: (score) => `(was ${score})`,
    bestWave: 'Best wave',
    totalBricks: 'All-time bricks',
    finalDeck: (cards) => `Final deck · ${plural(cards, 'card')}`,
    relics: (n) => `Relics · ${n}`,
    noRelics: 'No relics this run.',
    retryHint: '(Press R or click)',
    continueEndless: 'Continue — endless mode',
    continueHint: '(Enter or click)',
    endlessNote: `Wave ${BALANCE.waves.victoryWave} is cleared and this win is already on your records. Continue and the run goes on with no last wave — every brick keeps getting tougher, and a boss returns every ${BALANCE.boss.everyWaves} waves. How far can you get?`,
  },

  app: {
    rotateHint: ['Turn your phone ', 'sideways', ' and the game gets more than twice as big.'],
    homeScreenHint: ['Share → ', 'Add to Home Screen', ' opens it fullscreen, without the address bar.'],
    infoAria: 'Game info',
    paused: 'Game paused',
    closeInfo: 'Close and resume',
  },
};

const ko: Strings = {
  tagline: '벽돌깨기 × 덱빌딩 로그라이트',
  phase: {
    AIMING: '발사 준비 (클릭하여 발사)',
    PLAYING: '진행 중',
    TURN_RESOLVING: '턴 정산 중',
    REWARD: '보상 선택',
    GAME_OVER: '게임 오버',
    VICTORY: '승리',
  },
  phaseShort: {
    AIMING: '발사 준비',
    PLAYING: '진행 중',
    TURN_RESOLVING: '턴 정산',
    REWARD: '보상 선택',
    GAME_OVER: '게임 오버',
    VICTORY: '승리',
  },

  balls: {
    normal: { name: '기본 구체', description: '평범하지만 믿음직한 한 발.' },
    heavy: { name: '중량 구체', description: `느리지만 벽돌을 ${HEAVY_DAMAGE} 만큼 부순다.` },
    pierce: { name: '관통 구체', description: '벽돌을 뚫고 지나간다. 한 줄을 통째로.' },
    bomb: { name: '폭탄 구체', description: '부순 자리에서 폭발해 주변까지 쓸어버린다.' },
    split: { name: '분열 구체', description: `첫 벽돌에 맞는 순간 ${SPLIT_PIECES}개로 갈라진다.` },
    giant: { name: '거대 구체', description: `크고 무겁다 — 대미지 ${GIANT_DAMAGE}, 굵어서 두 벽돌을 한 번에 때린다.` },
    chain: { name: '연쇄 구체', description: `벽돌을 부술 때마다 가장 가까운 벽돌 ${CHAIN_TARGETS}개에 번개가 튄다.` },
    bouncy: { name: '탄성 구체', description: '턴마다 한 번, 바닥에서 스스로 튕겨 오른다.' },
  },
  relics: {
    'wide-paddle': {
      name: '광폭 패들',
      description: `패들 너비가 ${percent(R.widePaddleWidthMul)}% 넓어진다.`,
    },
    'lucky-charm': {
      name: '행운의 부적',
      description: `벽돌이 아이템을 ${percent(R.luckyCharmDropMul)}% 더 자주 품고, 나쁜 아이템은 ${-percent(R.luckyCharmBadMul)}% 드물어진다.`,
    },
    'iron-core': {
      name: '강철 심',
      description: `기본 구체의 대미지 +${R.ironCoreDamageAdd}.`,
    },
    demolition: {
      name: '철거 장약',
      description: `웨이브당 1회, 처음 부수는 벽돌이 폭발한다 (반경 ${R.demolitionRadius} · 피해 ${R.demolitionDamage}).`,
    },
    anchor: {
      name: '닻',
      description: '웨이브당 1회, 공을 잃어도 벽돌이 내려오지 않는다 — 새 줄도 들어오지 않는다.',
    },
    overcharge: {
      name: '과충전',
      description: `한 턴에 콤보 ${R.overchargeCombo}를 달성하면 날아가는 모든 공의 대미지가 턴이 끝날 때까지 +${R.overchargeDamageAdd}.`,
    },
    phoenix: {
      name: '불사조 깃털',
      description: `한 판에 1회, 벽돌이 데드라인에 닿는 순간 아래 ${R.phoenixRows}줄이 타 없어지고 판이 이어진다.`,
    },
    'flame-trail': {
      name: '화염 도선',
      description: `모든 볼의 이동 속도 +${percent(R.flameTrailSpeedMul)}%, 기본 대미지 +${R.flameTrailDamageAdd}.`,
    },
    'safety-net': {
      name: '비상 안전망',
      description: '웨이브당 1회, 바닥으로 떨어지는 공을 받아 위로 튕겨낸다.',
    },
    'scrap-cycle': {
      name: '재활용 루틴',
      description: `한 턴에 콤보 ${R.scrapCycleCombo}를 달성하면 버린 카드 더미에 폭탄 구체 1장을 만든다. (웨이브 종료 시 소멸)`,
    },
  },
  items: {
    wide: { name: '넓은 패들', description: '이번 턴 동안 패들이 1.5배 넓어진다.' },
    multi: { name: '×3', description: '모든 공이 셋으로 갈라진다.' },
    slow: { name: '느리게', description: '이번 턴 동안 공이 25% 느려진다.' },
    power: { name: '파워', description: '이번 턴 동안 공의 대미지 +1.' },
    shield: { name: '보호막', description: '바닥 보호막이 떨어지는 공을 한 번 튕겨 올린다.' },
    narrow: { name: '좁은 패들', description: '나쁨 — 이번 턴 동안 패들이 60% 로 줄어든다.' },
    fast: { name: '빠르게', description: '나쁨 — 이번 턴 동안 공이 30% 빨라진다.' },
    advance: { name: '하강', description: '나쁨 — 벽돌이 지금 당장 한 줄 내려온다.' },
  },
  itemsTitle: '이번 턴 아이템',
  itemsEmpty: '벽돌 속에 아이템이 숨어 있다 — 떨어지는 캡슐을 패들로 받는다. 효과는 공을 잃을 때까지. 빨간 것은 나쁘다.',
  patterns: {
    full: '기본 진형',
    checker: '체스판',
    'inverted-triangle': '역삼각형',
    shield: '보호막',
    diamond: '다이아몬드',
    columns: '기둥',
    boss: '보스 — 코어',
  },

  common: {
    score: '점수',
    turn: '턴',
    combo: '콤보',
    turns: (n) => `${n}턴`,
    mute: '음소거',
    unmute: '소리 켜기',
    enterFullscreen: '전체 화면',
    exitFullscreen: '전체 화면 끝내기',
    retry: '다시 도전',
  },

  hud: {
    currentWave: '현재 웨이브',
    reinforcementsLeft: (rows) => `증원 ${rows}줄 남음`,
    reinforcementsDone: '증원 끝 — 남은 벽돌만',
    discarded: '버린 카드',
    bricksLeft: '남은 벽돌',
    currentCard: '현재 카드',
    cardsLeft: '남은 카드',
    temporary: '임시',
    waiting: '대기 중…',
    deck: '보유 덱',
    records: '최고 기록',
    recordWave: '웨이브',
    recordBricks: '누적 파괴',
    settings: '설정',
    sound: '사운드',
    soundOn: '🔊 켜짐',
    soundMuted: '🔇 음소거됨',
    paddleControl: '패들 조작',
    paddleControlAria: '패들 조작 방식',
    mouse: '마우스',
    keyboard: '키보드',
    keyboardModeNote:
      '마우스를 움직여도 패들이 따라가지 않습니다. A/D 또는 ←/→ 로 조작하세요. 터치 드래그는 이 설정과 상관없이 항상 동작합니다.',
    display: '화면',
    crt: 'CRT 효과',
    crtOn: '켬',
    crtOff: '끔',
    language: '언어',
    relics: '패시브 유물',
    relicCount: (n) => `${n}개`,
    relicsEmpty: '웨이브를 클리어하면 얻을 수 있습니다.',
    chargesLeft: (left, total) => `이번 웨이브 남은 횟수 ${left} / ${total}`,
    chargesLeftRun: (left, total) => `이번 판 남은 횟수 ${left} / ${total}`,
    bossCore: `보스 코어 — 공을 잃을 때마다 ${BOSS_REGEN} 회복`,
    endless: `무한 모드 — 마지막 웨이브가 없습니다. 보스는 ${BALANCE.boss.everyWaves}웨이브마다.`,
    comboBest: (n) => `최고 ${n}`,
    comboUnit: '연속 타격',
    untilDeadline: '데드라인까지',
    deadlineWarning: '벽돌이 경고선에 닿으면 즉시 패배합니다.',
    newGame: '새 게임',
    confirmRestart: '진행 중인 판을 버립니다 — 한 번 더 누르면 확정',
  },

  arcade: {
    score: '점수',
    hiScore: '최고',
    wave: '웨이브',
    combo: '콤보',
    turn: '턴',
    deadline: '데드라인',
    incoming: '증원',
    incomingDone: '--',
    waiting: '뽑는 중…',
    relicsAria: '보유 유물',
    openInfo: '자세한 정보 · 설정 · 새 게임',
    boss: 'BOSS',
    promptLaunchKeyboard: 'SPACE 로 발사',
    promptLaunchTouch: '탭: 발사 · 드래그: 이동',
    promptPlaying: '',
    promptResolving: '벽돌 전진 중',
    promptReward: '보상을 고르세요  1 · 2 · 3',
    promptRewardTouch: '보상을 고르세요',
    promptGameOver: '게임 오버 · R 로 재도전',
    promptGameOverTouch: '게임 오버',
    promptVictory: '승리!',
  },

  hints: {
    move: '이동',
    launch: '발사',
    pickCard: '카드 선택',
    skip: '스킵',
    tap: '탭',
    drag: '드래그',
    movePaddle: '패들 이동',
    pickOrSkip: '카드 선택 · 스킵',
    keyboardAria: '키보드 조작 가이드',
    touchAria: '터치 조작 가이드',
    continueOrRetry: '계속하기(무한 모드) 또는 재도전',
  },

  reward: {
    aria: '웨이브 클리어 보상',
    title: '보상을 하나 고르세요',
    subtitle: '볼은 덱에 추가되고, 유물은 즉시 효과가 적용됩니다.',
    skip: '스킵 — 아무것도 받지 않고 다음 웨이브로',
    typeRelic: '패시브 유물',
    typeBall: '새로운 볼',
    relicAlwaysOn: '보유하는 동안 계속 적용',
    statPierce: '관통',
    statBlast: '폭발',
    statSplit: (pieces) => `${pieces}분열`,
    statChain: (targets) => `연쇄 ${targets}`,
    statBounce: '바닥 반동',
    currentDeck: '현재 덱',
    relics: '유물',
  },

  result: {
    ariaVictory: '승리 결과',
    ariaGameOver: '게임 오버 결과',
    finalWave: '최종 웨이브',
    totalScore: '총 점수',
    bestCombo: '최장 콤보',
    bricksDestroyed: '파괴한 벽돌',
    highScore: '최고 점수',
    previous: (score) => `(이전 ${score})`,
    bestWave: '최고 웨이브',
    totalBricks: '누적 파괴',
    finalDeck: (cards) => `최종 덱 · ${cards}장`,
    relics: (n) => `유물 · ${n}개`,
    noRelics: '이번 판에서는 유물을 얻지 못했습니다.',
    retryHint: '(R 키 또는 클릭)',
    continueEndless: '계속하기 — 무한 모드',
    continueHint: '(Enter 또는 클릭)',
    endlessNote: `${BALANCE.waves.victoryWave}웨이브를 깼고 이 승리는 이미 기록에 남았습니다. 계속하면 마지막 웨이브 없이 이어집니다 — 벽돌은 계속 단단해지고 보스는 ${BALANCE.boss.everyWaves}웨이브마다 돌아옵니다. 어디까지 갈 수 있을까요?`,
  },

  app: {
    rotateHint: ['폰을 ', '가로로 돌리면', ' 게임 화면이 2배 넘게 커집니다.'],
    homeScreenHint: ['공유 → ', '홈 화면에 추가', '로 실행하면 주소창 없이 전체 화면으로 열립니다.'],
    infoAria: '게임 정보',
    paused: '게임을 일시정지했습니다',
    closeInfo: '닫고 계속하기',
  },
};

export const STRINGS: Record<Language, Strings> = { en, ko };

/** 엔진 데이터(볼 · 유물 · 패턴 이름)의 기본 문구로 쓰는 영어 사전 */
export const EN = en;

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'ko';
}

/** 사전에 없는 유물(나중에 추가된 것)은 유물 자체에 적힌 문구로 대신한다. */
export function relicText(t: Strings, relic: { id: string; name: string; description: string }): NameAndDescription {
  const known = (t.relics as Record<string, NameAndDescription | undefined>)[relic.id];
  return known ?? { name: relic.name, description: relic.description };
}

export function patternName(t: Strings, id: string, fallback: string): string {
  return (t.patterns as Record<string, string | undefined>)[id] ?? fallback;
}
