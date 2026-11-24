// Mirrors server/src/schema.ts. Keep in sync (or extract to a shared package later).

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface StudyPlanPreferences {
  experienceLevel: ExperienceLevel;
  weeks: number;
  hoursPerWeek: number;
  focusNotes?: string;
}

export type ResourceType =
  | 'official-docs'
  | 'course'
  | 'book'
  | 'practice-exam'
  | 'hands-on-lab'
  | 'community'
  | 'other';

export interface StudyPlanWeek {
  week: number;
  theme: string;
  objectives: string[];
  activities: string[];
  estimatedHours: number;
}

export interface StudyPlan {
  summary: string;
  totalWeeks: number;
  hoursPerWeek: number;
  prerequisites: string[];
  weeks: StudyPlanWeek[];
  resources: { title: string; type: ResourceType; note: string }[];
  examTips: string[];
}

export type ProviderName = 'github-copilot' | 'gemini';

export interface StudyPlanResponse {
  plan: StudyPlan;
  provider: ProviderName;
  model: string | null;
  fallbackReason?: string;
  generatedAt: string;
}
