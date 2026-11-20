import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, viewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TuiButton, TuiIcon, TuiInput, TuiLoader } from '@taiga-ui/core';
import { TuiInputChip, TuiSegmented } from '@taiga-ui/kit';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../core/api.service';
import { formatBytes, orgAttachmentUrl } from '../core/markdown';
import type { Attachment, ContentFormat, ProblemDetail } from '../core/models';
import { SessionService } from '../core/session.service';
import { UiService } from '../core/ui.service';
import { ContentEditorComponent } from '../shared/content-editor.component';

const MAX_BYTES = 25 * 1024 * 1024;

@Component({
  selector: 'app-problem-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, TuiButton, TuiIcon, TuiInput, TuiInputChip, TuiLoader, TuiSegmented, ContentEditorComponent],
  template: `
    <a
      tuiButton appearance="flat" size="s" iconStart="@tui.arrow-left" class="mb-4"
      [routerLink]="id() ? ['/orgs', orgId(), 'problems', id()] : ['/orgs', orgId()]"
      >Cancel</a
    >
    <h1 class="text-2xl font-bold tracking-tight mb-6">{{ heading() }}</h1>

    @if (loading()) {
      <tui-loader class="block py-20" />
    } @else {
      @if (needsApproval()) {
        <div class="mb-6 rounded-xl border px-4 py-3 text-sm flex items-start gap-2" style="border-color: var(--tui-status-warning)">
          <tui-icon icon="@tui.info" />
          <span>You are not the author, so your changes are sent to an admin for approval. Nothing changes until they approve.</span>
        </div>
      }

      <form class="flex flex-col gap-6" (ngSubmit)="save()">
        <tui-textfield>
          <label tuiLabel for="title">Title</label>
          <input id="title" tuiInput name="title" [(ngModel)]="title" required minlength="3" maxlength="200" autocomplete="off" />
        </tui-textfield>

        <tui-textfield multi>
          <label tuiLabel for="tags">Tags (press Enter to add, up to 10)</label>
          <input id="tags" tuiInputChip name="tags" [ngModel]="tags()" (ngModelChange)="setTags($event)" />
        </tui-textfield>

        <div class="flex flex-wrap items-center gap-3">
          <span class="text-sm font-medium">Format</span>
          <tui-segmented size="m" [activeItemIndex]="format() === 'MARKDOWN' ? 0 : 1" (activeItemIndexChange)="format.set($event === 0 ? 'MARKDOWN' : 'PLAIN')">
            <button type="button">Markdown</button>
            <button type="button">Plain text</button>
          </tui-segmented>
          <span class="text-xs" style="color: var(--tui-text-secondary)">
            {{ format() === 'MARKDOWN' ? 'Write on the left, see the result on the right.' : 'Saved and shown exactly as typed.' }}
          </span>
        </div>

        <app-content-editor
          label="Problem" inputId="problem" placeholder="What went wrong? Include errors, context and how to reproduce."
          [format]="format()" [(value)]="problem" (focused)="lastFocused.set('problem')" (filesPasted)="addFiles($event, 'problem')"
        />
        <app-content-editor
          label="Solution" inputId="solution" placeholder="What fixed it? Steps, commands and links."
          [format]="format()" [(value)]="solution" (focused)="lastFocused.set('solution')" (filesPasted)="addFiles($event, 'solution')"
        />

        <section>
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-sm font-medium">Attachments</h2>
            <button tuiButton type="button" size="s" appearance="secondary" iconStart="@tui.paperclip" [disabled]="uploading()" (click)="fileInput.click()">
              {{ uploading() ? 'Uploading...' : 'Add files' }}
            </button>
            <input #fileInput type="file" multiple hidden (change)="addFiles($any($event.target).files, lastFocused()); fileInput.value = ''" />
          </div>
          <p class="text-xs mb-3" style="color: var(--tui-text-secondary)">
            Up to 25 MB per file. You can also paste an image straight into a text box.
          </p>
          @if (attachments().length) {
            <ul class="flex flex-col gap-2">
              @for (a of attachments(); track a.id) {
                <li class="flex items-center gap-3 rounded-xl px-3 py-2" style="background: var(--tui-background-neutral-1)">
                  <tui-icon [icon]="isImage(a) ? '@tui.image' : '@tui.file'" />
                  <span class="min-w-0 flex-1 truncate">{{ a.filename }}</span>
                  <span class="text-xs shrink-0" style="color: var(--tui-text-secondary)">{{ size(a.size) }}</span>
                  @if (format() === 'MARKDOWN') {
                    <button tuiIconButton type="button" appearance="flat" size="s" aria-label="Insert into text" title="Insert into text" (click)="insert(a, lastFocused())">
                      <tui-icon icon="@tui.text-cursor-input" />
                    </button>
                  }
                  <button tuiIconButton type="button" appearance="flat-destructive" size="s" aria-label="Remove attachment" title="Remove" (click)="removeAttachment(a)">
                    <tui-icon icon="@tui.x" />
                  </button>
                </li>
              }
            </ul>
          }
        </section>

        <div class="flex justify-end gap-2 pt-2">
          <a tuiButton appearance="flat" [routerLink]="id() ? ['/orgs', orgId(), 'problems', id()] : ['/orgs', orgId()]">Cancel</a>
          <button tuiButton type="submit" [disabled]="!valid() || saving() || uploading()">{{ submitLabel() }}</button>
        </div>
      </form>
    }
  `,
})
export class ProblemEditorPage {
  readonly orgId = input.required<string>();
  readonly id = input<string>();

  private readonly api = inject(ApiService);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly editors = viewChildren(ContentEditorComponent);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly lastFocused = signal<'problem' | 'solution'>('solution');
  protected readonly size = formatBytes;

  protected readonly title = signal('');
  protected readonly tags = signal<string[]>([]);
  protected readonly format = signal<ContentFormat>('MARKDOWN');
  protected readonly problem = signal('');
  protected readonly solution = signal('');
  protected readonly attachments = signal<Attachment[]>([]);
  private readonly loaded = signal<ProblemDetail | null>(null);

  protected readonly needsApproval = computed(() => this.loaded()?.permissions.canRequestChange ?? false);
  protected readonly heading = computed(() =>
    !this.id() ? 'New problem' : this.needsApproval() ? 'Suggest an edit' : 'Edit problem',
  );
  protected readonly submitLabel = computed(() =>
    !this.id() ? 'Save problem' : this.needsApproval() ? 'Send for approval' : 'Save changes',
  );
  protected readonly valid = computed(() => this.title().trim().length >= 3 && this.problem().trim().length > 0);

  constructor() {
    effect(() => {
      const id = this.id();
      if (!id) return;
      this.loading.set(true);
      this.api.problem(this.orgId(), id).subscribe({
        next: (p) => {
          this.loaded.set(p);
          this.title.set(p.title);
          this.tags.set(p.tags);
          this.format.set(p.format);
          this.problem.set(p.problem);
          this.solution.set(p.solution);
          this.attachments.set(p.attachments);
          this.loading.set(false);
          if (!p.permissions.canEdit && !p.permissions.canRequestChange) void this.router.navigate(['/orgs', this.orgId()]);
        },
        error: () => void this.router.navigate(['/orgs', this.orgId()]),
      });
    });
    // Viewers cannot create problems.
    effect(() => {
      if (!this.id() && this.session.roleIn(this.orgId()) === 'VIEWER') void this.router.navigate(['/orgs', this.orgId()]);
    });
  }

  protected setTags(tags: string[]) {
    this.tags.set(
      [...new Set(tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0 && t.length <= 30))].slice(0, 10),
    );
  }

  protected isImage(a: Attachment) {
    return ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(a.mimeType);
  }

  protected async addFiles(files: FileList | File[] | null, target: 'problem' | 'solution') {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    this.uploading.set(true);
    try {
      for (const file of list) {
        if (file.size > MAX_BYTES) {
          this.ui.error(null, `${file.name} is larger than 25 MB`);
          continue;
        }
        try {
          const attachment = await firstValueFrom(this.api.upload(this.orgId(), file));
          this.attachments.update((a) => [...a, attachment]);
          // Pasted or dropped images go straight into the text; other files stay in the list.
          if (this.format() === 'MARKDOWN' && this.isImage(attachment)) this.insert(attachment, target);
        } catch (err) {
          this.ui.error(err, `Could not upload ${file.name}`);
        }
      }
    } finally {
      this.uploading.set(false);
    }
  }

  protected insert(a: Attachment, target: 'problem' | 'solution') {
    const url = orgAttachmentUrl(this.orgId(), a.id);
    const text = this.isImage(a) ? `![${a.filename}](${url})` : `[${a.filename}](${url})`;
    this.editors()[target === 'problem' ? 0 : 1].insert(text);
  }

  protected removeAttachment(a: Attachment) {
    this.attachments.update((list) => list.filter((x) => x.id !== a.id));
  }

  protected async save() {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    const body = {
      title: this.title().trim(),
      problem: this.problem(),
      solution: this.solution(),
      format: this.format(),
      tags: this.tags(),
      attachmentIds: this.attachments().map((a) => a.id),
    };
    try {
      const id = this.id();
      if (!id) {
        const created = await firstValueFrom(this.api.createProblem(this.orgId(), body));
        this.ui.success('Problem saved');
        await this.router.navigate(['/orgs', this.orgId(), 'problems', created.id]);
      } else {
        const res = await firstValueFrom(this.api.updateProblem(this.orgId(), id, body));
        this.ui.success(res.applied ? 'Changes saved' : 'Sent to the admins for approval');
        await this.router.navigate(['/orgs', this.orgId(), 'problems', id]);
      }
    } catch (err) {
      this.ui.error(err, 'Could not save');
    } finally {
      this.saving.set(false);
    }
  }
}
