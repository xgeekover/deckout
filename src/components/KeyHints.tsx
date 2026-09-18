import type { GamePhase } from '../types/game';

interface KeyHintsProps {
  phase: GamePhase;
  isMuted: boolean;
}

interface Hint {
  keys: string[];
  label: string;
}

/** 지금 phase 에서 실제로 먹는 키만 보여준다. */
function hintsFor(phase: GamePhase, isMuted: boolean): Hint[] {
  const mute: Hint = { keys: ['M'], label: isMuted ? '소리 켜기' : '음소거' };

  switch (phase) {
    case 'REWARD':
      return [
        { keys: ['1', '2', '3'], label: '카드 선택' },
        { keys: ['0', 'S'], label: '스킵' },
        mute,
      ];
    case 'GAME_OVER':
    case 'VICTORY':
      return [{ keys: ['R'], label: '다시 도전' }, mute];
    case 'AIMING':
      return [
        { keys: ['A', 'D'], label: '이동' },
        { keys: ['←', '→'], label: '이동' },
        { keys: ['Space', 'Enter'], label: '발사' },
        mute,
      ];
    default:
      return [
        { keys: ['A', 'D'], label: '이동' },
        { keys: ['←', '→'], label: '이동' },
        mute,
      ];
  }
}

/** 화면 하단의 은은한 키보드 조작 가이드. 마우스 없이도 모든 흐름을 진행할 수 있다. */
export function KeyHints({ phase, isMuted }: KeyHintsProps) {
  return (
    <ul
      aria-label="키보드 조작 가이드"
      className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500 opacity-70 transition-opacity hover:opacity-100"
    >
      {hintsFor(phase, isMuted).map((hint) => (
        <li key={`${hint.keys.join('+')}-${hint.label}`} className="flex items-center gap-1.5">
          {hint.keys.map((key) => (
            <kbd
              key={key}
              className="rounded-md border border-deck-edge bg-deck-panel/80 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-300 shadow-[0_1px_0_rgba(255,255,255,0.06)]"
            >
              {key}
            </kbd>
          ))}
          <span>{hint.label}</span>
        </li>
      ))}
    </ul>
  );
}
