/**
 * 타격 파티클 + 스크린 셰이크.
 * 파티클은 고정 크기 풀로 관리해 GC 압력을 없앤다.
 */

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

const MAX_PARTICLES = 420;
const TRAUMA_DECAY = 1.8; // 초당 감쇠량
const MAX_SHAKE_PX = 14;

export class ParticleSystem {
  private pool: Particle[] = [];
  private cursor = 0;
  private trauma = 0;
  private shakeTime = 0;
  private shake = { x: 0, y: 0 };

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        color: '#fff',
        gravity: 0,
      });
    }
  }

  /** 충돌 지점에서 방사형으로 파티클을 터뜨린다. */
  burst(
    x: number,
    y: number,
    count: number,
    color: string,
    options: { speed?: number; spread?: number; gravity?: number; life?: number } = {},
  ): void {
    const speed = options.speed ?? 170;
    const spread = options.spread ?? Math.PI * 2;
    const gravity = options.gravity ?? 420;
    const life = options.life ?? 0.5;

    for (let i = 0; i < count; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;

      const angle = (Math.random() - 0.5) * spread + (spread >= Math.PI * 2 ? 0 : -Math.PI / 2);
      const v = speed * (0.45 + Math.random() * 0.75);

      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = life * (0.65 + Math.random() * 0.6);
      p.life = p.maxLife;
      p.size = 1.4 + Math.random() * 2.6;
      p.color = color;
      p.gravity = gravity;
    }
  }

  /** 0~1 사이의 충격량을 누적한다. */
  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, 1.2 * dt); // 공기 저항
    }

    this.shakeTime += dt;
    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY * dt);

    // trauma^2 로 감쇠시켜 작은 충격은 거의 안 흔들리게 한다
    const amount = this.trauma * this.trauma * MAX_SHAKE_PX;
    this.shake.x = Math.sin(this.shakeTime * 61) * amount * (Math.random() * 0.5 + 0.5);
    this.shake.y = Math.cos(this.shakeTime * 47) * amount * (Math.random() * 0.5 + 0.5);
  }

  /** 렌더 직전 ctx.translate 에 적용할 오프셋 */
  get shakeOffset(): { x: number; y: number } {
    return this.shake;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.pool) {
      if (!p.active) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, t);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
    this.trauma = 0;
    this.shake.x = 0;
    this.shake.y = 0;
  }
}
