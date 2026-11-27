import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { AuthUser, LoginCredentials, RegisterCredentials } from '../models/auth';

interface AuthResponse {
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  readonly currentUser = signal<AuthUser | null>(null);
  readonly sessionReady = signal(false);

  restoreSession(): Observable<AuthUser | null> {
    return this.http.get<AuthResponse>('/api/auth/me').pipe(
      map(({ user }) => user),
      tap((user) => {
        this.currentUser.set(user);
        this.sessionReady.set(true);
      }),
      catchError((error: HttpErrorResponse) => {
        this.sessionReady.set(true);
        if (error.status === 401) return of(null);
        return throwError(() => new Error(toMessage(error)));
      }),
    );
  }

  register(credentials: RegisterCredentials): Observable<AuthUser> {
    return this.http.post<AuthResponse>('/api/auth/register', credentials).pipe(
      map(({ user }) => user),
      tap((user) => {
        this.currentUser.set(user);
        this.sessionReady.set(true);
      }),
      catchError((error: HttpErrorResponse) => throwError(() => new Error(toMessage(error)))),
    );
  }

  login(credentials: LoginCredentials): Observable<AuthUser> {
    return this.http.post<AuthResponse>('/api/auth/login', credentials).pipe(
      map(({ user }) => user),
      tap((user) => {
        this.currentUser.set(user);
        this.sessionReady.set(true);
      }),
      catchError((error: HttpErrorResponse) => throwError(() => new Error(toMessage(error)))),
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {}).pipe(tap(() => this.currentUser.set(null)));
  }
}

function toMessage(error: HttpErrorResponse): string {
  if (error.status === 0) return 'Could not reach the account service. Is the server running?';
  return error.error?.error ?? `Unexpected error (${error.status}).`;
}
