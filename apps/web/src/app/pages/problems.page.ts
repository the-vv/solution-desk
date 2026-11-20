import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TuiButton, TuiIcon, TuiInput, TuiLoader } from '@taiga-ui/core';
import { TuiPagination } from '@taiga-ui/kit';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../core/api.service';
import { SessionService } from '../core/session.service';
import { UserAvatarComponent } from '../shared/user-avatar.component';

@Component({
  selector: 'app-problems',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, DatePipe, TuiButton, TuiIcon, TuiInput, TuiLoader, TuiPagination, UserAvatarComponent],
  template: `
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight truncate">{{ org()?.name }}</h1>
        <p class="text-sm mt-1" style="color: var(--tui-text-secondary)">
          Search past problems and their solutions, or browse what was added recently.
        </p>
      </div>
      @if (role() !== 'VIEWER') {
        <a tuiButton iconStart="@tui.plus" [routerLink]="['/orgs', orgId(), 'problems', 'new']">New problem</a>
      }
    </div>

    <tui-textfield class="mb-4" iconStart="@tui.search" [tuiTextfieldCleaner]="true">
      <label tuiLabel for="search">Search problems, solutions and tags</label>
      <input id="search" tuiInput type="search" autocomplete="off" [ngModel]="searchText()" (ngModelChange)="searchText.set($event)" />
    </tui-textfield>

    @if (tags().length) {
      <div class="flex flex-wrap items-center gap-2 mb-6" role="group" aria-label="Filter by tag">
        @for (t of tags(); track t.tag) {
          <button
            type="button"
            tuiButton
            size="xs"
            [appearance]="activeTag() === t.tag ? 'primary' : 'secondary'"
            (click)="toggleTag(t.tag)"
          >
            {{ t.tag }} <span class="opacity-60">{{ t.count }}</span>
          </button>
        }
      </div>
    }

    <div class="flex items-center justify-between mb-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide" style="color: var(--tui-text-secondary)">
        @if (query()) { Results for "{{ query() }}" } @else { Recently added }
        @if (data(); as d) { <span class="ml-1 normal-case font-normal">({{ d.total }})</span> }
      </h2>
    </div>

    <tui-loader [loading]="loading()" [overlay]="true">
      @if (data(); as d) {
        @if (d.items.length === 0) {
          <div class="rounded-2xl border border-dashed p-10 text-center" style="border-color: var(--tui-border-normal)">
            <tui-icon icon="@tui.search-x" class="mb-3" style="font-size: 2.5rem; color: var(--tui-text-tertiary)" />
            <p class="font-medium">{{ query() || activeTag() ? 'No problems match your search' : 'No problems yet' }}</p>
            @if (!query() && !activeTag() && role() !== 'VIEWER') {
              <p class="text-sm mt-1" style="color: var(--tui-text-secondary)">Add the first problem and its solution.</p>
            }
          </div>
        } @else {
          <ul class="flex flex-col gap-3">
            @for (p of d.items; track p.id) {
              <li>
                <a
                  [routerLink]="['/orgs', orgId(), 'problems', p.id]"
                  class="block rounded-2xl border p-5 transition-colors hover:bg-[var(--tui-background-neutral-1-hover)]"
                  style="background: var(--tui-background-elevation-1); border-color: var(--tui-border-normal)"
                >
                  <h3 class="font-semibold text-lg mb-1">{{ p.title }}</h3>
                  <p class="text-sm line-clamp-2 mb-3" style="color: var(--tui-text-secondary)">{{ p.excerpt }}</p>
                  <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs" style="color: var(--tui-text-secondary)">
                    <span class="inline-flex items-center gap-2">
                      <app-user-avatar [name]="p.author.name" [url]="p.author.avatarUrl" [size]="20" />
                      {{ p.author.name }}
                    </span>
                    <span class="inline-flex items-center gap-1"><tui-icon icon="@tui.clock" /> {{ p.createdAt | date: 'mediumDate' }}</span>
                    @if (p.attachmentCount) {
                      <span class="inline-flex items-center gap-1"><tui-icon icon="@tui.paperclip" /> {{ p.attachmentCount }}</span>
                    }
                    @for (t of p.tags; track t) {
                      <span class="rounded-full px-2 py-0.5" style="background: var(--tui-background-neutral-1)">{{ t }}</span>
                    }
                  </div>
                </a>
              </li>
            }
          </ul>
          @if (pageCount() > 1) {
            <div class="mt-6 flex justify-center">
              <tui-pagination [length]="pageCount()" [index]="page() - 1" (indexChange)="goToPage($event + 1)" />
            </div>
          }
        }
      }
    </tui-loader>
  `,
})
export class ProblemsPage {
  readonly orgId = input.required<string>();

  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly role = computed(() => this.session.roleIn(this.orgId()));
  protected readonly org = computed(() => this.session.organizations().find((o) => o.id === this.orgId()));

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: false });
  protected readonly query = computed(() => this.params()?.get('q') ?? '');
  protected readonly activeTag = computed(() => this.params()?.get('tag') ?? '');
  protected readonly page = computed(() => Math.max(1, Number(this.params()?.get('page') ?? 1) || 1));

  protected readonly searchText = signal('');
  protected readonly loading = signal(false);
  private readonly pageSize = 15;

  protected readonly tags = toSignal(
    toObservable(this.orgId).pipe(
      switchMap((id) => this.api.tags(id).pipe(catchError(() => of([])))),
      map((t) => t.slice(0, 20)),
    ),
    { initialValue: [] },
  );

  protected readonly data = toSignal(
    combineLatest([toObservable(this.orgId), toObservable(this.query), toObservable(this.activeTag), toObservable(this.page)]).pipe(
      tap(() => this.loading.set(true)),
      switchMap(([id, q, tag, page]) =>
        this.api.problems(id, { q, tag, page, pageSize: this.pageSize }).pipe(
          catchError(() => of(null)),
        ),
      ),
      tap(() => this.loading.set(false)),
    ),
    { initialValue: null },
  );

  protected readonly pageCount = computed(() => Math.ceil((this.data()?.total ?? 0) / this.pageSize));

  constructor() {
    this.searchText.set(this.route.snapshot.queryParamMap.get('q') ?? '');
    // Push typed text into the URL so searches can be bookmarked and survive reloads.
    toObservable(this.searchText)
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((text) => {
        const q = text.trim();
        if (q !== this.query()) void this.navigate({ q: q || null, page: null });
      });
  }

  protected toggleTag(tag: string) {
    void this.navigate({ tag: this.activeTag() === tag ? null : tag, page: null });
  }

  protected goToPage(page: number) {
    void this.navigate({ page: page === 1 ? null : page });
  }

  private navigate(queryParams: Record<string, string | number | null>) {
    return this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }
}
