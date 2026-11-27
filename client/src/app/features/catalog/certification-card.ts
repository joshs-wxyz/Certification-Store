import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Certification } from '../../core/models/certification';

/** Catalog panel. The whole card links to the details page; delete needs an inline confirm. */
@Component({
  selector: 'app-certification-card',
  imports: [RouterLink],
  template: `
    <article class="card" [class.card--confirming]="confirming()">
      <div class="card__meta">
        <span class="chip">{{ certification().level }}</span>
        @if (unsaved()) {
          <span class="chip chip--neutral">Unsaved</span>
        }
        <span class="card__vendor">{{ certification().vendor }}</span>
      </div>

      <h2 class="card__title">
        <a class="card__link" [routerLink]="['/certifications', certification().id]">{{ certification().title }}</a>
      </h2>
      <p class="card__desc">{{ certification().shortDescription }}</p>

      <div class="card__footer">
        <span class="card__cta" aria-hidden="true">View details →</span>

        @if (confirming()) {
          <div class="card__confirm" role="group" [attr.aria-label]="'Confirm delete ' + certification().title">
            <span>Delete?</span>
            <button type="button" class="btn btn--danger btn--sm" (click)="deleted.emit(certification().id)">Delete</button>
            <button type="button" class="btn btn--sm" (click)="confirming.set(false)">Cancel</button>
          </div>
        } @else {
          <div class="card__actions">
            @if (unsaved() && canSave()) {
              <button
                type="button"
                class="btn btn--primary btn--sm card__save"
                [disabled]="saving()"
                [attr.aria-label]="'Save ' + certification().title + ' to your account'"
                (click)="saveRequested.emit(certification().id)"
              >
                {{ saving() ? 'Saving…' : 'Save' }}
              </button>
            }
            <button
              type="button"
              class="btn btn--ghost btn--sm card__delete"
              [attr.aria-label]="'Delete ' + certification().title"
              (click)="confirming.set(true)"
            >
              Delete
            </button>
          </div>
        }
      </div>
    </article>
  `,
  styles: `
    :host { display: flex; width: 100%; }

    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--cs-space-3);
      width: 100%;
      padding: var(--cs-space-5);
      background: var(--cs-color-surface);
      border: 1px solid var(--cs-color-border);
      border-top: 3px solid var(--cs-color-primary);
      border-radius: var(--cs-radius-lg);
      box-shadow: var(--cs-shadow-1);
      transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;

      &:hover,
      &:focus-within {
        transform: translateY(-2px);
        box-shadow: var(--cs-shadow-3);
        border-color: var(--cs-color-primary);
      }

      &--confirming { border-color: var(--cs-color-error); }
    }

    .card__meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cs-space-2);
    }

    .card__vendor {
      font-size: var(--cs-text-xs);
      color: var(--cs-color-text-muted);
      text-align: right;
    }

    .card__title {
      margin: 0;
      font-size: var(--cs-text-lg);
    }

    .card__link {
      color: var(--cs-color-text);
      text-decoration: none;

      /* Stretch the link over the whole card. */
      &::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
      }

      &:focus-visible { outline: none; }
      &:focus-visible::after { outline: 2px solid var(--cs-color-focus-ring); outline-offset: 2px; }
    }

    .card__desc {
      flex: 1;
      margin: 0;
      color: var(--cs-color-text-muted);
      font-size: var(--cs-text-sm);
    }

    .card__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cs-space-2);
      min-height: 2rem;
    }

    .card__cta {
      font-size: var(--cs-text-sm);
      font-weight: 600;
      color: var(--cs-color-primary);
    }

    /* Controls sit above the stretched link. */
    .card__delete,
    .card__confirm,
    .card__save {
      position: relative;
      z-index: 1;
    }

    .card__actions {
      display: flex;
      align-items: center;
      gap: var(--cs-space-2);
    }

    .card__delete { --_fg: var(--cs-color-error-text); }
    .card__delete:hover { background: var(--cs-color-error-subtle); color: var(--cs-color-error-text); }

    .card__confirm {
      display: flex;
      align-items: center;
      gap: var(--cs-space-2);
      font-size: var(--cs-text-xs);
      font-weight: 600;
      color: var(--cs-color-error-text);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CertificationCard {
  readonly certification = input.required<Certification>();
  readonly unsaved = input(false);
  readonly canSave = input(false);
  readonly saving = input(false);
  readonly deleted = output<string>();
  readonly saveRequested = output<string>();
  protected readonly confirming = signal(false);
}
