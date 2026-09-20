import { useEffect, useRef } from 'react';
import { relicText } from '../i18n/strings';
import { useStrings } from '../i18n/useStrings';
import { BALL_STATS } from '../types/game';
import type { BallType, DeckCard, RunSummary } from '../types/game';
import type { RecordUpdate } from '../utils/storage';
import { useActivationGrace } from './useActivationGrace';

interface GameOverModalProps {
  summary: RunSummary;
  /** 이번 판을 기록에 반영한 결과. 저장 전이면 null. */
  update: RecordUpdate | null;
  onRestart: () => void;
  /** 승리 화면에서만: 무한 모드로 이어 가기. 없으면 재도전 버튼만 보인다 */
  onContinue?: () => void;
}

/** 폭죽 한 발의 위치/색/지연. 렌더마다 같아야 하므로 난수 대신 고정 테이블을 쓴다. */
const BURSTS = [
  { left: '14%', top: '22%', color: '#f7d558', delay: '0s' },
  { left: '82%', top: '18%', color: '#4cc9f0', delay: '0.35s' },
  { left: '26%', top: '70%', color: '#ff7ac8', delay: '0.7s' },
  { left: '74%', top: '66%', color: '#7ef0a8', delay: '1.05s' },
  { left: '50%', top: '12%', color: '#ffb066', delay: '1.4s' },
];
const SPARKS_PER_BURST = 14;

/** CSS 만으로 그리는 폭죽. 모션 최소화 설정에서는 통째로 숨긴다. */
function Fireworks() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
      {BURSTS.map((burst) => (
        <div key={burst.left + burst.top} className="absolute" style={{ left: burst.left, top: burst.top }}>
          {Array.from({ length: SPARKS_PER_BURST }, (_, i) => (
            <span
              key={i}
              className="firework-spark absolute size-1.5 rounded-full"
              style={
                {
                  backgroundColor: burst.color,
                  boxShadow: `0 0 8px ${burst.color}`,
                  animationDelay: burst.delay,
                  '--spark-angle': `${(360 / SPARKS_PER_BURST) * i}deg`,
                  '--spark-distance': `${70 + ((i * 37) % 46)}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function countByType(deck: DeckCard[]): Array<[BallType, number]> {
  const map = new Map<BallType, number>();
  for (const card of deck) map.set(card.ballType, (map.get(card.ballType) ?? 0) + 1);
  return [...map.entries()];
}

function StatTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`relative rounded-xl border bg-deck-panel/70 px-3 py-3 ${
        highlight ? 'border-deck-gold shadow-[0_0_28px_-6px_rgba(247,181,56,0.9)]' : 'border-deck-edge'
      }`}
    >
      {highlight && (
        <span className="neon-pulse absolute -top-2 left-1/2 -translate-x-1/2 rounded-full border border-deck-gold bg-deck-bg px-2 text-[9px] font-bold tracking-widest whitespace-nowrap text-deck-gold">
          NEW RECORD
        </span>
      )}
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div
        className={`mt-0.5 text-xl font-extrabold tabular-nums ${highlight ? 'text-deck-gold' : 'text-slate-100'}`}
      >
        {value}
      </div>
    </div>
  );
}

/** 게임 오버 / 승리 결과창. 통계 · 최종 덱 · 유물 · 최고 기록 갱신 여부를 보여준다. */
export function GameOverModal({ summary, update, onRestart, onContinue }: GameOverModalProps) {
  const t = useStrings();
  const primaryRef = useRef<HTMLButtonElement>(null);
  // 버튼에 자동 포커스를 주기 때문에, 발사하려던 Space 연타가 결과창을 보기도 전에 재시작시킬 수 있다.
  const isArmed = useActivationGrace(600);
  const victory = summary.outcome === 'victory';
  const canContinue = victory && onContinue !== undefined;
  const newScore = update?.isNewHighScore ?? false;
  const newWave = update?.isNewMaxWave ?? false;
  const anyRecord = newScore || newWave;

  // 주 버튼(승리면 "계속하기", 아니면 재도전)에 포커스를 줘서 Enter/Space 로도 바로 진행할 수 있게 한다 (R 은 InputManager 가 받는다).
  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={victory ? t.result.ariaVictory : t.result.ariaGameOver}
      className="modal-in fixed inset-0 z-30 flex items-start justify-center overflow-y-auto overscroll-contain bg-deck-bg/92 backdrop-blur-sm sm:items-center lg:absolute lg:z-10 lg:rounded-2xl lg:bg-deck-bg/85"
    >
      {anyRecord && <Fireworks />}

      <div className="relative w-full max-w-xl px-6 py-6 text-center">
        <p
          className={`text-xs uppercase tracking-[0.3em] ${victory ? 'text-emerald-300' : 'text-rose-400'}`}
        >
          {victory ? 'run complete' : summary.endless ? 'endless run ended' : 'run ended'}
        </p>
        <h2
          className={`mt-1 text-4xl font-black tracking-tight ${victory ? 'text-emerald-300' : 'text-rose-400'}`}
          style={{ textShadow: victory ? '0 0 28px rgba(126,240,168,0.55)' : '0 0 28px rgba(255,107,107,0.5)' }}
        >
          {victory ? 'VICTORY' : 'GAME OVER'}
        </h2>

        {anyRecord && (
          <p className="neon-pulse mt-2 text-sm font-bold tracking-[0.2em] text-deck-gold">
            ★ NEW RECORD ★
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={t.result.finalWave} value={`Wave ${summary.wave}`} highlight={newWave} />
          <StatTile label={t.result.totalScore} value={summary.score.toLocaleString()} highlight={newScore} />
          <StatTile label={t.result.bestCombo} value={`${summary.bestCombo}`} />
          <StatTile label={t.result.bricksDestroyed} value={summary.bricksDestroyed.toLocaleString()} />
        </div>

        {update && (
          <p className="mt-3 text-[11px] text-slate-500">
            {t.result.highScore} <b className="text-slate-300">{update.records.highScore.toLocaleString()}</b>
            {newScore && update.previous.highScore > 0 && (
              <span className="text-slate-600"> {t.result.previous(update.previous.highScore.toLocaleString())}</span>
            )}{' '}
            · {t.result.bestWave} <b className="text-slate-300">{update.records.maxWave}</b> · {t.result.totalBricks}{' '}
            <b className="text-slate-300">{update.records.totalBricksDestroyed.toLocaleString()}</b>
          </p>
        )}

        <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
          <section className="rounded-xl border border-deck-edge bg-deck-panel/60 p-3">
            <h3 className="text-[10px] uppercase tracking-wider text-slate-400">
              {t.result.finalDeck(summary.deck.length)}
            </h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {countByType(summary.deck).map(([type, count]) => {
                const stats = BALL_STATS[type];
                return (
                  <li
                    key={type}
                    className="flex items-center gap-1.5 rounded-lg border border-deck-edge bg-deck-bg/60 px-2 py-1 text-[11px] text-slate-200"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: stats.color, boxShadow: `0 0 8px ${stats.glow}` }}
                    />
                    {t.balls[type].name}
                    <span className="font-semibold tabular-nums text-deck-accent">×{count}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-deck-edge bg-deck-panel/60 p-3">
            <h3 className="text-[10px] uppercase tracking-wider text-slate-400">
              {t.result.relics(summary.relics.length)}
            </h3>
            {summary.relics.length === 0 ? (
              <p className="mt-2 text-[11px] text-slate-500">{t.result.noRelics}</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {summary.relics.map((relic) => {
                  const text = relicText(t, relic);
                  return (
                    <li
                      key={relic.id}
                      title={text.description}
                      className="flex items-center gap-1.5 rounded-lg border border-deck-edge bg-deck-bg/60 px-2 py-1 text-[11px] text-slate-200"
                    >
                      <span>{relic.icon}</span>
                      {text.name}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {canContinue && (
          <p data-testid="endless-note" className="mt-5 text-xs leading-relaxed text-slate-400">
            {t.result.endlessNote}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {canContinue && (
            <button
              ref={primaryRef}
              type="button"
              data-testid="continue-endless"
              onClick={() => {
                if (isArmed()) onContinue();
              }}
              className="rounded-xl border border-emerald-400 bg-emerald-400/10 px-7 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400 hover:text-deck-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              {t.result.continueEndless} <span className="ml-1 text-xs font-normal opacity-70">{t.result.continueHint}</span>
            </button>
          )}
          <button
            ref={canContinue ? undefined : primaryRef}
            type="button"
            data-testid="retry"
            onClick={() => {
              if (isArmed()) onRestart();
            }}
            className={
              canContinue
                ? 'rounded-xl border border-deck-edge px-5 py-2.5 text-sm text-slate-300 transition hover:border-deck-accent hover:text-deck-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deck-accent'
                : 'rounded-xl border border-deck-accent bg-deck-accent/10 px-7 py-2.5 text-sm font-semibold text-deck-accent transition hover:bg-deck-accent hover:text-deck-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deck-accent'
            }
          >
            {t.common.retry} <span className="ml-1 text-xs font-normal opacity-70">{t.result.retryHint}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
