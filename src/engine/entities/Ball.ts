import { BALANCE } from '../../config/balance';
import { BALL_STATS } from '../../types/game';
import type { BallType, Vec2 } from '../../types/game';
import type { Circle } from '../Physics';

/** 잔상으로 남길 최근 프레임 수 */
const HISTORY_LENGTH = BALANCE.feel.trailLength;

export class Ball {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  radius: number;
  type: BallType;
  damage: number;
  pierce: boolean;
  /** 이 공의 기준 속력 (반사 후 정규화에 사용) */
  baseSpeed: number;
  /** 아직 발사되지 않았으면 패들 위에 붙어 있다 */
  launched = false;
  alive = true;
  /** 이번 낙하에서 유물(안전망 등)에게 이미 구조 기회를 줬는가 */
  fallChecked = false;
  /** 아직 분열하지 않은 분열 구체인가. 분신은 다시 갈라지지 않는다. */
  canSplit: boolean;
  /** 바닥에 닿았을 때 스스로 튕겨 오를 수 있는 남은 횟수 (탄성 구체) */
  floorBounces: number;

  /** 최근 HISTORY_LENGTH 프레임의 위치 큐 (오래된 것이 앞) */
  readonly history: Vec2[] = [];
  /** brickId -> 남은 쿨다운(초). 관통 구체가 한 벽돌을 매 서브스텝 때리는 것을 막는다. */
  private hitCooldowns = new Map<number, number>();

  constructor(x: number, y: number, type: BallType = 'normal') {
    const stats = BALL_STATS[type];
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = stats.radius;
    this.damage = stats.damage;
    this.pierce = stats.pierce;
    this.baseSpeed = stats.speed;
    this.canSplit = (stats.splitCount ?? 0) > 0;
    this.floorBounces = stats.floorBounces ?? 0;
  }

  /**
   * 지금 이 공과 같은 상태(위치·속력·대미지)의 분신을 만든다. 속도 방향은 호출자가 정한다.
   * 방금 때린 벽돌의 쿨다운도 물려준다 — 안 그러면 같은 자리에서 태어난 분신이 그 벽돌을 또 때린다.
   */
  spawnChild(velocity: Vec2): Ball {
    const child = new Ball(this.x, this.y, this.type);
    child.damage = this.damage;
    child.baseSpeed = this.baseSpeed;
    child.launched = true;
    child.canSplit = false;
    child.setVelocity(velocity);
    for (const [id, remaining] of this.hitCooldowns) child.hitCooldowns.set(id, remaining);
    return child;
  }

  get circle(): Circle {
    return { x: this.x, y: this.y, r: this.radius };
  }

  get velocity(): Vec2 {
    return { x: this.vx, y: this.vy };
  }

  setVelocity(v: Vec2): void {
    this.vx = v.x;
    this.vy = v.y;
  }

  /** angleRad: 화면 좌표계 기준 (-PI/2 가 정위쪽) */
  launch(angleRad: number): void {
    this.vx = Math.cos(angleRad) * this.baseSpeed;
    this.vy = Math.sin(angleRad) * this.baseSpeed;
    this.launched = true;
  }

  /**
   * 공이 바닥을 "완전히" 벗어났는가 (지름 전체가 경계 밖).
   * 살짝 걸친 상태에서 턴이 끝나 버리는 것을 막기 위해 radius 를 함께 본다.
   */
  isBelow(bottomY: number): boolean {
    return this.y - this.radius > bottomY;
  }

  /** 패들 중앙 바로 위에 고정 배치하고 발사 대기 상태로 되돌린다. */
  attachTo(paddleX: number, paddleTopY: number, offset = 2): void {
    this.x = paddleX;
    this.y = paddleTopY - this.radius - offset;
    this.vx = 0;
    this.vy = 0;
    this.launched = false;
    this.alive = true;
    this.fallChecked = false;
    this.history.length = 0;
    this.hitCooldowns.clear();
  }

  step(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    for (const [id, remaining] of this.hitCooldowns) {
      const next = remaining - dt;
      if (next <= 0) this.hitCooldowns.delete(id);
      else this.hitCooldowns.set(id, next);
    }
  }

  canHit(brickId: number): boolean {
    return !this.hitCooldowns.has(brickId);
  }

  markHit(brickId: number, seconds: number = BALANCE.ball.brickHitCooldown): void {
    this.hitCooldowns.set(brickId, seconds);
  }

  /** 프레임마다 호출해 현재 위치를 잔상 큐에 넣는다. */
  recordHistory(): void {
    this.history.push({ x: this.x, y: this.y });
    if (this.history.length > HISTORY_LENGTH) this.history.shift();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const stats = BALL_STATS[this.type];

    // 잔상 — 오래된 위치일수록 작고 옅게. 볼 타입별 색을 쓴다.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = stats.trail;
    for (let i = 0; i < this.history.length; i++) {
      const p = this.history[i];
      const t = (i + 1) / this.history.length; // 0(가장 오래됨) ~ 1(가장 최근)
      ctx.globalAlpha = t * t * 0.42;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.radius * (0.25 + t * 0.7), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.shadowColor = stats.glow;
    ctx.shadowBlur = 20;
    const grad = ctx.createRadialGradient(
      this.x - this.radius * 0.35,
      this.y - this.radius * 0.35,
      this.radius * 0.15,
      this.x,
      this.y,
      this.radius,
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, stats.color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
