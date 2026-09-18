import { BALL_STATS } from '../../types/game';
import type { BallType, Vec2 } from '../../types/game';
import type { Circle } from '../Physics';

const TRAIL_LENGTH = 12;

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

  private trail: Vec2[] = [];
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
    this.trail.length = 0;
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

  markHit(brickId: number, seconds = 0.12): void {
    this.hitCooldowns.set(brickId, seconds);
  }

  recordTrail(): void {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > TRAIL_LENGTH) this.trail.shift();
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const stats = BALL_STATS[this.type];

    // 잔상
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const t = (i + 1) / this.trail.length;
      ctx.beginPath();
      ctx.fillStyle = stats.glow;
      ctx.globalAlpha = t * 0.35;
      ctx.arc(p.x, p.y, this.radius * t * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

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
