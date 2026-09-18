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

import { BALL_CARD_DATA } from '../types/game.ts';
import type { Relic, RelicModifiers } from '../types/game.ts';

/** 재활용 루틴이 발동하는 콤보 */
export const SCRAP_CYCLE_COMBO = 5;

export const RELIC_WIDE_PADDLE: Relic = {
  id: 'wide-paddle',
  name: '광폭 패들',
  description: '패들 너비가 20% 넓어진다.',
  icon: '🏓',
  rarity: 'COMMON',
  modifiers: { paddleWidthMul: 1.2 },
};

export const RELIC_FLAME_TRAIL: Relic = {
  id: 'flame-trail',
  name: '화염 도선',
  description: '모든 볼의 이동 속도 +15%, 기본 대미지 +1.',
  icon: '🔥',
  rarity: 'RARE',
  modifiers: { ballSpeedMul: 1.15, ballDamageAdd: 1, emberTrail: true },
};

export const RELIC_SAFETY_NET: Relic = {
  id: 'safety-net',
  name: '비상 안전망',
  description: '웨이브당 1회, 바닥으로 떨어지는 공을 받아 위로 튕겨낸다.',
  icon: '🕸️',
  rarity: 'RARE',
  chargesPerWave: 1,
  onBallFall(ctx) {
    if (!ctx.consumeCharge('safety-net')) return false;
    ctx.announce('SAFETY NET!');
    return true;
  },
};

export const RELIC_SCRAP_CYCLE: Relic = {
  id: 'scrap-cycle',
  name: '재활용 루틴',
  description: `한 턴에 콤보 ${SCRAP_CYCLE_COMBO}를 달성하면 버린 카드 더미에 폭탄 구체 1장을 만든다. (웨이브 종료 시 소멸)`,
  icon: '♻️',
  rarity: 'LEGENDARY',
  onCombo(ctx, before, after) {
    // 폭발로 콤보가 3 → 9 처럼 건너뛸 수 있으므로 "5를 지나쳤는가"로 판정한다.
    // 콤보는 턴이 끝날 때만 0이 되므로 자연히 턴당 1회로 제한된다.
    if (before >= SCRAP_CYCLE_COMBO || after < SCRAP_CYCLE_COMBO) return;
    ctx.addCardToDiscard(BALL_CARD_DATA.bomb, true);
    ctx.announce('+ 폭탄 구체');
  },
};

/** 보상 풀에 등장하는 전체 유물 */
export const RELIC_CATALOG: Relic[] = [
  RELIC_WIDE_PADDLE,
  RELIC_FLAME_TRAIL,
  RELIC_SAFETY_NET,
  RELIC_SCRAP_CYCLE,
];

export interface ResolvedModifiers {
  paddleWidthMul: number;
  ballSpeedMul: number;
  ballDamageAdd: number;
  emberTrail: boolean;
}

/** 보유 유물들의 상시 보정치를 하나로 합친다 (배율은 곱, 가산은 합). */
export function resolveModifiers(relics: Relic[]): ResolvedModifiers {
  const out: ResolvedModifiers = {
    paddleWidthMul: 1,
    ballSpeedMul: 1,
    ballDamageAdd: 0,
    emberTrail: false,
  };
  for (const relic of relics) {
    const m: RelicModifiers | undefined = relic.modifiers;
    if (!m) continue;
    out.paddleWidthMul *= m.paddleWidthMul ?? 1;
    out.ballSpeedMul *= m.ballSpeedMul ?? 1;
    out.ballDamageAdd += m.ballDamageAdd ?? 0;
    out.emberTrail = out.emberTrail || (m.emberTrail ?? false);
  }
  return out;
}
