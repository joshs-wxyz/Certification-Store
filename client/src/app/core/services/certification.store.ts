import { Injectable, computed, signal } from '@angular/core';
import { SEED_CERTIFICATIONS } from '../data/seed-certifications';
import { Certification, NewCertification } from '../models/certification';

export const CERTIFICATIONS_STORAGE_KEY = 'cs.certifications.v1';

/**
 * Signal-based catalog store persisted to localStorage.
 * Draft-stage persistence: swap `load`/`persist` for HTTP calls when a real catalog API exists.
 */
@Injectable({ providedIn: 'root' })
export class CertificationStore {
  private readonly state = signal<Certification[]>(this.load());

  readonly certifications = this.state.asReadonly();
  readonly count = computed(() => this.state().length);

  find(id: string): Certification | undefined {
    return this.state().find((c) => c.id === id);
  }

  add(input: NewCertification): Certification {
    const certification: Certification = {
      ...input,
      id: this.createId(input.title),
      createdAt: new Date().toISOString(),
    };
    this.update((list) => [certification, ...list]);
    return certification;
  }

  remove(id: string): void {
    this.update((list) => list.filter((c) => c.id !== id));
  }

  restoreDefaults(): void {
    this.update(() => structuredClone([...SEED_CERTIFICATIONS]));
  }

  private update(fn: (list: Certification[]) => Certification[]): void {
    this.state.update(fn);
    this.persist(this.state());
  }

  private createId(title: string): string {
    const slug = title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    const suffix = Math.random().toString(36).slice(2, 6);
    return `${slug || 'certification'}-${suffix}`;
  }

  private load(): Certification[] {
    try {
      const raw = localStorage.getItem(CERTIFICATIONS_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as Certification[];
      }
    } catch {
      // Storage unavailable or corrupt - fall back to seed data.
    }
    return structuredClone([...SEED_CERTIFICATIONS]);
  }

  private persist(list: Certification[]): void {
    try {
      localStorage.setItem(CERTIFICATIONS_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Storage full or blocked - keep working in memory.
    }
  }
}
