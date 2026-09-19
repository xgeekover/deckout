/**
 * LocalStorage 기반 영속화 — 최고 기록과 사용자 환경설정.
 *
 * 저장소는 언제든 실패할 수 있다고 가정한다: 사파리 사생활 보호 모드는 setItem 에서 던지고,
 * 용량이 찰 수도 있고, 사용자가 개발자 도구로 값을 망가뜨릴 수도 있다.
 * 그래서 (1) 모든 접근을 try/catch 로 감싸고 (2) 읽은 값은 반드시 정제(sanitize)하며
 * (3) 저장에 실패해도 게임은 메모리상의 값으로 계속 돌아가게 한다.
 *
 * 백엔드를 인자로 주입받으므로 DOM 없이(Node 에서) 그대로 검증할 수 있다.
 */

import { DEFAULT_LANGUAGE, isLanguage } from '../i18n/strings.ts';
import type { Language } from '../i18n/strings.ts';

export type ControlMode = 'mouse' | 'keyboard';

export interface Records {
  /** 최고 점수 */
  highScore: number;
  /** 도달한 최고 웨이브 */
  maxWave: number;
  /** 모든 판을 통틀어 파괴한 벽돌 수 */
  totalBricksDestroyed: number;
}

export interface Settings {
  isMuted: boolean;
  controlMode: ControlMode;
  /** 화면 문구의 언어. 이 필드가 없던 시절에 저장된 설정은 기본값(영어)으로 읽힌다. */
  language: Language;
  /** 주사선·비네트 오버레이. 없던 필드는 켜진 것으로 읽힌다. */
  crt: boolean;
}

/** 기록 갱신에 필요한 한 판의 결과 */
export interface RunResult {
  score: number;
  wave: number;
  bricksDestroyed: number;
}

export interface RecordUpdate {
  records: Records;
  isNewHighScore: boolean;
  isNewMaxWave: boolean;
  /** 갱신 직전의 기록 (결과창에서 "이전 최고 12,300" 처럼 보여줄 때 쓴다) */
  previous: Records;
}

/** localStorage 의 부분집합. 테스트에서는 Map 으로 흉내 낸다. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// 스키마를 바꾸면 버전을 올린다. 옛 키는 그냥 무시되어 기본값에서 다시 시작한다.
export const RECORDS_KEY = 'deckout:records:v1';
export const SETTINGS_KEY = 'deckout:settings:v1';

export const DEFAULT_RECORDS: Records = { highScore: 0, maxWave: 0, totalBricksDestroyed: 0 };
export const DEFAULT_SETTINGS: Settings = { isMuted: false, controlMode: 'mouse', language: DEFAULT_LANGUAGE, crt: true };

/** 브라우저의 localStorage. 쓸 수 없는 환경이면 null. */
export function getDefaultStore(): KeyValueStore | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    // 존재하지만 쓰기가 막힌 환경(사생활 보호 모드 등)을 걸러낸다.
    const probe = 'deckout:probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

const toCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

/** 어떤 값이 들어와도 유효한 Records 로 만든다. */
export function sanitizeRecords(raw: unknown): Records {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_RECORDS };
  const r = raw as Record<string, unknown>;
  return {
    highScore: toCount(r.highScore),
    maxWave: toCount(r.maxWave),
    totalBricksDestroyed: toCount(r.totalBricksDestroyed),
  };
}

export function sanitizeSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const r = raw as Record<string, unknown>;
  return {
    isMuted: r.isMuted === true,
    controlMode: r.controlMode === 'keyboard' ? 'keyboard' : 'mouse',
    language: isLanguage(r.language) ? r.language : DEFAULT_LANGUAGE,
    crt: r.crt !== false,
  };
}

function read(store: KeyValueStore | null, key: string): unknown {
  if (!store) return null;
  try {
    const text = store.getItem(key);
    return text === null ? null : JSON.parse(text);
  } catch {
    return null; // 깨진 JSON 은 없는 것으로 친다
  }
}

/** 저장 성공 여부를 돌려준다. 실패해도 던지지 않는다. */
function write(store: KeyValueStore | null, key: string, value: unknown): boolean {
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadRecords(store: KeyValueStore | null = getDefaultStore()): Records {
  return sanitizeRecords(read(store, RECORDS_KEY));
}

export function saveRecords(records: Records, store: KeyValueStore | null = getDefaultStore()): boolean {
  return write(store, RECORDS_KEY, sanitizeRecords(records));
}

export function loadSettings(store: KeyValueStore | null = getDefaultStore()): Settings {
  return sanitizeSettings(read(store, SETTINGS_KEY));
}

export function saveSettings(settings: Settings, store: KeyValueStore | null = getDefaultStore()): boolean {
  return write(store, SETTINGS_KEY, sanitizeSettings(settings));
}

/**
 * 끝난 판을 기록에 반영한다. 최고 점수/웨이브는 더 클 때만 바뀌고, 파괴 수는 누적된다.
 *
 * 신기록 판정
 *  - 최고 점수: 이전 기록을 "넘었을" 때. 0점은 신기록이 아니다.
 *  - 최고 웨이브: 이전 기록을 넘었고 2웨이브 이상일 때.
 *    (첫 판에 1웨이브에서 죽어도 "신기록: 웨이브 1" 이 뜨는 것은 민망하다.)
 */
export function submitRun(run: RunResult, store: KeyValueStore | null = getDefaultStore()): RecordUpdate {
  const previous = loadRecords(store);
  const score = toCount(run.score);
  const wave = toCount(run.wave);

  const isNewHighScore = score > previous.highScore;
  const isNewMaxWave = wave > previous.maxWave && wave > 1;

  const records: Records = {
    highScore: Math.max(previous.highScore, score),
    maxWave: Math.max(previous.maxWave, wave),
    totalBricksDestroyed: previous.totalBricksDestroyed + toCount(run.bricksDestroyed),
  };
  saveRecords(records, store);
  return { records, isNewHighScore, isNewMaxWave, previous };
}

/** 판을 도중에 버릴 때(새 게임) 그동안 파괴한 벽돌만 누적한다. */
export function addBricksDestroyed(count: number, store: KeyValueStore | null = getDefaultStore()): Records {
  const previous = loadRecords(store);
  const records = { ...previous, totalBricksDestroyed: previous.totalBricksDestroyed + toCount(count) };
  saveRecords(records, store);
  return records;
}
