import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TuiButton, TuiDataList, TuiDropdown, TuiIcon } from '@taiga-ui/core';
import { filter, map, startWith } from 'rxjs';
import { ApiService } from '../core/api.service';
import { SessionService } from '../core/session.service';
import { UserAvatarComponent } from '../shared/user-avatar.component';

const LAST_ORG_KEY = 'sd.lastOrg';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TuiButton, TuiIcon, TuiDropdown, TuiDataList, UserAvatarComponent],
  template: `
    <div class="min-h-screen lg:flex">
      <!-- mobile top bar -->
      <header
        class="sticky top-0 z-30 flex items-center gap-3 px-4 h-14 lg:hidden border-b"
        style="background: var(--tui-background-base); border-color: var(--tui-border-normal)"
      >
        <button tuiIconButton appearance="flat" size="s" type="button" aria-label="Open menu" (click)="menuOpen.set(true)">
          <tui-icon icon="@tui.menu" />
        </button>
        <span class="font-semibold">Solution Desk</span>
      </header>

      @if (menuOpen()) {
        <div class="fixed inset-0 z-40 bg-black/60 lg:hidden" (click)="menuOpen.set(false)" aria-hidden="true"></div>
      }

      <aside
        class="fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0"
        [class.-translate-x-full]="!menuOpen()"
        style="background: var(--tui-background-elevation-1); border-color: var(--tui-border-normal)"
        aria-label="Primary"
      >
        <a routerLink="/" class="flex items-center gap-3 px-5 h-16 shrink-0" (click)="menuOpen.set(false)">
          <span class="inline-flex size-9 items-center justify-center rounded-xl" style="background: var(--tui-background-accent-1)">
            <tui-icon icon="@tui.book-open-text" class="text-white" />
          </span>
          <span class="font-bold text-lg tracking-tight">Solution Desk</span>
        </a>

        <div class="px-3 pb-2">
          <button
            tuiButton
            type="button"
            appearance="secondary"
            size="m"
            class="w-full !justify-between"
            [tuiDropdown]="orgMenu"
            [(tuiDropdownOpen)]="orgMenuOpen"
          >
            <span class="flex items-center gap-2 min-w-0">
              <tui-icon icon="@tui.building-2" />
              <span class="truncate">{{ currentOrg()?.name ?? 'Select organization' }}</span>
            </span>
            <tui-icon icon="@tui.chevrons-up-down" />
          </button>
          <ng-template #orgMenu>
            <tui-data-list>
              @for (org of session.organizations(); track org.id) {
                <a tuiOption [routerLink]="['/orgs', org.id]" (click)="orgMenuOpen.set(false); menuOpen.set(false)">
                  {{ org.name }}
                </a>
              }
              <a tuiOption routerLink="/" (click)="orgMenuOpen.set(false); menuOpen.set(false)">
                <span class="flex items-center gap-2"><tui-icon icon="@tui.layout-grid" /> All organizations</span>
              </a>
            </tui-data-list>
          </ng-template>
        </div>

        @if (currentOrg(); as org) {
          <nav class="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1" (click)="menuOpen.set(false)">
            <a class="nav-item" [routerLink]="['/orgs', org.id]" routerLinkActive="nav-item-active" [routerLinkActiveOptions]="{ exact: true }">
              <tui-icon icon="@tui.search" /> Browse problems
            </a>
            @if (org.role !== 'VIEWER') {
              <a class="nav-item" [routerLink]="['/orgs', org.id, 'problems', 'new']" routerLinkActive="nav-item-active">
                <tui-icon icon="@tui.square-pen" /> New problem
              </a>
            }
            <a class="nav-item" [routerLink]="['/orgs', org.id, 'approvals']" routerLinkActive="nav-item-active">
              <tui-icon icon="@tui.git-pull-request" />
              <span class="flex-1">{{ org.role === 'ADMIN' ? 'Approvals' : 'My requests' }}</span>
              @if (pending() > 0) {
                <span class="rounded-full px-2 text-xs font-semibold" style="background: var(--tui-status-warning); color: #000">{{ pending() }}</span>
              }
            </a>
            <a class="nav-item" [routerLink]="['/orgs', org.id, 'members']" routerLinkActive="nav-item-active">
              <tui-icon icon="@tui.users" /> Members
            </a>
            <a class="nav-item" [routerLink]="['/orgs', org.id, 'settings']" routerLinkActive="nav-item-active">
              <tui-icon icon="@tui.settings" /> Settings
            </a>
          </nav>
        } @else {
          <div class="flex-1"></div>
        }

        @if (session.me(); as me) {
          <div class="p-3 border-t" style="border-color: var(--tui-border-normal)">
            <div class="flex items-center gap-3 px-2 py-1">
              <app-user-avatar [name]="me.name" [url]="me.avatarUrl" [size]="36" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{{ me.name }}</div>
                <div class="truncate text-xs" style="color: var(--tui-text-secondary)">{{ me.email }}</div>
              </div>
              <button tuiIconButton appearance="flat" size="s" type="button" aria-label="Sign out" title="Sign out" (click)="logout()">
                <tui-icon icon="@tui.log-out" />
              </button>
            </div>
          </div>
        }
      </aside>

      <main class="flex-1 min-w-0">
        <div class="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 lg:py-10">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: `
    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      border-radius: 0.75rem;
      font: var(--tui-font-text-m);
      color: var(--tui-text-secondary);
      transition: background 0.15s, color 0.15s;
    }
    .nav-item:hover {
      background: var(--tui-background-neutral-1-hover);
      color: var(--tui-text-primary);
    }
    .nav-item-active {
      background: var(--tui-background-neutral-1);
      color: var(--tui-text-primary);
    }
  `,
})
export class ShellComponent {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  protected readonly menuOpen = signal(false);
  protected readonly orgMenuOpen = signal(false);
  protected readonly pending = signal(0);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly currentOrgId = computed(() => /^\/orgs\/([0-9a-f-]{36})/.exec(this.url())?.[1] ?? null);
  protected readonly currentOrg = computed(
    () => this.session.organizations().find((o) => o.id === this.currentOrgId()) ?? null,
  );

  constructor() {
    effect(() => {
      const id = this.currentOrgId();
      if (id) {
        try {
          localStorage.setItem(LAST_ORG_KEY, id);
        } catch {
          /* storage unavailable */
        }
      }
    });
    // Refresh the badge whenever the route changes inside an organization.
    effect(() => {
      this.url();
      const org = this.currentOrg();
      if (!org) return this.pending.set(0);
      this.api.changeRequests(org.id, 'PENDING').subscribe({
        next: (list) => this.pending.set(list.length),
        error: () => this.pending.set(0),
      });
    });
  }

  protected async logout() {
    await this.session.logout();
    await this.router.navigateByUrl('/login');
  }
}

export { LAST_ORG_KEY };
