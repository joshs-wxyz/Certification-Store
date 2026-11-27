import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from './auth.api';
import { CertificationApi } from './certification.api';
import { Certification, NewCertification } from '../models/certification';

export const CERTIFICATIONS_STORAGE_KEY = 'cs.certifications.v1';

@Injectable({ providedIn: 'root' })
export class CertificationStore {
  private readonly auth = inject(AuthApi);
  private readonly api = inject(CertificationApi);
  readonly accountError = signal('');
  readonly loading = signal(!this.auth.sessionReady() || this.auth.currentUser() !== null);
  private readonly localCatalog = signal<Certification[]>(this.loadLocal());
  private readonly state = signal<Certification[]>([...this.localCatalog()]);
  readonly unsavedIds = signal<ReadonlySet<string>>(new Set(this.localCatalog().map(({ id }) => id)));
  private activeAccountId: number | null = null;
  private accountInitialized = false;
  private loadVersion = 0;

  readonly certifications = this.state.asReadonly();
  readonly count = computed(() => this.state().length);
  readonly signedIn = computed(() => this.auth.currentUser() !== null);

  constructor() {
    effect(() => {
      if (!this.auth.sessionReady()) {
        this.loading.set(true);
        return;
      }
      this.activateAccount(this.auth.currentUser()?.id ?? null);
    });
  }

  find(id: string): Certification | undefined {
    return this.state().find((certification) => certification.id === id);
  }

  isUnsaved(id: string): boolean {
    return this.unsavedIds().has(id);
  }

  async add(input: NewCertification): Promise<Certification> {
    const certification: Certification = {
      ...input,
      id: this.createId(input.title),
      createdAt: new Date().toISOString(),
    };
    const accountId = this.auth.currentUser()?.id ?? null;

    if (accountId === null) {
      const next = [certification, ...this.localCatalog()];
      this.updateLocalCatalog(next);
      this.state.set(next);
      this.unsavedIds.update((ids) => new Set(ids).add(certification.id));
      this.accountError.set('');
      return certification;
    }

    this.ensureAccountReady(accountId);
    try {
      const saved = await firstValueFrom(this.api.add(certification));
      if (this.activeAccountId === accountId) this.state.update((list) => [saved, ...list]);
      this.accountError.set('');
      return saved;
    } catch (error) {
      if (this.activeAccountId === accountId) this.accountError.set(errorMessage(error));
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const accountId = this.auth.currentUser()?.id ?? null;
    if (accountId === null || this.isUnsaved(id)) {
      const next = this.localCatalog().filter((certification) => certification.id !== id);
      this.updateLocalCatalog(next);
      if (accountId === null) this.state.set(next);
      else this.state.update((list) => list.filter((certification) => certification.id !== id));
      if (accountId === null) this.accountError.set('');
      this.unsavedIds.update((ids) => {
        const updated = new Set(ids);
        updated.delete(id);
        return updated;
      });
      return;
    }

    this.ensureAccountReady(accountId);
    try {
      await firstValueFrom(this.api.remove(id));
      if (this.activeAccountId === accountId) {
        this.state.update((list) => list.filter((certification) => certification.id !== id));
      }
      this.accountError.set('');
    } catch (error) {
      if (this.activeAccountId === accountId) this.accountError.set(errorMessage(error));
      throw error;
    }
  }

  async saveToAccount(id: string): Promise<Certification> {
    const accountId = this.auth.currentUser()?.id;
    if (accountId === undefined) {
      throw new Error('Sign in before saving a certification to your account.');
    }

    this.ensureAccountReady(accountId);
    const draft = this.localCatalog().find((certification) => certification.id === id);
    if (!draft || !this.isUnsaved(id)) {
      throw new Error('This certification is not an unsaved local draft.');
    }

    try {
      const saved = await firstValueFrom(this.api.add(draft));
      if (this.activeAccountId === accountId) {
        this.state.update((list) => list.map((certification) => (certification.id === id ? saved : certification)));
      } else {
        this.state.update((list) => list.filter((certification) => certification.id !== id));
      }
      this.unsavedIds.update((ids) => {
        const updated = new Set(ids);
        updated.delete(id);
        return updated;
      });
      this.accountError.set('');

      const remainingDrafts = this.localCatalog().filter((certification) => certification.id !== id);
      try {
        this.updateLocalCatalog(remainingDrafts);
      } catch {
        this.accountError.set('Saved to your account, but the local draft could not be removed.');
      }
      return saved;
    } catch (error) {
      if (this.activeAccountId === accountId) this.accountError.set(errorMessage(error));
      throw error;
    }
  }

  reloadAccountCatalog(): void {
    const accountId = this.auth.currentUser()?.id;
    if (accountId !== undefined) this.loadAccount(accountId);
  }

  private activateAccount(accountId: number | null): void {
    if (this.accountInitialized && this.activeAccountId === accountId) {
      this.loading.set(false);
      return;
    }

    this.accountInitialized = true;
    this.activeAccountId = accountId;
    this.accountError.set('');
    this.loadVersion++;

    if (accountId === null) {
      const drafts = this.localCatalog();
      this.state.set(drafts);
      this.unsavedIds.set(new Set(drafts.map(({ id }) => id)));
      this.loading.set(false);
      return;
    }

    const drafts = this.localCatalog();
    this.state.set(drafts);
    this.unsavedIds.set(new Set(drafts.map(({ id }) => id)));
    this.loadAccount(accountId);
  }

  private loadAccount(accountId: number): void {
    const version = ++this.loadVersion;
    this.loading.set(true);
    this.accountError.set('');
    this.api.list().subscribe({
      next: (certifications) => {
        if (version !== this.loadVersion || this.activeAccountId !== accountId) return;
        const savedIds = new Set(certifications.map(({ id }) => id));
        const drafts = this.localCatalog().filter(({ id }) => !savedIds.has(id));
        this.unsavedIds.set(new Set(drafts.map(({ id }) => id)));
        this.state.set([...drafts, ...certifications]);
        this.accountError.set('');
        this.loading.set(false);
      },
      error: (error: Error) => {
        if (version !== this.loadVersion || this.activeAccountId !== accountId) return;
        this.accountError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  private ensureAccountReady(accountId: number): void {
    if (this.loading() || this.activeAccountId !== accountId || this.accountError()) {
      const error = new Error('Your account catalog is not ready. Retry loading it before changing certifications.');
      this.accountError.set(error.message);
      throw error;
    }
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

  private loadLocal(): Certification[] {
    try {
      const raw = localStorage.getItem(CERTIFICATIONS_STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Certification[];
      throw new Error('Saved guest catalog has an invalid format.');
    } catch (error) {
      this.accountError.set(errorMessage(error, 'Could not read the guest catalog from browser storage.'));
      return [];
    }
  }

  private persistLocal(list: Certification[]): void {
    try {
      localStorage.setItem(CERTIFICATIONS_STORAGE_KEY, JSON.stringify(list));
    } catch {
      const error = new Error('Could not save the guest catalog to browser storage.');
      this.accountError.set(error.message);
      throw error;
    }
  }

  private updateLocalCatalog(list: Certification[]): void {
    this.persistLocal(list);
    this.localCatalog.set(list);
  }
}

function errorMessage(error: unknown, fallback = 'Could not load the certification catalog.'): string {
  return error instanceof Error ? error.message : fallback;
}
