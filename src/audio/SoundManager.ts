/**
 * WebAudio 합성 효과음 — 오디오 파일 없이 오실레이터와 노이즈만으로 만든다.
 *
 * 음소거 설정과 M 키가 실제로 의미를 갖도록 넣은 최소한의 사운드 계층이다.
 * 엔진은 소리를 모른다: App 이 엔진 훅을 받아 여기로 넘겨준다.
 */

export type SoundName =
  | 'launch'
  | 'paddle'
  | 'brickHit'
  | 'brickDestroy'
  | 'explosion'
  | 'ballLost'
  | 'waveClear'
  | 'rewardPick'
  | 'itemGood'
  | 'itemBad'
  | 'zap'
  | 'floorBounce'
  | 'relic'
  | 'bossWave'
  | 'bossRegen'
  | 'bossDown'
  | 'gameOver'
  | 'victory'
  | 'newRecord';

interface Tone {
  type: OscillatorType;
  /** 시작 → 끝 주파수(Hz) */
  from: number;
  to: number;
  /** 길이(초) */
  duration: number;
  gain: number;
  /** 시작 지연(초) — 아르페지오용 */
  delay?: number;
}

const TONES: Record<Exclude<SoundName, 'explosion'>, Tone[]> = {
  launch: [{ type: 'triangle', from: 320, to: 640, duration: 0.12, gain: 0.5 }],
  paddle: [{ type: 'square', from: 220, to: 180, duration: 0.07, gain: 0.35 }],
  brickHit: [{ type: 'square', from: 620, to: 520, duration: 0.05, gain: 0.25 }],
  brickDestroy: [{ type: 'triangle', from: 880, to: 1320, duration: 0.09, gain: 0.4 }],
  ballLost: [{ type: 'sawtooth', from: 300, to: 70, duration: 0.4, gain: 0.4 }],
  waveClear: [
    { type: 'triangle', from: 523, to: 523, duration: 0.12, gain: 0.45 },
    { type: 'triangle', from: 659, to: 659, duration: 0.12, gain: 0.45, delay: 0.1 },
    { type: 'triangle', from: 784, to: 784, duration: 0.2, gain: 0.45, delay: 0.2 },
  ],
  rewardPick: [{ type: 'sine', from: 700, to: 1050, duration: 0.14, gain: 0.4 }],
  // 좋은 아이템: 짧게 두 번 올라가는 삑삑
  itemGood: [
    { type: 'triangle', from: 880, to: 1320, duration: 0.09, gain: 0.35 },
    { type: 'triangle', from: 1100, to: 1760, duration: 0.12, gain: 0.35, delay: 0.09 },
  ],
  // 나쁜 아이템: 아래로 미끄러지는 둔탁한 톱니
  itemBad: [{ type: 'sawtooth', from: 300, to: 90, duration: 0.28, gain: 0.4 }],
  // 연쇄 구체의 번개: 아주 짧고 날카로운 지직
  zap: [
    { type: 'square', from: 2200, to: 700, duration: 0.05, gain: 0.28 },
    { type: 'sawtooth', from: 3000, to: 1100, duration: 0.05, gain: 0.18, delay: 0.02 },
  ],
  // 탄성 구체의 바닥 반동: 통통 튀는 삼각파
  floorBounce: [{ type: 'triangle', from: 240, to: 560, duration: 0.11, gain: 0.42 }],
  // 유물 발동: 두 번 올라가는 맑은 사인
  relic: [
    { type: 'sine', from: 660, to: 990, duration: 0.1, gain: 0.38 },
    { type: 'sine', from: 990, to: 1320, duration: 0.16, gain: 0.38, delay: 0.08 },
  ],
  // 보스 웨이브 예고: 낮게 깔리는 세 박자
  bossWave: [
    { type: 'sawtooth', from: 110, to: 110, duration: 0.22, gain: 0.45 },
    { type: 'sawtooth', from: 82, to: 82, duration: 0.22, gain: 0.45, delay: 0.24 },
    { type: 'square', from: 62, to: 48, duration: 0.55, gain: 0.4, delay: 0.48 },
  ],
  // 보스 회복: 낮은 곳에서 부풀어 오르는 사인
  bossRegen: [{ type: 'sine', from: 160, to: 300, duration: 0.22, gain: 0.35 }],
  // 보스 격파: 상승 아르페지오 (폭발 노이즈는 App 이 따로 겹친다)
  bossDown: [
    { type: 'triangle', from: 392, to: 392, duration: 0.12, gain: 0.45 },
    { type: 'triangle', from: 523, to: 523, duration: 0.12, gain: 0.45, delay: 0.1 },
    { type: 'triangle', from: 659, to: 659, duration: 0.12, gain: 0.45, delay: 0.2 },
    { type: 'triangle', from: 784, to: 1047, duration: 0.4, gain: 0.45, delay: 0.3 },
  ],
  gameOver: [
    { type: 'sawtooth', from: 392, to: 370, duration: 0.22, gain: 0.35 },
    { type: 'sawtooth', from: 311, to: 294, duration: 0.22, gain: 0.35, delay: 0.2 },
    { type: 'sawtooth', from: 233, to: 110, duration: 0.55, gain: 0.35, delay: 0.4 },
  ],
  victory: [
    { type: 'triangle', from: 523, to: 523, duration: 0.14, gain: 0.45 },
    { type: 'triangle', from: 659, to: 659, duration: 0.14, gain: 0.45, delay: 0.12 },
    { type: 'triangle', from: 784, to: 784, duration: 0.14, gain: 0.45, delay: 0.24 },
    { type: 'triangle', from: 1047, to: 1047, duration: 0.4, gain: 0.45, delay: 0.36 },
  ],
  newRecord: [
    { type: 'sine', from: 988, to: 988, duration: 0.1, gain: 0.4 },
    { type: 'sine', from: 1319, to: 1319, duration: 0.3, gain: 0.4, delay: 0.1 },
  ],
};

/** 같은 소리가 이보다 촘촘하게 겹치면 버린다 — 연쇄 폭발에서 수십 개가 한꺼번에 울리는 것 방지 */
const MIN_INTERVAL_SECONDS = 0.035;
const MASTER_GAIN = 0.22;

export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted: boolean;
  private lastPlayed = new Map<SoundName, number>();

  constructor(muted = false) {
    this.muted = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /**
   * 브라우저는 사용자 제스처 없이 오디오를 시작하지 못하게 막는다.
   * 첫 키 입력/클릭 때 호출해 컨텍스트를 만들거나 깨운다.
   */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null; // 오디오를 못 쓰는 환경이면 조용히 포기한다
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) {
      // 뚝 끊기는 클릭음이 나지 않게 짧게 페이드한다.
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, this.ctx.currentTime, 0.015);
    }
  }

  play(name: SoundName): void {
    const ctx = this.ctx;
    const master = this.master;
    if (this.muted || !ctx || !master || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const last = this.lastPlayed.get(name);
    if (last !== undefined && now - last < MIN_INTERVAL_SECONDS) return;
    this.lastPlayed.set(name, now);

    if (name === 'explosion') {
      this.playNoise(ctx, master, now);
      return;
    }
    for (const tone of TONES[name]) this.playTone(ctx, master, now, tone);
  }

  dispose(): void {
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.master = null;
  }

  private playTone(ctx: AudioContext, out: AudioNode, now: number, tone: Tone): void {
    const start = now + (tone.delay ?? 0);
    const end = start + tone.duration;

    const osc = ctx.createOscillator();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(tone.to, 1), end);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(tone.gain, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(end + 0.02);
  }

  /** 폭발: 저역 통과시킨 화이트 노이즈 + 낮게 떨어지는 사인파 */
  private playNoise(ctx: AudioContext, out: AudioNode, now: number): void {
    const duration = 0.38;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(filter).connect(gain).connect(out);
    source.start(now);

    this.playTone(ctx, out, now, { type: 'sine', from: 150, to: 40, duration: 0.32, gain: 0.6 });
  }
}
