/**
 * 벽돌 속 아이템. 벽돌이 깨지면 떨어지고, 패들로 받으면 그 자리에서 적용된다.
 * 효과는 **이번 턴**(공을 전부 잃을 때까지)만 간다 — 턴이 끝나면 전부 사라진다.
 * 가끔 나쁜 아이템이 섞여 있어, 떨어지는 것을 무조건 받는 게 능사가 아니다.
 *
 * DOM 무의존 순수 모듈. 수치는 config/balance.ts 에 있다.
 */

import { BALANCE } from '../config/balance.ts';
import type { Rect } from './Physics.ts';

export type ItemId = 'wide' | 'multi' | 'slow' | 'power' | 'shield' | 'narrow' | 'fast' | 'advance';

export interface ItemDef {
  id: ItemId;
  /** 캡슐에 적히는 짧은 영어 라벨 (캔버스 문구는 언어와 무관하게 영어) */
  label: string;
  good: boolean;
  color: string;
  /** 같은 종류(좋은/나쁜) 안에서의 추첨 가중치 */
  weight: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  wide: { id: 'wide', label: 'WIDE', good: true, color: '#4cc9f0', weight: 3 },
  multi: { id: 'multi', label: 'x3', good: true, color: '#ff9de2', weight: 2 },
  slow: { id: 'slow', label: 'SLOW', good: true, color: '#8ad8ff', weight: 2 },
  power: { id: 'power', label: 'PWR', good: true, color: '#ffd98a', weight: 2 },
  shield: { id: 'shield', label: 'SHIELD', good: true, color: '#7ef0a8', weight: 2 },
  narrow: { id: 'narrow', label: 'NARROW', good: false, color: '#ff6b6b', weight: 3 },
  fast: { id: 'fast', label: 'FAST', good: false, color: '#ff8a3d', weight: 3 },
  advance: { id: 'advance', label: 'DOWN', good: false, color: '#e879f9', weight: 2 },
};

export const ITEM_LIST: readonly ItemDef[] = Object.values(ITEMS);

function weightedPick(pool: readonly ItemDef[], r: number): ItemDef {
  const total = pool.reduce((s, d) => s + d.weight, 0);
  let acc = r * total;
  for (const d of pool) {
    acc -= d.weight;
    if (acc < 0) return d;
  }
  return pool[pool.length - 1];
}

/**
 * 새 벽돌에 아이템을 숨길지 정한다. 없으면 null.
 * r1: 드롭 여부, r2: 좋은/나쁜, r3: 종류 — 난수를 밖에서 넣어 결정적으로 검증할 수 있다.
 */
export function rollItem(r1 = Math.random(), r2 = Math.random(), r3 = Math.random()): ItemId | null {
  const { dropChance, badChance } = BALANCE.items;
  if (r1 >= dropChance) return null;
  const pool = ITEM_LIST.filter((d) => d.good !== (r2 < badChance));
  return weightedPick(pool, r3).id;
}

/** 이번 턴 동안 쌓이는 효과. 턴이 끝나면 reset 된다. */
export interface TurnEffects {
  paddleMul: number;
  speedMul: number;
  damageAdd: number;
  /** 바닥 보호막 남은 횟수 */
  shield: number;
  /** 이번 턴에 받은 아이템 (순서대로, UI 표시용) */
  caught: ItemId[];
}

export const freshTurnEffects = (): TurnEffects => ({ paddleMul: 1, speedMul: 1, damageAdd: 0, shield: 0, caught: [] });

/** 떨어지는 아이템 캡슐 */
export class Drop {
  x: number;
  y: number;
  readonly item: ItemDef;
  alive = true;
  /** 살랑거림 위상 */
  private phase: number;
  private readonly baseX: number;

  constructor(x: number, y: number, item: ItemDef) {
    this.x = x;
    this.y = y;
    this.baseX = x;
    this.item = item;
    this.phase = Math.random() * Math.PI * 2;
  }

  step(dt: number): void {
    this.y += BALANCE.items.fallSpeed * dt;
    this.phase += dt * 4;
    this.x = this.baseX + Math.sin(this.phase) * 6;
  }

  get rect(): Rect {
    const { width, height } = BALANCE.items;
    return { x: this.x - width / 2, y: this.y - height / 2, w: width, h: height };
  }

  /** 두 사각형이 겹치는가 */
  static overlaps(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
}
