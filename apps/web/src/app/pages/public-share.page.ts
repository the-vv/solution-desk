import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import { TuiButton, TuiIcon, TuiLoader } from '@taiga-ui/core';
import { catchError, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../core/api.service';
import { formatBytes, publicAttachmentUrl } from '../core/markdown';
import type { PublicProblem } from '../core/models';
import { ContentViewComponent } from '../shared/markdown-view.component';

/** Read-only page opened from a share link. No account needed. */
@Component({
  selector: 'app-public-share',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TuiButton, TuiIcon, TuiLoader, ContentViewComponent],
  template: `
    <div class="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
      <div class="flex items-center gap-3 mb-8">
        <span class="inline-flex size-9 items-center justify-center rounded-xl" style="background: var(--tui-background-accent-1)">
          <tui-icon icon="@tui.book-open-text" class="text-white" />
        </span>
        <span class="font-bold text-lg tracking-tight">Solution Desk</span>
        <span class="ml-auto inline-flex items-center gap-1 text-xs" style="color: var(--tui-text-secondary)">
          <tui-icon icon="@tui.eye" /> Read-only link
        </span>
      </div>

      @if (loading()) {
        <tui-loader class="block py-20" />
      } @else if (p(); as p) {
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight mb-3">{{ p.title }}</h1>
        <div class="text-sm mb-3" style="color: var(--tui-text-secondary)">
          {{ p.organization }} - by {{ p.author }} - updated {{ p.updatedAt | date: 'mediumDate' }}
        </div>
        @if (p.tags.length) {
          <div class="flex flex-wrap gap-2 mb-6">
            @for (t of p.tags; track t) {
              <span class="rounded-full px-3 py-1 text-xs" style="background: var(--tui-background-neutral-1)">{{ t }}</span>
            }
          </div>
        }

        <section class="rounded-2xl border p-5 sm:p-6 mb-5" style="background: var(--tui-background-elevation-1); border-color: var(--tui-border-normal)">
          <h2 class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide mb-4" style="color: var(--tui-status-negative)">
            <tui-icon icon="@tui.circle-alert" /> Problem
          </h2>
          <app-content-view [content]="p.problem" [format]="p.format" [shareToken]="token()" />
        </section>
        <section class="rounded-2xl border p-5 sm:p-6 mb-5" style="background: var(--tui-background-elevation-1); border-color: var(--tui-border-normal)">
          <h2 class="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide mb-4" style="color: var(--tui-status-positive)">
            <tui-icon icon="@tui.circle-check" /> Solution
          </h2>
          @if (p.solution.trim()) {
            <app-content-view [content]="p.solution" [format]="p.format" [shareToken]="token()" />
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
                  <tui-icon icon="@tui.file" />
                  <span class="min-w-0 flex-1 truncate">{{ a.filename }}</span>
                  <span class="text-xs shrink-0" style="color: var(--tui-text-secondary)">{{ size(a.size) }}</span>
                  <a tuiIconButton appearance="flat" size="s" [href]="url(a.id)" target="_blank" rel="noopener" aria-label="Open attachment">
                    <tui-icon icon="@tui.download" />
                  </a>
                </li>
              }
            </ul>
          </section>
        }
      } @else {
        <div class="rounded-2xl border border-dashed p-10 text-center" style="border-color: var(--tui-border-normal)">
          <tui-icon icon="@tui.link-2-off" class="mb-3" style="font-size: 2.5rem; color: var(--tui-text-tertiary)" />
          <p class="font-medium">This link is not valid anymore</p>
          <p class="text-sm mt-1" style="color: var(--tui-text-secondary)">It may have been turned off by its owner.</p>
        </div>
      }
    </div>
  `,
})
export class PublicSharePage {
  readonly token = input.required<string>();

  private readonly api = inject(ApiService);
  protected readonly loading = signal(true);
  protected readonly size = formatBytes;

  protected readonly p = toSignal(
    toObservable(this.token).pipe(
      tap(() => this.loading.set(true)),
      switchMap((t) => this.api.publicProblem(t).pipe(catchError(() => of(null as PublicProblem | null)))),
      tap(() => this.loading.set(false)),
    ),
    { initialValue: null as PublicProblem | null },
  );

  constructor() {
    // Secret links should never be indexed.
    inject(Meta).updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  protected url(attachmentId: string) {
    return publicAttachmentUrl(this.token(), attachmentId);
  }
}
