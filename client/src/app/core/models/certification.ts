export const CERTIFICATION_LEVELS = ['Foundational', 'Associate', 'Professional', 'Specialty', 'Expert'] as const;
export type CertificationLevel = (typeof CERTIFICATION_LEVELS)[number];

export interface Certification {
  id: string;
  title: string;
  vendor: string;
  level: CertificationLevel;
  /** One-liner shown on the catalog panel. */
  shortDescription: string;
  /** Full description shown on the details page. */
  description: string;
  /** Who the certification is intended for (roles / profiles). */
  intendedFor: string[];
  createdAt: string;
}

export type NewCertification = Omit<Certification, 'id' | 'createdAt'>;
