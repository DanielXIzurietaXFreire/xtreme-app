import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
} from '@ionic/angular/standalone';
import { InvalidAccessCodeError, SessionService } from '../../services/session.service';

@Component({
  selector: 'app-enter-code',
  standalone: true,
  imports: [FormsModule, IonButton, IonContent, IonIcon, IonInput],
  templateUrl: './enter-code.page.html',
  styleUrl: './enter-code.page.scss',
})
export class EnterCodePage {
  accessCode = '';
  errorMessage = '';
  isLoading = false;

  constructor(
    private readonly router: Router,
    private readonly session: SessionService,
  ) {}

  goBack(): void {
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  async enter(): Promise<void> {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    try {
      await this.session.authenticate(this.accessCode);
      await this.router.navigateByUrl('/splash2', { replaceUrl: true });
    } catch (error: unknown) {
      console.error('No se pudo validar el código de acceso.', error);
      this.errorMessage = error instanceof InvalidAccessCodeError
        ? error.message
        : 'No se pudo validar el código. Comprueba tu conexión e inténtalo de nuevo.';
    } finally {
      this.isLoading = false;
    }
  }
}
