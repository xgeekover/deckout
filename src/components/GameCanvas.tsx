import { useEffect, useRef } from 'react';
import { GameEngine } from '../engine/GameEngine';
import { GAME_HEIGHT, GAME_WIDTH } from '../types/game';
import type { GameState } from '../types/game';

interface GameCanvasProps {
  /** 엔진 인스턴스를 상위로 올려 UI 버튼이 명령을 보낼 수 있게 한다. */
  onEngineReady: (engine: GameEngine | null) => void;
  /** 엔진이 방출하는 상태 스냅샷 (값이 바뀐 프레임에만 호출된다) */
  onStateChange: (state: GameState) => void;
}

const MOVE_KEYS_LEFT = new Set(['ArrowLeft', 'a', 'A']);
const MOVE_KEYS_RIGHT = new Set(['ArrowRight', 'd', 'D']);

/**
 * Canvas DOM 바인딩 전담 컴포넌트.
 * React 상태를 전혀 갖지 않으므로 리렌더가 발생해도 엔진 루프는 영향을 받지 않는다.
 */
export function GameCanvas({ onEngineReady, onStateChange }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // 콜백 identity 변화로 엔진이 재생성되지 않도록 ref 에 고정한다.
  const readyRef = useRef(onEngineReady);
  const stateRef = useRef(onStateChange);

  // 렌더 중 ref 를 건드리면 동시성 렌더링에서 안전하지 않으므로 커밋 후에 동기화한다.
  useEffect(() => {
    readyRef.current = onEngineReady;
    stateRef.current = onStateChange;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const engine = new GameEngine(canvas);
    const unsubscribe = engine.subscribe((s) => stateRef.current(s));
    readyRef.current(engine);

    // 개발 빌드에서만 콘솔/자동화 검증용 핸들을 연다. 프로덕션 번들에는 포함되지 않는다.
    const devWindow = window as unknown as { __deckout?: GameEngine };
    if (import.meta.env.DEV) devWindow.__deckout = engine;

    const applySize = () => {
      const cssWidth = wrapper.clientWidth;
      if (cssWidth <= 0) return;
      engine.resize(cssWidth, (cssWidth * GAME_HEIGHT) / GAME_WIDTH, window.devicePixelRatio || 1);
    };
    applySize();

    const observer = new ResizeObserver(applySize);
    observer.observe(wrapper);

    /* ---------- 입력: DOM 이벤트를 엔진 API 로 번역만 한다 ---------- */
    const toLogicalX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return null;
      return ((clientX - rect.left) / rect.width) * GAME_WIDTH;
    };

    const onPointerMove = (e: PointerEvent) => engine.setPointer(toLogicalX(e.clientX));
    const onPointerLeave = () => engine.setPointer(null);
    const onPointerDown = (e: PointerEvent) => {
      engine.setPointer(toLogicalX(e.clientX));
      engine.launch();
    };

    const pressed = new Set<string>();
    const syncDirection = () => {
      let dir = 0;
      for (const key of pressed) {
        if (MOVE_KEYS_LEFT.has(key)) dir -= 1;
        if (MOVE_KEYS_RIGHT.has(key)) dir += 1;
      }
      engine.setKeyDirection(Math.sign(dir));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        engine.launch();
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        // R 은 A/D 이동 키 바로 옆이라 플레이 중 오타 한 번으로 판이 날아갈 수 있다.
        // 안내가 뜨는 종료 화면에서만 받고, 그 외의 재시작은 HUD 의 "새 게임" 버튼으로 한다.
        if (engine.phase === 'GAME_OVER' || engine.phase === 'VICTORY') engine.restart();
        return;
      }
      if (!MOVE_KEYS_LEFT.has(e.key) && !MOVE_KEYS_RIGHT.has(e.key)) return;
      e.preventDefault();
      pressed.add(e.key);
      syncDirection();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!pressed.delete(e.key)) return;
      syncDirection();
    };
    // 탭 전환 등으로 keyup 을 놓치면 패들이 계속 움직이므로 초기화한다.
    const onBlur = () => {
      pressed.clear();
      engine.setKeyDirection(0);
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    engine.start();

    return () => {
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      observer.disconnect();
      unsubscribe();
      if (import.meta.env.DEV && devWindow.__deckout === engine) delete devWindow.__deckout;
      engine.destroy();
      readyRef.current(null);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full overflow-hidden rounded-2xl border border-deck-edge bg-black shadow-[0_0_60px_-15px_rgba(76,201,240,0.45)]"
      style={{ aspectRatio: `${GAME_WIDTH} / ${GAME_HEIGHT}` }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-none" />
    </div>
  );
}
