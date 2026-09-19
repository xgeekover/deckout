import { useCallback, useEffect, useRef, useState } from 'react';
import { SoundManager } from './audio/SoundManager';
import { GameCanvas } from './components/GameCanvas';
import { GameOverModal } from './components/GameOverModal';
import { HUD } from './components/HUD';
import { KeyHints } from './components/KeyHints';
import { RewardModal } from './components/RewardModal';
import type { GameEngine } from './engine/GameEngine';
import { createInitialGameState } from './types/game';
import type { GameState, RunSummary } from './types/game';
import {
  addBricksDestroyed,
  loadRecords,
  loadSettings,
  saveSettings,
  submitRun,
} from './utils/storage';
import type { ControlMode, RecordUpdate, Records, Settings } from './utils/storage';

interface RunEnd {
  summary: RunSummary;
  update: RecordUpdate;
}

export default function App() {
  const engineRef = useRef<GameEngine | null>(null);
  const [state, setState] = useState<GameState>(createInitialGameState);
  // 저장소는 첫 렌더에서 한 번만 읽는다 (lazy initializer).
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [records, setRecords] = useState<Records>(loadRecords);
  const [runEnd, setRunEnd] = useState<RunEnd | null>(null);

  // 사운드는 렌더와 무관한 장수 객체라 state 의 지연 초기화로 한 번만 만든다.
  // 음소거 여부는 아래 effect 가 설정값과 동기화한다.
  const [sound] = useState(() => new SoundManager());

  useEffect(() => () => sound.dispose(), [sound]);

  // 저장은 effect 에서 한다. setState 의 updater 는 순수해야 하고(React 가 StrictMode 에서
  // 일부러 두 번 부른다), localStorage 쓰기 같은 부수 효과를 그 안에 두면 안 된다.
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // 음소거는 설정(state)이 진실이고, 사운드 객체는 그걸 따라간다.
  useEffect(() => {
    sound.setMuted(settings.isMuted);
  }, [sound, settings.isMuted]);

  const handleToggleMute = useCallback(() => {
    setSettings((prev) => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  const handleControlModeChange = useCallback((mode: ControlMode) => {
    setSettings((prev) => ({ ...prev, controlMode: mode }));
  }, []);

  const handleUserGesture = useCallback(() => sound.unlock(), [sound]);

  const handleEngineReady = useCallback(
    (engine: GameEngine | null) => {
      engineRef.current = engine;
      if (!engine) return;

      /** 끝난 판을 기록에 반영한다. 엔진이 판당 정확히 한 번만 부르므로 중복 집계가 없다. */
      const finishRun = (summary: RunSummary) => {
        const update = submitRun({
          score: summary.score,
          wave: summary.wave,
          bricksDestroyed: summary.bricksDestroyed,
        });
        setRecords(update.records);
        setRunEnd({ summary, update });
        sound.play(summary.outcome === 'victory' ? 'victory' : 'gameOver');
        if (update.isNewHighScore || update.isNewMaxWave) sound.play('newRecord');
      };

      // 엔진은 소리도 저장소도 모른다. 게임플레이 이벤트를 여기서 받아 바깥 계층에 연결한다.
      engine.setHooks({
        onLaunch: () => sound.play('launch'),
        onPaddleHit: () => sound.play('paddle'),
        onBrickHit: () => sound.play('brickHit'),
        onBrickDestroyed: () => sound.play('brickDestroy'),
        onExplosion: () => sound.play('explosion'),
        onBallLost: () => sound.play('ballLost'),
        onWaveClear: () => sound.play('waveClear'),
        onRewardResolved: (picked) => {
          if (picked) sound.play('rewardPick');
        },
        onGameOver: finishRun,
        onVictory: finishRun,
      });
    },
    [sound],
  );

  const handleChooseReward = useCallback((itemId: string) => {
    engineRef.current?.chooseReward(itemId);
  }, []);

  const handleSkipReward = useCallback(() => {
    engineRef.current?.skipReward();
  }, []);

  const handleRestart = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    // 끝난 판은 이미 submitRun 으로 집계됐다. 진행 중인 판을 버리는 경우에만
    // 그동안 파괴한 벽돌을 누적 기록에 더해 준다.
    const summary = engine.getRunSummary();
    if (summary.outcome === 'in-progress' && summary.bricksDestroyed > 0) {
      setRecords(addBricksDestroyed(summary.bricksDestroyed));
    }
    sound.unlock();
    engine.restart();
  }, [sound]);

  const isOver = state.phase === 'GAME_OVER' || state.phase === 'VICTORY';
  // 모달은 aria-modal 을 선언한다 — 그 약속대로 뒤의 HUD 를 실제로 비활성화해야
  // Tab 이나 클릭이 모달 뒤의 "새 게임" 같은 버튼에 닿지 않는다.
  const modalOpen = state.phase === 'REWARD' || (isOver && runEnd !== null);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 p-4 lg:flex-row lg:items-start lg:p-8">
      <div className="flex-1">
        <div className="relative">
          <GameCanvas
            onEngineReady={handleEngineReady}
            onStateChange={setState}
            controlMode={settings.controlMode}
            onToggleMute={handleToggleMute}
            onUserGesture={handleUserGesture}
          />

          {state.phase === 'REWARD' && (
            <RewardModal
              wave={state.wave}
              choices={state.rewardChoices}
              deck={state.deck}
              relics={state.relics}
              onChoose={handleChooseReward}
              onSkip={handleSkipReward}
            />
          )}

          {isOver && runEnd && (
            <GameOverModal summary={runEnd.summary} update={runEnd.update} onRestart={handleRestart} />
          )}
        </div>

        <KeyHints phase={state.phase} isMuted={settings.isMuted} />
      </div>

      <HUD
        state={state}
        records={records}
        settings={settings}
        onToggleMute={handleToggleMute}
        onControlModeChange={handleControlModeChange}
        onRestart={handleRestart}
        inert={modalOpen}
      />
    </main>
  );
}
