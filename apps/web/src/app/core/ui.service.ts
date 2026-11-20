import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TuiDialogService, TuiNotificationService } from '@taiga-ui/core';
import { TUI_CONFIRM, type TuiConfirmData } from '@taiga-ui/kit';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UiService {
  private readonly dialogs = inject(TuiDialogService);
  private readonly notifications = inject(TuiNotificationService);

  async confirm(label: string, content: string, yes = 'Confirm', danger = false): Promise<boolean> {
    const data: TuiConfirmData = {
      content,
      yes,
      no: 'Cancel',
      appearance: danger ? ['primary-destructive', 'secondary'] : ['primary', 'secondary'],
    };
    const result = await firstValueFrom(this.dialogs.open<boolean>(TUI_CONFIRM, { label, size: 's', data }), {
      defaultValue: false,
    });
    return !!result;
  }

  success(message: string) {
    this.notifications.open(message, { appearance: 'positive', autoClose: 4000 }).subscribe();
  }

  error(err: unknown, fallback = 'Something went wrong') {
    this.notifications.open(this.message(err, fallback), { appearance: 'negative', autoClose: 6000 }).subscribe();
  }

  message(err: unknown, fallback = 'Something went wrong'): string {
    if (err instanceof HttpErrorResponse) {
      const m = (err.error as { message?: string | string[] } | null)?.message;
      if (Array.isArray(m)) return m[0] ?? fallback;
      if (typeof m === 'string') return m;
      if (err.status === 0) return 'Cannot reach the server';
    }
    return fallback;
  }
}
