import { useCallback, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { RewardModal } from './components/RewardModal';
import type { GameEngine } from './engine/GameEngine';
import { createInitialGameState } from './types/game';
import type { GameState } from './types/game';
import type { RunResult } from './components/HUD';

export default function App() {
  const engineRef = useRef<GameEngine | null>(null);
  const [state, setState] = useState<GameState>(createInitialGameState);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);

  const handleEngineReady = useCallback((engine: GameEngine | null) => {
    engineRef.current = engine;
    if (!engine) return;

    // 엔진 게임플레이 이벤트를 React 쪽에 연결하는 지점.
    // 캔버스가 자체 오버레이를 그리므로 여기서는 기록만 남기지만,
    // onGameOver 를 그대로 모달 오픈에 연결해도 된다.
    engine.setHooks({
      onGameOver: (turn, score) => setLastRun({ outcome: 'defeat', turn, score }),
      onVictory: (turn, score) => setLastRun({ outcome: 'victory', turn, score }),
    });
  }, []);

  const handleChooseReward = useCallback((cardId: string) => {
    engineRef.current?.chooseReward(cardId);
  }, []);

  const handleRestart = useCallback(() => {
    engineRef.current?.restart();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 p-4 lg:flex-row lg:items-start lg:p-8">
      <div className="relative flex-1">
        <GameCanvas onEngineReady={handleEngineReady} onStateChange={setState} />

        {state.phase === 'REWARD' && (
          <RewardModal
            wave={state.wave}
            choices={state.rewardChoices}
            onChoose={handleChooseReward}
          />
        )}

      </div>

      <HUD state={state} lastRun={lastRun} onRestart={handleRestart} />
    </main>
  );
}
