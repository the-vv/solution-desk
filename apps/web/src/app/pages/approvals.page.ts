import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TuiButton, TuiDialog, TuiIcon, TuiInput, TuiLoader } from '@taiga-ui/core';
import { TuiSegmented, TuiTextarea } from '@taiga-ui/kit';
import { catchError, firstValueFrom, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../core/api.service';
import type { ChangeRequest } from '../core/models';
import { SessionService } from '../core/session.service';
import { UiService } from '../core/ui.service';
import { UserAvatarComponent } from '../shared/user-avatar.component';

interface FieldDiff {
  label: string;
  before: string;
  after: string;
}

@Component({
  selector: 'app-approvals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, RouterLink, TuiButton, TuiDialog, TuiIcon, TuiInput, TuiLoader, TuiSegmented, TuiTextarea, UserAvatarComponent],
  template: `
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">{{ isAdmin() ? 'Approvals' : 'My requests' }}</h1>
        <p class="text-sm mt-1" style="color: var(--tui-text-secondary)">
          {{ isAdmin() ? 'Edits and deletions suggested by members on problems they did not write.' : 'Changes you suggested to other people\\'s problems.' }}
        </p>
      </div>
      <tui-segmented size="m" [activeItemIndex]="tab()" (activeItemIndexChange)="tab.set($event)">
        <button type="button">Pending</button>
        <button type="button">History</button>
      </tui-segmented>
    </div>

    <tui-loader [loading]="loading()" [overlay]="true">
      @if (visible().length === 0) {
        <div class="rounded-2xl border border-dashed p-10 text-center" style="border-color: var(--tui-border-normal)">
          <tui-icon icon="@tui.circle-check" class="mb-3" style="font-size: 2.5rem; color: var(--tui-text-tertiary)" />
          <p class="font-medium">{{ tab() === 0 ? 'Nothing waiting for review' : 'No past requests' }}</p>
        </div>
      }
      <ul class="flex flex-col gap-4">
        @for (r of visible(); track r.id) {
          <li class="rounded-2xl border p-5" style="background: var(--tui-background-elevation-1); border-color: var(--tui-border-normal)">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2 mb-3">
              <span
                class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                [style.background]="r.type === 'DELETE' ? 'var(--tui-status-negative-pale)' : 'var(--tui-status-info-pale)'"
                [style.color]="r.type === 'DELETE' ? 'var(--tui-status-negative)' : 'var(--tui-status-info)'"
                >{{ r.type === 'DELETE' ? 'Delete' : 'Edit' }}</span>
              <a [routerLink]="['/orgs', orgId(), 'problems', r.problem.id]" class="font-semibold underline-offset-2 hover:underline">{{ r.problem.title }}</a>
              @if (r.status !== 'PENDING') {
                <span class="text-xs font-semibold" [style.color]="r.status === 'APPROVED' ? 'var(--tui-status-positive)' : 'var(--tui-status-negative)'">{{ r.status }}</span>
              }
            </div>
            <div class="flex flex-wrap items-center gap-3 text-xs mb-4" style="color: var(--tui-text-secondary)">
              <span class="inline-flex items-center gap-2"><app-user-avatar [name]="r.requester.name" [url]="r.requester.avatarUrl" [size]="20" /> {{ r.requester.name }}</span>
              <span>{{ r.createdAt | date: 'medium' }}</span>
              @if (r.reviewer) { <span>Reviewed by {{ r.reviewer.name }}</span> }
            </div>

            @if (r.type === 'DELETE') {
              <p class="text-sm" style="color: var(--tui-text-secondary)">Requests to delete this problem, including its attachments and share links.</p>
            } @else {
              @for (d of diffs(r); track d.label) {
                <div class="mb-3">
                  <div class="text-xs font-semibold uppercase tracking-wide mb-1" style="color: var(--tui-text-secondary)">{{ d.label }}</div>
                  <div class="grid gap-2 md:grid-cols-2">
                    <div class="diff-box" style="border-color: var(--tui-status-negative)">{{ d.before || '(empty)' }}</div>
                    <div class="diff-box" style="border-color: var(--tui-status-positive)">{{ d.after || '(empty)' }}</div>
                  </div>
                </div>
              } @empty {
                <p class="text-sm" style="color: var(--tui-text-secondary)">No text changes. Only attachments differ.</p>
              }
            }

            @if (r.reviewNote) {
              <p class="mt-2 text-sm"><span style="color: var(--tui-text-secondary)">Note:</span> {{ r.reviewNote }}</p>
            }

            @if (r.status === 'PENDING') {
              <div class="flex flex-wrap justify-end gap-2 mt-4">
                @if (isAdmin()) {
                  <button tuiButton type="button" size="m" appearance="secondary" iconStart="@tui.x" (click)="rejecting.set(r)">Reject</button>
                  <button tuiButton type="button" size="m" iconStart="@tui.check" [disabled]="busy()" (click)="approve(r)">Approve</button>
                } @else {
                  <button tuiButton type="button" size="m" appearance="secondary" (click)="withdraw(r)">Withdraw</button>
                }
              </div>
            }
          </li>
        }
      </ul>
    </tui-loader>

    <ng-template
      [tuiDialog]="!!rejecting()"
      (tuiDialogChange)="$event || rejecting.set(null)"
      [tuiDialogOptions]="{ label: 'Reject request', size: 's' }"
    >
      <form class="flex flex-col gap-4" (ngSubmit)="reject()">
        <tui-textfield>
          <label tuiLabel for="note">Reason (optional)</label>
          <textarea id="note" tuiTextarea name="note" [(ngModel)]="note" maxlength="500" [minRows]="3" [maxRows]="6"></textarea>
        </tui-textfield>
        <div class="flex justify-end gap-2">
          <button tuiButton type="button" appearance="flat" (click)="rejecting.set(null)">Cancel</button>
          <button tuiButton type="submit" appearance="primary-destructive" [disabled]="busy()">Reject</button>
        </div>
      </form>
    </ng-template>
  `,
  styles: `
    .diff-box {
      border-left: 3px solid;
      background: var(--tui-background-neutral-1);
      border-radius: 0.5rem;
      padding: 0.6rem 0.8rem;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 0.85rem;
      max-height: 14rem;
      overflow: auto;
    }
  `,
})
export class ApprovalsPage {
  readonly orgId = input.required<string>();

  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  private readonly session = inject(SessionService);

  protected readonly tab = signal(0);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly rejecting = signal<ChangeRequest | null>(null);
  protected readonly note = signal('');
  private readonly reload = signal(0);

  protected readonly isAdmin = computed(() => this.session.roleIn(this.orgId()) === 'ADMIN');

  private readonly all = toSignal(
    toObservable(computed(() => [this.orgId(), this.reload()] as const)).pipe(
      tap(() => this.loading.set(true)),
      switchMap(([id]) => this.api.changeRequests(id).pipe(catchError(() => of([] as ChangeRequest[])))),
      tap(() => this.loading.set(false)),
    ),
    { initialValue: [] as ChangeRequest[] },
  );

  protected readonly visible = computed(() =>
    this.all().filter((r) => (this.tab() === 0 ? r.status === 'PENDING' : r.status !== 'PENDING')),
  );

  protected diffs(r: ChangeRequest): FieldDiff[] {
    const p = r.proposed;
    if (!p) return [];
    const out: FieldDiff[] = [];
    const push = (label: string, before: string, after: string) => before !== after && out.push({ label, before, after });
    push('Title', r.problem.title, p.title);
    push('Tags', r.problem.tags.join(', '), p.tags.join(', '));
    push('Format', r.problem.format, p.format);
    push('Problem', r.problem.problem, p.problem);
    push('Solution', r.problem.solution, p.solution);
    return out;
  }

  private refresh() {
    this.reload.update((n) => n + 1);
  }

  protected async approve(r: ChangeRequest) {
    const verb = r.type === 'DELETE' ? 'Delete this problem?' : 'Apply this edit?';
    const text = r.type === 'DELETE' ? 'The problem and its attachments will be removed for good.' : 'The problem will be updated with the proposed text.';
    if (!(await this.ui.confirm(verb, text, 'Approve', r.type === 'DELETE'))) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.reviewRequest(this.orgId(), r.id, 'approve'));
      this.ui.success('Approved');
      this.refresh();
    } catch (err) {
      this.ui.error(err);
    } finally {
      this.busy.set(false);
    }
  }

  protected async reject() {
    const r = this.rejecting();
    if (!r) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.reviewRequest(this.orgId(), r.id, 'reject', this.note().trim() || undefined));
      this.rejecting.set(null);
      this.note.set('');
      this.refresh();
    } catch (err) {
      this.ui.error(err);
    } finally {
      this.busy.set(false);
    }
  }

  protected async withdraw(r: ChangeRequest) {
    try {
      await firstValueFrom(this.api.cancelRequest(this.orgId(), r.id));
      this.refresh();
    } catch (err) {
      this.ui.error(err);
    }
  }
}
