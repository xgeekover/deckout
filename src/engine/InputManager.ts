/**
 * 입력 어댑터 — DOM 키보드/포인터 이벤트를 게임 명령으로 번역한다.
 *
 * GameEngine 은 여전히 DOM 이벤트를 직접 듣지 않는다. 이 클래스가 그 경계에 서서
 * (1) 키 → 명령 매핑(resolveKey, 순수 함수)과 (2) 실제 리스너 부착을 맡는다.
 * 마우스 없이 키보드만으로 발사 · 보상 선택 · 스킵 · 음소거 · 재시작까지 전부 가능하다.
 */

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

  constructor(canvas: HTMLCanvasElement, engine: InputEngine, options: InputOptions) {
    this.canvas = canvas;
    this.engine = engine;
    this.options = options;
  }

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
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

  private toLogicalX(clientX: number): number | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return null;
    return ((clientX - rect.left) / rect.width) * GAME_WIDTH;
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (this.options.getControlMode() === 'keyboard') return;
    this.engine.setPointer(this.toLogicalX(e.clientX));
  };

  private onPointerLeave = (): void => {
    this.engine.setPointer(null);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.options.onUserGesture?.();
    if (this.options.getControlMode() !== 'keyboard') this.engine.setPointer(this.toLogicalX(e.clientX));
    this.engine.launch();
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
