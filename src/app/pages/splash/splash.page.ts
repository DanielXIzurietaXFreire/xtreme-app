import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [IonContent, IonSpinner],
  templateUrl: './splash.page.html',
  styleUrl: './splash.page.scss',
})
export class SplashPage implements OnInit, OnDestroy {
  private redirectTimer?: ReturnType<typeof setTimeout>;
  private readonly redirectTo: string;

  constructor(
    route: ActivatedRoute,
    private readonly router: Router,
    private readonly session: SessionService,
  ) {
    const destination: unknown = route.snapshot.data['redirectTo'];
    if (typeof destination !== 'string') {
      throw new Error('La ruta de splash debe definir un destino.');
    }
    this.redirectTo = destination;
  }

  ngOnInit(): void {
    if (this.router.url.startsWith('/splash2')) {
      this.redirectTimer = setTimeout(() => {
        void this.router.navigateByUrl(this.redirectTo, { replaceUrl: true });
      }, 2500);
      return;
    }

    void this.startInitialSplash();
  }

  private async startInitialSplash(): Promise<void> {
    const startedAt = Date.now();
    let destination = '/login';
    try {
      const result = await this.session.validateStoredSession();
      if (result.status === 'valid') {
        destination = '/home';
      }
    } catch (error: unknown) {
      console.error('No se pudo validar la sesión guardada al iniciar.', error);
      this.session.setNotice('No se pudo validar el acceso. Comprueba tu conexión.');
    }

    const remainingSplashTime = Math.max(0, 2500 - (Date.now() - startedAt));
    this.redirectTimer = setTimeout(() => {
      void this.router.navigateByUrl(destination, { replaceUrl: true });
    }, remainingSplashTime);
  }

  ngOnDestroy(): void {
    if (this.redirectTimer !== undefined) {
      clearTimeout(this.redirectTimer);
    }
  }
}
