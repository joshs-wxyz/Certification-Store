import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthApi } from './auth.api';
import { CERTIFICATIONS_STORAGE_KEY, CertificationStore } from './certification.store';

describe('CertificationStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(AuthApi).sessionReady.set(true);
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  const certification = {
    title: 'Internal Security Champion',
    vendor: 'Acme',
    level: 'Foundational' as const,
    shortDescription: 'Short',
    description: 'Long',
    intendedFor: ['Developers'],
  };

  it('starts with an empty catalog when browser storage is empty', () => {
    const store = TestBed.inject(CertificationStore);
    expect(store.certifications()).toEqual([]);
  });

  it('adds a guest certification to browser storage', async () => {
    const store = TestBed.inject(CertificationStore);
    const created = await store.add(certification);

    expect(created.id).toMatch(/^internal-security-champion-/);
    expect(store.certifications()[0].id).toBe(created.id);
    expect(store.find(created.id)?.title).toBe('Internal Security Champion');

    const persisted = JSON.parse(localStorage.getItem(CERTIFICATIONS_STORAGE_KEY)!);
    expect(persisted[0].id).toBe(created.id);
  });

  it('removes a guest certification from browser storage', async () => {
    const store = TestBed.inject(CertificationStore);
    const created = await store.add(certification);

    await store.remove(created.id);
    expect(store.find(created.id)).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(CERTIFICATIONS_STORAGE_KEY)!)).toEqual([]);
  });

  it('loads previously persisted data', () => {
    const saved = { ...certification, id: 'existing-cert', createdAt: new Date().toISOString() };
    localStorage.setItem(CERTIFICATIONS_STORAGE_KEY, JSON.stringify([saved]));
    const store = TestBed.inject(CertificationStore);
    expect(store.certifications()).toEqual([saved]);
  });

  it('loads and writes a signed-in user catalog in the API, keeping guest data local', async () => {
    const guest = { ...certification, id: 'guest-cert', createdAt: new Date().toISOString() };
    localStorage.setItem(CERTIFICATIONS_STORAGE_KEY, JSON.stringify([guest]));

    const store = TestBed.inject(CertificationStore);
    const auth = TestBed.inject(AuthApi);
    const http = TestBed.inject(HttpTestingController);
    auth.currentUser.set({ id: 12, name: 'Jordan', email: 'jordan@example.com' });
    TestBed.flushEffects();

    const listRequest = http.expectOne('/api/certifications');
    expect(listRequest.request.method).toBe('GET');
    listRequest.flush({ certifications: [] });
    expect(store.certifications()).toEqual([guest]);
    expect(store.isUnsaved(guest.id)).toBe(true);

    const addPromise = store.add(certification);
    const addRequest = http.expectOne('/api/certifications');
    expect(addRequest.request.method).toBe('POST');
    expect(addRequest.request.body.title).toBe(certification.title);
    const accountCertification = {
      ...addRequest.request.body,
    };
    addRequest.flush({ certification: accountCertification });
    await addPromise;
    expect(store.certifications()).toEqual([accountCertification, guest]);
    expect(JSON.parse(localStorage.getItem(CERTIFICATIONS_STORAGE_KEY)!)).toEqual([guest]);

    auth.currentUser.set(null);
    TestBed.flushEffects();
    expect(store.certifications()).toEqual([guest]);
    expect(store.isUnsaved(guest.id)).toBe(true);
  });

  it('saves a local draft to the signed-in account and removes its unsaved label', async () => {
    const guest = { ...certification, id: 'guest-cert', createdAt: new Date().toISOString() };
    localStorage.setItem(CERTIFICATIONS_STORAGE_KEY, JSON.stringify([guest]));

    const store = TestBed.inject(CertificationStore);
    const auth = TestBed.inject(AuthApi);
    const http = TestBed.inject(HttpTestingController);
    auth.currentUser.set({ id: 21, name: 'Jordan', email: 'jordan@example.com' });
    TestBed.flushEffects();
    http.expectOne('/api/certifications').flush({ certifications: [] });

    const saving = store.saveToAccount(guest.id);
    const request = http.expectOne('/api/certifications');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(guest);
    request.flush({ certification: guest });
    await saving;

    expect(store.isUnsaved(guest.id)).toBe(false);
    expect(store.certifications()).toEqual([guest]);
    expect(JSON.parse(localStorage.getItem(CERTIFICATIONS_STORAGE_KEY)!)).toEqual([]);
  });
});
