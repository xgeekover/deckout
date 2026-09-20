/**
 * 웨이브별 벽돌 배치 패턴과 HP 스케일링. DOM 무의존 순수 모듈.
 * 수치와 공식은 config/balance.ts 에 있다.
 */

import { BALANCE, isBossWave, toughBrickChance, waveHpBonus } from '../config/balance.ts';
import { EN } from '../i18n/strings.ts';
import type { PatternId } from '../i18n/strings.ts';

/** 여러 칸을 차지하는 거대 벽돌(보스 코어)의 자리 — 그리드 칸 단위 */
export interface BossRegion {
  row: number;
  col: number;
  rows: number;
  cols: number;
}

export interface WavePattern {
  id: PatternId;
  /** 영어 이름. 화면에는 id 로 찾은 현재 언어의 이름을 쓴다. */
  name: string;
  /** 이 칸에 벽돌을 놓는가 */
  has(row: number, col: number, rows: number, cols: number): boolean;
  /** 칸별 추가 HP (보호막 행 등) */
  hpBonus?(row: number, col: number, rows: number, cols: number): number;
  /** 보스 코어의 자리. 이 안의 칸은 has() 와 무관하게 비워 두고 코어 하나로 채운다 */
  boss?(rows: number, cols: number): BossRegion;
}

export const FULL: WavePattern = {
  id: 'full',
  name: EN.patterns.full,
  has: () => true,
};

const CHECKER: WavePattern = {
  id: 'checker',
  name: EN.patterns.checker,
  has: (row, col) => (row + col) % 2 === 0,
};

const INVERTED_TRIANGLE: WavePattern = {
  id: 'inverted-triangle',
  name: EN.patterns['inverted-triangle'],
  // 아래로 갈수록 양끝에서 한 칸씩 좁아진다
  has: (row, col, _rows, cols) => col >= row && col <= cols - 1 - row,
};

const SHIELD: WavePattern = {
  id: 'shield',
  name: EN.patterns.shield,
  // 맨 아랫줄이 단단한 보호막, 그 위 한 줄은 비워 둔다
  has: (row, _col, rows) => row !== rows - 2,
  hpBonus: (row, _col, rows) => (row === rows - 1 ? 2 : 0),
};

const DIAMOND: WavePattern = {
  id: 'diamond',
  name: EN.patterns.diamond,
  has: (row, col, rows, cols) =>
    Math.abs(row - (rows - 1) / 2) + Math.abs(col - (cols - 1) / 2) <= Math.max(rows, cols) / 2 - 1,
};

const COLUMNS: WavePattern = {
  id: 'columns',
  name: EN.patterns.columns,
  has: (_row, col) => Math.floor(col / 2) % 2 === 0,
};

/** 그리드 위쪽 중앙에 놓이는 코어 자리. 그리드가 코어보다 작으면 그리드에 맞춰 줄인다 */
export function bossRegion(rows: number, cols: number): BossRegion {
  const size = { rows: Math.min(BALANCE.boss.rows, rows), cols: Math.min(BALANCE.boss.cols, cols) };
  return { row: 0, col: Math.floor((cols - size.cols) / 2), ...size };
}

const inRegion = (r: BossRegion, row: number, col: number): boolean =>
  row >= r.row && row < r.row + r.rows && col >= r.col && col < r.col + r.cols;

/**
 * 보스: 위쪽 중앙의 코어(여러 칸짜리 벽돌 하나) · 코어 아랫줄 양옆의 포탑 · 그 아래 방벽 한 줄 · 나머지는 체스판.
 *
 *   . . [C C C C] . .
 *   T T [C C C C] T T
 *   G G  G G G G  G G
 *   . x . x . x . x
 *   x . x . x . x .
 */
export const BOSS: WavePattern = {
  id: 'boss',
  name: EN.patterns.boss,
  boss: bossRegion,
  has(row, col, rows, cols) {
    const core = bossRegion(rows, cols);
    if (inRegion(core, row, col)) return false;
    if (row < core.row + core.rows - 1) return false; // 코어 옆 윗줄은 비운다
    if (row === core.row + core.rows - 1) return true; // 포탑 줄
    if (row === core.row + core.rows) return true; // 방벽 줄
    return (row + col) % 2 === 0;
  },
  hpBonus(row, _col, rows, cols) {
    const core = bossRegion(rows, cols);
    if (row === core.row + core.rows - 1) return BALANCE.boss.turretHpBonus;
    if (row === core.row + core.rows) return BALANCE.boss.guardHpBonus;
    return 0;
  },
};

/** 2웨이브부터 이 순서로 순환한다 (보스 웨이브는 건너뛴다) */
const ROTATION: WavePattern[] = [CHECKER, INVERTED_TRIANGLE, SHIELD, DIAMOND, COLUMNS];

export const WAVE_PATTERNS: WavePattern[] = [FULL, ...ROTATION, BOSS];

/**
 * 1웨이브는 기본 진형, 보스 웨이브(BALANCE.boss.everyWaves 의 배수)는 보스,
 * 나머지는 보스 웨이브를 빼고 센 순서로 패턴을 순환한다 — 보스가 끼어도 순환이 한 칸 밀리지 않는다.
 */
export function patternForWave(wave: number): WavePattern {
  if (wave <= 1) return FULL;
  if (isBossWave(wave)) return BOSS;
  const every = BALANCE.boss.everyWaves;
  const bossesBefore = every > 1 ? Math.floor((wave - 1) / every) : 0;
  return ROTATION[(wave - 2 - bossesBefore) % ROTATION.length];
}

/**
 * 웨이브에 따른 칸 HP = 행 기본 HP + 웨이브 보너스 + (확률적으로) 단단한 벽돌 +1
 */
export function waveCellHp(wave: number, row: number, rand: () => number = Math.random): number {
  const rowHp = BALANCE.bricks.rowHp;
  const base = rowHp[Math.min(row, rowHp.length - 1)];
  return base + waveHpBonus(wave) + (rand() < toughBrickChance(wave) ? 1 : 0);
}
