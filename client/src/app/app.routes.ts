import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Certification Store',
    loadComponent: () => import('./features/catalog/catalog-page').then((m) => m.CatalogPage),
  },
  {
    path: 'certifications/:id',
    title: 'Certification details · Certification Store',
    loadComponent: () =>
      import('./features/certification-detail/certification-detail-page').then((m) => m.CertificationDetailPage),
  },
  { path: '**', redirectTo: '' },
];
