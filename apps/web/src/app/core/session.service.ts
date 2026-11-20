import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import type { Me } from './models';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(ApiService);
  readonly me = signal<Me | null>(null);
  readonly organizations = computed(() => this.me()?.organizations ?? []);

  /** Returns the signed-in user, or null when there is no valid session. */
  async load(force = false): Promise<Me | null> {
    if (this.me() && !force) return this.me();
    try {
      const me = await firstValueFrom(this.api.me());
      this.me.set(me);
      return me;
    } catch {
      this.me.set(null);
      return null;
    }
  }

  roleIn(orgId: string) {
    return this.organizations().find((o) => o.id === orgId)?.role ?? null;
  }

  async logout() {
    await firstValueFrom(this.api.logout());
    this.me.set(null);
  }
}
