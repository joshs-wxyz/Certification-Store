import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, inject, output, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CERTIFICATION_LEVELS, CertificationLevel, NewCertification } from '../../core/models/certification';

@Component({
  selector: 'app-certification-form',
  imports: [ReactiveFormsModule],
  template: `
    <form class="panel form" [formGroup]="form" (ngSubmit)="submit()" aria-labelledby="add-cert-heading">
      <h2 id="add-cert-heading">Add a certification</h2>

      <div class="form__row">
        <div class="field">
          <label for="cert-title">Title *</label>
          <input #titleInput id="cert-title" class="input" formControlName="title" autocomplete="off" />
          @if (showError('title')) { <span class="error">Title is required.</span> }
        </div>
        <div class="field">
          <label for="cert-vendor">Vendor / issuing body</label>
          <input id="cert-vendor" class="input" formControlName="vendor" autocomplete="off" />
        </div>
        <div class="field">
          <label for="cert-level">Level</label>
          <select id="cert-level" class="input" formControlName="level">
            @for (level of levels; track level) { <option [value]="level">{{ level }}</option> }
          </select>
        </div>
      </div>

      <div class="field">
        <label for="cert-short">Short description *</label>
        <input id="cert-short" class="input" formControlName="shortDescription" maxlength="160" />
        <span class="hint">Shown on the catalog panel. Max 160 characters.</span>
        @if (showError('shortDescription')) { <span class="error">Short description is required.</span> }
      </div>

      <div class="field">
        <label for="cert-desc">Full description *</label>
        <textarea id="cert-desc" class="input" formControlName="description" rows="4"></textarea>
        @if (showError('description')) { <span class="error">Description is required.</span> }
      </div>

      <div class="field">
        <label for="cert-audience">Intended for *</label>
        <textarea id="cert-audience" class="input" formControlName="intendedFor" rows="3"
          placeholder="One role per line, e.g.&#10;Cloud engineers&#10;Solutions architects"></textarea>
        <span class="hint">One audience per line (commas also work).</span>
        @if (showError('intendedFor')) { <span class="error">Add at least one audience.</span> }
      </div>

      <div class="form__actions">
        <button type="button" class="btn" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="btn btn--primary">Save certification</button>
      </div>
    </form>
  `,
  styles: `
    .form {
      display: grid;
      gap: var(--cs-space-4);
      border-top: 3px solid var(--cs-color-accent);
    }

    .form h2 { margin: 0; }

    .form__row {
      display: grid;
      gap: var(--cs-space-4);
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
    }

    .form__actions {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: var(--cs-space-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificationForm implements AfterViewInit {
  readonly saved = output<NewCertification>();
  readonly cancelled = output<void>();

  protected readonly levels = CERTIFICATION_LEVELS;
  private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    vendor: ['', Validators.maxLength(100)],
    level: this.fb.control<CertificationLevel>('Associate'),
    shortDescription: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.required, Validators.maxLength(4000)]],
    intendedFor: ['', Validators.required],
  });

  ngAfterViewInit(): void {
    this.titleInput()?.nativeElement.focus();
  }

  protected showError(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  protected submit(): void {
    const audiences = splitList(this.form.controls.intendedFor.value);
    if (audiences.length === 0) this.form.controls.intendedFor.setErrors({ required: true });

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.saved.emit({
      title: v.title.trim(),
      vendor: v.vendor.trim(),
      level: v.level,
      shortDescription: v.shortDescription.trim(),
      description: v.description.trim(),
      intendedFor: audiences,
    });
  }
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
