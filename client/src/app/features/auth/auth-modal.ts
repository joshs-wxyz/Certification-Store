import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, output, viewChild, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthApi } from '../../core/services/auth.api';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-auth-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './auth-modal.html',
  styleUrl: './auth-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthModal {
  readonly initialMode = input<AuthMode>('login');
  readonly dismissed = output<void>();
  protected readonly mode = signal<AuthMode>('login');
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal('');

  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthApi);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly form = this.formBuilder.group({
    name: ['', [Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  constructor() {
    effect(() => {
      this.mode.set(this.initialMode());
      const name = this.form.controls.name;
      name.setValidators(this.initialMode() === 'register' ? [Validators.required, Validators.maxLength(100)] : []);
      name.updateValueAndValidity();
    });

    effect(() => {
      const element = this.dialog()?.nativeElement;
      if (element && !element.open) element.showModal();
    });
  }

  protected setMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.errorMessage.set('');
    const name = this.form.controls.name;
    name.setValidators(mode === 'register' ? [Validators.required, Validators.maxLength(100)] : []);
    name.updateValueAndValidity();
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;

    this.busy.set(true);
    this.errorMessage.set('');
    const { name, email, password } = this.form.getRawValue();
    const request =
      this.mode() === 'register'
        ? this.auth.register({ name: name.trim(), email: email.trim(), password })
        : this.auth.login({ email: email.trim(), password });

    request.subscribe({
      next: () => this.dismissed.emit(),
      error: (error: Error) => {
        this.errorMessage.set(error.message);
        this.busy.set(false);
      },
    });
  }

  protected closeOnBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) this.dismissed.emit();
  }
}
