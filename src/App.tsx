import { useCallback, useEffect, useRef, useState } from 'react';
import { SoundManager } from './audio/SoundManager';
import { ArcadeBottomBar, ArcadeTopBar } from './components/ArcadeBar';
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

  const handleCrtChange = useCallback((crt: boolean) => {
    setSettings((prev) => ({ ...prev, crt }));
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
        onItemCaught: (item) => sound.play(item.good ? 'itemGood' : 'itemBad'),
        onChainZap: () => sound.play('zap'),
        onFloorBounce: () => sound.play('floorBounce'),
        onRelicAnnounce: () => sound.play('relic'),
        onBossWave: () => sound.play('bossWave'),
        onBossRegen: () => sound.play('bossRegen'),
        onBossDefeated: () => {
          sound.play('explosion');
          sound.play('bossDown');
        },
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
   * 오락실 캐비닛 레이아웃 — 화면 크기와 상관없이 하나다.
   *   위 줄(점수판) / 게임 화면 / 아래 줄(카드 · 유물 · 안내 · 버튼)
   * 게임 화면은 남은 영역에 들어가는 가장 큰 900:640 이고, 자세한 정보(덱 · 기록 · 설정 · 새 게임)는 ☰ 패널이다.
   * 세로가 모자란 가로 폰에서는 두 줄을 위쪽 한 줄로 합쳐 캔버스에 높이를 더 준다.
   * 예전에는 넓은 화면에서 캔버스 옆에 긴 정보판을 붙였는데, 게임 화면이 창의 절반 남짓이었다.
   */
  const fullscreen = useFullscreen();
  const singleBar = useMediaQuery('(orientation: landscape) and (max-height: 560px)');
  const [infoOpen, setInfoOpen] = useState(false);

  // 정보 패널을 열어 둔 동안 공이 혼자 돌아다니지 않게 멈춘다.
  useEffect(() => {
    engineRef.current?.setPaused(infoOpen);
  }, [infoOpen]);

  const isOver = state.phase === 'GAME_OVER' || state.phase === 'VICTORY';
  // 모달은 aria-modal 을 선언한다 — 그 약속대로 뒤의 HUD 를 실제로 비활성화해야
  // Tab 이나 클릭이 모달 뒤의 "새 게임" 같은 버튼에 닿지 않는다.
  const modalOpen = state.phase === 'REWARD' || (isOver && runEnd !== null);

  const barProps = {
    state,
    records,
    isMuted: settings.isMuted,
    fullscreen,
    onToggleMute: handleToggleMute,
    onOpenInfo: () => setInfoOpen(true),
  };

  // 두 줄 ↔ 한 줄 전환에도 GameCanvas 가 다시 마운트되면 안 된다 (엔진이 새로 만들어져 진행 중인 판이 사라진다).
  // 형제에 key 를 줘서 아래 줄이 사라져도 캔버스의 자리가 밀리지 않게 한다.
  return (
    <StringsContext value={t}>
      <main
        className="fixed inset-0 flex flex-col bg-deck-bg"
        style={{
          // 노치/홈 인디케이터 영역을 피한다 (홈 화면에 추가해 주소창 없이 실행했을 때 특히 필요)
          paddingTop: 'env(safe-area-inset-top)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
        }}
      >
        <ArcadeTopBar key="top" {...barProps} single={singleBar} />

        <div
          key="stage"
          // 크기 컨테이너: 안쪽 상자가 "이 영역에 들어가는 가장 큰 900:640" 이 되도록 cqw/cqh 로 계산한다
          className="flex min-h-0 min-w-0 flex-1 items-center justify-center [container-type:size]"
        >
          <div
            className={`relative rounded-lg shadow-[0_0_0_1px_#1e2a42,0_0_48px_-8px_rgba(76,201,240,0.35)] ${settings.crt ? 'crt-overlay' : ''}`}
            style={{ width: `min(100cqw, calc(100cqh * ${GAME_WIDTH} / ${GAME_HEIGHT}))` }}
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

            {/* 세로로 든 폰: 캔버스 아래가 비므로 가로 회전(과 아이폰의 홈 화면 실행) 안내를 둔다 */}
            <p className="pointer-events-none absolute inset-x-0 top-full mt-3 hidden px-4 text-center text-[11px] leading-relaxed text-slate-500 portrait:block">
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

            {/* 한 줄 모드에는 안내 문구 자리가 없다. 처음 몇 턴 동안만 빈 플레이 필드 위에 얹어 보여준다. */}
            {singleBar && state.phase === 'AIMING' && state.turn.currentTurn <= 3 && (
              <div
                data-testid="overlay-hints"
                className="pointer-events-none absolute inset-x-0 top-[58%] flex justify-center"
              >
                <KeyHints phase={state.phase} isMuted={settings.isMuted} />
              </div>
            )}
          </div>
        </div>

        {!singleBar && <ArcadeBottomBar key="bottom" {...barProps} />}

        {infoOpen && (
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
              <HUD
                state={state}
                records={records}
                settings={settings}
                fullscreen={fullscreen}
                onToggleMute={handleToggleMute}
                onControlModeChange={handleControlModeChange}
                onLanguageChange={handleLanguageChange}
                onCrtChange={handleCrtChange}
                onRestart={() => {
                  handleRestart();
                  setInfoOpen(false);
                }}
                inert={modalOpen}
              />
              <KeyHints phase={state.phase} isMuted={settings.isMuted} />
            </div>
          </div>
        )}
      </main>
    </StringsContext>
  );
}
