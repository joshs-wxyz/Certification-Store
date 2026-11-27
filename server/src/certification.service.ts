import type { Certification } from './schema.js';

export interface CertificationStore {
  listForUser(userId: number): Certification[];
  addForUser(userId: number, certification: Certification): void;
  removeForUser(userId: number, id: string): void;
}
