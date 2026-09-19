import { useCallback, useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
}

interface LockableOrientation {
  lock?: (orientation: 'landscape') => Promise<void>;
  unlock?: () => void;
}

export interface FullscreenControl {
  /** 이 브라우저가 페이지 전체 화면을 지원하는가. 아이폰 Safari 는 동영상 말고는 지원하지 않는다. */
  supported: boolean;
  active: boolean;
  toggle: () => void;
}

/**
 * 페이지 전체 화면(Fullscreen API).
 * 들어갈 때 가로 고정을 시도한다 — 플레이 필드가 가로로 긴 900×640 이라 세로 화면에서는 작게 보인다.
 * 방향 고정은 안드로이드 크롬의 전체 화면에서만 되므로 실패는 조용히 무시한다.
 */
export function useFullscreen(): FullscreenControl {
  const active = useSyncExternalStore(
    subscribe,
    () => document.fullscreenElement !== null,
    () => false,
  );

  const supported =
    typeof document.documentElement.requestFullscreen === 'function' &&
    document.fullscreenEnabled !== false;

  const toggle = useCallback(() => {
    const orientation = screen.orientation as unknown as LockableOrientation | undefined;
    if (document.fullscreenElement) {
      orientation?.unlock?.();
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    void document.documentElement
      .requestFullscreen({ navigationUI: 'hide' })
      .then(() => orientation?.lock?.('landscape'))
      .catch(() => undefined);
  }, []);

  return { supported, active, toggle };
}
