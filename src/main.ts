import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    provideIonicAngular(),
    provideHttpClient(),
    provideRouter(routes),
  ],
}).catch((error: unknown) => {
  console.error('No se pudo iniciar la aplicación Xtreme Gym.', error);
});
