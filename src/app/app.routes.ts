import { Routes } from '@angular/router';
import { guestGuard, homeGuard } from './guards/guest.guard';

export const routes: Routes = [
  {
    path: 'splash',
    loadComponent: () =>
      import('./pages/splash/splash.page').then((page) => page.SplashPage),
    data: { redirectTo: '/login' },
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.page').then((page) => page.LoginPage),
    canActivate: [guestGuard],
  },
  {
    path: 'enter-code',
    loadComponent: () =>
      import('./pages/enter-code/enter-code.page').then((page) => page.EnterCodePage),
    canActivate: [guestGuard],
  },
  {
    path: 'splash2',
    loadComponent: () =>
      import('./pages/splash/splash.page').then((page) => page.SplashPage),
    data: { redirectTo: '/home' },
  },
  {
    path: 'apiukabrir',
    loadComponent: () =>
      import('./pages/access-gate/access-gate.page').then((page) => page.AccessGatePage),
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./pages/home/home.page').then((page) => page.HomePage),
    canActivate: [homeGuard],
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'splash',
  },
  {
    path: '**',
    redirectTo: 'splash',
  },
];
