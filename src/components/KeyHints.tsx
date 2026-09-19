import type { GamePhase } from '../types/game';
import { useIsTouchPrimary } from './useIsTouchPrimary';

interface KeyHintsProps {
  phase: GamePhase;
  isMuted: boolean;
}

interface Hint {
  keys: string[];
  label: string;
}

/** 지금 phase 에서 실제로 먹는 키만 보여준다. */
function keyboardHints(phase: GamePhase, isMuted: boolean): Hint[] {
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

/** 키보드가 없는 기기용. 있지도 않은 키를 안내하는 대신 실제로 되는 제스처를 알려준다. */
function touchHints(phase: GamePhase): Hint[] {
  switch (phase) {
    case 'REWARD':
      return [{ keys: ['탭'], label: '카드 선택 · 스킵' }];
    case 'GAME_OVER':
    case 'VICTORY':
      return [{ keys: ['탭'], label: '다시 도전' }];
    case 'AIMING':
      return [
        { keys: ['드래그'], label: '패들 이동' },
        { keys: ['탭'], label: '발사' },
      ];
    default:
      return [{ keys: ['드래그'], label: '패들 이동' }];
  }
}

/** 화면 하단의 은은한 조작 가이드. 기기의 주 입력 장치에 맞춰 키보드 또는 터치 안내를 보여준다. */
export function KeyHints({ phase, isMuted }: KeyHintsProps) {
  const isTouch = useIsTouchPrimary();
  const hints = isTouch ? touchHints(phase) : keyboardHints(phase, isMuted);

  return (
    <ul
      aria-label={isTouch ? '터치 조작 가이드' : '키보드 조작 가이드'}
      data-input={isTouch ? 'touch' : 'keyboard'}
      className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500 opacity-70 transition-opacity hover:opacity-100"
    >
      {hints.map((hint) => (
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
