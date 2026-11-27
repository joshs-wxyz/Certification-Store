import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { Certification } from '../models/certification';

interface CertificationListResponse {
  certifications: Certification[];
}

interface CertificationResponse {
  certification: Certification;
}

@Injectable({ providedIn: 'root' })
export class CertificationApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Certification[]> {
    return this.http.get<CertificationListResponse>('/api/certifications').pipe(
      map(({ certifications }) => certifications),
      catchError((error: HttpErrorResponse) => throwError(() => new Error(toMessage(error)))),
    );
  }

  add(certification: Certification): Observable<Certification> {
    return this.http.post<CertificationResponse>('/api/certifications', certification).pipe(
      map(({ certification: saved }) => saved),
      catchError((error: HttpErrorResponse) => throwError(() => new Error(toMessage(error)))),
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/certifications/${encodeURIComponent(id)}`).pipe(
      catchError((error: HttpErrorResponse) => throwError(() => new Error(toMessage(error)))),
    );
  }
}

function toMessage(error: HttpErrorResponse): string {
  if (error.status === 0) return 'Could not reach the certification service. Is the server running?';
  return error.error?.error ?? `Unexpected error (${error.status}).`;
}
