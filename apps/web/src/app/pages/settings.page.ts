import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TuiButton, TuiInput } from '@taiga-ui/core';
import { TuiTextarea } from '@taiga-ui/kit';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { SessionService } from '../core/session.service';
import { UiService } from '../core/ui.service';

@Component({
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TuiButton, TuiInput, TuiTextarea],
  template: `
    <h1 class="text-2xl font-bold tracking-tight mb-8">Settings</h1>

    @if (isAdmin()) {
      <section class="rounded-2xl border p-5 sm:p-6 mb-6" style="background: var(--tui-background-elevation-1); border-color: var(--tui-border-normal)">
        <h2 class="font-semibold mb-4">Organization</h2>
        <form class="flex flex-col gap-4" (ngSubmit)="save()">
          <tui-textfield>
            <label tuiLabel for="s-name">Name</label>
            <input id="s-name" tuiInput name="name" [(ngModel)]="name" required minlength="2" maxlength="80" />
          </tui-textfield>
          <tui-textfield>
            <label tuiLabel for="s-desc">Description</label>
            <textarea id="s-desc" tuiTextarea name="description" [(ngModel)]="description" maxlength="500" [minRows]="3" [maxRows]="6"></textarea>
          </tui-textfield>
          <div class="flex justify-end">
            <button tuiButton type="submit" [disabled]="name().trim().length < 2 || busy()">Save</button>
          </div>
        </form>
      </section>
    }

    <section class="rounded-2xl border p-5 sm:p-6" style="border-color: var(--tui-status-negative)">
      <h2 class="font-semibold mb-4">Danger zone</h2>
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="font-medium">Leave organization</div>
            <div class="text-sm" style="color: var(--tui-text-secondary)">You lose access. An admin can invite you again.</div>
          </div>
          <button tuiButton type="button" appearance="secondary-destructive" (click)="leave()">Leave</button>
        </div>
        @if (isAdmin()) {
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="font-medium">Delete organization</div>
              <div class="text-sm" style="color: var(--tui-text-secondary)">Removes all problems, solutions, attachments and share links for good.</div>
            </div>
            <button tuiButton type="button" appearance="primary-destructive" (click)="remove()">Delete</button>
          </div>
        }
      </div>
    </section>
  `,
})
export class SettingsPage {
  readonly orgId = input.required<string>();

  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly busy = signal(false);
  protected readonly isAdmin = computed(() => this.session.roleIn(this.orgId()) === 'ADMIN');

  constructor() {
    effect(() => {
      if (!this.isAdmin()) return;
      this.api.org(this.orgId()).subscribe((o) => {
        this.name.set(o.name);
        this.description.set(o.description);
      });
    });
  }

  protected async save() {
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.updateOrg(this.orgId(), { name: this.name().trim(), description: this.description().trim() }));
      await this.session.load(true);
      this.ui.success('Settings saved');
    } catch (err) {
      this.ui.error(err);
    } finally {
      this.busy.set(false);
    }
  }

  protected async leave() {
    if (!(await this.ui.confirm('Leave this organization?', 'You will no longer be able to see its problems.', 'Leave', true))) return;
    try {
      await firstValueFrom(this.api.removeMember(this.orgId(), this.session.me()!.id));
      await this.session.load(true);
      await this.router.navigate(['/']);
    } catch (err) {
      this.ui.error(err);
    }
  }

  protected async remove() {
    if (!(await this.ui.confirm('Delete this organization?', 'Everything in it is deleted permanently. This cannot be undone.', 'Delete forever', true))) return;
    try {
      await firstValueFrom(this.api.deleteOrg(this.orgId()));
      await this.session.load(true);
      await this.router.navigate(['/']);
    } catch (err) {
      this.ui.error(err);
    }
  }
}
