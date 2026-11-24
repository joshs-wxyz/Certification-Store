import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Certification } from '../../core/models/certification';
import { ExperienceLevel, StudyPlanResponse } from '../../core/models/study-plan';
import { StudyPlanApi } from '../../core/services/study-plan.api';
import { StudyPlanView } from './study-plan-view';

@Component({
  selector: 'app-study-plan-generator',
  imports: [ReactiveFormsModule, StudyPlanView],
  templateUrl: './study-plan-generator.html',
  styleUrl: './study-plan-generator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudyPlanGenerator {
  readonly certification = input.required<Certification>();

  private readonly api = inject(StudyPlanApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  private inFlight?: Subscription;

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<StudyPlanResponse | null>(null);

  protected readonly form = this.fb.group({
    experienceLevel: this.fb.control<ExperienceLevel>('intermediate'),
    weeks: [6, [Validators.required, Validators.min(1), Validators.max(26)]],
    hoursPerWeek: [5, [Validators.required, Validators.min(1), Validators.max(40)]],
    focusNotes: ['', Validators.maxLength(1000)],
  });

  protected generate(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.inFlight?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);

    const v = this.form.getRawValue();
    this.inFlight = this.api
      .generate(this.certification(), {
        experienceLevel: v.experienceLevel,
        weeks: Number(v.weeks),
        hoursPerWeek: Number(v.hoursPerWeek),
        focusNotes: v.focusNotes,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.result.set(res);
          this.loading.set(false);
        },
        error: (err: Error) => {
          this.error.set(err.message);
          this.loading.set(false);
        },
      });
  }

  protected cancel(): void {
    this.inFlight?.unsubscribe();
    this.loading.set(false);
  }
}
