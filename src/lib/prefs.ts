// Preferências de exibição de cada aparelho (ficam só neste celular).

import { useSyncExternalStore } from 'react';

export interface Prefs {
  fontSize: number;
  showChords: boolean;
  showSectionLabels: boolean;
  theme: 'dark' | 'light';
  /** Ajuste fino da rolagem automática por música (multiplicador). */
  scrollFactor: Record<string, number>;
}

const KEY = 'cifras-louvor:prefs';
const DEFAULTS: Prefs = {
  fontSize: 18,
  showChords: true,
  showSectionLabels: true,
  theme: 'dark',
  scrollFactor: {},
};

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* modo privado ou dados corrompidos */
  }
  return DEFAULTS;
}

let current = load();
const listeners = new Set<() => void>();

export function setPrefs(patch: Partial<Prefs> | ((p: Prefs) => Partial<Prefs>)) {
  const delta = typeof patch === 'function' ? patch(current) : patch;
  current = { ...current, ...delta };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignora */
  }
  listeners.forEach((l) => l());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

export const FONT_MIN = 12;
export const FONT_MAX = 40;
