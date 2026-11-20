import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { renderMarkdown } from '../core/markdown';
import type { ContentFormat } from '../core/models';

/** Renders user content: sanitized markdown, or plain text exactly as typed. */
@Component({
  selector: 'app-content-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (format() === 'MARKDOWN') {
      <div class="prose-sd" [innerHTML]="html()"></div>
    } @else {
      <div class="plain-text">{{ content() }}</div>
    }
  `,
})
export class ContentViewComponent {
  readonly content = input.required<string>();
  readonly format = input<ContentFormat>('MARKDOWN');
  readonly shareToken = input<string>();
  protected readonly html = computed(() => renderMarkdown(this.content(), this.shareToken()));
}
