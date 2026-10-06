import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonIcon } from '@ionic/angular/standalone';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [IonButton, IonContent, IonIcon],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  notice = '';

  constructor(
    private readonly router: Router,
    private readonly session: SessionService,
  ) {}

  ionViewWillEnter(): void {
    this.notice = this.session.takeNotice();
  }

  openCodeEntry(): void {
    void this.router.navigateByUrl('/enter-code', { replaceUrl: true });
  }
}
