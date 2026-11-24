import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { Certification } from '../models/certification';
import { StudyPlanPreferences, StudyPlanResponse } from '../models/study-plan';

/** Calls the BFF. API keys never reach the browser - the server holds them. */
@Injectable({ providedIn: 'root' })
export class StudyPlanApi {
  private readonly http = inject(HttpClient);

  generate(certification: Certification, preferences: StudyPlanPreferences): Observable<StudyPlanResponse> {
    const body = {
      certification: {
        id: certification.id,
        title: certification.title,
        vendor: certification.vendor || undefined,
        level: certification.level,
        description: certification.description,
        intendedFor: certification.intendedFor,
      },
      preferences: {
        ...preferences,
        focusNotes: preferences.focusNotes?.trim() || undefined,
      },
    };

    return this.http
      .post<StudyPlanResponse>('/api/study-plan', body)
      .pipe(catchError((err: HttpErrorResponse) => throwError(() => new Error(toMessage(err)))));
  }
}

function toMessage(err: HttpErrorResponse): string {
  if (err.status === 0) return 'Could not reach the study plan service. Is the server running?';
  if (err.status === 400) return 'The request was rejected as invalid. Please check the form values.';
  if (err.status === 502) {
    const failures = (err.error?.failures ?? []) as { provider: string; reason: string }[];
    const detail = failures.map((f) => `${f.provider}: ${f.reason}`).join(' · ');
    return `Both AI providers failed to generate a plan.${detail ? ` (${detail})` : ''}`;
  }
  return err.error?.error ?? `Unexpected error (${err.status}).`;
}
