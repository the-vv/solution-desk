import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TuiButton, TuiDialog, TuiIcon, TuiInput, TuiLoader } from '@taiga-ui/core';
import { catchError, firstValueFrom, of, switchMap } from 'rxjs';
import { ApiService } from '../core/api.service';
import { formatBytes, orgAttachmentUrl } from '../core/markdown';
import type { ProblemDetail } from '../core/models';
import { UiService } from '../core/ui.service';
import { ContentViewComponent } from '../shared/markdown-view.component';
import { UserAvatarComponent } from '../shared/user-avatar.component';

@Component({
  selector: 'app-problem-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, DatePipe, TuiButton, TuiIcon, TuiInput, TuiLoader, TuiDialog, ContentViewComponent, UserAvatarComponent],
  template: `
    <a [routerLink]="['/orgs', orgId()]" tuiButton appearance="flat" size="s" iconStart="@tui.arrow-left" class="mb-4">Back to problems</a>

    @if (loading()) {
      <tui-loader class="block py-20" />
    } @else if (problem(); as p) {
      <article>
        <header class="mb-6">
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight mb-3">{{ p.title }}</h1>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" style="color: var(--tui-text-secondary)">
            <span class="inline-flex items-center gap-2">
              <app-user-avatar [name]="p.author.name" [url]="p.author.avatarUrl" [size]="24" /> {{ p.author.name }}
            </span>
            <span>Added {{ p.createdAt | date: 'medium' }}</span>
            @if (p.updatedAt !== p.createdAt) { <span>Updated {{ p.updatedAt | date: 'medium' }}</span> }
          </div>
          @if (p.tags.length) {
            <div class="flex flex-wrap gap-2 mt-3">
              @for (t of p.tags; track t) {
                <a [routerLink]="['/orgs', orgId()]" [queryParams]="{ tag: t }" class="rounded-full px-3 py-1 text-xs" style="background: var(--tui-background-neutral-1)">{{ t }}</a>
              }
            </div>
          }
          <div class="flex flex-wrap gap-2 mt-5">
            @if (p.permissions.canEdit) {
              <a tuiButton size="m" appearance="secondary" iconStart="@tui.pencil" [routerLink]="['/orgs', orgId(), 'problems', p.id, 'edit']">Edit</a>
              <button tuiButton size="m" appearance="secondary" iconStart="@tui.share-2" type="button" (click)="openShare()">
                {{ p.shareToken ? 'Sharing on' : 'Share' }}
              </button>
              <button tuiButton size="m" appearance="flat-destructive" iconStart="@tui.trash-2" type="button" (click)="remove()">Delete</button>
            } @else if (p.permissions.canRequestChange) {
              <a tuiButton size="m" appearance="secondary" iconStart="@tui.pencil" [routerLink]="['/orgs', orgId(), 'problems', p.id, 'edit']">Suggest edit</a>
              <button tuiButton size="m" appearance="flat-destructive" iconStart="@tui.trash-2" type="button" (click)="remove()">Request deletion</button>
            }
          </div>
          @if (p.pendingRequests > 0) {
            <div class="mt-4 rounded-xl border px-4 py-3 text-sm flex items-center gap-2" style="border-color: var(--tui-status-warning); color: var(--tui-text-primary)">
              <tui-icon icon="@tui.clock" />
              {{ p.pendingRequests }} change {{ p.pendingRequests === 1 ? 'request is' : 'requests are' }} waiting for admin review.
              <a class="underline ml-auto" [routerLink]="['/orgs', orgId(), 'approvals']">View</a>
            </div>
          }
        </header>

        <section class="rounded-2xl border p-5 sm:p-6 mb-5" style="background: var(--tui-background-elevation-1); border-color: var(--tui-border-normal)">
          <h2 class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide mb-4" style="color: var(--tui-status-negative)">
            <tui-icon icon="@tui.circle-alert" /> Problem
          </h2>
          <app-content-view [content]="p.problem" [format]="p.format" />
        </section>

        <section class="rounded-2xl border p-5 sm:p-6 mb-5" style="background: var(--tui-background-elevation-1); border-color: var(--tui-border-normal)">
          <h2 class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide mb-4" style="color: var(--tui-status-positive)">
            <tui-icon icon="@tui.circle-check" /> Solution
          </h2>
          @if (p.solution.trim()) {
            <app-content-view [content]="p.solution" [format]="p.format" />
          } @else {
            <p style="color: var(--tui-text-secondary)">No solution has been added yet.</p>
          }
        </section>

        @if (p.attachments.length) {
          <section class="rounded-2xl border p-5 sm:p-6" style="background: var(--tui-background-elevation-1); border-color: var(--tui-border-normal)">
            <h2 class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide mb-4" style="color: var(--tui-text-secondary)">
              <tui-icon icon="@tui.paperclip" /> Attachments
            </h2>
            <ul class="flex flex-col gap-2">
              @for (a of p.attachments; track a.id) {
                <li class="flex items-center gap-3 rounded-xl px-3 py-2" style="background: var(--tui-background-neutral-1)">
                  <tui-icon [icon]="a.mimeType.startsWith('image/') ? '@tui.image' : '@tui.file'" />
                  <span class="min-w-0 flex-1 truncate">{{ a.filename }}</span>
                  <span class="text-xs shrink-0" style="color: var(--tui-text-secondary)">{{ size(a.size) }}</span>
                  <a tuiIconButton appearance="flat" size="s" [href]="url(a.id)" target="_blank" rel="noopener" [attr.download]="a.mimeType.startsWith('image/') ? null : a.filename" aria-label="Open attachment">
                    <tui-icon icon="@tui.download" />
                  </a>
                </li>
              }
            </ul>
          </section>
        }
      </article>

      <ng-template
        [tuiDialog]="shareOpen()"
        (tuiDialogChange)="shareOpen.set($event)"
        [tuiDialogOptions]="{ label: 'Share this problem', size: 's' }"
      >
        <div class="flex flex-col gap-4">
          <p class="text-sm" style="color: var(--tui-text-secondary)">
            Anyone with this link can read this problem, its solution and attachments, without signing in. They cannot edit anything.
            Turn the link off at any time.
          </p>
          @if (p.shareToken) {
            <tui-textfield>
              <label tuiLabel for="share-url">Link</label>
              <input id="share-url" tuiInput [readonly]="true" [ngModel]="shareUrl()" (focus)="$any($event.target).select()" />
            </tui-textfield>
            <div class="flex flex-wrap gap-2 justify-between">
              <button tuiButton type="button" appearance="flat-destructive" iconStart="@tui.link-2-off" (click)="revokeShare()">Turn off link</button>
              <button tuiButton type="button" iconStart="@tui.copy" (click)="copy()">Copy link</button>
            </div>
          } @else {
            <button tuiButton type="button" iconStart="@tui.link" (click)="createShare()">Create share link</button>
          }
        </div>
      </ng-template>
    } @else {
      <div class="rounded-2xl border border-dashed p-10 text-center" style="border-color: var(--tui-border-normal)">
        <p class="font-medium">This problem does not exist or was deleted.</p>
      </div>
    }
  `,
})
export class ProblemViewPage {
  readonly orgId = input.required<string>();
  readonly id = input.required<string>();

  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  private readonly reload = signal(0);
  protected readonly shareOpen = signal(false);
  protected readonly size = formatBytes;

  protected readonly problem = toSignal(
    toObservable(computed(() => ({ org: this.orgId(), id: this.id(), n: this.reload() }))).pipe(
      switchMap(({ org, id }) => {
        this.loading.set(true);
        return this.api.problem(org, id).pipe(catchError(() => of(null as ProblemDetail | null)));
      }),
      // Set loading false once a value arrives.
      switchMap((p) => {
        this.loading.set(false);
        return of(p);
      }),
    ),
    { initialValue: null as ProblemDetail | null },
  );

  protected readonly shareUrl = computed(() => {
    const token = this.problem()?.shareToken;
    return token ? `${location.origin}/s/${token}` : '';
  });

  protected url(attachmentId: string) {
    return orgAttachmentUrl(this.orgId(), attachmentId);
  }

  protected openShare() {
    this.shareOpen.set(true);
  }

  protected async createShare() {
    try {
      await firstValueFrom(this.api.createShare(this.orgId(), this.id()));
      this.reload.update((n) => n + 1);
    } catch (err) {
      this.ui.error(err);
    }
  }

  protected async revokeShare() {
    if (!(await this.ui.confirm('Turn off sharing?', 'The current link will stop working for everyone.', 'Turn off', true))) return;
    try {
      await firstValueFrom(this.api.revokeShare(this.orgId(), this.id()));
      this.reload.update((n) => n + 1);
      this.ui.success('Sharing turned off');
    } catch (err) {
      this.ui.error(err);
    }
  }

  protected async copy() {
    try {
      await navigator.clipboard.writeText(this.shareUrl());
      this.ui.success('Link copied');
    } catch {
      this.ui.error(null, 'Could not copy. Select the link and copy it manually.');
    }
  }

  protected async remove() {
    const p = this.problem();
    if (!p) return;
    const direct = p.permissions.canEdit;
    const ok = await this.ui.confirm(
      direct ? 'Delete this problem?' : 'Request deletion?',
      direct
        ? 'The problem, its solution, attachments and share links will be removed for good.'
        : 'An admin will review your request before anything is deleted.',
      direct ? 'Delete' : 'Send request',
      true,
    );
    if (!ok) return;
    try {
      const res = await firstValueFrom(this.api.deleteProblem(this.orgId(), this.id()));
      if (res.applied) {
        this.ui.success('Problem deleted');
        await this.router.navigate(['/orgs', this.orgId()]);
      } else {
        this.ui.success('Deletion request sent to the admins');
        this.reload.update((n) => n + 1);
      }
    } catch (err) {
      this.ui.error(err);
    }
  }
}
