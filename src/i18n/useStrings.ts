import { createContext, useContext } from 'react';
import { DEFAULT_LANGUAGE, STRINGS } from './strings';
import type { Strings } from './strings';

/** 현재 언어의 문구 사전. App 이 설정값에 맞는 사전을 내려 준다. */
export const StringsContext = createContext<Strings>(STRINGS[DEFAULT_LANGUAGE]);

export function useStrings(): Strings {
  return useContext(StringsContext);
}
