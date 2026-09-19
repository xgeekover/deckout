import { useMediaQuery } from './useMediaQuery';

/**
 * 주 입력 장치가 터치인 기기인가 (호버가 없고 포인터가 거칠다 = 폰/태블릿).
 * 키보드가 없는 기기에 "Space 로 발사" 같은 안내를 보여주지 않기 위한 판별이다.
 * 태블릿에 키보드를 붙였다 떼는 경우처럼 도중에 바뀔 수 있어 변경을 구독한다.
 */
export function useIsTouchPrimary(): boolean {
  return useMediaQuery('(hover: none) and (pointer: coarse)');
}
