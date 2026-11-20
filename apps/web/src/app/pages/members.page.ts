import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiIcon, TuiInput, TuiLoader } from '@taiga-ui/core';
import { catchError, firstValueFrom, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../core/api.service';
import type { Invitation, Member, Role } from '../core/models';
import { SessionService } from '../core/session.service';
import { UiService } from '../core/ui.service';
import { UserAvatarComponent } from '../shared/user-avatar.component';

const ROLE_HELP: Record<Role, string> = {
  ADMIN: 'Manages members, approvals, sharing and settings',
  MEMBER: 'Adds problems; edits their own; suggests edits to others',
  VIEWER: 'Can search and read only',
};

@Component({
  selector: 'app-members',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DatePipe, TuiButton, TuiIcon, TuiInput, TuiLoader, UserAvatarComponent],
  template: `
    <h1 class="text-2xl font-bold tracking-tight mb-1">Members</h1>
    <p class="text-sm mb-8" style="color: var(--tui-text-secondary)">People who can access this organization.</p>

    @if (isAdmin()) {
      <section class="rounded-2xl border p-5 mb-8" style="background: var(--tui-background-elevation-1); border-color: var(--tui-border-normal)">
        <h2 class="font-semibold mb-1">Invite someone</h2>
        <p class="text-xs mb-4" style="color: var(--tui-text-secondary)">
          Use the Google email address they sign in with. If they have not signed in before, they join automatically the first time they do.
        </p>
        <form class="flex flex-col sm:flex-row gap-3 sm:items-end" (ngSubmit)="invite()">
          <tui-textfield class="flex-1">
            <label tuiLabel for="invite-email">Email</label>
            <input id="invite-email" tuiInput type="email" name="email" [(ngModel)]="email" required autocomplete="off" />
          </tui-textfield>
          <label class="flex flex-col gap-1 text-xs" style="color: var(--tui-text-secondary)">
            Role
            <select class="sd-select" name="role" [ngModel]="inviteRole()" (ngModelChange)="inviteRole.set($event)">
              <option value="MEMBER">Member</option>
              <option value="VIEWER">Viewer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <button tuiButton type="submit" iconStart="@tui.user-plus" [disabled]="!email().includes('@') || busy()">Invite</button>
        </form>
        <p class="text-xs mt-3" style="color: var(--tui-text-tertiary)">{{ help[inviteRole()] }}</p>
      </section>
    }

    <tui-loader [loading]="loading()" [overlay]="true">
      <ul class="flex flex-col gap-2">
        @for (m of data()?.members ?? []; track m.userId) {
          <li class="flex items-center gap-3 rounded-2xl border px-4 py-3" style="background: var(--tui-background-elevation-1); border-color: var(--tui-border-normal)">
            <app-user-avatar [name]="m.name" [url]="m.avatarUrl" [size]="40" />
            <div class="min-w-0 flex-1">
              <div class="truncate font-medium">{{ m.name }} @if (m.userId === meId()) { <span class="text-xs" style="color: var(--tui-text-secondary)">(you)</span> }</div>
              <div class="truncate text-xs" style="color: var(--tui-text-secondary)">{{ m.email }} - joined {{ m.joinedAt | date: 'mediumDate' }}</div>
            </div>
            @if (isAdmin()) {
              <select class="sd-select" [attr.aria-label]="'Role for ' + m.name" [ngModel]="m.role" (ngModelChange)="changeRole(m, $event)">
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <button tuiIconButton appearance="flat-destructive" size="s" type="button" aria-label="Remove member" title="Remove" (click)="remove(m)">
                <tui-icon icon="@tui.user-minus" />
              </button>
            } @else {
              <span class="text-xs uppercase tracking-wide" style="color: var(--tui-text-secondary)">{{ m.role }}</span>
            }
          </li>
        }
      </ul>

      @if (isAdmin() && (data()?.invitations?.length ?? 0) > 0) {
        <h2 class="font-semibold mt-8 mb-3">Pending invitations</h2>
        <ul class="flex flex-col gap-2">
          @for (i of data()!.invitations; track i.id) {
            <li class="flex items-center gap-3 rounded-2xl border border-dashed px-4 py-3" style="border-color: var(--tui-border-normal)">
              <tui-icon icon="@tui.mail" />
              <div class="min-w-0 flex-1">
                <div class="truncate">{{ i.email }}</div>
                <div class="text-xs" style="color: var(--tui-text-secondary)">{{ i.role }} - invited {{ i.createdAt | date: 'mediumDate' }}</div>
              </div>
              <button tuiIconButton appearance="flat" size="s" type="button" aria-label="Cancel invitation" title="Cancel invitation" (click)="cancel(i)">
                <tui-icon icon="@tui.x" />
              </button>
            </li>
          }
        </ul>
      }
    </tui-loader>
  `,
})
export class MembersPage {
  readonly orgId = input.required<string>();

  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  private readonly session = inject(SessionService);

  protected readonly help = ROLE_HELP;
  protected readonly loading = signal(true);
  private readonly reload = signal(0);
  protected readonly busy = signal(false);
  protected readonly email = signal('');
  protected readonly inviteRole = signal<Role>('MEMBER');

  protected readonly isAdmin = computed(() => this.session.roleIn(this.orgId()) === 'ADMIN');
  protected readonly meId = computed(() => this.session.me()?.id);

  protected readonly data = toSignal(
    toObservable(computed(() => [this.orgId(), this.reload()] as const)).pipe(
      tap(() => this.loading.set(true)),
      switchMap(([id]) =>
        this.api.members(id).pipe(catchError(() => of(null as { members: Member[]; invitations: Invitation[] } | null))),
      ),
      tap(() => this.loading.set(false)),
    ),
    { initialValue: null as { members: Member[]; invitations: Invitation[] } | null },
  );

  private refresh() {
    this.reload.update((n) => n + 1);
  }

  protected async invite() {
    this.busy.set(true);
    try {
      const res = await firstValueFrom(this.api.invite(this.orgId(), { email: this.email().trim(), role: this.inviteRole() }));
      this.ui.success(res.status === 'added' ? 'Added to the organization' : 'Invitation saved. They join when they first sign in.');
      this.email.set('');
      this.refresh();
    } catch (err) {
      this.ui.error(err, 'Could not invite');
    } finally {
      this.busy.set(false);
    }
  }

  protected async changeRole(m: Member, role: Role) {
    if (role === m.role) return;
    try {
      await firstValueFrom(this.api.changeRole(this.orgId(), m.userId, role));
      this.ui.success(`${m.name} is now ${role.toLowerCase()}`);
      if (m.userId === this.meId()) await this.session.load(true);
    } catch (err) {
      this.ui.error(err);
    }
    this.refresh();
  }

  protected async remove(m: Member) {
    if (!(await this.ui.confirm('Remove member?', `${m.name} will lose access to this organization.`, 'Remove', true))) return;
    try {
      await firstValueFrom(this.api.removeMember(this.orgId(), m.userId));
      this.refresh();
    } catch (err) {
      this.ui.error(err);
    }
  }

  protected async cancel(i: Invitation) {
    try {
      await firstValueFrom(this.api.cancelInvitation(this.orgId(), i.id));
      this.refresh();
    } catch (err) {
      this.ui.error(err);
    }
  }
}
