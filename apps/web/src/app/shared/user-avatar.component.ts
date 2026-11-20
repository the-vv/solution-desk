import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-user-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (url()) {
      <img [src]="url()" [alt]="name()" referrerpolicy="no-referrer" class="rounded-full object-cover" [style.width.px]="size()" [style.height.px]="size()" />
    } @else {
      <span
        class="inline-flex items-center justify-center rounded-full font-semibold select-none"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="size() * 0.4"
        style="background: var(--tui-background-accent-1); color: var(--tui-text-primary-on-accent-1)"
        >{{ initials() }}</span
      >
    }
  `,
})
export class UserAvatarComponent {
  readonly name = input.required<string>();
  readonly url = input<string | null>(null);
  readonly size = input(32);
  protected readonly initials = computed(() =>
    this.name()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join(''),
  );
}
