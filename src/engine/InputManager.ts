/**
 * 입력 어댑터 — DOM 키보드/포인터 이벤트를 게임 명령으로 번역한다.
 *
 * GameEngine 은 여전히 DOM 이벤트를 직접 듣지 않는다. 이 클래스가 그 경계에 서서
 * (1) 키 → 명령 매핑(resolveKey, 순수 함수)과 (2) 실제 리스너 부착을 맡는다.
 * 마우스 없이 키보드만으로 발사 · 보상 선택 · 스킵 · 음소거 · 재시작까지 전부 가능하다.
 */

import { BALANCE } from '../config/balance.ts';
import { GAME_WIDTH } from '../types/game.ts';
import type { GamePhase } from '../types/game.ts';
import type { ControlMode } from '../utils/storage.ts';

export type KeyCommand =
  | { kind: 'move'; dir: -1 | 1 }
  | { kind: 'launch' }
  | { kind: 'selectReward'; index: number }
  | { kind: 'skipReward' }
  | { kind: 'toggleMute' }
  | { kind: 'restart' };

const MOVE_LEFT = new Set(['ArrowLeft', 'a', 'A']);
const MOVE_RIGHT = new Set(['ArrowRight', 'd', 'D']);
const LAUNCH = new Set([' ', 'Spacebar', 'Enter']);
const SKIP = new Set(['0', 's', 'S']);

/**
 * 눌린 키 추적용 정규화. 'a' 를 누른 채 Shift 를 눌렀다 떼면 keyup 이 'A' 로 와서,
 * 대소문자를 구분해 추적하면 'a' 가 영영 눌린 채로 남아 패들이 멈추지 않는다.
 */
export const normalizeKey = (key: string): string => (key.length === 1 ? key.toLowerCase() : key);

/** 공이 필드에 있거나 곧 있을 phase — 이때의 Space/Enter 는 게임의 것이다. */
const isPlayPhase = (phase: GamePhase): boolean =>
  phase === 'AIMING' || phase === 'PLAYING' || phase === 'TURN_RESOLVING';

/**
 * 키 하나를 현재 phase 에 맞는 명령으로 바꾼다. 해당 없으면 null.
 *
 * 같은 키라도 phase 에 따라 의미가 다르다: 1·2·3 과 0/S 는 보상 화면에서만,
 * R 은 종료 화면에서만 받는다(R 은 A/D 바로 옆이라 플레이 중에 받으면 오타로 판이 날아간다).
 * Space/Enter 는 플레이 중에만 가져가고, 모달이 떠 있을 때는 포커스된 버튼의 기본 동작에 맡긴다.
 */
export function resolveKey(key: string, phase: GamePhase): KeyCommand | null {
  if (key === 'm' || key === 'M') return { kind: 'toggleMute' };

  if (phase === 'REWARD') {
    if (key === '1' || key === '2' || key === '3') return { kind: 'selectReward', index: Number(key) - 1 };
    if (SKIP.has(key)) return { kind: 'skipReward' };
    return null;
  }

  if (phase === 'GAME_OVER' || phase === 'VICTORY') {
    if (key === 'r' || key === 'R') return { kind: 'restart' };
    return null;
  }

  if (MOVE_LEFT.has(key)) return { kind: 'move', dir: -1 };
  if (MOVE_RIGHT.has(key)) return { kind: 'move', dir: 1 };
  if (LAUNCH.has(key) && isPlayPhase(phase)) return { kind: 'launch' };
  return null;
}

/**
 * 터치가 "탭"이었는가. 거의 움직이지 않았고 짧게 눌렀을 때만 탭이다.
 * 순수 함수로 빼 둔 것은 경계값을 DOM 없이 검증하기 위해서다.
 */
export function isTap(movedPx: number, heldMs: number): boolean {
  return movedPx <= BALANCE.input.tapMaxMovePx && heldMs <= BALANCE.input.tapMaxMs;
}

/** InputManager 가 조작하는 엔진의 표면. 테스트에서 가짜로 갈아 끼울 수 있다. */
export interface InputEngine {
  readonly phase: GamePhase;
  setPointer(logicalX: number | null): void;
  setKeyDirection(dir: number): void;
  launch(): void;
  restart(): void;
  chooseRewardByIndex(index: number): void;
  skipReward(): void;
}

export interface InputOptions {
  /** 현재 선호 입력 방식. 'keyboard' 면 마우스 이동으로 패들이 끌려가지 않는다. */
  getControlMode(): ControlMode;
  onToggleMute(): void;
  /** 첫 사용자 제스처 — 브라우저 정책상 오디오는 이때 열어야 한다. */
  onUserGesture?(): void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function isButtonLike(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'BUTTON' || target.tagName === 'A' || target.getAttribute('role') === 'button';
}

export class InputManager {
  private canvas: HTMLCanvasElement;
  private engine: InputEngine;
  private options: InputOptions;
  private pressed = new Set<string>();
  private attached = false;
  /** 캔버스에서 시작해 아직 떼지 않은 터치/펜의 pointerId */
  private activeTouchId: number | null = null;
  /** 그 터치가 시작된 위치와 시각, 그리고 시작점에서 가장 멀리 간 거리 — 탭/드래그 판별용 */
  private touchStart = { x: 0, y: 0, time: 0, maxMove: 0 };

  constructor(canvas: HTMLCanvasElement, engine: InputEngine, options: InputOptions) {
    this.canvas = canvas;
    this.engine = engine;
    this.options = options;
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    // 포인터 이동은 캔버스가 아니라 창 전체에서 듣는다 (아래 onPointerMove 주석 참고).
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerEnd);
    window.addEventListener('pointercancel', this.onPointerEnd);
    document.documentElement.addEventListener('pointerleave', this.onPointerExitWindow);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerEnd);
    window.removeEventListener('pointercancel', this.onPointerEnd);
    document.documentElement.removeEventListener('pointerleave', this.onPointerExitWindow);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.activeTouchId = null;
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.pressed.clear();
    this.engine.setKeyDirection(0);
  }

  /** 선호 입력 방식이 바뀌었을 때 호출한다. 키보드 모드로 가면 마우스 추종을 즉시 끊는다. */
  syncControlMode(): void {
    if (this.options.getControlMode() === 'keyboard') this.engine.setPointer(null);
  }

  /* ---------------------------------------------------------------- */

  /** 화면 x 를 필드의 논리 x 로. 캔버스 밖이면 가까운 쪽 벽으로 붙인다. */
  private toLogicalX(clientX: number): number | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return null;
    const x = ((clientX - rect.left) / rect.width) * GAME_WIDTH;
    return Math.min(Math.max(x, 0), GAME_WIDTH);
  }

  /**
   * 창 전체의 pointermove 와, 포인터가 창을 벗어나는 순간(documentElement pointerleave)을 함께 받는다.
   *
   * 예전에는 캔버스에서만 듣고 캔버스를 벗어나면 추종 목표를 null 로 만들었다. 그러면 공을 살리려고
   * 벽 쪽으로 빠르게 휘두른 마우스가 캔버스를 벗어나는 순간 패들이 보간 도중에 멈춰,
   * 벽에서 70~140px(패들 폭 이상) 모자란 채 굳었다. 이제 캔버스 밖에서도 x 를 계속 따라가고,
   * 범위를 벗어난 x 는 벽으로 붙으므로 어떤 속도로 휘둘러도 패들은 끝까지 간다.
   */
  private onPointerMove = (e: PointerEvent): void => {
    // 터치/펜은 "캔버스에서 시작한 드래그"만 따라간다. 창 전체에서 받다 보니, HUD 를 스크롤하려고
    // 댄 손가락까지 패들을 끌고 다니게 된다 (좁은 화면에서는 HUD 가 캔버스 아래에 길게 이어진다).
    if (e.pointerType !== 'mouse') {
      if (e.pointerId !== this.activeTouchId) return;
      const moved = Math.hypot(e.clientX - this.touchStart.x, e.clientY - this.touchStart.y);
      if (moved > this.touchStart.maxMove) this.touchStart.maxMove = moved;
    }
    if (this.ignoresPointerPosition(e)) return;
    this.engine.setPointer(this.toLogicalX(e.clientX));
  };

  /**
   * 마우스가 창 밖으로 나가는 순간. 나간 지점의 x 가 곧 "어느 쪽 벽으로 가던 중이었나"다.
   * 터치에는 쓰지 않는다 — 손가락은 창을 "벗어나며 계속 움직일" 수 없고, 터치 종료 때 오는
   * pointerleave 는 좌표가 (0,0) 으로 올 수 있어 패들을 엉뚱하게 왼쪽 벽으로 보낸다.
   */
  private onPointerExitWindow = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') this.onPointerMove(e);
  };

  private onPointerEnd = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeTouchId) return;
    this.activeTouchId = null;
    // 터치는 손을 "뗄 때" 발사 여부를 정한다: 제자리에서 짧게 톡 친 것만 발사다.
    // 브라우저가 스크롤 등으로 제스처를 가져간 경우(pointercancel)는 발사하지 않는다.
    if (e.type !== 'pointerup') return;
    if (isTap(this.touchStart.maxMove, performance.now() - this.touchStart.time)) this.engine.launch();
  };

  /**
   * '키보드' 모드가 막으려는 것은 "책상 위에 가만히 둔 마우스가 패들을 끌어가는 것"뿐이다.
   * 터치와 펜은 언제나 의도적인 조작이므로 모드와 상관없이 받는다 — 그러지 않으면 키보드가 없는
   * 폰에서 '키보드'를 한 번 탭하는 순간 패들을 움직일 방법이 아예 사라진다(새로고침해도 유지된다).
   */
  private ignoresPointerPosition(e: PointerEvent): boolean {
    return this.options.getControlMode() === 'keyboard' && e.pointerType === 'mouse';
  }

  private onPointerDown = (e: PointerEvent): void => {
    // 마우스는 주 버튼(왼쪽)만 발사로 친다. 우클릭/휠클릭이 공을 쏴 버리면 안 된다.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.options.onUserGesture?.();
    if (!this.ignoresPointerPosition(e)) this.engine.setPointer(this.toLogicalX(e.clientX));

    if (e.pointerType === 'mouse') {
      this.engine.launch();
      return;
    }
    // 터치/펜은 대는 순간 쏘지 않는다. 그러면 패들 위치를 잡으려고 손을 대기만 해도 공이 나가서
    // 조준이라는 게 성립하지 않는다. 드래그는 이동, 탭만 발사 — 판정은 onPointerEnd 에서.
    this.activeTouchId = e.pointerId;
    this.touchStart = { x: e.clientX, y: e.clientY, time: performance.now(), maxMove: 0 };
  };

  /** 게임 화면 위에 브라우저 컨텍스트 메뉴가 뜨지 않게 한다 (트랙패드 두 손가락 클릭 등). */
  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private syncDirection(): void {
    let dir = 0;
    for (const key of this.pressed) {
      if (MOVE_LEFT.has(key)) dir -= 1;
      if (MOVE_RIGHT.has(key)) dir += 1;
    }
    this.engine.setKeyDirection(Math.sign(dir));
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Cmd+R(새로고침), Ctrl+S 같은 브라우저 단축키를 가로채지 않는다.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;
    this.options.onUserGesture?.();

    const phase = this.engine.phase;
    const command = resolveKey(e.key, phase);

    if (!command) {
      // 모달이 떠 있을 때 Space 가 페이지를 스크롤시키는 것만 막는다.
      // 버튼에 포커스가 있으면 기본 동작(버튼 활성화)을 살려 둔다.
      if (e.key === ' ' && !isButtonLike(e.target)) e.preventDefault();
      return;
    }

    if (command.kind === 'move') {
      e.preventDefault();
      this.pressed.add(normalizeKey(e.key));
      this.syncDirection();
      return;
    }

    e.preventDefault();
    if (e.repeat) return; // 누르고 있어도 한 번만 (M 을 누르고 있으면 음소거가 깜빡이는 것 방지)

    switch (command.kind) {
      case 'launch':
        this.engine.launch();
        break;
      case 'selectReward':
        this.engine.chooseRewardByIndex(command.index);
        break;
      case 'skipReward':
        this.engine.skipReward();
        break;
      case 'toggleMute':
        this.options.onToggleMute();
        break;
      case 'restart':
        this.engine.restart();
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (!this.pressed.delete(normalizeKey(e.key))) return;
    this.syncDirection();
  };

  // 탭 전환 등으로 keyup 을 놓치면 패들이 계속 움직이므로 초기화한다.
  private onBlur = (): void => {
    this.pressed.clear();
    this.engine.setKeyDirection(0);
  };
}
