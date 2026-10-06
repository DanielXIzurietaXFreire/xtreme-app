import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

export const guestGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  try {
    const result = await session.validateStoredSession();
    return result.status === 'valid' ? router.parseUrl('/home') : true;
  } catch (error: unknown) {
    console.error('No se pudo comprobar una sesión guardada.', error);
    session.setNotice('No se pudo validar el acceso. Comprueba tu conexión.');
    return true;
  }
};

export const homeGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  try {
    const result = await session.validateStoredSession();
    return result.status === 'valid' ? true : router.parseUrl('/login');
  } catch (error: unknown) {
    console.error('No se pudo validar el acceso a Inicio.', error);
    session.setNotice('No se pudo validar el acceso. Comprueba tu conexión.');
    return router.parseUrl('/login');
  }
};
