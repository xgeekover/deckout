/**
 * 화면 흔들림 매니저.
 *
 * GameEngine 의 렌더 파이프라인에서 쓰이지만, 의존성이 없는 순수 로직이라
 * 별도 모듈로 두어 단독으로 실행·검증할 수 있게 했다.
 */

/**
 * 강도(intensity)와 지속시간(duration)으로 관리하는 화면 흔들림.
 * 진행 중인 흔들림보다 약한 요청은 무시해, 작은 연출이 큰 연출을 덮어쓰거나 연장하지 못하게 한다.
 */
export class ScreenShake {
  private intensity = 0;
  private duration = 0;
  private elapsed = 0;
  private x = 0;
  private y = 0;

  shake(intensity: number, durationMs: number): void {
    // 지금 남아 있는 세기보다 약한 요청은 통째로 무시한다.
    //
    // "약하고 동시에 짧을 때만 무시" 같은 조건을 쓰면, 패들 진동(4/150ms)처럼
    // 자주 오는 약한 요청이 폭발(9/250ms)의 elapsed 를 계속 0으로 되돌려
    // 강한 흔들림이 랠리 내내 끝나지 않는다.
    if (intensity <= this.currentAmount()) return;

    this.intensity = intensity;
    this.duration = durationMs / 1000;
    this.elapsed = 0;
  }

  /** 지금 이 순간 남아 있는 흔들림 세기 */
  private currentAmount(): number {
    if (this.duration <= 0) return 0;
    return this.intensity * Math.max(0, 1 - this.elapsed / this.duration);
  }

  update(dt: number): void {
    if (this.duration <= 0) {
      this.x = 0;
      this.y = 0;
      return;
    }

    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.reset();
      return;
    }
    // 남은 시간에 제곱 비례해 감쇠 — 끝이 매끄럽다
    const falloff = 1 - this.elapsed / this.duration;
    const amount = this.intensity * falloff * falloff;
    this.x = (Math.random() - 0.5) * amount;
    this.y = (Math.random() - 0.5) * amount;
  }

  get offset(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  reset(): void {
    this.intensity = 0;
    this.duration = 0;
    this.elapsed = 0;
    this.x = 0;
    this.y = 0;
  }
}
