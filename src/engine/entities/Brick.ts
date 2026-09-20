import type { Brick as BrickModel, BrickType } from '../../types/game';
import type { ItemId } from '../Items';
import type { Rect } from '../Physics';

interface Tier {
  base: string;
  edge: string;
  glow: string;
  text: string;
}

/**
 * 남은 HP 기준 색 단계.
 * maxHp 가 아니라 "현재 hp" 로 고르기 때문에, 맞을 때마다 색이 한 단계씩 내려간다.
 */
const HP_TIERS: Tier[] = [
  { base: '#3d5a9e', edge: '#8fb4ff', glow: 'rgba(143, 180, 255, 0.40)', text: '#e8f0ff' }, // hp 1
  { base: '#6a4a9e', edge: '#c9a4ff', glow: 'rgba(201, 164, 255, 0.40)', text: '#f3ebff' }, // hp 2
  { base: '#9e4a72', edge: '#ff9fc6', glow: 'rgba(255, 159, 198, 0.42)', text: '#ffeef5' }, // hp 3
  { base: '#9e5a3d', edge: '#ffc48f', glow: 'rgba(255, 196, 143, 0.45)', text: '#fff2e4' }, // hp 4
  { base: '#9e3d3d', edge: '#ff9f9f', glow: 'rgba(255, 159, 159, 0.48)', text: '#ffecec' }, // hp 5+
];

const BOMB_TIER: Tier = {
  base: '#8a3520',
  edge: '#ff9a4d',
  glow: 'rgba(255, 154, 77, 0.55)',
  text: '#fff0e0',
};

const tierFor = (hp: number): Tier => HP_TIERS[Math.min(Math.max(hp, 1), HP_TIERS.length) - 1];

/** maxHp 로 벽돌의 분류를 정한다. */
export const classifyBrick = (maxHp: number): BrickType =>
  maxHp >= 4 ? 'core' : maxHp >= 2 ? 'tough' : 'normal';

let brickSeq = 0;

export class Brick implements BrickModel {
  /** 숨어 있는 아이템. 깨지면 떨어진다 */
  item: ItemId | null;
  readonly id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  isDestroyed = false;
  type: BrickType;
  /** 피격 직후 번쩍이는 연출용 타이머 (초) */
  flash = 0;
  /** 하강 슬라이드 시작/목표 y */
  private slideFromY = 0;
  private slideToY = 0;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    hp: number,
    type?: BrickType,
  ) {
    this.id = brickSeq++;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.hp = hp;
    this.maxHp = hp;
    this.type = type ?? classifyBrick(hp);
    this.item = null;
    // 슬라이드를 한 번도 하지 않은 벽돌도 settledY 가 현재 위치를 가리켜야 한다.
    this.slideFromY = y;
    this.slideToY = y;
  }

  get rect(): Rect {
    return { x: this.x, y: this.y, w: this.width, h: this.height };
  }

  get center(): { x: number; y: number } {
    return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
  }

  get tier(): Tier {
    return this.type === 'bomb' ? BOMB_TIER : tierFor(this.hp);
  }

  get isBomb(): boolean {
    return this.type === 'bomb';
  }

  /** 엔진 바깥(훅/UI)으로 넘길 때 쓰는 순수 데이터 스냅샷 */
  toModel(): BrickModel {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      hp: this.hp,
      maxHp: this.maxHp,
      isDestroyed: this.isDestroyed,
      type: this.type,
      item: this.item,
    };
  }

  /** 데미지를 적용하고 파괴 여부를 돌려준다. */
  hit(damage: number): boolean {
    if (this.isDestroyed) return false;
    this.hp -= damage;
    this.flash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDestroyed = true;
      return true;
    }
    return false;
  }

  update(dt: number): void {
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
  }

  /** dy 만큼 내려가는 슬라이드를 준비한다. */
  /** 즉시 이동 — 슬라이드 없이 자리를 옮기고 정착 위치도 함께 갱신한다 (DOWN 아이템) */
  moveBy(dy: number): void {
    this.y += dy;
    this.slideFromY = this.y;
    this.slideToY = this.y;
  }

  beginSlide(dy: number): void {
    this.slideFromY = this.y;
    this.slideToY = this.y + dy;
  }

  /** t: 0~1. 슬라이드 진행률을 위치에 반영한다. */
  applySlide(t: number): void {
    this.y = this.slideFromY + (this.slideToY - this.slideFromY) * t;
  }

  /** 슬라이드가 끝났을 때의 최종 y (애니메이션 중에도 판정에 쓸 수 있다) */
  get settledY(): number {
    return this.slideToY;
  }

  get bottom(): number {
    return this.y + this.height;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isDestroyed) return;
    const { base, edge, glow, text } = this.tier;
    const { x, y, width: w, height: h } = this;

    ctx.save();

    // 본체
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, edge);
    grad.addColorStop(0.18, base);
    grad.addColorStop(1, base);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.fill();

    // 테두리 (단단할수록 두껍고 밝다)
    ctx.strokeStyle = edge;
    ctx.lineWidth = this.maxHp > 1 ? 2 : 1;
    ctx.stroke();

    if (this.isBomb) {
      // 맥동하는 외곽 글로우 — "이건 터진다"는 신호
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 180);
      ctx.shadowColor = glow;
      ctx.shadowBlur = 10 + 12 * pulse;
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 폭탄 글리프
      const cx = x + w / 2;
      const cy = y + h / 2 + 1;
      ctx.fillStyle = '#1a0d07';
      ctx.beginPath();
      ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = text;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx + 3.5, cy - 5.5);
      ctx.quadraticCurveTo(cx + 8, cy - 10, cx + 5, cy - 12);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 214, 120, ${0.5 + 0.5 * pulse})`;
      ctx.beginPath();
      ctx.arc(cx + 5, cy - 12.5, 2 + pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    // 하단 체력 바 — 남은 비율을 한눈에
    if (!this.isBomb && this.maxHp > 1) {
      const ratio = this.hp / this.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x + 4, y + h - 5, w - 8, 3);
      ctx.fillStyle = edge;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 8;
      ctx.fillRect(x + 4, y + h - 5, (w - 8) * ratio, 3);
      ctx.shadowBlur = 0;

      // 숫자로도 표시
      ctx.fillStyle = text;
      ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(this.hp), x + w / 2, y + h / 2 - 1);
    }

    // 피격 플래시
    if (this.flash > 0) {
      ctx.globalAlpha = (this.flash / 0.12) * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 5);
      ctx.fill();
    }

    ctx.restore();
  }
}
