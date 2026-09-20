import { useEffect, useRef } from 'react';
import { clampBallSpeed } from '../config/balance';
import { damageAddFor, resolveModifiers } from '../engine/Relics';
import type { ResolvedModifiers } from '../engine/Relics';
import { relicText } from '../i18n/strings';
import { useStrings } from '../i18n/useStrings';
import { BALL_STATS } from '../types/game';
import type { BallType, DeckCard, Rarity, Relic, RewardItem } from '../types/game';
import { useActivationGrace } from './useActivationGrace';

interface RewardModalProps {
  wave: number;
  choices: RewardItem[];
  /** 작은 화면에서는 모달이 HUD 를 가리므로, 고르는 데 필요한 덱/유물 정보를 모달 안에 다시 보여준다 */
  deck: DeckCard[];
  relics: Relic[];
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

/** 카드의 큰 아이콘 — 볼은 실제 구체 색으로, 유물은 이모지로. */
function RewardIcon({ item }: { item: RewardItem }) {
  if (item.type === 'RELIC') {
    return (
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-2xl transition-transform duration-200 group-hover:scale-110 sm:size-14 sm:text-3xl">
        {item.relic.icon}
      </span>
    );
  }
  const stats = BALL_STATS[item.ball.ballType];
  return (
    <span className="flex size-12 shrink-0 items-center justify-center sm:size-14">
      <span
        className="size-9 rounded-full transition-transform duration-200 group-hover:scale-110 sm:size-11"
        style={{
          background: `radial-gradient(circle at 35% 35%, #ffffff, ${stats.color})`,
          boxShadow: `0 0 26px ${stats.glow}`,
        }}
      />
    </span>
  );
}

/**
 * 카드에 찍는 수치는 "덱에 넣으면 실제로 날아갈 공" 기준이다.
 * 기본 스탯표를 그대로 찍으면, 화염 도선을 가진 플레이어에게 DMG 1 · SPD 480 이라고 보여주고
 * 실제로는 DMG 2 · SPD 552 짜리 공을 쏘게 된다.
 */
function BallStatLine({ type, mods }: { type: BallType; mods: ResolvedModifiers }) {
  const t = useStrings();
  const stats = BALL_STATS[type];
  const damage = stats.damage + damageAddFor(mods, type);
  const speed = Math.round(clampBallSpeed(stats.speed * mods.ballSpeedMul));
  const boosted = 'text-deck-gold';
  return (
    <>
      DMG <b className={damage !== stats.damage ? boosted : 'font-normal'}>{damage}</b> · SPD{' '}
      <b className={speed !== stats.speed ? boosted : 'font-normal'}>{speed}</b>
      {stats.pierce ? ` · ${t.reward.statPierce}` : ''}
      {stats.explosionRadius ? ` · ${t.reward.statBlast}` : ''}
      {stats.splitCount ? ` · ${t.reward.statSplit(stats.splitCount + 1)}` : ''}
      {stats.chainCount ? ` · ${t.reward.statChain(stats.chainCount)}` : ''}
      {stats.floorBounces ? ` · ${t.reward.statBounce}` : ''}
    </>
  );
}

function RewardCardView({
  item,
  index,
  mods,
  onChoose,
}: {
  item: RewardItem;
  index: number;
  mods: ResolvedModifiers;
  onChoose: (id: string) => void;
}) {
  const t = useStrings();
  const style = RARITY_STYLE[item.rarity];
  const isRelic = item.type === 'RELIC';
  const text = isRelic ? relicText(t, item.relic) : t.balls[item.ball.ballType];
  const title = text.name;
  const description = text.description;

  // 좁은 화면: 아이콘 왼쪽 + 글 오른쪽의 낮은 가로 카드 (세 장이 한 화면에 들어온다)
  // sm 이상: 세로로 긴 카드 세 장을 나란히
  return (
    <button
      type="button"
      data-reward-type={item.type}
      onClick={() => onChoose(item.id)}
      className={`group flex items-center gap-3 rounded-2xl border bg-deck-panel/90 p-3 text-left transition duration-200 ease-out hover:-translate-y-1 hover:scale-[1.03] hover:bg-deck-panel focus-visible:scale-[1.03] focus-visible:outline-2 focus-visible:outline-deck-accent sm:min-h-64 sm:flex-col sm:gap-3 sm:p-5 sm:text-center sm:hover:-translate-y-1.5 sm:hover:scale-[1.04] ${style.border} ${style.hover}`}
    >
      <div className="hidden w-full flex-wrap items-center justify-between gap-1 sm:flex">
        <RarityTag rarity={item.rarity} />
        <TypeTag isRelic={isRelic} />
      </div>

      <RewardIcon item={item} />

      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-none sm:items-center sm:gap-3">
        <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
          <kbd className="rounded border border-deck-edge px-1 text-[10px] text-slate-400">{index + 1}</kbd>
          <RarityTag rarity={item.rarity} />
          <TypeTag isRelic={isRelic} />
        </div>
        <span className="text-sm font-bold text-slate-100 sm:text-base">{title}</span>
        <span className="text-xs leading-relaxed text-slate-400">{description}</span>
        {!isRelic && (
          <span className="text-[11px] tracking-wider text-slate-500 sm:hidden">
            <BallStatLine type={item.ball.ballType} mods={mods} />
          </span>
        )}
      </div>

      <span
        data-testid="reward-stats"
        className="hidden text-[11px] uppercase tracking-wider text-slate-500 sm:mt-auto sm:block"
      >
        {isRelic ? t.reward.relicAlwaysOn : <BallStatLine type={item.ball.ballType} mods={mods} />}
      </span>
    </button>
  );
}

function RarityTag({ rarity }: { rarity: Rarity }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-widest ${RARITY_STYLE[rarity].tag}`}
    >
      {rarity}
    </span>
  );
}

function TypeTag({ isRelic }: { isRelic: boolean }) {
  const t = useStrings();
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${
        isRelic ? 'bg-fuchsia-500/15 text-fuchsia-200' : 'bg-deck-accent/15 text-deck-accent'
      }`}
    >
      {isRelic ? t.reward.typeRelic : t.reward.typeBall}
    </span>
  );
}

function countByType(deck: DeckCard[]): Array<[BallType, number]> {
  const map = new Map<BallType, number>();
  for (const card of deck) map.set(card.ballType, (map.get(card.ballType) ?? 0) + 1);
  return [...map.entries()];
}

/**
 * 웨이브 클리어 보상 — 3택 1, 또는 스킵.
 *
 * 배치: lg 이상에서는 캔버스 위에만 덮여 옆의 HUD(덱·유물)를 보면서 고를 수 있다.
 * 그보다 좁으면 캔버스 박스가 카드 세 장을 담기엔 너무 낮아서(폰에서 250px 남짓),
 * 화면 전체를 덮는 스크롤 가능한 오버레이로 바꾸고 덱/유물 요약을 모달 안에 넣는다.
 */
export function RewardModal({ wave, choices, deck, relics, onChoose, onSkip }: RewardModalProps) {
  const t = useStrings();
  const dialogRef = useRef<HTMLDivElement>(null);
  const isArmed = useActivationGrace();
  const mods = resolveModifiers(relics);

  // 포커스를 다이얼로그 "자체"에 둔다. 첫 카드에 두면, 발사하려고 Space 를 누르던 손가락이
  // 그대로 첫 카드를 골라 버린다. 여기서 Tab 을 누르면 첫 카드로 간다.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const guarded = (fn: () => void) => () => {
    if (isArmed()) fn();
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={t.reward.aria}
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto overscroll-contain bg-deck-bg/92 py-6 outline-none backdrop-blur-sm sm:items-center lg:absolute lg:z-10 lg:rounded-2xl lg:bg-deck-bg/88 lg:py-0"
    >
      <div className="w-full max-w-3xl px-4 text-center sm:px-6">
        <p className="text-xs uppercase tracking-[0.3em] text-deck-accent">wave {wave} clear</p>
        <h2 className="mt-2 text-xl font-bold text-slate-100 sm:text-2xl">{t.reward.title}</h2>
        <p className="mt-1 text-xs text-slate-400">{t.reward.subtitle}</p>

        <div className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-3 sm:gap-4">
          {choices.map((item, index) => (
            <RewardCardView
              key={item.id}
              item={item}
              index={index}
              mods={mods}
              onChoose={(id) => guarded(() => onChoose(id))()}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={guarded(onSkip)}
          className="mt-4 rounded-xl border border-deck-edge px-5 py-2 text-xs text-slate-400 transition hover:border-slate-400 hover:text-slate-200 sm:mt-6"
        >
          {t.reward.skip}
        </button>

        {/* lg 미만에서는 이 오버레이가 HUD 를 가린다 — 판단에 필요한 정보만 추려 보여준다 */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-slate-400 lg:hidden">
          <span className="text-slate-500">{t.reward.currentDeck}</span>
          {countByType(deck).map(([type, count]) => (
            <span key={type} className="rounded-md border border-deck-edge px-1.5 py-0.5">
              {t.balls[type].name} ×{count}
            </span>
          ))}
          {relics.length > 0 && <span className="ml-1 text-slate-500">{t.reward.relics}</span>}
          {relics.map((relic) => (
            <span key={relic.id} title={relicText(t, relic).name}>
              {relic.icon}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
