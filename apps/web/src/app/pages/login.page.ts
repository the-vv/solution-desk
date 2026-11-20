import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TuiButton, TuiIcon } from '@taiga-ui/core';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TuiButton, TuiIcon],
  template: `
    <div class="min-h-screen flex items-center justify-center px-4">
      <div
        class="w-full max-w-md rounded-3xl border p-8 sm:p-10"
        style="background: var(--tui-background-elevation-1); border-color: var(--tui-border-normal)"
      >
        <div class="flex items-center gap-3 mb-8">
          <span class="inline-flex size-11 items-center justify-center rounded-2xl" style="background: var(--tui-background-accent-1)">
            <tui-icon icon="@tui.book-open-text" class="text-white" />
          </span>
          <span class="text-2xl font-bold tracking-tight">Solution Desk</span>
        </div>
        <h1 class="text-xl font-semibold mb-2">Sign in</h1>
        <p class="mb-8 text-sm" style="color: var(--tui-text-secondary)">
          Keep the problems your team has solved, and find the answer next time in seconds.
        </p>
        <a tuiButton appearance="secondary" size="l" class="w-full" href="/api/auth/google">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/>
            <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
          </svg>
          Continue with Google
        </a>
        <p class="mt-6 text-xs" style="color: var(--tui-text-tertiary)">
          New here? You can create your own organization, or ask an admin to invite your Google email address.
        </p>
      </div>
    </div>
  `,
})
export class LoginPage {}
