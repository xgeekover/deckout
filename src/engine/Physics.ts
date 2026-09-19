/**
 * Deckout - 순수 함수 물리 모듈.
 * DOM/Canvas 에 의존하지 않으므로 단독 테스트가 가능하다.
 */

import { BALANCE } from '../config/balance.ts';
import type { Vec2 } from '../types/game';

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** 좌상단 기준 AABB */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Collision {
  /** 사각형 -> 원 방향의 단위 법선 */
  normal: Vec2;
  /** 겹친 깊이 (>= 0) */
  penetration: number;
  /** 사각형 위의 최근접 접점 */
  contact: Vec2;
  /** 원이 부딪힌 사각형의 면 */
  face: CollisionFace;
}

/** 사각형 기준의 충돌 면. 'top' 은 사각형의 윗면(= 원이 위쪽에서 내려와 맞음). */
export type CollisionFace = 'top' | 'bottom' | 'left' | 'right';

export type WallSide = 'left' | 'right' | 'top';

/** 위치 보정 후 남겨 두는 여유 간격 — 다음 스텝에서 곧바로 재충돌하는 지터를 막는다. */
export const CONTACT_SKIN = 0.01;

/** 법선의 x/y 크기가 이보다 가까우면 모서리 충돌로 보고 진입 속도로 면을 결정한다. */
const CORNER_EPSILON = 0.12;

/** 법선 방향으로부터 충돌 면을 고른다. */
export function faceFromNormal(n: Vec2): CollisionFace {
  if (Math.abs(n.x) > Math.abs(n.y)) return n.x > 0 ? 'right' : 'left';
  return n.y > 0 ? 'bottom' : 'top';
}

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

export const length = (v: Vec2): number => Math.hypot(v.x, v.y);

export function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export const scale = (v: Vec2, s: number): Vec2 => ({ x: v.x * s, y: v.y * s });

/** v 를 angleRad 만큼 회전 (화면 좌표계 — y 가 아래라 양수 각은 시계 방향으로 보인다) */
export function rotate(v: Vec2, angleRad: number): Vec2 {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/** 입사 벡터 v 를 단위 법선 n 에 대해 반사: v - 2(v·n)n */
export function reflect(v: Vec2, n: Vec2): Vec2 {
  const d = 2 * dot(v, n);
  return { x: v.x - d * n.x, y: v.y - d * n.y };
}

/**
 * 원 - 사각형(AABB) 충돌 판정.
 * 겹치지 않으면 null, 겹치면 밀어낼 법선/침투 깊이/접점을 돌려준다.
 */
export function circleVsRect(c: Circle, r: Rect): Collision | null {
  const closestX = clamp(c.x, r.x, r.x + r.w);
  const closestY = clamp(c.y, r.y, r.y + r.h);
  const dx = c.x - closestX;
  const dy = c.y - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq > c.r * c.r) return null;

  // 원의 중심이 사각형 내부에 있는 경우: 최근접점이 중심과 같아 법선을 못 구한다.
  // 각 변까지의 거리 중 최소 축으로 밀어낸다.
  if (distSq === 0) {
    const left = c.x - r.x;
    const right = r.x + r.w - c.x;
    const top = c.y - r.y;
    const bottom = r.y + r.h - c.y;
    const min = Math.min(left, right, top, bottom);

    if (min === left) {
      return {
        normal: { x: -1, y: 0 },
        penetration: c.r + left,
        contact: { x: r.x, y: c.y },
        face: 'left',
      };
    }
    if (min === right) {
      return {
        normal: { x: 1, y: 0 },
        penetration: c.r + right,
        contact: { x: r.x + r.w, y: c.y },
        face: 'right',
      };
    }
    if (min === top) {
      return {
        normal: { x: 0, y: -1 },
        penetration: c.r + top,
        contact: { x: c.x, y: r.y },
        face: 'top',
      };
    }
    return {
      normal: { x: 0, y: 1 },
      penetration: c.r + bottom,
      contact: { x: c.x, y: r.y + r.h },
      face: 'bottom',
    };
  }

  const dist = Math.sqrt(distSq);
  const normal = { x: dx / dist, y: dy / dist };
  return {
    normal,
    penetration: c.r - dist,
    contact: { x: closestX, y: closestY },
    face: faceFromNormal(normal),
  };
}

/**
 * 벽(좌/우/상) 충돌 처리. 위치를 경계 안으로 되돌리고 속도를 반사한다.
 * 바닥은 "턴 종료" 판정이라 여기서 다루지 않는다.
 */
export function resolveWalls(
  c: Circle,
  vel: Vec2,
  bounds: Rect,
): { position: Vec2; velocity: Vec2; hits: WallSide[] } {
  const position = { x: c.x, y: c.y };
  const velocity = { x: vel.x, y: vel.y };
  const hits: WallSide[] = [];

  const minX = bounds.x + c.r;
  const maxX = bounds.x + bounds.w - c.r;
  const minY = bounds.y + c.r;

  if (position.x < minX) {
    position.x = minX;
    if (velocity.x < 0) velocity.x = -velocity.x;
    hits.push('left');
  } else if (position.x > maxX) {
    position.x = maxX;
    if (velocity.x > 0) velocity.x = -velocity.x;
    hits.push('right');
  }

  if (position.y < minY) {
    position.y = minY;
    if (velocity.y < 0) velocity.y = -velocity.y;
    hits.push('top');
  }

  return { position, velocity, hits };
}

/**
 * 원-사각 충돌을 반사로 해소한다.
 * 침투만큼 법선 방향으로 밀어낸 뒤 속도를 반사하고, 속력은 보존한다.
 */
export function resolveCircleRect(
  c: Circle,
  vel: Vec2,
  rect: Rect,
): { position: Vec2; velocity: Vec2; collision: Collision } | null {
  const collision = circleVsRect(c, rect);
  if (!collision) return null;

  const position = {
    x: c.x + collision.normal.x * collision.penetration,
    y: c.y + collision.normal.y * collision.penetration,
  };

  // 이미 빠져나가는 중이면 (법선 방향 속도가 양수) 다시 반사해 달라붙는 것을 막는다.
  const approaching = dot(vel, collision.normal) < 0;
  const velocity = approaching ? reflect(vel, collision.normal) : { x: vel.x, y: vel.y };

  return { position, velocity, collision };
}

export interface BounceResult {
  position: Vec2;
  velocity: Vec2;
  collision: Collision;
  face: CollisionFace;
}

/**
 * 벽돌(AABB) 충돌을 "면 기준"으로 해소한다. 벽돌깨기의 표준적인 처리.
 *
 * 왜 법선 반사(reflect)가 아니라 축 반전인가:
 *  - 모서리에 스칠 때 법선이 대각선이 되어 공이 엉뚱한 각도로 꺾이거나,
 *    보정 → 재충돌 → 보정이 반복되며 벽돌 틈새에서 진동(sticking)한다.
 *  - 그래서 (1) 충돌 면을 먼저 정하고, (2) 공을 그 면 바깥으로 "스냅"시킨 뒤,
 *    (3) 해당 축 속도를 부호까지 강제(-abs/+abs)해 반드시 멀어지게 만든다.
 *    단순 부호 반전이 아니라 abs 강제이므로, 이미 빠져나가는 중이던 공을
 *    다시 안쪽으로 되돌리는 일이 없다 = 끼임이 원천적으로 불가능하다.
 */
export function resolveAABBBounce(
  c: Circle,
  vel: Vec2,
  rect: Rect,
  skin = CONTACT_SKIN,
): BounceResult | null {
  const collision = circleVsRect(c, rect);
  if (!collision) return null;

  // (1) 충돌 면 결정. 법선이 대각선에 가까우면(모서리) 진입 속도의 지배 축으로 판별한다.
  let face = collision.face;
  const ambiguous =
    Math.abs(Math.abs(collision.normal.x) - Math.abs(collision.normal.y)) < CORNER_EPSILON;
  if (ambiguous && (vel.x !== 0 || vel.y !== 0)) {
    face =
      Math.abs(vel.x) > Math.abs(vel.y)
        ? vel.x > 0
          ? 'left'
          : 'right'
        : vel.y > 0
          ? 'top'
          : 'bottom';
  }

  // (2) 위치 보정 — 침투 깊이만큼 밀어내는 대신 면 바깥으로 스냅해 잔여 겹침을 0으로 만든다.
  const position = { x: c.x, y: c.y };
  if (face === 'left') position.x = rect.x - c.r - skin;
  else if (face === 'right') position.x = rect.x + rect.w + c.r + skin;
  else if (face === 'top') position.y = rect.y - c.r - skin;
  else position.y = rect.y + rect.h + c.r + skin;

  // (3) 속도 반전 — 해당 축만, 항상 면에서 멀어지는 부호로.
  const velocity = { x: vel.x, y: vel.y };
  if (face === 'left') velocity.x = -Math.abs(vel.x);
  else if (face === 'right') velocity.x = Math.abs(vel.x);
  else if (face === 'top') velocity.y = -Math.abs(vel.y);
  else velocity.y = Math.abs(vel.y);

  return { position, velocity, collision, face };
}

export interface RectContact {
  /** 입력으로 준 rects 배열에서의 인덱스 */
  index: number;
  result: BounceResult;
}

export interface MultiBounceResult {
  position: Vec2;
  velocity: Vec2;
  /** 이번 스텝에 겹친 모든 사각형 (깊이 내림차순) */
  contacts: RectContact[];
  /** 양쪽에서 동시에 눌려 해당 축으로는 빠져나갈 수 없었던 경우 */
  wedged: boolean;
}

/**
 * 여러 사각형과 동시에 겹친 원을 한 번에 해소한다.
 *
 * 왜 "가장 깊은 하나만" 처리하면 안 되는가:
 *  - 벽돌 두 개 사이 틈에 걸친 공은 매 스텝 번갈아 다른 벽돌이 선택되어
 *    좌 → 우 → 좌 로 스냅되며 제자리 진동(sticking)한다.
 *  - 그래서 축(x/y)별로 최대 한 번씩만 보정하고,
 *    양쪽에서 동시에 눌리는(= 어떤 위치로도 분리 불가능한) 축은 아예 건드리지 않은 채
 *    직교 축으로 탈출시킨다.
 */
export function resolveCircleVsRects(
  c: Circle,
  vel: Vec2,
  rects: Rect[],
  skin = CONTACT_SKIN,
): MultiBounceResult | null {
  const contacts: RectContact[] = [];
  for (let i = 0; i < rects.length; i++) {
    const result = resolveAABBBounce(c, vel, rects[i], skin);
    if (result) contacts.push({ index: i, result });
  }
  if (contacts.length === 0) return null;

  contacts.sort((a, b) => b.result.collision.penetration - a.result.collision.penetration);

  // 축별로 가장 깊은 접촉을 대표로 뽑는다.
  let left: BounceResult | null = null;
  let right: BounceResult | null = null;
  let top: BounceResult | null = null;
  let bottom: BounceResult | null = null;
  for (const { result } of contacts) {
    if (result.face === 'left' && !left) left = result;
    else if (result.face === 'right' && !right) right = result;
    else if (result.face === 'top' && !top) top = result;
    else if (result.face === 'bottom' && !bottom) bottom = result;
  }

  const position = { x: c.x, y: c.y };
  const velocity = { x: vel.x, y: vel.y };

  // 같은 축의 양쪽 면에 동시에 닿았다면 그 축으로는 분리 자체가 불가능하다.
  const wedgedX = left !== null && right !== null;
  const wedgedY = top !== null && bottom !== null;

  if (!wedgedX) {
    const chosen = left ?? right;
    if (chosen) {
      position.x = chosen.position.x;
      velocity.x = chosen.velocity.x;
    }
  }
  if (!wedgedY) {
    const chosen = top ?? bottom;
    if (chosen) {
      position.y = chosen.position.y;
      velocity.y = chosen.velocity.y;
    }
  }

  // 끼인 축이 있는데 직교 축 보정도 없었다면, 직교 축으로 탈출시킨다.
  //
  // 방향은 "가장 가까운 면"이 아니라 "온 길을 되돌아가는 쪽"으로 고른다.
  // 가까운 면을 고르면, 아래에서 틈으로 파고든 공을 위로 밀어내 결국 벽돌 줄을
  // 그대로 통과시켜 버린다(= 관통 구체가 아닌데 관통하는 버그).
  // 진행 방향을 거스르는 쪽으로 되돌리면 어떤 경우에도 통과가 생기지 않는다.
  if (wedgedX && !top && !bottom) {
    const r = rects[contacts[0].index];
    const pushUp = vel.y !== 0 ? vel.y > 0 : c.y - r.y <= r.y + r.h - c.y;
    if (pushUp) {
      position.y = r.y - c.r - skin;
      velocity.y = -Math.abs(vel.y || 1);
    } else {
      position.y = r.y + r.h + c.r + skin;
      velocity.y = Math.abs(vel.y || 1);
    }
  } else if (wedgedY && !left && !right) {
    const r = rects[contacts[0].index];
    const pushLeft = vel.x !== 0 ? vel.x > 0 : c.x - r.x <= r.x + r.w - c.x;
    if (pushLeft) {
      position.x = r.x - c.r - skin;
      velocity.x = -Math.abs(vel.x || 1);
    } else {
      position.x = r.x + r.w + c.r + skin;
      velocity.x = Math.abs(vel.x || 1);
    }
  }

  return { position, velocity, contacts, wedged: wedgedX || wedgedY };
}

/**
 * 패들 반사: 물리적 법선 대신 "맞은 위치"로 각도를 만든다 (클래식 브레이크아웃 감각).
 * offset -1(좌단) ~ +1(우단) 이 -maxAngle ~ +maxAngle 로 매핑되며 항상 위로 튄다.
 */
export function paddleReflect(
  ballX: number,
  paddle: Rect,
  speed: number,
  maxAngleDeg: number = BALANCE.paddle.maxBounceAngleDeg,
): Vec2 {
  const half = paddle.w / 2;
  const center = paddle.x + half;
  const offset = clamp((ballX - center) / half, -1, 1);
  const maxAngle = (maxAngleDeg * Math.PI) / 180;
  // -90도(정위쪽) 기준으로 offset 만큼 좌우로 기울인다.
  const angle = -Math.PI / 2 + offset * maxAngle;
  return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
}

/**
 * 수직 성분이 너무 작으면(거의 수평 이동) 공이 영원히 좌우로만 튀는 교착이 생긴다.
 * 속력을 유지한 채 최소 수직 비율을 보장한다.
 */
export function ensureMinVerticalSpeed(
  v: Vec2,
  minRatio: number = BALANCE.ball.minVerticalRatio,
): Vec2 {
  const speed = Math.hypot(v.x, v.y);
  if (speed === 0) return { x: 0, y: -1 };

  const minVy = speed * minRatio;
  if (Math.abs(v.y) >= minVy) return v;

  const sign = v.y === 0 ? -1 : Math.sign(v.y);
  const vy = minVy * sign;
  const vx = Math.sign(v.x || 1) * Math.sqrt(Math.max(speed * speed - vy * vy, 0));
  return { x: vx, y: vy };
}

/**
 * 수평 성분이 사실상 0이면 공이 패들 정중앙 ↔ 벽돌 사이를 수직으로만 오가며
 * 영원히 떨어지지 않는 교착이 생긴다 (패들이 안 움직이면 offset 도 0 → 계속 수직).
 * 속력을 유지한 채 아주 작은 수평 성분을 보장해 대칭을 깬다.
 *
 * minRatio 를 크게 잡으면 "똑바로 위로 쏘는" 감각이 사라지므로 2% 만 준다.
 * 한 번 튄 뒤 패들 중심에서 벗어나면 offset 반사가 알아서 각을 키운다.
 */
export function ensureMinHorizontalSpeed(
  v: Vec2,
  minRatio: number = BALANCE.ball.minHorizontalRatio,
): Vec2 {
  const speed = Math.hypot(v.x, v.y);
  if (speed === 0) return { x: 0, y: -1 };

  const minVx = speed * minRatio;
  if (Math.abs(v.x) >= minVx) return v;

  // 부호가 없으면(정확히 0) 좌우를 무작위로 정한다.
  const sign = v.x === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(v.x);
  const vx = minVx * sign;
  const vy = Math.sign(v.y || -1) * Math.sqrt(Math.max(speed * speed - vx * vx, 0));
  return { x: vx, y: vy };
}

/** 속력을 target 으로 정규화 (반사 누적 오차로 인한 가속/감속 방지) */
export function withSpeed(v: Vec2, target: number): Vec2 {
  const n = normalize(v);
  return { x: n.x * target, y: n.y * target };
}
