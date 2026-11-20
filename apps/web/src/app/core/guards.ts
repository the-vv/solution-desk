import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

export const authGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return (await session.load()) ? true : router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);
  return (await session.load()) ? router.createUrlTree(['/']) : true;
};

/** Only members of :orgId may open its pages. */
export const orgGuard: CanActivateFn = async (route) => {
  const session = inject(SessionService);
  const router = inject(Router);
  await session.load();
  return session.roleIn(route.paramMap.get('orgId') ?? '') ? true : router.createUrlTree(['/']);
};

export const adminGuard: CanActivateFn = async (route) => {
  const session = inject(SessionService);
  const router = inject(Router);
  const orgId = route.paramMap.get('orgId') ?? '';
  await session.load();
  return session.roleIn(orgId) === 'ADMIN' ? true : router.createUrlTree(['/orgs', orgId]);
};
