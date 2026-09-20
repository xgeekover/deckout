import type { Strings } from '../i18n/strings';
import { useStrings } from '../i18n/useStrings';
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
function keyboardHints(t: Strings, phase: GamePhase, isMuted: boolean): Hint[] {
  const mute: Hint = { keys: ['M'], label: isMuted ? t.common.unmute : t.common.mute };

  switch (phase) {
    case 'REWARD':
      return [
        { keys: ['1', '2', '3'], label: t.hints.pickCard },
        { keys: ['0', 'S'], label: t.hints.skip },
        mute,
      ];
    case 'VICTORY':
      return [{ keys: ['Enter'], label: t.result.continueEndless }, { keys: ['R'], label: t.common.retry }, mute];
    case 'GAME_OVER':
      return [{ keys: ['R'], label: t.common.retry }, mute];
    case 'AIMING':
      return [
        { keys: ['A', 'D'], label: t.hints.move },
        { keys: ['←', '→'], label: t.hints.move },
        { keys: ['Space', 'Enter'], label: t.hints.launch },
        mute,
      ];
    default:
      return [
        { keys: ['A', 'D'], label: t.hints.move },
        { keys: ['←', '→'], label: t.hints.move },
        mute,
      ];
  }
}

/** 키보드가 없는 기기용. 있지도 않은 키를 안내하는 대신 실제로 되는 제스처를 알려준다. */
function touchHints(t: Strings, phase: GamePhase): Hint[] {
  switch (phase) {
    case 'REWARD':
      return [{ keys: [t.hints.tap], label: t.hints.pickOrSkip }];
    case 'VICTORY':
      return [{ keys: [t.hints.tap], label: t.hints.continueOrRetry }];
    case 'GAME_OVER':
      return [{ keys: [t.hints.tap], label: t.common.retry }];
    case 'AIMING':
      return [
        { keys: [t.hints.drag], label: t.hints.movePaddle },
        { keys: [t.hints.tap], label: t.hints.launch },
      ];
    default:
      return [{ keys: [t.hints.drag], label: t.hints.movePaddle }];
  }
}

/** 화면 하단의 은은한 조작 가이드. 기기의 주 입력 장치에 맞춰 키보드 또는 터치 안내를 보여준다. */
export function KeyHints({ phase, isMuted }: KeyHintsProps) {
  const t = useStrings();
  const isTouch = useIsTouchPrimary();
  const hints = isTouch ? touchHints(t, phase) : keyboardHints(t, phase, isMuted);

  return (
    <ul
      aria-label={isTouch ? t.hints.touchAria : t.hints.keyboardAria}
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
