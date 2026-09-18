import { BALL_STATS } from '../types/game';
import type { Rarity, RewardItem } from '../types/game';

interface RewardModalProps {
  wave: number;
  choices: RewardItem[];
  onChoose: (itemId: string) => void;
  onSkip: () => void;
}

interface RarityStyle {
  tag: string;
  border: string;
  /** 호버 시 네온 하이라이트 */
  hover: string;
}

const RARITY_STYLE: Record<Rarity, RarityStyle> = {
  COMMON: {
    tag: 'border-slate-500/70 text-slate-300',
    border: 'border-slate-600/80',
    hover: 'hover:border-deck-accent hover:shadow-[0_0_34px_-4px_rgba(76,201,240,0.85)]',
  },
  RARE: {
    tag: 'border-deck-gold/70 text-deck-gold',
    border: 'border-deck-gold/50',
    hover: 'hover:border-deck-gold hover:shadow-[0_0_38px_-4px_rgba(247,181,56,0.9)]',
  },
  LEGENDARY: {
    tag: 'border-fuchsia-400/70 text-fuchsia-300',
    border: 'border-fuchsia-400/50',
    hover: 'hover:border-fuchsia-300 hover:shadow-[0_0_42px_-2px_rgba(232,121,249,0.95)]',
  },
};

/** 카드 상단의 큰 아이콘 — 볼은 실제 구체 색으로, 유물은 이모지로. */
function RewardIcon({ item }: { item: RewardItem }) {
  if (item.type === 'RELIC') {
    return (
      <span className="flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-3xl transition-transform duration-200 group-hover:scale-110">
        {item.relic.icon}
      </span>
    );
  }
  const stats = BALL_STATS[item.ball.ballType];
  return (
    <span className="flex size-14 items-center justify-center">
      <span
        className="size-11 rounded-full transition-transform duration-200 group-hover:scale-110"
        style={{
          background: `radial-gradient(circle at 35% 35%, #ffffff, ${stats.color})`,
          boxShadow: `0 0 26px ${stats.glow}`,
        }}
      />
    </span>
  );
}

function RewardCardView({ item, onChoose }: { item: RewardItem; onChoose: (id: string) => void }) {
  const style = RARITY_STYLE[item.rarity];
  const isRelic = item.type === 'RELIC';
  const title = isRelic ? item.relic.name : item.ball.name;
  const description = isRelic ? item.relic.description : item.ball.description;
  const stats = isRelic ? null : BALL_STATS[item.ball.ballType];

  return (
    <button
      type="button"
      data-reward-type={item.type}
      onClick={() => onChoose(item.id)}
      className={`group flex min-h-64 flex-col items-center gap-3 rounded-2xl border bg-deck-panel/90 p-5 text-center transition duration-200 ease-out hover:-translate-y-1.5 hover:scale-[1.04] hover:bg-deck-panel focus-visible:scale-[1.04] focus-visible:outline-2 focus-visible:outline-deck-accent ${style.border} ${style.hover}`}
    >
      <div className="flex w-full items-center justify-between">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-widest ${style.tag}`}
        >
          {item.rarity}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            isRelic ? 'bg-fuchsia-500/15 text-fuchsia-200' : 'bg-deck-accent/15 text-deck-accent'
          }`}
        >
          {isRelic ? '패시브 유물' : '새로운 볼'}
        </span>
      </div>

      <RewardIcon item={item} />

      <span className="text-base font-bold text-slate-100">{title}</span>
      <span className="text-xs leading-relaxed text-slate-400">{description}</span>

      <span className="mt-auto text-[11px] uppercase tracking-wider text-slate-500">
        {stats
          ? `DMG ${stats.damage} · SPD ${stats.speed}${stats.pierce ? ' · 관통' : ''}${stats.explosionRadius ? ' · 폭발' : ''}`
          : '보유하는 동안 계속 적용'}
      </span>
    </button>
  );
}

/** 웨이브 클리어 보상 — 3택 1, 또는 스킵. */
export function RewardModal({ wave, choices, onChoose, onSkip }: RewardModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="웨이브 클리어 보상"
      className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-deck-bg/88 backdrop-blur-sm"
    >
      <div className="w-full max-w-3xl px-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-deck-accent">wave {wave} clear</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-100">보상을 하나 고르세요</h2>
        <p className="mt-1 text-xs text-slate-400">
          볼은 덱에 추가되고, 유물은 즉시 효과가 적용됩니다.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {choices.map((item) => (
            <RewardCardView key={item.id} item={item} onChoose={onChoose} />
          ))}
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="mt-6 rounded-xl border border-deck-edge px-5 py-2 text-xs text-slate-400 transition hover:border-slate-400 hover:text-slate-200"
        >
          스킵 — 아무것도 받지 않고 다음 웨이브로
        </button>
      </div>
    </div>
  );
}
