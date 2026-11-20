import type { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard, orgGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in - Solution Desk',
    loadComponent: () => import('./pages/login.page').then((m) => m.LoginPage),
  },
  {
    path: 's/:token',
    title: 'Shared solution - Solution Desk',
    loadComponent: () => import('./pages/public-share.page').then((m) => m.PublicSharePage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Organizations - Solution Desk',
        loadComponent: () => import('./pages/home.page').then((m) => m.HomePage),
      },
      {
        path: 'orgs/:orgId',
        canActivate: [orgGuard],
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Problems - Solution Desk',
            loadComponent: () => import('./pages/problems.page').then((m) => m.ProblemsPage),
          },
          {
            path: 'problems/new',
            title: 'New problem - Solution Desk',
            loadComponent: () => import('./pages/problem-editor.page').then((m) => m.ProblemEditorPage),
          },
          {
            path: 'problems/:id',
            title: 'Problem - Solution Desk',
            loadComponent: () => import('./pages/problem-view.page').then((m) => m.ProblemViewPage),
          },
          {
            path: 'problems/:id/edit',
            title: 'Edit problem - Solution Desk',
            loadComponent: () => import('./pages/problem-editor.page').then((m) => m.ProblemEditorPage),
          },
          {
            path: 'approvals',
            title: 'Approvals - Solution Desk',
            loadComponent: () => import('./pages/approvals.page').then((m) => m.ApprovalsPage),
          },
          {
            path: 'members',
            title: 'Members - Solution Desk',
            loadComponent: () => import('./pages/members.page').then((m) => m.MembersPage),
          },
          {
            path: 'settings',
            title: 'Settings - Solution Desk',
            loadComponent: () => import('./pages/settings.page').then((m) => m.SettingsPage),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
