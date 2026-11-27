import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthModal } from './features/auth/auth-modal';
import { AuthApi } from './core/services/auth.api';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, AuthModal],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthApi);
  protected readonly authModalMode = signal<'login' | 'register' | null>(null);
  protected readonly authError = signal('');
  protected readonly themeLabel = computed(() => {
    const pref = this.theme.preference();
    return pref === 'system' ? 'System' : pref === 'light' ? 'Light' : 'Dark';
  });

  constructor() {
    this.auth.restoreSession().subscribe({
      next: (user) => this.auth.currentUser.set(user),
      error: (error: Error) => this.authError.set(error.message),
    });
  }

  protected openAuth(mode: 'login' | 'register'): void {
    this.authModalMode.set(mode);
  }

  protected signOut(): void {
    this.auth.logout().subscribe({
      error: (error: Error) => this.authError.set(error.message),
    });
  }
}
