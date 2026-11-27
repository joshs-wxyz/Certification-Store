import { z } from 'zod';

export const CertificationSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  vendor: z.string().max(100),
  level: z.enum(['Foundational', 'Associate', 'Professional', 'Specialty', 'Expert']),
  shortDescription: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(4000),
  intendedFor: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
  createdAt: z.iso.datetime(),
});
export type Certification = z.infer<typeof CertificationSchema>;

/** Payload the Angular client sends with each study-plan request. */
export const StudyPlanRequestSchema = z.object({
  certification: z.object({
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(200),
    vendor: z.string().max(100).optional(),
    level: z.string().max(50).optional(),
    description: z.string().min(1).max(4000),
    intendedFor: z.array(z.string().max(200)).max(20),
  }),
  preferences: z.object({
    experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
    weeks: z.number().int().min(1).max(26),
    hoursPerWeek: z.number().int().min(1).max(40),
    focusNotes: z.string().max(1000).optional(),
  }),
});
export type StudyPlanRequest = z.infer<typeof StudyPlanRequestSchema>;

/**
 * Shape both providers must return. Kept free of numeric/length constraints so it
 * works with Gemini structured output (JSON Schema) and the Copilot SDK's response schema alike.
 */
export const StudyPlanSchema = z.object({
  summary: z.string().describe('Two or three sentences describing the overall approach.'),
  totalWeeks: z.number().describe('Number of weeks in the plan.'),
  hoursPerWeek: z.number().describe('Planned study hours per week.'),
  prerequisites: z.array(z.string()).describe('Knowledge the learner should have or review first.'),
  weeks: z
    .array(
      z.object({
        week: z.number(),
        theme: z.string(),
        objectives: z.array(z.string()),
        activities: z.array(z.string()),
        estimatedHours: z.number(),
      }),
    )
    .describe('One entry per week, in order.'),
  resources: z.array(
    z.object({
      title: z.string(),
      type: z.enum(['official-docs', 'course', 'book', 'practice-exam', 'hands-on-lab', 'community', 'other']),
      note: z.string(),
    }),
  ),
  examTips: z.array(z.string()),
});
export type StudyPlan = z.infer<typeof StudyPlanSchema>;

export type ProviderName = 'github-copilot' | 'gemini';

export interface StudyPlanResponse {
  plan: StudyPlan;
  provider: ProviderName;
  model: string | null;
  /** Present when the primary provider failed and the fallback produced the plan. */
  fallbackReason?: string;
  generatedAt: string;
}
