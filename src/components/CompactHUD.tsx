import { patternName, relicText } from '../i18n/strings';
import { useStrings } from '../i18n/useStrings';
import { BALL_STATS } from '../types/game';
import type { GameState } from '../types/game';
import type { FullscreenControl } from './useFullscreen';

interface CompactHUDProps {
  state: GameState;
  isMuted: boolean;
  fullscreen: FullscreenControl;
  onToggleMute: () => void;
  onOpenInfo: () => void;
}

function Chip({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) {
  return (
    <span className="flex items-baseline gap-1 whitespace-nowrap">
      <span className="text-[10px] text-slate-500">{label}</span>
      <b className={`tabular-nums font-semibold text-slate-100 ${tone}`}>{value}</b>
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
      className="flex size-9 items-center justify-center rounded-lg border border-deck-edge bg-deck-panel/80 text-sm text-slate-200 transition active:scale-95"
    >
      {children}
    </button>
  );
}

/**
 * 게임 화면을 최대한 크게 쓰기 위한 요약 HUD.
 * 세로 화면에서는 위쪽의 얇은 바, 가로 화면에서는 옆의 좁은 기둥이 된다 — 가로에서는 캔버스가
 * "높이"에 맞춰지므로 옆 공간은 어차피 남는다. 자세한 정보(덱·기록·설정)는 ℹ 버튼으로 연다.
 */
export function CompactHUD({ state, isMuted, fullscreen, onToggleMute, onOpenInfo }: CompactHUDProps) {
  const t = useStrings();
  const card = state.currentCard;
  const total = state.drawPileCount + state.discardPileCount + (card ? 1 : 0);
  const danger = state.turnsUntilDeadline >= 0 && state.turnsUntilDeadline <= 2;

  return (
    <header
      data-testid="compact-hud"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-deck-edge bg-deck-panel/70 px-3 py-1.5 text-[12px] portrait:border-b landscape:h-full landscape:w-36 landscape:flex-col landscape:flex-nowrap landscape:items-stretch landscape:gap-y-1.5 landscape:overflow-y-auto landscape:border-r landscape:py-2"
    >
      {/* 좁은 옆 기둥에서는 패턴 이름이 길면(Inverted Triangle) 아랫줄로 내려간다 — "Wave 2" 가 두 줄로 쪼개지면 안 된다 */}
      <div className="flex flex-wrap items-baseline gap-x-2">
        <b className="whitespace-nowrap text-sm font-extrabold tracking-tight text-deck-accent">Wave {state.wave}</b>
        <span className="whitespace-nowrap text-[10px] text-slate-400">
          {patternName(t, state.wavePatternId, state.wavePattern)}
        </span>
      </div>
      <span className="text-[10px] text-slate-400 landscape:-mt-1">{t.phaseShort[state.phase]}</span>

      <Chip label={t.common.score} value={state.score.toLocaleString()} />
      <Chip label={t.common.turn} value={state.turn.currentTurn} />
      <Chip label={t.common.combo} value={state.combo} tone={state.combo >= 3 ? 'text-deck-gold' : ''} />
      <Chip
        label={t.compact.deadline}
        value={state.turnsUntilDeadline < 0 ? '—' : t.common.turns(state.turnsUntilDeadline)}
        tone={danger ? 'text-rose-400' : ''}
      />
      <Chip
        label={t.compact.incoming}
        value={
          state.reinforcementsLeft > 0 ? t.compact.incomingRows(state.reinforcementsLeft) : t.compact.incomingDone
        }
      />

      <span className="flex items-center gap-1.5 whitespace-nowrap">
        {card && (
          <span
            className="size-2.5 rounded-full"
            style={{
              backgroundColor: BALL_STATS[card.ballType].color,
              boxShadow: `0 0 8px ${BALL_STATS[card.ballType].glow}`,
            }}
          />
        )}
        <span className="text-slate-200">{card ? t.balls[card.ballType].name : t.compact.waiting}</span>
        <span className="text-[10px] tabular-nums text-slate-500">
          {state.drawPileCount}/{total}
        </span>
      </span>

      {state.relics.length > 0 && (
        <span className="flex gap-0.5" aria-label={t.compact.relicsAria}>
          {state.relics.map((relic) => (
            <span key={relic.id} title={relicText(t, relic).name}>
              {relic.icon}
            </span>
          ))}
        </span>
      )}

      <div className="ml-auto flex gap-1.5 landscape:ml-0 landscape:mt-auto landscape:flex-wrap">
        <IconButton label={t.compact.openInfo} onClick={onOpenInfo} testId="open-info">
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
      </div>
    </header>
  );
}
