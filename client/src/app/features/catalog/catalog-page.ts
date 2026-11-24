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

  protected onAdd(input: NewCertification): void {
    const created = this.store.add(input);
    this.showForm.set(false);
    this.announcement.set(`Added ${created.title}.`);
  }

  protected onDelete(id: string): void {
    const title = this.store.find(id)?.title ?? 'Certification';
    this.store.remove(id);
    this.announcement.set(`Deleted ${title}.`);
  }
}
