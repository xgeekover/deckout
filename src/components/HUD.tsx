import { useEffect, useState } from 'react';
import { LANGUAGES, LANGUAGE_NAMES, patternName, relicText } from '../i18n/strings';
import type { Language } from '../i18n/strings';
import { useStrings } from '../i18n/useStrings';
import { ITEMS } from '../engine/Items';
import type { ItemId } from '../engine/Items';
import { BALL_STATS } from '../types/game';
import type { BallType, DeckCard, GameState, Rarity, Relic } from '../types/game';
import type { ControlMode, Records, Settings } from '../utils/storage';
import type { FullscreenControl } from './useFullscreen';

interface HUDProps {
  state: GameState;
  records: Records;
  settings: Settings;
  fullscreen: FullscreenControl;
  onToggleMute: () => void;
  onControlModeChange: (mode: ControlMode) => void;
  onLanguageChange: (language: Language) => void;
  onCrtChange: (crt: boolean) => void;
  onRestart: () => void;
  /** 모달이 떠 있는 동안 HUD 전체를 비활성화한다 (포커스·클릭 모두 차단) */
  inert?: boolean;
}

const PHASE_TONE: Record<GameState['phase'], string> = {
  AIMING: 'border-deck-gold/60 text-deck-gold',
  PLAYING: 'border-deck-edge text-slate-300',
  TURN_RESOLVING: 'border-deck-accent/60 text-deck-accent',
  REWARD: 'border-deck-gold/60 text-deck-gold',
  GAME_OVER: 'border-rose-500/60 text-rose-400',
  VICTORY: 'border-emerald-400/60 text-emerald-300',
};

function BallChip({ type, count }: { type: BallType; count: number }) {
  const t = useStrings();
  const stats = BALL_STATS[type];
  return (
    <div className="flex items-center gap-2 rounded-lg border border-deck-edge bg-deck-panel/70 px-2.5 py-1.5">
      <span
        className="size-3 rounded-full"
        style={{ backgroundColor: stats.color, boxShadow: `0 0 10px ${stats.glow}` }}
      />
      <span className="text-xs text-slate-200">{t.balls[type].name}</span>
      <span className="ml-auto text-xs font-semibold tabular-nums text-deck-accent">×{count}</span>
    </div>
  );
}

function countByType(deck: DeckCard[]): Array<[BallType, number]> {
  const map = new Map<BallType, number>();
  for (const card of deck) map.set(card.ballType, (map.get(card.ballType) ?? 0) + 1);
  return [...map.entries()];
}

/** 남은 덱 · 현재 턴 · 데드라인까지 남은 턴 표시 */
export function HUD({
  state,
  records,
  settings,
  fullscreen,
  onToggleMute,
  onControlModeChange,
  onLanguageChange,
  onCrtChange,
  onRestart,
  inert = false,
}: HUDProps) {
  const t = useStrings();
  const current = state.currentCard;
  // 분모는 영구 덱 장수가 아니라 "지금 순환 중인 카드 전체"다.
  // 재활용 루틴이 만든 임시 카드는 deck 에 없어서, deck.length 로 나누면 9 / 5 같은 값이 나온다.
  const cycleTotal = state.drawPileCount + state.discardPileCount + (current ? 1 : 0);

  return (
    <aside
      inert={inert}
      className={`flex w-full flex-col gap-4 transition-opacity lg:w-72 ${inert ? 'opacity-60' : ''}`}
    >
      <header className="rounded-xl border border-deck-edge bg-deck-panel/60 p-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-tight text-deck-accent">DECKOUT</h1>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] ${PHASE_TONE[state.phase]}`}
          >
            {t.phase[state.phase]}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">{t.tagline}</p>
      </header>

      <section className="flex items-center justify-between rounded-xl border border-deck-accent/40 bg-deck-panel/60 px-4 py-3">
        <div className="shrink-0 whitespace-nowrap">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">{t.hud.currentWave}</div>
          <div className="text-xl font-extrabold tracking-tight text-deck-accent">
            Wave {state.wave}
          </div>
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1 text-right">
          {state.wavePattern && (
            <span className="rounded-full border border-deck-edge px-2.5 py-1 text-[11px] text-slate-300">
              {patternName(t, state.wavePatternId, state.wavePattern)}
            </span>
          )}
          {state.boss && (
            <span data-testid="hud-boss" className="text-[11px] tabular-nums text-fuchsia-300">
              {t.hud.bossCore} · {state.boss.hp}/{state.boss.maxHp}
            </span>
          )}
          {state.endless && (
            <span data-testid="hud-endless" className="text-[11px] text-emerald-300">
              {t.hud.endless}
            </span>
          )}
          {/* 새 줄은 웨이브마다 정해진 수만큼만 들어온다. 0 이 되면 남은 벽돌만 치우면 된다. */}
          <span
            data-testid="reinforcements-left"
            className={`text-[11px] tabular-nums ${state.reinforcementsLeft > 0 ? 'text-slate-400' : 'text-emerald-300'}`}
          >
            {state.reinforcementsLeft > 0
              ? t.hud.reinforcementsLeft(state.reinforcementsLeft)
              : t.hud.reinforcementsDone}
          </span>
        </div>
      </section>

      <RelicBar relics={state.relics} charges={state.relicCharges} />

      <section className="rounded-xl border border-deck-edge bg-deck-panel/60 p-4" data-testid="hud-items">
        <span className="text-xs uppercase tracking-wider text-slate-400">{t.itemsTitle}</span>
        {state.turnEffects.length === 0 ? (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{t.itemsEmpty}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {state.turnEffects.map((id, i) => {
              const def = ITEMS[id as ItemId];
              return (
                <li key={`${id}-${i}`} className="flex items-baseline gap-2 text-xs">
                  <b className={def?.good === false ? 'text-rose-400' : 'text-emerald-300'}>{t.items[id]?.name ?? id}</b>
                  <span className="text-slate-400">{t.items[id]?.description}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Stat label={t.hud.discarded} value={state.discardPileCount} />
        <Stat label={t.common.turn} value={state.turn.currentTurn} />
        <Stat label={t.common.score} value={state.score.toLocaleString()} />
        <Stat label={t.hud.bricksLeft} value={state.bricksRemaining} />
      </section>

      <ComboMeter combo={state.combo} best={state.bestCombo} />

      <DeadlineMeter turns={state.turnsUntilDeadline} />

      <section className="rounded-xl border border-deck-edge bg-deck-panel/60 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-slate-400">{t.hud.currentCard}</span>
          <span className="text-xs text-slate-400">
            {t.hud.cardsLeft} <b className="tabular-nums text-deck-gold">{state.drawPileCount}</b> /{' '}
            {cycleTotal}
          </span>
        </div>
        {current ? (
          <div
            className="rounded-lg border p-3"
            style={{
              borderColor: BALL_STATS[current.ballType].color,
              boxShadow: `inset 0 0 22px ${BALL_STATS[current.ballType].glow}`,
            }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              {t.balls[current.ballType].name}
              {current.temporary && (
                <span className="rounded-full border border-fuchsia-400/60 px-1.5 text-[9px] font-medium text-fuchsia-200">
                  {t.hud.temporary}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {t.balls[current.ballType].description}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">
            {t.hud.waiting}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-deck-edge bg-deck-panel/60 p-4">
        <span className="text-xs uppercase tracking-wider text-slate-400">{t.hud.deck}</span>
        <div className="mt-2 flex flex-col gap-1.5">
          {countByType(state.deck).map(([type, count]) => (
            <BallChip key={type} type={type} count={count} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-deck-edge bg-deck-panel/60 p-4">
        <span className="text-xs uppercase tracking-wider text-slate-400">{t.hud.records}</span>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
          <RecordCell label={t.common.score} value={records.highScore.toLocaleString()} testId="record-high-score" />
          <RecordCell label={t.hud.recordWave} value={records.maxWave > 0 ? `${records.maxWave}` : '—'} testId="record-max-wave" />
          <RecordCell label={t.hud.recordBricks} value={records.totalBricksDestroyed.toLocaleString()} testId="record-total-bricks" />
        </dl>
      </section>

      <section className="rounded-xl border border-deck-edge bg-deck-panel/60 p-4">
        <span className="text-xs uppercase tracking-wider text-slate-400">{t.hud.settings}</span>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-300">{t.hud.sound}</span>
          <button
            type="button"
            aria-pressed={settings.isMuted}
            data-testid="mute-toggle"
            onClick={(e) => {
              onToggleMute();
              e.currentTarget.blur(); // 포커스가 남으면 Space 가 발사 대신 이 버튼을 누른다
            }}
            className={`rounded-lg border px-3 py-1 text-xs transition ${
              settings.isMuted
                ? 'border-slate-600 text-slate-500'
                : 'border-deck-accent/60 text-deck-accent'
            }`}
          >
            {settings.isMuted ? t.hud.soundMuted : t.hud.soundOn}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-300">{t.hud.paddleControl}</span>
          <div role="radiogroup" aria-label={t.hud.paddleControlAria} className="flex overflow-hidden rounded-lg border border-deck-edge">
            {(['mouse', 'keyboard'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={settings.controlMode === mode}
                data-testid={`control-${mode}`}
                onClick={(e) => {
                  onControlModeChange(mode);
                  e.currentTarget.blur();
                }}
                className={`px-3 py-1 text-xs transition ${
                  settings.controlMode === mode
                    ? 'bg-deck-accent/20 text-deck-accent'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {mode === 'mouse' ? t.hud.mouse : t.hud.keyboard}
              </button>
            ))}
          </div>
        </div>
        {fullscreen.supported && (
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-300">{t.hud.display}</span>
            <button
              type="button"
              aria-pressed={fullscreen.active}
              data-testid="hud-fullscreen"
              onClick={(e) => {
                fullscreen.toggle();
                e.currentTarget.blur();
              }}
              className="rounded-lg border border-deck-edge px-3 py-1 text-xs text-slate-300 transition hover:border-deck-accent hover:text-deck-accent"
            >
              {fullscreen.active ? `🗗 ${t.common.exitFullscreen}` : `⛶ ${t.common.enterFullscreen}`}
            </button>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-300">{t.hud.crt}</span>
          <button
            type="button"
            aria-pressed={settings.crt}
            data-testid="crt-toggle"
            onClick={(e) => {
              onCrtChange(!settings.crt);
              e.currentTarget.blur();
            }}
            className={`rounded-lg border px-3 py-1 text-xs transition ${
              settings.crt ? 'border-deck-accent/60 text-deck-accent' : 'border-slate-600 text-slate-500'
            }`}
          >
            {settings.crt ? t.hud.crtOn : t.hud.crtOff}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-300">{t.hud.language}</span>
          <div role="radiogroup" aria-label={t.hud.language} className="flex overflow-hidden rounded-lg border border-deck-edge">
            {LANGUAGES.map((language) => (
              <button
                key={language}
                type="button"
                role="radio"
                lang={language}
                aria-checked={settings.language === language}
                data-testid={`language-${language}`}
                onClick={(e) => {
                  onLanguageChange(language);
                  e.currentTarget.blur();
                }}
                className={`px-3 py-1 text-xs transition ${
                  settings.language === language
                    ? 'bg-deck-accent/20 text-deck-accent'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {LANGUAGE_NAMES[language]}
              </button>
            ))}
          </div>
        </div>
        {settings.controlMode === 'keyboard' && (
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{t.hud.keyboardModeNote}</p>
        )}
      </section>

      <RestartButton state={state} onRestart={onRestart} />
    </aside>
  );
}

const RELIC_RING: Record<Rarity, string> = {
  COMMON: 'border-slate-500/70',
  RARE: 'border-deck-gold/70',
  LEGENDARY: 'border-fuchsia-400/70',
};

/**
 * 보유 유물 아이콘 바. 아이콘에 마우스를 올리거나 포커스하면 이름·효과 툴팁이 뜬다.
 * 웨이브당 1회성 유물은 충전을 다 쓰면 흐려진다.
 */
function RelicBar({ relics, charges }: { relics: Relic[]; charges: Record<string, number> }) {
  const t = useStrings();
  return (
    <section className="rounded-xl border border-deck-edge bg-deck-panel/60 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-slate-400">{t.hud.relics}</span>
        <span className="text-[11px] text-slate-500">{t.hud.relicCount(relics.length)}</span>
      </div>

      {relics.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">{t.hud.relicsEmpty}</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {relics.map((relic) => {
            const limited = relic.chargesPerWave !== undefined || relic.chargesPerRun !== undefined;
            const left = charges[relic.id] ?? 0;
            const spent = limited && left <= 0;
            const text = relicText(t, relic);
            return (
              <li key={relic.id} className="group relative">
                <button
                  type="button"
                  aria-label={`${text.name}: ${text.description}`}
                  data-relic-id={relic.id}
                  className={`relative flex size-10 items-center justify-center rounded-xl border bg-white/5 text-xl transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-deck-accent ${RELIC_RING[relic.rarity]} ${spent ? 'opacity-35 grayscale' : ''}`}
                >
                  {relic.icon}
                  {limited && (
                    <span className="absolute -bottom-1 -right-1 rounded-full border border-deck-edge bg-deck-bg px-1 text-[9px] font-semibold tabular-nums text-slate-300">
                      {left}
                    </span>
                  )}
                </button>

                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-52 rounded-lg border border-deck-edge bg-deck-bg/95 p-3 text-left opacity-0 shadow-xl transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100">{text.name}</span>
                    <span className="text-[9px] tracking-widest text-slate-500">{relic.rarity}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    {text.description}
                  </p>
                  {limited && (
                    <p className="mt-1.5 text-[10px] text-deck-accent">
                      {relic.chargesPerRun !== undefined
                        ? t.hud.chargesLeftRun(left, relic.chargesPerRun)
                        : t.hud.chargesLeft(left, relic.chargesPerWave ?? 0)}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * 현재 콤보. 3타부터 강조되고, 숫자가 바뀔 때마다 살짝 튀어오른다.
 * 콤보는 패들 반사로는 끊기지 않고 공을 잃을 때만 0으로 돌아간다.
 */
function ComboMeter({ combo, best }: { combo: number; best: number }) {
  const t = useStrings();
  const hot = combo >= 3;
  return (
    <section
      className={`rounded-xl border bg-deck-panel/60 p-4 transition-colors ${
        hot ? 'border-deck-gold/70' : 'border-deck-edge'
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wider text-slate-400">{t.common.combo}</span>
        <span className="text-[11px] text-slate-500">{t.hud.comboBest(best)}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          key={combo}
          className={`text-2xl font-extrabold tabular-nums ${
            hot ? 'animate-[combo-pop_220ms_ease-out] text-deck-gold' : 'text-slate-300'
          }`}
        >
          {combo}
        </span>
        <span className="text-xs text-slate-500">{t.hud.comboUnit}</span>
      </div>
    </section>
  );
}

/** 데드라인까지 남은 턴 수. 2턴 이하면 경고색으로 바뀐다. */
function DeadlineMeter({ turns }: { turns: number }) {
  const t = useStrings();
  const none = turns < 0;
  const danger = !none && turns <= 2;
  const filled = none ? 0 : Math.max(0, 6 - Math.min(turns, 6));

  return (
    <section
      className={`rounded-xl border bg-deck-panel/60 p-4 ${danger ? 'border-rose-500/70' : 'border-deck-edge'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-slate-400">{t.hud.untilDeadline}</span>
        <span
          className={`text-sm font-semibold tabular-nums ${danger ? 'text-rose-400' : 'text-slate-200'}`}
        >
          {none ? '—' : t.common.turns(turns)}
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < filled
                ? danger
                  ? 'bg-rose-500'
                  : 'bg-deck-accent'
                : 'bg-slate-700/70'
            }`}
          />
        ))}
      </div>
      {danger && (
        <p className="mt-2 text-[11px] leading-relaxed text-rose-300/90">{t.hud.deadlineWarning}</p>
      )}
    </section>
  );
}

/** 이 시간 안에 한 번 더 눌러야 재시작이 확정된다 */
const RESTART_CONFIRM_MS = 3000;

/**
 * "새 게임" 버튼. 잃을 게 있는 판이면 한 번 더 눌러야 확정된다.
 *
 * 예전에는 한 번 누르면(또는 Tab 으로 와서 Enter 한 번이면) 진행 중인 판이 확인 없이 사라졌다.
 * 끝난 판이거나 아직 아무것도 안 한 새 판이면 바로 재시작한다.
 */
function RestartButton({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const t = useStrings();
  const [confirming, setConfirming] = useState(false);

  const isOver = state.phase === 'GAME_OVER' || state.phase === 'VICTORY';
  const hasProgress = state.score > 0 || state.wave > 1 || state.turn.currentTurn > 1;
  const needsConfirm = !isOver && hasProgress;

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), RESTART_CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  return (
    <button
      type="button"
      data-testid="restart-button"
      data-confirming={confirming}
      onClick={(e) => {
        e.currentTarget.blur(); // 포커스가 남으면 Space 가 발사 대신 이 버튼을 누른다
        if (needsConfirm && !confirming) {
          setConfirming(true);
          return;
        }
        setConfirming(false);
        onRestart();
      }}
      className={`rounded-xl border px-4 py-2 text-sm transition ${
        confirming
          ? 'border-rose-500/80 bg-rose-500/10 text-rose-300'
          : 'border-deck-edge bg-deck-panel/60 text-slate-300 hover:border-deck-accent hover:text-deck-accent'
      }`}
    >
      {confirming ? t.hud.confirmRestart : t.hud.newGame}
    </button>
  );
}

function RecordCell({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-lg border border-deck-edge bg-deck-bg/50 px-1 py-1.5">
      <dt className="text-[10px] text-slate-500">{label}</dt>
      <dd data-testid={testId} className="text-sm font-semibold tabular-nums text-deck-gold">
        {value}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-deck-edge bg-deck-panel/60 p-3">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-slate-100">{value}</div>
    </div>
  );
}
