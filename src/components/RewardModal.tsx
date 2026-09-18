import { BALL_STATS } from '../types/game';
import type { RewardCard } from '../types/game';

interface RewardModalProps {
  wave: number;
  choices: RewardCard[];
  onChoose: (cardId: string) => void;
}

const RARITY_STYLE: Record<RewardCard['rarity'], string> = {
  common: 'border-slate-600',
  rare: 'border-deck-gold shadow-[0_0_26px_-6px_rgba(247,181,56,0.75)]',
};

/** 웨이브 클리어 보상 — 카드를 하나 골라 덱에 넣는다. */
export function RewardModal({ wave, choices, onChoose }: RewardModalProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-deck-bg/85 backdrop-blur-sm">
      <div className="w-full max-w-2xl px-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-deck-accent">wave {wave} clear</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-100">덱에 넣을 카드를 고르세요</h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {choices.map((card) => {
            const stats = BALL_STATS[card.ballType];
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onChoose(card.id)}
                className={`group flex flex-col items-center gap-3 rounded-2xl border bg-deck-panel/80 p-5 text-left transition hover:-translate-y-1 hover:bg-deck-panel ${RARITY_STYLE[card.rarity]}`}
              >
                <span
                  className="size-12 rounded-full transition group-hover:scale-110"
                  style={{
                    backgroundColor: stats.color,
                    boxShadow: `0 0 26px ${stats.glow}`,
                  }}
                />
                <span className="text-sm font-semibold text-slate-100">{card.name}</span>
                <span className="text-xs leading-relaxed text-slate-400">{card.description}</span>
                <span className="mt-auto text-[11px] uppercase tracking-wider text-slate-500">
                  DMG {stats.damage} · SPD {stats.speed}
                  {stats.pierce ? ' · 관통' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
