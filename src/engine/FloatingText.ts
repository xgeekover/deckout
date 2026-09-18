/**
 * 떠오르며 사라지는 텍스트 — 대미지 숫자, BOOM!, 콤보 팝업.
 *
 * 동시에 존재하는 개수가 수십 개 수준이라 파티클처럼 풀링하지 않고
 * 살아 있는 것만 남기는 단순 배열로 관리한다.
 */

export type FloatingKind = 'damage' | 'boom' | 'combo' | 'notice';

const EASE_BACK_C1 = 1.70158;
const EASE_BACK_C3 = EASE_BACK_C1 + 1;

/** 살짝 튀어 올랐다가 제자리로 돌아오는 팝 연출용 */
const easeOutBack = (t: number): number =>
  1 + EASE_BACK_C3 * Math.pow(t - 1, 3) + EASE_BACK_C1 * Math.pow(t - 1, 2);

export class FloatingText {
  x: number;
  y: number;
  vx: number;
  vy: number;
  text: string;
  color: string;
  size: number;
  kind: FloatingKind;
  life: number;
  maxLife: number;

  constructor(
    x: number,
    y: number,
    text: string,
    color: string,
    size: number,
    kind: FloatingKind,
    life: number,
  ) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 26;
    this.vy = kind === 'combo' || kind === 'notice' ? -44 : -76;
    this.text = text;
    this.color = color;
    this.size = size;
    this.kind = kind;
    this.life = life;
    this.maxLife = life;
  }

  get alive(): boolean {
    return this.life > 0;
  }

  update(dt: number): void {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // 위로 떠오르다 서서히 느려진다
    const damping = 1 - Math.min(1, 1.9 * dt);
    this.vx *= damping;
    this.vy *= damping;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const age = this.maxLife - this.life;
    const remain = this.life / this.maxLife;

    // 등장 직후 0.18초 동안 튀어 오르는 스케일 팝
    const popT = Math.min(age / 0.18, 1);
    const pops = this.kind === 'combo' || this.kind === 'notice';
    const pop = pops ? 0.45 + 0.55 * easeOutBack(popT) : 0.8 + 0.2 * popT;
    // 수명의 마지막 45% 구간에서 서서히 사라진다
    const alpha = Math.min(1, remain / 0.45);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y);
    ctx.scale(pop, pop);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${this.kind === 'damage' ? 700 : 800} ${this.size}px ui-sans-serif, system-ui, sans-serif`;

    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(5, 8, 16, 0.85)';
    ctx.strokeText(this.text, 0, 0);

    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.kind === 'damage' ? 6 : 18;
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

/**
 * 동시 표시 상한. 폭탄 연쇄(최대 24회 × 벽돌 15개)면 380개 이상이 한꺼번에 생기는데,
 * 각각이 매 프레임 strokeText + shadowBlur 를 수행하므로 그대로 두면 프레임이 무너진다.
 */
const MAX_ITEMS = 140;

export class FloatingTextSystem {
  private items: FloatingText[] = [];

  /** 상한을 넘으면 가장 오래된 것부터 버린다. */
  private push(item: FloatingText): void {
    if (this.items.length >= MAX_ITEMS) this.items.shift();
    this.items.push(item);
  }

  get count(): number {
    return this.items.length;
  }

  /** 대미지 숫자: -1, -2 … */
  spawnDamage(x: number, y: number, amount: number, color = '#f4f8ff'): void {
    // 연쇄 폭발로 여러 개가 동시에 뜰 때 겹쳐 읽히지 않도록 살짝 흩는다.
    const jitterX = (Math.random() - 0.5) * 18;
    const jitterY = (Math.random() - 0.5) * 12;
    this.push(new FloatingText(x + jitterX, y + jitterY, `-${amount}`, color, 17, 'damage', 0.62));
  }

  /** 폭발 */
  spawnBoom(x: number, y: number): void {
    this.push(new FloatingText(x, y, 'BOOM!', '#ffb066', 30, 'boom', 0.85));
  }

  /** 3타 이상일 때만 띄우는 콤보 팝업 */
  spawnCombo(x: number, y: number, count: number): void {
    // 콤보가 오를수록 커지고 색이 뜨거워진다
    const size = Math.min(26 + count * 1.8, 46);
    const color = count >= 10 ? '#ff7a7a' : count >= 6 ? '#ffb066' : '#f7d558';
    this.push(new FloatingText(x, y, `${count} COMBO!`, color, size, 'combo', 0.95));
  }

  /** 유물 발동 등 시스템 알림 */
  spawnNotice(x: number, y: number, text: string, color = '#7ef0ff'): void {
    this.push(new FloatingText(x, y, text, color, 22, 'notice', 1.1));
  }

  update(dt: number): void {
    let write = 0;
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      item.update(dt);
      if (item.alive) this.items[write++] = item;
    }
    this.items.length = write;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const item of this.items) item.draw(ctx);
  }

  clear(): void {
    this.items.length = 0;
  }
}
