import type { ProviderName, StudyPlan, StudyPlanRequest } from '../schema.js';

export interface StudyPlanProvider {
  readonly name: ProviderName;
  readonly model: string | null;
  generate(request: StudyPlanRequest): Promise<StudyPlan>;
  dispose?(): Promise<void>;
}
