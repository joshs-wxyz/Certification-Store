import { TestBed } from '@angular/core/testing';
import { SEED_CERTIFICATIONS } from '../data/seed-certifications';
import { CERTIFICATIONS_STORAGE_KEY, CertificationStore } from './certification.store';

describe('CertificationStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('seeds the catalog on first load', () => {
    const store = TestBed.inject(CertificationStore);
    expect(store.count()).toBe(SEED_CERTIFICATIONS.length);
  });

  it('adds a certification to the top and persists it', () => {
    const store = TestBed.inject(CertificationStore);
    const created = store.add({
      title: 'Internal Security Champion',
      vendor: 'Acme',
      level: 'Foundational',
      shortDescription: 'Short',
      description: 'Long',
      intendedFor: ['Developers'],
    });

    expect(created.id).toMatch(/^internal-security-champion-/);
    expect(store.certifications()[0].id).toBe(created.id);
    expect(store.find(created.id)?.title).toBe('Internal Security Champion');

    const persisted = JSON.parse(localStorage.getItem(CERTIFICATIONS_STORAGE_KEY)!);
    expect(persisted[0].id).toBe(created.id);
  });

  it('removes a certification and can restore defaults', () => {
    const store = TestBed.inject(CertificationStore);
    const firstId = store.certifications()[0].id;

    store.remove(firstId);
    expect(store.find(firstId)).toBeUndefined();
    expect(store.count()).toBe(SEED_CERTIFICATIONS.length - 1);

    store.restoreDefaults();
    expect(store.count()).toBe(SEED_CERTIFICATIONS.length);
  });

  it('loads previously persisted data', () => {
    localStorage.setItem(CERTIFICATIONS_STORAGE_KEY, JSON.stringify([SEED_CERTIFICATIONS[0]]));
    const store = TestBed.inject(CertificationStore);
    expect(store.count()).toBe(1);
  });
});
