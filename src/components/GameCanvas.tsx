import { useEffect, useRef } from 'react';
import { BALANCE } from '../config/balance';
import { GameEngine } from '../engine/GameEngine';
import { InputManager } from '../engine/InputManager';
import { GAME_HEIGHT, GAME_WIDTH } from '../types/game';
import type { GameState } from '../types/game';
import type { ControlMode } from '../utils/storage';

interface GameCanvasProps {
  /** 엔진 인스턴스를 상위로 올려 UI 버튼이 명령을 보낼 수 있게 한다. */
  onEngineReady: (engine: GameEngine | null) => void;
  /** 엔진이 방출하는 상태 스냅샷 (값이 바뀐 프레임에만 호출된다) */
  onStateChange: (state: GameState) => void;
  /** 선호 입력 방식. 'keyboard' 면 마우스 이동으로 패들이 끌려가지 않는다. */
  controlMode: ControlMode;
  onToggleMute: () => void;
  /** 첫 사용자 제스처 (오디오 잠금 해제용) */
  onUserGesture: () => void;
}

/**
 * Canvas DOM 바인딩 전담 컴포넌트.
 * React 상태를 전혀 갖지 않으므로 리렌더가 발생해도 엔진 루프는 영향을 받지 않는다.
 * 입력은 InputManager 가 맡는다 — 여기서는 수명 주기만 관리한다.
 */
export function GameCanvas({
  onEngineReady,
  onStateChange,
  controlMode,
  onToggleMute,
  onUserGesture,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<InputManager | null>(null);

  // 콜백/설정 identity 변화로 엔진이 재생성되지 않도록 ref 에 고정한다.
  const latest = useRef({ onEngineReady, onStateChange, controlMode, onToggleMute, onUserGesture });

  // 렌더 중 ref 를 건드리면 동시성 렌더링에서 안전하지 않으므로 커밋 후에 동기화한다.
  useEffect(() => {
    latest.current = { onEngineReady, onStateChange, controlMode, onToggleMute, onUserGesture };
  });

  // 키보드 모드로 바꾸는 순간 마우스 추종을 끊는다.
  useEffect(() => {
    inputRef.current?.syncControlMode();
  }, [controlMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const engine = new GameEngine(canvas);
    const unsubscribe = engine.subscribe((s) => latest.current.onStateChange(s));
    latest.current.onEngineReady(engine);

    // 개발 빌드에서만 콘솔/자동화 검증용 핸들을 연다. 프로덕션 번들에는 포함되지 않는다.
    const devWindow = window as unknown as { __deckout?: GameEngine };
    if (import.meta.env.DEV) devWindow.__deckout = engine;

    const applySize = () => {
      const cssWidth = wrapper.clientWidth;
      if (cssWidth <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, BALANCE.render.maxDevicePixelRatio);
      engine.resize(cssWidth, (cssWidth * GAME_HEIGHT) / GAME_WIDTH, dpr);
    };
    applySize();

    const observer = new ResizeObserver(applySize);
    observer.observe(wrapper);

    const input = new InputManager(canvas, engine, {
      getControlMode: () => latest.current.controlMode,
      onToggleMute: () => latest.current.onToggleMute(),
      onUserGesture: () => latest.current.onUserGesture(),
    });
    input.attach();
    inputRef.current = input;

    engine.start();

    return () => {
      input.detach();
      inputRef.current = null;
      observer.disconnect();
      unsubscribe();
      if (import.meta.env.DEV && devWindow.__deckout === engine) delete devWindow.__deckout;
      engine.destroy();
      latest.current.onEngineReady(null);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full overflow-hidden rounded-2xl border border-deck-edge bg-black shadow-[0_0_60px_-15px_rgba(76,201,240,0.45)]"
      style={{ aspectRatio: `${GAME_WIDTH} / ${GAME_HEIGHT}` }}
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full ${controlMode === 'mouse' ? 'cursor-none' : ''}`}
      />
    </div>
  );
}
