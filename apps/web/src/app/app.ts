import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TuiRoot } from '@taiga-ui/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TuiRoot],
  template: `
    <tui-root tuiTheme="dark">
      <router-outlet />
    </tui-root>
  `,
})
export class App {}
