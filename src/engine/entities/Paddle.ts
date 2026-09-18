import { clamp } from '../Physics';
import type { Rect } from '../Physics';

const KEYBOARD_SPEED = 780; // px/s
const POINTER_SMOOTHING = 24; // 클수록 마우스에 빠르게 붙는다

/** 플레이어가 조작하는 패들. x 는 중심 좌표. */
export class Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 마우스 목표 좌표. 키보드 조작 시 null 로 해제된다. */
  pointerTarget: number | null = null;
  /** 직전 프레임 대비 이동 속도 (px/s) — 스핀 연출용 */
  velocity = 0;

  constructor(x: number, y: number, width = 130, height = 16) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  get rect(): Rect {
    return { x: this.x - this.width / 2, y: this.y, w: this.width, h: this.height };
  }

  /** dir: -1(좌) | 0 | 1(우) */
  update(dt: number, dir: number, bounds: Rect): void {
    const prevX = this.x;

    if (dir !== 0) {
      this.pointerTarget = null; // 키보드 입력이 마우스 추종을 덮어쓴다
      this.x += dir * KEYBOARD_SPEED * dt;
    } else if (this.pointerTarget !== null) {
      const t = 1 - Math.exp(-POINTER_SMOOTHING * dt); // 프레임레이트 독립 보간
      this.x += (this.pointerTarget - this.x) * t;
    }

    const half = this.width / 2;
    this.x = clamp(this.x, bounds.x + half, bounds.x + bounds.w - half);
    this.velocity = dt > 0 ? (this.x - prevX) / dt : 0;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { x, y, w, h } = this.rect;
    const r = h / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(76, 201, 240, 0.7)';
    ctx.shadowBlur = 18;

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#8be9ff');
    grad.addColorStop(1, '#2b7fa8');
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();

    // 중앙 마커: 어디를 맞히면 똑바로 튀는지 알려준다
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillRect(this.x - 1, y + 3, 2, h - 6);
    ctx.restore();
  }
}
