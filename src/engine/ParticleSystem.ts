/**
 * 타격 파티클.
 *
 * 화면 흔들림은 GameEngine 의 ScreenShake 가 담당하고, 여기서는 파티클만 다룬다.
 *
 * 메모리 전략: Particle 은 클래스지만 인스턴스를 고정 풀에 미리 만들어 두고
 * 매 프레임 "살아 있는 구간"만 앞으로 압축(swap-remove)한다.
 * 수명이 다한 객체는 배열에서 즉시 정리되면서도 60fps 로 새 객체를 할당하지 않는다.
 */

/** 파티클 한 개. */
export class Particle {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  size = 2;
  color = '#ffffff';
  life = 0;
  maxLife = 1;
  gravity = 0;
  /** 초당 감속 비율 (0 = 감속 없음, 1에 가까울수록 빨리 멈춤) */
  drag = 0;
  /** 밝게 합성할지 (스파크/폭발은 true, 연기는 false) */
  additive = true;

  get alive(): boolean {
    return this.life > 0;
  }

  /** 남은 수명 비율 0~1 */
  get t(): number {
    return this.maxLife > 0 ? Math.max(0, this.life / this.maxLife) : 0;
  }

  update(dt: number): void {
    this.life -= dt;
    if (this.life <= 0) return;
    this.vy += this.gravity * dt;
    const damping = 1 - Math.min(1, this.drag * dt);
    this.vx *= damping;
    this.vy *= damping;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}

export interface EmitOptions {
  speed?: number;
  speedJitter?: number;
  /** 방출 부채꼴의 폭(라디안). 기본 2π(전방향) */
  spread?: number;
  /** 부채꼴의 중심 방향(라디안) */
  direction?: number;
  gravity?: number;
  drag?: number;
  life?: number;
  size?: number;
  additive?: boolean;
}

const MAX_PARTICLES = 700;

export class ParticleSystem {
  private pool: Particle[] = [];
  /** pool[0 .. activeCount-1] 이 살아 있는 파티클 */
  private activeCount = 0;
  /** 풀이 가득 찼을 때 재활용할 슬롯을 순환시키는 커서 */
  private recycleCursor = 0;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) this.pool.push(new Particle());
  }

  get count(): number {
    return this.activeCount;
  }

  /**
   * 풀에서 슬롯을 하나 얻는다.
   * 가득 찼을 때 항상 같은 슬롯을 돌려주면 한 번의 emit() 안에서 앞선 파티클이
   * 전부 덮어써져 폭발이 1개로 쪼그라든다. 커서를 돌려 서로 다른 슬롯을 재활용한다.
   */
  private acquire(): Particle {
    if (this.activeCount < MAX_PARTICLES) return this.pool[this.activeCount++];
    const p = this.pool[this.recycleCursor];
    this.recycleCursor = (this.recycleCursor + 1) % MAX_PARTICLES;
    return p;
  }

  emit(x: number, y: number, count: number, color: string, options: EmitOptions = {}): void {
    const speed = options.speed ?? 170;
    const jitter = options.speedJitter ?? 0.6;
    const spread = options.spread ?? Math.PI * 2;
    const direction = options.direction ?? 0;
    const gravity = options.gravity ?? 420;
    const drag = options.drag ?? 1.2;
    const life = options.life ?? 0.5;
    const size = options.size ?? 2.2;

    for (let i = 0; i < count; i++) {
      const p = this.acquire();
      const angle = direction + (Math.random() - 0.5) * spread;
      const v = speed * (1 - jitter / 2 + Math.random() * jitter);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = life * (0.7 + Math.random() * 0.6);
      p.life = p.maxLife;
      p.size = size * (0.6 + Math.random() * 0.9);
      p.color = color;
      p.gravity = gravity;
      p.drag = drag;
      p.additive = options.additive ?? true;
    }
  }

  /* ---------------------------------------------------------------- */
  /* 방출 프리셋                                                        */
  /* ---------------------------------------------------------------- */

  /** 벽돌 일반 피격: 타격 지점에서 튀는 작은 스파크 4~6개. */
  sparks(x: number, y: number, color = '#ffffff'): void {
    this.emit(x, y, 4 + Math.floor(Math.random() * 3), color, {
      speed: 210,
      life: 0.26,
      size: 1.7,
      gravity: 260,
      drag: 2.6,
    });
  }

  /** 벽돌 파괴: 벽돌 색 파편 15~20개가 사방으로 폭발하며 서서히 사라진다. */
  debris(x: number, y: number, color: string): void {
    this.emit(x, y, 15 + Math.floor(Math.random() * 6), color, {
      speed: 280,
      speedJitter: 0.9,
      life: 0.62,
      size: 2.8,
      gravity: 640,
      drag: 0.9,
    });
  }

  /** 폭탄 폭발: 화염 + 연기. 30개 이상이 급속 확산한다. */
  explosion(x: number, y: number, radius = 80): void {
    const scale = radius / 80;

    // 화염 코어 — 빠르고 밝게 퍼졌다가 짧게 꺼진다
    this.emit(x, y, 22, '#ffd166', {
      speed: 460 * scale,
      speedJitter: 1.0,
      life: 0.3,
      size: 3.4 * scale,
      gravity: -40,
      drag: 3.4,
    });
    this.emit(x, y, 16, '#ff6b2c', {
      speed: 340 * scale,
      speedJitter: 1.0,
      life: 0.42,
      size: 4.2 * scale,
      gravity: -20,
      drag: 2.6,
    });
    // 연기 — 느리게 위로 떠오르며 오래 남는다 (가산 합성 끄기)
    this.emit(x, y, 14, '#6b4636', {
      speed: 130 * scale,
      speedJitter: 1.2,
      life: 0.95,
      size: 6 * scale,
      gravity: -110,
      drag: 1.5,
      additive: false,
    });
  }

  /** 공이 바닥으로 사라질 때 */
  ballLost(x: number, floorY: number): void {
    this.emit(x, floorY, 16, '#ff6b6b', {
      speed: 240,
      spread: Math.PI,
      direction: -Math.PI / 2,
      life: 0.5,
      gravity: -140,
      drag: 1.6,
    });
  }

  /* ---------------------------------------------------------------- */

  update(dt: number): void {
    for (let i = 0; i < this.activeCount; i++) {
      const p = this.pool[i];
      p.update(dt);
      if (p.alive) continue;

      // 수명이 다한 객체는 마지막 활성 슬롯과 교환해 배열에서 즉시 제외한다.
      const last = this.activeCount - 1;
      this.pool[i] = this.pool[last];
      this.pool[last] = p;
      this.activeCount--;
      i--; // 교환해 온 파티클도 이번 프레임에 갱신해야 한다
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (let i = 0; i < this.activeCount; i++) {
      const p = this.pool[i];
      const t = p.t;
      ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
      ctx.globalAlpha = p.additive ? t : t * 0.45;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.35 + t * 0.65), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  clear(): void {
    for (const p of this.pool) p.life = 0;
    this.activeCount = 0;
    this.recycleCursor = 0;
  }
}
