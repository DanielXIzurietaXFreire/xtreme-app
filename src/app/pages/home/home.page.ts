import { Component, OnDestroy, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  IonCard,
  IonCardContent,
  IonChip,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonList,
  IonProgressBar,
  IonRow,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  barbellOutline,
  calendarOutline,
  cardOutline,
  personOutline,
} from 'ionicons/icons';
import { Cliente, SessionService } from '../../services/session.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    DecimalPipe,
    IonCard,
    IonCardContent,
    IonChip,
    IonCol,
    IonContent,
    IonGrid,
    IonIcon,
    IonList,
    IonProgressBar,
    IonRow,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements OnInit, OnDestroy {
  countdown = { days: 0, hours: 0, minutes: 0, seconds: 0 };
  countdownAvailable = false;
  private countdownTimer?: ReturnType<typeof setInterval>;
  private expiryHandled = false;

  constructor(private readonly session: SessionService) {
    addIcons({
      'barbell-outline': barbellOutline,
      'calendar-outline': calendarOutline,
      'card-outline': cardOutline,
      'person-outline': personOutline,
    });
  }

  ngOnInit(): void {
    this.updateCountdown();
    this.countdownTimer = setInterval(() => this.updateCountdown(), 1000);
  }

  ngOnDestroy(): void {
    if (this.countdownTimer !== undefined) {
      clearInterval(this.countdownTimer);
    }
  }

  get cliente(): Cliente | null {
    return this.session.currentCliente;
  }

  get remainingDays(): number {
    return this.session.remainingDays;
  }

  get noticeMessage(): string {
    return this.session.currentNotice;
  }

  get firstName(): string {
    const name = this.displayValue('nombre');
    return name === 'No disponible' ? 'bienvenido' : name.trim().split(/\s+/)[0];
  }

  get accessProgress(): number {
    return Math.min(Math.max(this.countdown.days / 30, 0), 1);
  }

  get countdownExpired(): boolean {
    return this.countdownAvailable
      && this.countdown.days === 0
      && this.countdown.hours === 0
      && this.countdown.minutes === 0
      && this.countdown.seconds === 0;
  }

  get membershipName(): string {
    return this.displayValue('tipoPago', 'tipo_pago', 'membresia');
  }

  get expiryDate(): string {
    const date = this.displayValue('fechaVencimiento', 'fecha_vencimiento', 'fecha_fin');
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
  }

  displayValue(...keys: string[]): string {
    const cliente = this.cliente;
    if (!cliente) {
      return 'No disponible';
    }

    for (const key of keys) {
      const value = cliente[key];
      if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
      }
    }
    return 'No disponible';
  }

  private updateCountdown(): void {
    const rawExpiryDate = this.displayValue(
      'fechaVencimiento',
      'fecha_vencimiento',
      'fecha_fin',
    );
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawExpiryDate);

    if (!match || rawExpiryDate === 'No disponible') {
      this.countdownAvailable = false;
      this.countdown = { days: 0, hours: 0, minutes: 0, seconds: 0 };
      return;
    }

    const [, year, month, day] = match;
    const expiryDay = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      expiryDay.getFullYear() !== Number(year)
      || expiryDay.getMonth() !== Number(month) - 1
      || expiryDay.getDate() !== Number(day)
    ) {
      this.countdownAvailable = false;
      this.countdown = { days: 0, hours: 0, minutes: 0, seconds: 0 };
      return;
    }

    this.countdownAvailable = true;
    const deadline = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    ).getTime();
    let secondsLeft = Math.max(0, Math.floor((deadline - Date.now()) / 1000));

    const days = Math.floor(secondsLeft / 86_400);
    secondsLeft %= 86_400;
    const hours = Math.floor(secondsLeft / 3_600);
    secondsLeft %= 3_600;
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;

    this.countdown = { days, hours, minutes, seconds };

    if (this.countdownExpired && !this.expiryHandled && this.cliente) {
      this.expiryHandled = true;
      void this.session.expireSession().catch((error: unknown) => {
        console.error('No se pudo cerrar la sesión al vencer la membresía.', error);
      });
    }
  }
}
