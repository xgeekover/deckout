/**
 * 웨이브 클리어 보상 추첨. DOM 무의존 순수 모듈.
 */

import { BALANCE } from '../config/balance.ts';
import { RELIC_CATALOG } from './Relics.ts';
import { BALL_CARD_DATA } from '../types/game.ts';
import type { BallType, Rarity, RewardItem } from '../types/game.ts';

/** 보상으로 나오는 볼과 그 등급 */
const BALL_REWARDS: Array<{ ballType: BallType; rarity: Rarity }> = [
  { ballType: 'normal', rarity: 'COMMON' },
  { ballType: 'heavy', rarity: 'COMMON' },
  { ballType: 'pierce', rarity: 'RARE' },
  { ballType: 'bomb', rarity: 'RARE' },
  { ballType: 'split', rarity: 'RARE' },
];

/** 유니언의 각 멤버에 따로 Omit 을 적용한다 (그냥 Omit 은 공통 키만 남긴다) */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type Candidate = DistributiveOmit<RewardItem, 'id'> & { key: string };

const RARITY_ORDER: Rarity[] = ['COMMON', 'RARE', 'LEGENDARY'];

/**
 * 2단계 추첨: 먼저 등급을 BALANCE.rewards.rarityChance(70/25/5)로 정하고,
 * 그 등급 안에서는 균등하게 고른다. 후보가 없는 등급은 빼고 남은 확률을 비율대로 다시 나눈다.
 *
 * 후보별 가중치로 한 번에 뽑으면 "같은 등급의 후보 수"가 등장 확률을 흔든다
 * (COMMON 이 2개면 COMMON 이 두 배로 자주 나온다). 등급 확률을 스펙 그대로 지키려면 나눠 뽑아야 한다.
 */
export function pickByRarity<T extends { rarity: Rarity }>(pool: T[], rand: () => number): T {
  const chance = BALANCE.rewards.rarityChance;
  const tiers = RARITY_ORDER.filter((r) => pool.some((c) => c.rarity === r));
  const total = tiers.reduce((sum, r) => sum + chance[r], 0);

  let roll = rand() * total;
  let tier = tiers[tiers.length - 1];
  for (const r of tiers) {
    roll -= chance[r];
    if (roll < 0) {
      tier = r;
      break;
    }
  }

  const inTier = pool.filter((c) => c.rarity === tier);
  return inTier[Math.min(Math.floor(rand() * inTier.length), inTier.length - 1)];
}

/**
 * 서로 다른 보상 count 개를 뽑는다.
 *  - 이미 가진 유물은 다시 나오지 않는다.
 *  - 아직 못 가진 유물이 남아 있으면 선택지 중 최소 1개는 유물로 보장한다
 *    (볼만 세 장 나와 유물 시스템이 묻히는 것을 막는다).
 *  - 볼도 최소 1장은 보장한다. 유물만 세 장이 나오면 그 웨이브에는 덱을 키울 방법이
 *    없어져, 덱빌딩 게임의 핵심 선택(덱 성장 vs 패시브)이 사라진다.
 */
export function rollRewards(
  ownedRelicIds: ReadonlySet<string>,
  wave: number,
  count: number = BALANCE.rewards.choices,
  rand: () => number = Math.random,
): RewardItem[] {
  const relics: Candidate[] = RELIC_CATALOG.filter((r) => !ownedRelicIds.has(r.id)).map((relic) => ({
    key: `relic:${relic.id}`,
    type: 'RELIC' as const,
    rarity: relic.rarity,
    relic,
  }));
  const balls: Candidate[] = BALL_REWARDS.map(({ ballType, rarity }) => ({
    key: `ball:${ballType}`,
    type: 'BALL' as const,
    rarity,
    ball: BALL_CARD_DATA[ballType],
  }));

  const picks: Candidate[] = [];
  if (relics.length > 0) {
    const guaranteed = pickByRarity(relics, rand);
    picks.push(guaranteed);
    relics.splice(relics.indexOf(guaranteed), 1);
  }

  if (picks.length < count) {
    const guaranteedBall = pickByRarity(balls, rand);
    picks.push(guaranteedBall);
    balls.splice(balls.indexOf(guaranteedBall), 1);
  }

  const pool = [...relics, ...balls];
  while (picks.length < count && pool.length > 0) {
    const choice = pickByRarity(pool, rand);
    picks.push(choice);
    pool.splice(pool.indexOf(choice), 1);
  }

  // 보장 유물이 항상 첫 칸에 오지 않도록 섞는다 (Fisher-Yates)
  for (let i = picks.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [picks[i], picks[j]] = [picks[j], picks[i]];
  }

  return picks.map(({ key, ...item }, i): RewardItem => ({
    ...item,
    id: `reward-w${wave}-${i}-${key}`,
  }));
}
