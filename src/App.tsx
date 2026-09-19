import { useCallback, useEffect, useRef, useState } from 'react';
import { SoundManager } from './audio/SoundManager';
import { CompactHUD } from './components/CompactHUD';
import { GameCanvas } from './components/GameCanvas';
import { GameOverModal } from './components/GameOverModal';
import { HUD } from './components/HUD';
import { KeyHints } from './components/KeyHints';
import { RewardModal } from './components/RewardModal';
import { useFullscreen } from './components/useFullscreen';
import { useMediaQuery } from './components/useMediaQuery';
import type { GameEngine } from './engine/GameEngine';
import { STRINGS } from './i18n/strings';
import type { Language } from './i18n/strings';
import { StringsContext } from './i18n/useStrings';
import { GAME_HEIGHT, GAME_WIDTH, createInitialGameState } from './types/game';
import type { GameState, RunSummary } from './types/game';
import {
  RECORDS_KEY,
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

  // 다른 탭에서 기록이 바뀌면 이 탭의 HUD 도 따라간다. (storage 이벤트는 "다른" 탭의 쓰기에만 온다.)
  // 저장 자체는 submitRun 이 매번 저장소를 다시 읽고 쓰므로 탭마다 상태가 낡아도 기록이 깨지지 않는다.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === RECORDS_KEY) setRecords(loadRecords());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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

  const handleLanguageChange = useCallback((language: Language) => {
    setSettings((prev) => ({ ...prev, language }));
  }, []);

  // 문서의 lang 속성도 따라가야 스크린 리더가 맞는 발음으로 읽고, 브라우저의 "번역할까요?"가 엉뚱하게 뜨지 않는다.
  useEffect(() => {
    document.documentElement.lang = settings.language;
  }, [settings.language]);

  const t = STRINGS[settings.language];

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
        onBallSplit: () => sound.play('rewardPick'),
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

  /*
   * 레이아웃은 두 가지다.
   *  - 일반: 캔버스 옆에 전체 HUD (넓은 화면)
   *  - 게임 우선: 캔버스를 화면에 꽉 차게 맞추고 HUD 는 요약 바로 줄인다. 좁거나 낮은 화면(폰·가로로 든 폰)에서
   *    자동으로 쓰이고, 전체 화면에 들어가면 데스크톱에서도 쓰인다.
   * 폰에서 예전 레이아웃은 캔버스를 "폭" 기준으로만 잡고 그 아래에 긴 HUD 를 붙여서, 세로로는 356×253px 로
   * 작았고 가로로 돌리면 캔버스가 화면 높이를 넘어 스크롤이 생겼다.
   */
  const fullscreen = useFullscreen();
  const smallScreen = useMediaQuery('(max-width: 1023px), (max-height: 560px)');
  const immersive = smallScreen || fullscreen.active;
  const [infoOpen, setInfoOpen] = useState(false);
  const showInfo = immersive && infoOpen;

  // 정보 패널을 열어 둔 동안 공이 혼자 돌아다니지 않게 멈춘다.
  useEffect(() => {
    engineRef.current?.setPaused(showInfo);
  }, [showInfo]);

  const isOver = state.phase === 'GAME_OVER' || state.phase === 'VICTORY';
  // 모달은 aria-modal 을 선언한다 — 그 약속대로 뒤의 HUD 를 실제로 비활성화해야
  // Tab 이나 클릭이 모달 뒤의 "새 게임" 같은 버튼에 닿지 않는다.
  const modalOpen = state.phase === 'REWARD' || (isOver && runEnd !== null);

  const hud = (
    <HUD
      state={state}
      records={records}
      settings={settings}
      fullscreen={fullscreen}
      onToggleMute={handleToggleMute}
      onControlModeChange={handleControlModeChange}
      onLanguageChange={handleLanguageChange}
      onRestart={() => {
        handleRestart();
        setInfoOpen(false);
      }}
      inert={modalOpen}
    />
  );

  // 모드가 바뀌어도 GameCanvas 가 다시 마운트되면 안 된다 (엔진이 새로 만들어져 진행 중인 판이 사라진다).
  // 그래서 트리 구조는 두 모드가 같고, 형제에는 key 를 줘서 앞에 요약 HUD 가 끼어들어도 자리가 밀리지 않게 한다.
  return (
    <StringsContext value={t}>
      <main
        className={
          immersive
            ? 'fixed inset-0 flex flex-col bg-deck-bg landscape:flex-row'
            : 'mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 p-4 lg:flex-row lg:items-start lg:p-8'
        }
        style={
          immersive
            ? {
                // 노치/홈 인디케이터 영역을 피한다 (홈 화면에 추가해 주소창 없이 실행했을 때 특히 필요)
                paddingTop: 'env(safe-area-inset-top)',
                paddingRight: 'env(safe-area-inset-right)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                paddingLeft: 'env(safe-area-inset-left)',
              }
            : undefined
        }
      >
        {immersive && (
          <CompactHUD
            key="compact-hud"
            state={state}
            isMuted={settings.isMuted}
            fullscreen={fullscreen}
            onToggleMute={handleToggleMute}
            onOpenInfo={() => setInfoOpen(true)}
          />
        )}

        <div
          key="stage"
          className={
            immersive
              ? // 크기 컨테이너: 안쪽 상자가 "이 영역에 들어가는 가장 큰 900:640" 이 되도록 cqw/cqh 로 계산한다
                'flex min-h-0 min-w-0 flex-1 items-start justify-center [container-type:size] landscape:items-center'
              : 'flex-1'
          }
        >
          <div
            className="relative"
            style={
              immersive
                ? { width: `min(100cqw, calc(100cqh * ${GAME_WIDTH} / ${GAME_HEIGHT}))` }
                : undefined
            }
          >
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

            {/* 게임 우선 화면에는 하단 조작 가이드를 둘 자리가 없다. 처음 몇 턴 동안만 빈 플레이 필드 위에 얹어 보여준다. */}
            {immersive && state.phase === 'AIMING' && state.turn.currentTurn <= 3 && (
              <div
                data-testid="overlay-hints"
                className="pointer-events-none absolute inset-x-0 top-[58%] flex justify-center"
              >
                <KeyHints phase={state.phase} isMuted={settings.isMuted} />
              </div>
            )}

            {immersive && (
              <p className="pointer-events-none absolute inset-x-0 top-full mt-3 px-4 text-center text-[11px] leading-relaxed text-slate-500 landscape:hidden">
                📱 {t.app.rotateHint[0]}
                <b className="text-slate-300">{t.app.rotateHint[1]}</b>
                {t.app.rotateHint[2]}
                {!fullscreen.supported && (
                  <>
                    <br />
                    {t.app.homeScreenHint[0]}
                    <b className="text-slate-300">{t.app.homeScreenHint[1]}</b>
                    {t.app.homeScreenHint[2]}
                  </>
                )}
              </p>
            )}
          </div>

          {!immersive && <KeyHints phase={state.phase} isMuted={settings.isMuted} />}
        </div>

        {!immersive && <div key="hud">{hud}</div>}

        {showInfo && (
          <div
            key="info-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t.app.infoAria}
            className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-deck-bg/97 p-4 backdrop-blur-sm"
          >
            <div className="mx-auto flex w-full max-w-md flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{t.app.paused}</span>
                <button
                  type="button"
                  data-testid="close-info"
                  onClick={() => setInfoOpen(false)}
                  className="rounded-lg border border-deck-accent px-4 py-1.5 text-sm text-deck-accent"
                >
                  {t.app.closeInfo}
                </button>
              </div>
              {hud}
            </div>
          </div>
        )}
      </main>
    </StringsContext>
  );
}
