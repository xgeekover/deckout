/**
 * 패시브 유물 카탈로그.
 *
 * 유물은 두 가지 방식으로 게임에 개입한다.
 *  - modifiers : 보유하는 것만으로 적용되는 상시 보정치 (패들 너비, 볼 속도 …)
 *  - 훅(on*)   : 특정 순간에 엔진이 호출. RelicContext 로만 엔진에 영향을 준다.
 *
 * 충전 횟수 같은 런타임 상태는 유물 객체가 아니라 엔진이 들고 있다.
 * 여기 있는 객체들은 불변 정의라서 여러 판에 걸쳐 그대로 재사용해도 안전하다.
 */

import { BALANCE } from '../config/balance.ts';
import { EN } from '../i18n/strings.ts';
import { BALL_CARD_DATA } from '../types/game.ts';
import type { BallType, Relic, RelicModifiers } from '../types/game.ts';

/** 재활용 루틴이 발동하는 콤보 */
export const SCRAP_CYCLE_COMBO = BALANCE.relics.scrapCycleCombo;

export const RELIC_WIDE_PADDLE: Relic = {
  id: 'wide-paddle',
  ...EN.relics['wide-paddle'],
  icon: '🏓',
  rarity: 'COMMON',
  modifiers: { paddleWidthMul: BALANCE.relics.widePaddleWidthMul },
};

export const RELIC_FLAME_TRAIL: Relic = {
  id: 'flame-trail',
  ...EN.relics['flame-trail'],
  icon: '🔥',
  rarity: 'RARE',
  modifiers: {
    ballSpeedMul: BALANCE.relics.flameTrailSpeedMul,
    ballDamageAdd: BALANCE.relics.flameTrailDamageAdd,
    emberTrail: true,
  },
};

export const RELIC_SAFETY_NET: Relic = {
  id: 'safety-net',
  ...EN.relics['safety-net'],
  icon: '🕸️',
  rarity: 'RARE',
  chargesPerWave: BALANCE.relics.safetyNetChargesPerWave,
  onBallFall(ctx) {
    if (!ctx.consumeCharge('safety-net')) return false;
    ctx.announce('SAFETY NET!');
    return true;
  },
};

export const RELIC_SCRAP_CYCLE: Relic = {
  id: 'scrap-cycle',
  ...EN.relics['scrap-cycle'],
  icon: '♻️',
  rarity: 'LEGENDARY',
  onCombo(ctx, before, after) {
    // 폭발로 콤보가 3 → 9 처럼 건너뛸 수 있으므로 "5를 지나쳤는가"로 판정한다.
    // 콤보는 턴이 끝날 때만 0이 되므로 자연히 턴당 1회로 제한된다.
    if (before >= SCRAP_CYCLE_COMBO || after < SCRAP_CYCLE_COMBO) return;
    ctx.addCardToDiscard(BALL_CARD_DATA.bomb, true);
    ctx.announce('+ BOMB BALL'); // 캔버스 위의 문구는 언어와 무관하게 영어다 (BOOM! · SAFETY NET! 과 같은 결)
  },
};

export const RELIC_LUCKY_CHARM: Relic = {
  id: 'lucky-charm',
  ...EN.relics['lucky-charm'],
  icon: '🍀',
  rarity: 'COMMON',
  modifiers: {
    itemDropMul: BALANCE.relics.luckyCharmDropMul,
    itemBadMul: BALANCE.relics.luckyCharmBadMul,
  },
};

export const RELIC_IRON_CORE: Relic = {
  id: 'iron-core',
  ...EN.relics['iron-core'],
  icon: '🔩',
  rarity: 'COMMON',
  modifiers: { ballTypeDamageAdd: { normal: BALANCE.relics.ironCoreDamageAdd } },
};

export const RELIC_DEMOLITION: Relic = {
  id: 'demolition',
  ...EN.relics.demolition,
  icon: '💥',
  rarity: 'RARE',
  chargesPerWave: BALANCE.relics.demolitionChargesPerWave,
  onBrickDestroy(ctx, brick) {
    if (!ctx.consumeCharge('demolition')) return;
    ctx.announce('DEMOLITION!');
    ctx.blast(brick.x + brick.width / 2, brick.y + brick.height / 2, BALANCE.relics.demolitionRadius, BALANCE.relics.demolitionDamage);
  },
};

export const RELIC_ANCHOR: Relic = {
  id: 'anchor',
  ...EN.relics.anchor,
  icon: '⚓',
  rarity: 'RARE',
  chargesPerWave: BALANCE.relics.anchorChargesPerWave,
  onDescend(ctx) {
    if (!ctx.consumeCharge('anchor')) return false;
    ctx.announce('ANCHOR!');
    return true;
  },
};

/** 과충전이 발동하는 콤보 */
export const OVERCHARGE_COMBO = BALANCE.relics.overchargeCombo;

export const RELIC_OVERCHARGE: Relic = {
  id: 'overcharge',
  ...EN.relics.overcharge,
  icon: '🔋',
  rarity: 'RARE',
  onCombo(ctx, before, after) {
    // 재활용 루틴과 같은 "지나쳤는가" 판정. 콤보는 턴이 끝날 때만 0이 되므로 턴당 1회.
    if (before >= OVERCHARGE_COMBO || after < OVERCHARGE_COMBO) return;
    ctx.addTurnDamage(BALANCE.relics.overchargeDamageAdd);
    ctx.announce('OVERCHARGE!');
  },
};

export const RELIC_PHOENIX: Relic = {
  id: 'phoenix',
  ...EN.relics.phoenix,
  icon: '🪶',
  rarity: 'LEGENDARY',
  chargesPerRun: BALANCE.relics.phoenixChargesPerRun,
  onDeadline(ctx) {
    if (!ctx.consumeCharge('phoenix')) return false;
    ctx.announce('PHOENIX!');
    return true;
  },
};

/** 보상 풀에 등장하는 전체 유물 */
export const RELIC_CATALOG: Relic[] = [
  RELIC_WIDE_PADDLE,
  RELIC_LUCKY_CHARM,
  RELIC_IRON_CORE,
  RELIC_FLAME_TRAIL,
  RELIC_SAFETY_NET,
  RELIC_DEMOLITION,
  RELIC_ANCHOR,
  RELIC_OVERCHARGE,
  RELIC_SCRAP_CYCLE,
  RELIC_PHOENIX,
];

export interface ResolvedModifiers {
  paddleWidthMul: number;
  ballSpeedMul: number;
  ballDamageAdd: number;
  emberTrail: boolean;
  ballTypeDamageAdd: Partial<Record<BallType, number>>;
  itemDropMul: number;
  itemBadMul: number;
}

/** 보유 유물들의 상시 보정치를 하나로 합친다 (배율은 곱, 가산은 합). */
export function resolveModifiers(relics: Relic[]): ResolvedModifiers {
  const out: ResolvedModifiers = {
    paddleWidthMul: 1,
    ballSpeedMul: 1,
    ballDamageAdd: 0,
    emberTrail: false,
    ballTypeDamageAdd: {},
    itemDropMul: 1,
    itemBadMul: 1,
  };
  for (const relic of relics) {
    const m: RelicModifiers | undefined = relic.modifiers;
    if (!m) continue;
    out.paddleWidthMul *= m.paddleWidthMul ?? 1;
    out.ballSpeedMul *= m.ballSpeedMul ?? 1;
    out.ballDamageAdd += m.ballDamageAdd ?? 0;
    out.emberTrail = out.emberTrail || (m.emberTrail ?? false);
    out.itemDropMul *= m.itemDropMul ?? 1;
    out.itemBadMul *= m.itemBadMul ?? 1;
    for (const [type, add] of Object.entries(m.ballTypeDamageAdd ?? {}) as Array<[BallType, number]>) {
      out.ballTypeDamageAdd[type] = (out.ballTypeDamageAdd[type] ?? 0) + add;
    }
  }
  return out;
}

/** 이 볼 타입의 공이 유물로 얻는 총 대미지 가산 */
export function damageAddFor(mods: ResolvedModifiers, type: BallType): number {
  return mods.ballDamageAdd + (mods.ballTypeDamageAdd[type] ?? 0);
}
