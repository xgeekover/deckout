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

const PHASE_SHORT: Record<GameState['phase'], string> = {
  AIMING: '발사 준비',
  PLAYING: '진행 중',
  TURN_RESOLVING: '턴 정산',
  REWARD: '보상 선택',
  GAME_OVER: '게임 오버',
  VICTORY: '승리',
};

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
  const card = state.currentCard;
  const total = state.drawPileCount + state.discardPileCount + (card ? 1 : 0);
  const danger = state.turnsUntilDeadline >= 0 && state.turnsUntilDeadline <= 2;

  return (
    <header
      data-testid="compact-hud"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-deck-edge bg-deck-panel/70 px-3 py-1.5 text-[12px] portrait:border-b landscape:h-full landscape:w-36 landscape:flex-col landscape:flex-nowrap landscape:items-stretch landscape:gap-y-1.5 landscape:overflow-y-auto landscape:border-r landscape:py-2"
    >
      <div className="flex items-baseline gap-2">
        <b className="text-sm font-extrabold tracking-tight text-deck-accent">Wave {state.wave}</b>
        <span className="text-[10px] text-slate-400">{state.wavePattern}</span>
      </div>
      <span className="text-[10px] text-slate-400 landscape:-mt-1">{PHASE_SHORT[state.phase]}</span>

      <Chip label="점수" value={state.score.toLocaleString()} />
      <Chip label="턴" value={state.turn.currentTurn} />
      <Chip label="콤보" value={state.combo} tone={state.combo >= 3 ? 'text-deck-gold' : ''} />
      <Chip
        label="데드라인"
        value={state.turnsUntilDeadline < 0 ? '—' : `${state.turnsUntilDeadline}턴`}
        tone={danger ? 'text-rose-400' : ''}
      />
      <Chip label="증원" value={state.reinforcementsLeft > 0 ? `${state.reinforcementsLeft}줄` : '끝'} />

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
        <span className="text-slate-200">{card ? card.name : '대기 중'}</span>
        <span className="text-[10px] tabular-nums text-slate-500">
          {state.drawPileCount}/{total}
        </span>
      </span>

      {state.relics.length > 0 && (
        <span className="flex gap-0.5" aria-label="보유 유물">
          {state.relics.map((relic) => (
            <span key={relic.id} title={relic.name}>
              {relic.icon}
            </span>
          ))}
        </span>
      )}

      <div className="ml-auto flex gap-1.5 landscape:ml-0 landscape:mt-auto landscape:flex-wrap">
        <IconButton label="자세한 정보 · 설정 · 새 게임" onClick={onOpenInfo} testId="open-info">
          ☰
        </IconButton>
        <IconButton label={isMuted ? '소리 켜기' : '음소거'} onClick={onToggleMute} testId="compact-mute">
          {isMuted ? '🔇' : '🔊'}
        </IconButton>
        {fullscreen.supported && (
          <IconButton
            label={fullscreen.active ? '전체 화면 끝내기' : '전체 화면'}
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
