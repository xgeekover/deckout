import { useCallback, useEffect, useRef } from 'react';

/**
 * 모달이 뜬 직후의 입력을 잠깐 무시하기 위한 훅.
 *
 * 공을 쏘려고 Space 나 클릭을 연타하던 중에 웨이브가 끝나거나 게임 오버가 되면,
 * 그 연타가 방금 뜬 모달의 버튼에 그대로 꽂혀 보상이 멋대로 골라지거나 결과창을 보기도 전에
 * 재시작돼 버린다. 뜬 뒤 graceMs 동안은 "아직 장전되지 않음"으로 친다.
 */
export function useActivationGrace(graceMs = 500): () => boolean {
  const armedAt = useRef(Number.POSITIVE_INFINITY);

  useEffect(() => {
    armedAt.current = performance.now() + graceMs;
  }, [graceMs]);

  return useCallback(() => performance.now() >= armedAt.current, []);
}
