import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TuiButton, TuiDialog, TuiIcon, TuiInput } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { SessionService } from '../core/session.service';
import { UiService } from '../core/ui.service';
import { LAST_ORG_KEY } from '../shell/shell.component';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, TuiButton, TuiIcon, TuiDialog, TuiInput, TuiTextarea],
  template: `
    <div class="flex items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Organizations</h1>
        <p class="text-sm mt-1" style="color: var(--tui-text-secondary)">Pick a workspace, or start a new one.</p>
      </div>
      <button tuiButton type="button" iconStart="@tui.plus" (click)="dialogOpen.set(true)">New organization</button>
    </div>

    @if (session.organizations().length === 0) {
      <div class="rounded-2xl border border-dashed p-10 text-center" style="border-color: var(--tui-border-normal)">
        <tui-icon icon="@tui.building-2" class="mb-3" style="font-size: 2.5rem; color: var(--tui-text-tertiary)" />
        <h2 class="text-lg font-semibold mb-1">You are not in an organization yet</h2>
        <p class="text-sm mb-5 mx-auto max-w-md" style="color: var(--tui-text-secondary)">
          Create your own, or ask an admin to invite
          <strong>{{ session.me()?.email }}</strong> and it will appear here.
        </p>
        <button tuiButton type="button" (click)="dialogOpen.set(true)">Create organization</button>
      </div>
    } @else {
      <div class="grid gap-4 sm:grid-cols-2">
        @for (org of session.organizations(); track org.id) {
          <a
            [routerLink]="['/orgs', org.id]"
            class="group rounded-2xl border p-5 flex items-center gap-4 transition-colors hover:bg-[var(--tui-background-neutral-1-hover)]"
            style="background: var(--tui-background-elevation-1); border-color: var(--tui-border-normal)"
          >
            <span class="inline-flex size-12 shrink-0 items-center justify-center rounded-xl" style="background: var(--tui-background-neutral-1)">
              <tui-icon icon="@tui.building-2" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-semibold">{{ org.name }}</span>
              <span class="block text-xs uppercase tracking-wide mt-0.5" style="color: var(--tui-text-secondary)">{{ org.role }}</span>
            </span>
            <tui-icon icon="@tui.chevron-right" style="color: var(--tui-text-tertiary)" />
          </a>
        }
      </div>
    }

    <ng-template
      [tuiDialog]="dialogOpen()"
      (tuiDialogChange)="dialogOpen.set($event)"
      [tuiDialogOptions]="{ label: 'Create organization', size: 's' }"
    >
      <form class="flex flex-col gap-4" (ngSubmit)="create()">
        <tui-textfield>
          <label tuiLabel for="org-name">Name</label>
          <input id="org-name" tuiInput name="name" [(ngModel)]="name" required minlength="2" maxlength="80" autocomplete="off" />
        </tui-textfield>
        <tui-textfield>
          <label tuiLabel for="org-desc">Description (optional)</label>
          <textarea id="org-desc" tuiTextarea name="description" [(ngModel)]="description" maxlength="500" [minRows]="3" [maxRows]="6"></textarea>
        </tui-textfield>
        <p class="text-xs" style="color: var(--tui-text-secondary)">You will be the admin of this organization.</p>
        <div class="flex justify-end gap-2">
          <button tuiButton type="button" appearance="flat" (click)="dialogOpen.set(false)">Cancel</button>
          <button tuiButton type="submit" [disabled]="name().trim().length < 2 || busy()">Create</button>
        </div>
      </form>
    </ng-template>
  `,
})
export class HomePage implements OnInit {
  protected readonly session = inject(SessionService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly ui = inject(UiService);

  protected readonly dialogOpen = signal(false);
  protected readonly busy = signal(false);
  protected readonly name = signal('');
  protected readonly description = signal('');

  private static redirected = false;

  ngOnInit() {
    // On a fresh page load, jump back to the last organization the user was working in.
    if (HomePage.redirected) return;
    HomePage.redirected = true;
    try {
      const last = localStorage.getItem(LAST_ORG_KEY);
      if (last && this.session.roleIn(last)) void this.router.navigate(['/orgs', last], { replaceUrl: true });
    } catch {
      /* storage unavailable */
    }
  }

  protected async create() {
    if (this.name().trim().length < 2 || this.busy()) return;
    this.busy.set(true);
    try {
      const org = await firstValueFrom(
        this.api.createOrg({ name: this.name().trim(), description: this.description().trim() }),
      );
      await this.session.load(true);
      this.dialogOpen.set(false);
      this.name.set('');
      this.description.set('');
      await this.router.navigate(['/orgs', org.id]);
    } catch (err) {
      this.ui.error(err, 'Could not create the organization');
    } finally {
      this.busy.set(false);
    }
  }
}
