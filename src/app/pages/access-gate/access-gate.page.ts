import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline,
  closeCircleOutline,
} from 'ionicons/icons';
import { SessionService } from '../../services/session.service';

type AccessStatus = 'checking' | 'allowed' | 'denied';

@Component({
  selector: 'app-access-gate',
  standalone: true,
  imports: [IonContent, IonIcon, IonSpinner],
  templateUrl: './access-gate.page.html',
  styleUrl: './access-gate.page.scss',
})
export class AccessGatePage implements OnInit, OnDestroy {
  status: AccessStatus = 'checking';
  private redirectTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly session: SessionService,
    private readonly router: Router,
  ) {
    addIcons({
      'checkmark-circle-outline': checkmarkCircleOutline,
      'close-circle-outline': closeCircleOutline,
    });
  }

  ngOnInit(): void {
    void this.checkAccess();
  }

  ngOnDestroy(): void {
    if (this.redirectTimer !== undefined) {
      clearTimeout(this.redirectTimer);
    }
  }

  get statusMessage(): string {
    switch (this.status) {
      case 'allowed':
        return 'Acceso permitido';
      case 'denied':
        return 'Acceso denegado';
      default:
        return 'Verificando acceso...';
    }
  }

  private async checkAccess(): Promise<void> {
    let destination = '/login';

    try {
      const result = await this.session.validateStoredSession();
      if (result.status === 'valid') {
        this.status = 'allowed';
        destination = '/home';
      } else {
        this.status = 'denied';
        this.session.setNotice(
          result.status === 'mismatch' || result.status === 'expired'
            ? result.message
            : 'No existe una sesión activa en este dispositivo.',
        );
      }
    } catch (error: unknown) {
      console.error('No se pudo validar el acceso desde el enlace directo.', error);
      this.status = 'denied';
      this.session.setNotice(
        'No se pudo validar el acceso. Inicia sesión o vuelve a intentarlo.',
      );
    }

    this.redirectTimer = setTimeout(() => {
      void this.router.navigateByUrl(destination, { replaceUrl: true });
    }, 2500);
  }
}
