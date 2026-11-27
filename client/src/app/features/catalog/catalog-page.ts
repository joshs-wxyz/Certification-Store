import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NewCertification } from '../../core/models/certification';
import { CertificationStore } from '../../core/services/certification.store';
import { CertificationCard } from './certification-card';
import { CertificationForm } from './certification-form';

@Component({
  selector: 'app-catalog-page',
  imports: [CertificationCard, CertificationForm],
  templateUrl: './catalog-page.html',
  styleUrl: './catalog-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogPage {
  protected readonly store = inject(CertificationStore);
  protected readonly showForm = signal(false);
  protected readonly announcement = signal('');
  protected readonly savingIds = signal<ReadonlySet<string>>(new Set());

  protected onAdd(input: NewCertification): void {
    this.store
      .add(input)
      .then((created) => {
        this.showForm.set(false);
        this.announcement.set(`Added ${created.title}.`);
      })
      .catch(() => {});
  }

  protected onDelete(id: string): void {
    const title = this.store.find(id)?.title ?? 'Certification';
    this.store
      .remove(id)
      .then(() => this.announcement.set(`Deleted ${title}.`))
      .catch(() => {});
  }

  protected onSave(id: string): void {
    this.savingIds.update((ids) => new Set(ids).add(id));
    this.store
      .saveToAccount(id)
      .then((saved) => this.announcement.set(`Saved ${saved.title} to your account.`))
      .catch(() => {})
      .finally(() => {
        this.savingIds.update((ids) => {
          const updated = new Set(ids);
          updated.delete(id);
          return updated;
        });
      });
  }

  protected reloadAccountCatalog(): void {
    this.store.reloadAccountCatalog();
  }
}
