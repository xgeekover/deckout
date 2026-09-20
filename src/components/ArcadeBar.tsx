import { patternName, relicText } from '../i18n/strings';
import { ITEMS } from '../engine/Items';
import type { ItemId } from '../engine/Items';
import type { Strings } from '../i18n/strings';
import { useStrings } from '../i18n/useStrings';
import { BALL_STATS } from '../types/game';
import type { GamePhase, GameState } from '../types/game';
import type { Records } from '../utils/storage';
import type { FullscreenControl } from './useFullscreen';
import { useIsTouchPrimary } from './useIsTouchPrimary';

/*
 * 오락실 캐비닛의 스코어라인.
 *  - 위 줄: SCORE · HI · WAVE · COMBO · TURN · DEADLINE — 옛 아케이드의 "1UP 012340 HI-SCORE" 자리
 *  - 아래 줄: 지금 뽑힌 카드 · 유물 · 깜빡이는 안내(PRESS SPACE …) · 버튼(☰ 🔊 ⛶)
 * 세로가 모자란 가로 폰에서는 한 줄(`single`)로 합친다 — 안내 문구는 빠지고 캔버스 위 오버레이가 대신한다.
 * 픽셀 폰트는 이 두 줄에서만 쓴다. 나머지 UI(정보 패널·모달)는 그대로 산세리프다.
 */

interface ArcadeBarProps {
  state: GameState;
  records: Records;
  isMuted: boolean;
  fullscreen: FullscreenControl;
  onToggleMute: () => void;
  onOpenInfo: () => void;
  /** 위·아래 두 줄을 한 줄로 합친다 (가로로 든 폰) */
  single?: boolean;
}

/** 6자리 0 채움 — 아케이드 점수판의 관습 */
const pad = (n: number, width = 6): string => String(Math.max(0, Math.floor(n))).padStart(width, '0');

function Field({ label, value, tone = 'text-slate-100' }: { label: string; value: string; tone?: string }) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-deck-accent/80">{label}</span>
      <span className={tone}>{value}</span>
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
  testId,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-testid={testId}
      onClick={(e) => {
        onClick();
        e.currentTarget.blur(); // 포커스가 남으면 Space 가 발사 대신 이 버튼을 누른다
      }}
      className="flex size-7 shrink-0 items-center justify-center rounded border border-deck-edge bg-deck-panel/80 font-sans text-[13px] leading-none text-slate-200 transition active:scale-95"
    >
      {children}
    </button>
  );
}

/** phase 별 안내 문구. 빈 문자열이면 아무것도 띄우지 않는다. */
function prompt(t: Strings, phase: GamePhase, touch: boolean): string {
  switch (phase) {
    case 'AIMING':
      return touch ? t.arcade.promptLaunchTouch : t.arcade.promptLaunchKeyboard;
    case 'PLAYING':
      return t.arcade.promptPlaying;
    case 'TURN_RESOLVING':
      return t.arcade.promptResolving;
    case 'REWARD':
      return touch ? t.arcade.promptRewardTouch : t.arcade.promptReward;
    case 'GAME_OVER':
      return touch ? t.arcade.promptGameOverTouch : t.arcade.promptGameOver;
    case 'VICTORY':
      return t.arcade.promptVictory;
  }
}

function ScoreFields({ state, records, compact }: { state: GameState; records: Records; compact: boolean }) {
  const t = useStrings();
  const danger = state.turnsUntilDeadline >= 0 && state.turnsUntilDeadline <= 2;
  // HI 는 저장된 최고 기록이되, 지금 판이 그걸 넘는 순간부터 같이 올라간다 (아케이드 관습)
  const hi = Math.max(records.highScore, state.score);
  return (
    <>
      <Field label={t.arcade.score} value={pad(state.score)} />
      {!compact && (
        <Field label={t.arcade.hiScore} value={pad(hi)} tone={state.score >= hi && state.score > 0 ? 'text-deck-gold' : 'text-slate-300'} />
      )}
      <Field label={t.arcade.wave} value={pad(state.wave, 2)} tone="text-deck-gold" />
      <Field label={t.arcade.combo} value={`x${state.combo}`} tone={state.combo >= 3 ? 'text-deck-gold' : 'text-slate-100'} />
      {!compact && <Field label={t.arcade.turn} value={pad(state.turn.currentTurn, 2)} />}
      <Field
        label={t.arcade.deadline}
        value={state.turnsUntilDeadline < 0 ? '--' : String(state.turnsUntilDeadline)}
        tone={danger ? 'text-rose-400 arcade-blink' : 'text-slate-100'}
      />
      {!compact && (
        <Field
          label={t.arcade.incoming}
          value={state.reinforcementsLeft > 0 ? String(state.reinforcementsLeft) : t.arcade.incomingDone}
          tone="text-slate-300"
        />
      )}
    </>
  );
}

function StatusFields({ state, compact = false }: { state: GameState; compact?: boolean }) {
  const t = useStrings();
  const card = state.currentCard;
  const total = state.drawPileCount + state.discardPileCount + (card ? 1 : 0);
  return (
    <>
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        {card && (
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{
              backgroundColor: BALL_STATS[card.ballType].color,
              boxShadow: `0 0 6px ${BALL_STATS[card.ballType].glow}`,
            }}
          />
        )}
        {/* 카드가 없는 순간: 턴 정산 중이면 "뽑는 중", 보상·결과 화면이면 그냥 빈칸 */}
        <span className="text-slate-100">
          {card ? t.balls[card.ballType].name : state.phase === 'TURN_RESOLVING' ? t.arcade.waiting : '--'}
        </span>
        {!compact && (
          <span className="text-slate-500">
            {state.drawPileCount}/{total}
          </span>
        )}
      </span>
      {/* 이번 턴에 받은 아이템 — 좋은 건 초록, 나쁜 건 빨강. 턴이 끝나면 사라진다 */}
      {state.turnEffects.length > 0 && (
        <span className="flex gap-1" data-testid="turn-effects" aria-label={t.itemsTitle}>
          {state.turnEffects.map((id, i) => {
            const def = ITEMS[id as ItemId];
            const label = t.items[id]?.name ?? def?.label ?? id;
            return (
              <span
                key={`${id}-${i}`}
                data-item={id}
                title={t.items[id]?.description}
                className={`animate-[combo-pop_260ms_ease-out] rounded border px-1 leading-tight ${
                  def?.good === false ? 'border-rose-500/80 text-rose-400' : 'border-emerald-400/80 text-emerald-300'
                }`}
              >
                {label}
              </span>
            );
          })}
        </span>
      )}
      {state.relics.length > 0 && (
        <span className="flex gap-1 font-sans text-sm leading-none" aria-label={t.arcade.relicsAria}>
          {state.relics.map((relic, i) => (
            // 마지막(방금 얻은) 유물은 마운트되며 팝 — 보상이 들어왔음이 하단 줄에서도 보이게
            <span key={relic.id} title={relicText(t, relic).name} className={i === state.relics.length - 1 ? 'inline-block animate-[combo-pop_260ms_ease-out]' : ''}>
              {relic.icon}
            </span>
          ))}
        </span>
      )}
    </>
  );
}

function Buttons({
  isMuted,
  fullscreen,
  onToggleMute,
  onOpenInfo,
}: Pick<ArcadeBarProps, 'isMuted' | 'fullscreen' | 'onToggleMute' | 'onOpenInfo'>) {
  const t = useStrings();
  return (
    <span className="flex shrink-0 gap-1.5">
      <IconButton label={t.arcade.openInfo} onClick={onOpenInfo} testId="open-info">
        ☰
      </IconButton>
      <IconButton label={isMuted ? t.common.unmute : t.common.mute} onClick={onToggleMute} testId="compact-mute">
        {isMuted ? '🔇' : '🔊'}
      </IconButton>
      {fullscreen.supported && (
        <IconButton
          label={fullscreen.active ? t.common.exitFullscreen : t.common.enterFullscreen}
          onClick={fullscreen.toggle}
          testId="fullscreen-toggle"
        >
          {fullscreen.active ? '🗗' : '⛶'}
        </IconButton>
      )}
    </span>
  );
}

/*
 * 줄의 뼈대: [가로로 넘치면 스크롤되는 필드 영역][항상 보이는 버튼].
 * 버튼을 필드와 같은 스크롤 영역에 두면 좁은 폰에서 ☰ 🔊 ⛶ 가 화면 밖으로 밀려나 눌 수 없게 된다.
 * 세로로 든 폰은 세로 여백이 남으므로(캔버스가 폭에 묶인다) 필드를 두 줄로 접는다.
 */
const BAR =
  'font-arcade flex shrink-0 items-center gap-x-3 border-deck-edge bg-deck-panel/70 px-3 leading-none text-slate-300';
const FIELDS =
  'flex min-w-0 flex-1 items-center gap-x-4 overflow-x-auto [scrollbar-width:none] lg:gap-x-6 portrait:flex-wrap portrait:gap-y-2 portrait:overflow-visible';

/** 위 줄: 점수판. `single` 이면 아래 줄의 내용까지 여기에 들어온다. */
export function ArcadeTopBar({ state, records, isMuted, fullscreen, onToggleMute, onOpenInfo, single = false }: ArcadeBarProps) {
  const t = useStrings();
  return (
    <header
      data-testid="arcade-top"
      className={`${BAR} border-b ${single ? 'h-8 text-[9px]' : 'h-8 text-[9px] sm:h-9 sm:text-[10px] lg:text-[11px] portrait:h-auto portrait:py-2.5'}`}
    >
      <div className={FIELDS}>
        <ScoreFields state={state} records={records} compact={single} />
        {!single && (
          <span className="hidden whitespace-nowrap text-slate-500 lg:inline">
            {patternName(t, state.wavePatternId, state.wavePattern)}
          </span>
        )}
        {single && <StatusFields state={state} compact />}
      </div>
      {single && <Buttons isMuted={isMuted} fullscreen={fullscreen} onToggleMute={onToggleMute} onOpenInfo={onOpenInfo} />}
    </header>
  );
}

/** 아래 줄: 카드 · 유물 · 안내 · 버튼 */
export function ArcadeBottomBar({
  state,
  isMuted,
  fullscreen,
  onToggleMute,
  onOpenInfo,
}: Omit<ArcadeBarProps, 'records' | 'single'>) {
  const t = useStrings();
  const touch = useIsTouchPrimary();
  const text = prompt(t, state.phase, touch);
  return (
    <footer
      data-testid="arcade-bottom"
      className={`${BAR} h-9 border-t text-[9px] sm:h-10 sm:text-[10px] lg:text-[11px] portrait:h-auto portrait:flex-wrap portrait:py-2.5`}
    >
      {/* 카드 영역은 내용만큼만 차지하고, 안내 문구가 남는 폭의 가운데에 선다 */}
      <div className="flex min-w-0 shrink-0 items-center gap-x-4 lg:gap-x-6 portrait:flex-1 portrait:overflow-x-auto portrait:[scrollbar-width:none]">
        <StatusFields state={state} />
      </div>
      {text && (
        <span
          data-testid="arcade-prompt"
          className={`min-w-0 flex-1 truncate text-center text-deck-gold portrait:order-last portrait:mt-2.5 portrait:basis-full ${
            state.phase === 'AIMING' ? 'arcade-blink' : ''
          }`}
        >
          {text}
        </span>
      )}
      {!text && <span className="flex-1 portrait:hidden" />}
      <Buttons isMuted={isMuted} fullscreen={fullscreen} onToggleMute={onToggleMute} onOpenInfo={onOpenInfo} />
    </footer>
  );
}
