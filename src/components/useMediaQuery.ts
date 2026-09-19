import { useCallback, useSyncExternalStore } from 'react';

/** CSS 미디어 쿼리의 현재 일치 여부. 화면 회전·창 크기 변경을 구독한다. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
