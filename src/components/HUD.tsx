import { BALL_STATS } from '../types/game';
import type { BallType, DeckCard, GameState } from '../types/game';

/** 직전 판의 결과 — 엔진의 onGameOver / onVictory 훅으로 채워진다. */
export interface RunResult {
  outcome: 'victory' | 'defeat';
  turn: number;
  score: number;
}

interface HUDProps {
  state: GameState;
  lastRun: RunResult | null;
  onRestart: () => void;
}

const PHASE_LABEL: Record<GameState['phase'], string> = {
  AIMING: '발사 준비 (클릭하여 발사)',
  PLAYING: '진행 중',
  TURN_RESOLVING: '턴 정산 중',
  REWARD: '보상 선택',
  GAME_OVER: '게임 오버',
  VICTORY: '승리',
};

const PHASE_TONE: Record<GameState['phase'], string> = {
  AIMING: 'border-deck-gold/60 text-deck-gold',
  PLAYING: 'border-deck-edge text-slate-300',
  TURN_RESOLVING: 'border-deck-accent/60 text-deck-accent',
  REWARD: 'border-deck-gold/60 text-deck-gold',
  GAME_OVER: 'border-rose-500/60 text-rose-400',
  VICTORY: 'border-emerald-400/60 text-emerald-300',
};

function BallChip({ type, count }: { type: BallType; count: number }) {
  const stats = BALL_STATS[type];
  return (
    <div className="flex items-center gap-2 rounded-lg border border-deck-edge bg-deck-panel/70 px-2.5 py-1.5">
      <span
        className="size-3 rounded-full"
        style={{ backgroundColor: stats.color, boxShadow: `0 0 10px ${stats.glow}` }}
      />
      <span className="text-xs text-slate-200">{stats.label}</span>
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
export function HUD({ state, lastRun, onRestart }: HUDProps) {
  const current = state.currentCard;

  return (
    <aside className="flex w-full flex-col gap-4 lg:w-72">
      <header className="rounded-xl border border-deck-edge bg-deck-panel/60 p-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-tight text-deck-accent">DECKOUT</h1>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] ${PHASE_TONE[state.phase]}`}
          >
            {PHASE_LABEL[state.phase]}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-400">벽돌깨기 × 덱빌딩 로그라이트</p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <Stat label="웨이브" value={state.wave} />
        <Stat label="턴" value={state.turn.currentTurn} />
        <Stat label="점수" value={state.score.toLocaleString()} />
        <Stat label="남은 벽돌" value={state.bricksRemaining} />
      </section>

      <DeadlineMeter turns={state.turnsUntilDeadline} />

      <section className="rounded-xl border border-deck-edge bg-deck-panel/60 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-slate-400">현재 카드</span>
          <span className="text-xs text-slate-400">
            남은 카드 <b className="tabular-nums text-deck-gold">{state.drawPileCount}</b> /{' '}
            {state.deck.length}
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
            <div className="text-sm font-semibold text-slate-100">{current.name}</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{current.description}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs text-slate-500">
            대기 중…
          </div>
        )}
      </section>

      <section className="rounded-xl border border-deck-edge bg-deck-panel/60 p-4">
        <span className="text-xs uppercase tracking-wider text-slate-400">보유 덱</span>
        <div className="mt-2 flex flex-col gap-1.5">
          {countByType(state.deck).map(([type, count]) => (
            <BallChip key={type} type={type} count={count} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-deck-edge bg-deck-panel/60 p-4 text-xs leading-relaxed text-slate-400">
        <b className="text-slate-200">조작</b>
        <ul className="mt-1.5 space-y-1">
          <li>마우스 이동 · ← → · A/D — 패들</li>
          <li>클릭 · Space — 발사</li>
          <li>R — 재시작</li>
        </ul>
      </section>

      {lastRun && (
        <div className="rounded-xl border border-deck-edge bg-deck-panel/40 px-4 py-2.5 text-[11px] text-slate-400">
          직전 판{' '}
          <b className={lastRun.outcome === 'victory' ? 'text-emerald-300' : 'text-rose-400'}>
            {lastRun.outcome === 'victory' ? '승리' : '패배'}
          </b>{' '}
          · {lastRun.turn}턴 · {lastRun.score.toLocaleString()}점
        </div>
      )}

      <button
        type="button"
        onClick={onRestart}
        className="rounded-xl border border-deck-edge bg-deck-panel/60 px-4 py-2 text-sm text-slate-300 transition hover:border-deck-accent hover:text-deck-accent"
      >
        새 게임
      </button>
    </aside>
  );
}

/** 데드라인까지 남은 턴 수. 2턴 이하면 경고색으로 바뀐다. */
function DeadlineMeter({ turns }: { turns: number }) {
  const none = turns < 0;
  const danger = !none && turns <= 2;
  const filled = none ? 0 : Math.max(0, 6 - Math.min(turns, 6));

  return (
    <section
      className={`rounded-xl border bg-deck-panel/60 p-4 ${danger ? 'border-rose-500/70' : 'border-deck-edge'}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-slate-400">데드라인까지</span>
        <span
          className={`text-sm font-semibold tabular-nums ${danger ? 'text-rose-400' : 'text-slate-200'}`}
        >
          {none ? '—' : `${turns}턴`}
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
        <p className="mt-2 text-[11px] leading-relaxed text-rose-300/90">
          벽돌이 경고선에 닿으면 즉시 패배합니다.
        </p>
      )}
    </section>
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
