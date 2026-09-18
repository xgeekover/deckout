/**
 * 웨이브별 벽돌 배치 패턴과 HP 스케일링. DOM 무의존 순수 모듈.
 */

export interface WavePattern {
  id: string;
  name: string;
  /** 이 칸에 벽돌을 놓는가 */
  has(row: number, col: number, rows: number, cols: number): boolean;
  /** 칸별 추가 HP (보호막 행 등) */
  hpBonus?(row: number, col: number, rows: number, cols: number): number;
}

export const FULL: WavePattern = {
  id: 'full',
  name: '기본 진형',
  has: () => true,
};

const CHECKER: WavePattern = {
  id: 'checker',
  name: '체스판',
  has: (row, col) => (row + col) % 2 === 0,
};

const INVERTED_TRIANGLE: WavePattern = {
  id: 'inverted-triangle',
  name: '역삼각형',
  // 아래로 갈수록 양끝에서 한 칸씩 좁아진다
  has: (row, col, _rows, cols) => col >= row && col <= cols - 1 - row,
};

const SHIELD: WavePattern = {
  id: 'shield',
  name: '보호막',
  // 맨 아랫줄이 단단한 보호막, 그 위 한 줄은 비워 둔다
  has: (row, _col, rows) => row !== rows - 2,
  hpBonus: (row, _col, rows) => (row === rows - 1 ? 2 : 0),
};

const DIAMOND: WavePattern = {
  id: 'diamond',
  name: '다이아몬드',
  has: (row, col, rows, cols) =>
    Math.abs(row - (rows - 1) / 2) + Math.abs(col - (cols - 1) / 2) <= Math.max(rows, cols) / 2 - 1,
};

const COLUMNS: WavePattern = {
  id: 'columns',
  name: '기둥',
  has: (_row, col) => Math.floor(col / 2) % 2 === 0,
};

/** 2웨이브부터 이 순서로 순환한다 */
const ROTATION: WavePattern[] = [CHECKER, INVERTED_TRIANGLE, SHIELD, DIAMOND, COLUMNS];

export const WAVE_PATTERNS: WavePattern[] = [FULL, ...ROTATION];

/** 1웨이브는 기본 진형, 이후는 패턴을 순환한다. */
export function patternForWave(wave: number): WavePattern {
  if (wave <= 1) return FULL;
  return ROTATION[(wave - 2) % ROTATION.length];
}

/** 행별 기본 HP (0번이 최상단). 위로 갈수록 단단하다. */
export const ROW_HP = [3, 2, 2, 1, 1];

/**
 * 웨이브에 따른 칸 HP.
 *  - 2웨이브마다 전체 +1  → 평균 HP 상승
 *  - 웨이브당 +12%p(최대 60%) 확률로 추가 +1 → 단단한 벽돌 비율 상승
 */
export function waveCellHp(wave: number, row: number, rand: () => number = Math.random): number {
  const base = ROW_HP[Math.min(row, ROW_HP.length - 1)];
  const flat = Math.floor((wave - 1) / 2);
  const toughChance = Math.min(0.12 * (wave - 1), 0.6);
  return base + flat + (rand() < toughChance ? 1 : 0);
}
