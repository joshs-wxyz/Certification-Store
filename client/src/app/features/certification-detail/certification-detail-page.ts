import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CertificationStore } from '../../core/services/certification.store';
import { StudyPlanGenerator } from '../study-plan/study-plan-generator';

@Component({
  selector: 'app-certification-detail-page',
  imports: [RouterLink, StudyPlanGenerator],
  templateUrl: './certification-detail-page.html',
  styleUrl: './certification-detail-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificationDetailPage {
  /** Bound from the `:id` route param via withComponentInputBinding(). */
  readonly id = input.required<string>();

  protected readonly store = inject(CertificationStore);
  protected readonly certification = computed(() => this.store.find(this.id()));
}
