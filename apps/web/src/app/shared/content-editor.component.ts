import { ChangeDetectionStrategy, Component, ElementRef, computed, input, model, output, viewChild } from '@angular/core';
import { renderMarkdown } from '../core/markdown';
import type { ContentFormat } from '../core/models';

/**
 * Markdown: editor on the left, live preview on the right (stacked on small screens).
 * Plain text: one full-width box, saved and shown exactly as typed.
 */
@Component({
  selector: 'app-content-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium" [attr.for]="inputId()">{{ label() }}</label>
      <div class="grid gap-3" [class.lg:grid-cols-2]="format() === 'MARKDOWN'">
        <textarea
          #box
          class="editor-box"
          [id]="inputId()"
          [value]="value()"
          (input)="value.set(box.value)"
          (focus)="focused.emit()"
          (paste)="onPaste($event)"
          [class.font-mono]="format() === 'MARKDOWN'"
          [placeholder]="placeholder()"
          spellcheck="true"
        ></textarea>
        @if (format() === 'MARKDOWN') {
          <div class="preview-box" aria-label="Preview">
            @if (value().trim()) {
              <div class="prose-sd" [innerHTML]="html()"></div>
            } @else {
              <span style="color: var(--tui-text-tertiary)">Preview appears here</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .editor-box,
    .preview-box {
      min-height: 16rem;
      border: 1px solid var(--tui-border-normal);
      border-radius: 0.75rem;
      background: var(--tui-background-base);
      padding: 0.9rem 1rem;
      color: var(--tui-text-primary);
    }
    .editor-box {
      width: 100%;
      resize: vertical;
      font-size: 0.9rem;
      line-height: 1.6;
      outline: none;
    }
    .editor-box:focus {
      border-color: var(--tui-border-focus);
    }
    .preview-box {
      overflow: auto;
      max-height: 40rem;
      background: var(--tui-background-elevation-1);
    }
  `,
})
export class ContentEditorComponent {
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  readonly placeholder = input('');
  readonly format = input<ContentFormat>('MARKDOWN');
  readonly value = model('');
  readonly focused = output<void>();
  readonly filesPasted = output<File[]>();

  private readonly box = viewChild.required<ElementRef<HTMLTextAreaElement>>('box');
  protected readonly html = computed(() => renderMarkdown(this.value()));

  protected onPaste(event: ClipboardEvent) {
    const files = Array.from(event.clipboardData?.files ?? []);
    if (files.length) {
      event.preventDefault();
      this.filesPasted.emit(files);
    }
  }

  /** Inserts text at the cursor (or appends when the box was never focused). */
  insert(text: string) {
    const el = this.box().nativeElement;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const prefix = start > 0 && !el.value.slice(0, start).endsWith('\n') ? '\n' : '';
    const next = `${el.value.slice(0, start)}${prefix}${text}\n${el.value.slice(end)}`;
    this.value.set(next);
  }
}
