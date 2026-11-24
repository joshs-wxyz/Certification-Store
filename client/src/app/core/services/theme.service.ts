import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'cs.theme';
const ORDER: ThemePreference[] = ['system', 'light', 'dark'];

/** Sets `data-theme` on <html>; "system" removes it so `prefers-color-scheme` applies. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  readonly preference = signal<ThemePreference>(readPreference());

  constructor() {
    effect(() => {
      const pref = this.preference();
      if (pref === 'system') this.root.removeAttribute('data-theme');
      else this.root.setAttribute('data-theme', pref);
      try {
        localStorage.setItem(STORAGE_KEY, pref);
      } catch {
        /* ignore */
      }
    });
  }

  cycle(): void {
    const next = ORDER[(ORDER.indexOf(this.preference()) + 1) % ORDER.length];
    this.preference.set(next);
  }
}

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    /* ignore */
  }
  return 'system';
}
