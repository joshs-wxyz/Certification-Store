import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ResourceType, StudyPlanResponse } from '../../core/models/study-plan';

const RESOURCE_LABELS: Record<ResourceType, string> = {
  'official-docs': 'Official docs',
  course: 'Course',
  book: 'Book',
  'practice-exam': 'Practice exam',
  'hands-on-lab': 'Hands-on lab',
  community: 'Community',
  other: 'Other',
};

@Component({
  selector: 'app-study-plan-view',
  imports: [DatePipe],
  templateUrl: './study-plan-view.html',
  styleUrl: './study-plan-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudyPlanView {
  readonly response = input.required<StudyPlanResponse>();

  protected readonly plan = computed(() => this.response().plan);
  protected readonly providerLabel = computed(() =>
    this.response().provider === 'github-copilot' ? 'GitHub Copilot' : 'Google Gemini',
  );
  protected readonly totalHours = computed(() =>
    this.plan().weeks.reduce((sum, w) => sum + (Number(w.estimatedHours) || 0), 0),
  );

  protected resourceLabel(type: ResourceType): string {
    return RESOURCE_LABELS[type] ?? type;
  }
}
