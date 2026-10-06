import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Cliente {
  [key: string]: unknown;
  cedula: string;
  nombre: string;
  tipoPago: string;
  fechaVencimiento: string;
}

type SessionValidation =
  | { status: 'missing' }
  | { status: 'valid'; cliente: Cliente; daysRemaining: number }
  | { status: 'mismatch'; message: string }
  | { status: 'expired'; message: string };
type BackendValidation = SessionValidation | { status: 'invalid'; message: string };

export class InvalidAccessCodeError extends Error {}

const ACCESS_CODE_KEY = 'accessCode';
const API_BASE_URL = `${environment.backendUrl}/rest/v1`;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class SessionService {
  private cliente: Cliente | null = null;
  private daysRemaining = 0;
  private expiryTimer?: ReturnType<typeof setTimeout>;
  private resumeValidation: Promise<void> | null = null;
  private lifecycleStarted = false;
  private notice = '';

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {}

  get currentCliente(): Cliente | null {
    return this.cliente;
  }

  get remainingDays(): number {
    return this.daysRemaining;
  }

  get currentNotice(): string {
    return this.notice;
  }

  takeNotice(): string {
    const notice = this.notice;
    this.notice = '';
    return notice;
  }

  setNotice(message: string): void {
    this.notice = message;
  }

  startLifecycleMonitoring(): void {
    if (this.lifecycleStarted) {
      return;
    }
    this.lifecycleStarted = true;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.validateOnResume();
      }
    });

    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void this.validateOnResume();
      }
    }).catch((error: unknown) => {
      console.error('No se pudo registrar el evento de estado de la app.', error);
    });
  }

  async validateStoredSession(): Promise<SessionValidation> {
    const { value: accessCode } = await Preferences.get({ key: ACCESS_CODE_KEY });
    if (!accessCode) {
      this.clearCurrentCliente();
      return { status: 'missing' };
    }

    const result = await this.validateWithBackend(accessCode, false);
    if (result.status === 'mismatch') {
      await this.clearAccessCodeSession();
      this.setNotice(result.message);
      return result;
    }

    if (result.status !== 'valid') {
      throw new Error(
        result.status === 'invalid'
          ? result.message
          : 'El código guardado ya no está disponible.',
      );
    }

    if (this.isMembershipExpired(result.cliente.fechaVencimiento)) {
      await this.clearAccessCodeSession();
      const expired = {
        status: 'expired' as const,
        message: 'La membresía venció y se cerró la sesión.',
      };
      this.setNotice(expired.message);
      return expired;
    }

    this.updateCurrentCliente(result.cliente, result.daysRemaining);
    return result;
  }

  async authenticate(accessCode: string): Promise<void> {
    const submittedCode = accessCode.trim();
    if (!submittedCode) {
      throw new InvalidAccessCodeError('Ingresa un código de acceso.');
    }

    const result = await this.validateWithBackend(submittedCode, true);
    if (result.status !== 'valid') {
      throw new InvalidAccessCodeError(
        result.status === 'invalid' ? result.message : 'Código inválido o ya utilizado.',
      );
    }

    await Preferences.set({ key: ACCESS_CODE_KEY, value: submittedCode });
    try {
      await firstValueFrom(
        this.http.patch<unknown>(
          `${API_BASE_URL}/codigo/${encodeURIComponent(result.cliente.cedula)}`,
          { usado: true },
        ),
      );
    } catch (error: unknown) {
      try {
        await Preferences.remove({ key: ACCESS_CODE_KEY });
      } catch (removeError: unknown) {
        console.error('No se pudo limpiar el código guardado tras fallar su consumo.', removeError);
      }
      throw error;
    }

    this.updateCurrentCliente(result.cliente, result.daysRemaining);
  }

  async expireSession(): Promise<void> {
    await this.clearAccessCodeSession();
    this.setNotice('La membresía venció y se cerró la sesión.');
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private async validateWithBackend(
    accessCode: string,
    requireUnusedCode: boolean,
  ): Promise<BackendValidation> {
    const codeRows = await firstValueFrom(
      this.http.get<unknown>(`${API_BASE_URL}/codigo`, {
        params: { codigo: `eq.${accessCode}` },
      }),
    );
    const codeRow = this.asRecords(codeRows).find(
      (row) => this.readString(row, 'codigo') === accessCode,
    );

    if (!codeRow) {
      return {
        status: 'mismatch',
        message: 'El código guardado ya no coincide con el código activo en la base de datos.',
      };
    }

    if (
      requireUnusedCode
      && this.readBoolean(codeRow, 'usado', 'codigo_usado') !== false
    ) {
      return {
        status: 'invalid',
        message: 'Código inválido o ya utilizado. Solicita un código activo.',
      };
    }

    const cedula = this.readString(codeRow, 'cedula');
    if (!cedula) {
      throw new Error('El código no está asociado a un cliente.');
    }

    const clientRows = await firstValueFrom(
      this.http.get<unknown>(`${API_BASE_URL}/clientes`, {
        params: { cedula: `eq.${cedula}` },
      }),
    );
    const client = this.asRecords(clientRows)[0];
    if (!client) {
      throw new Error('No se encontró el cliente asociado al código.');
    }

    const expiryDate = this.readString(client, 'fecha_vencimiento', 'fecha_fin');
    const daysRemaining = this.getDaysRemaining(expiryDate);
    if (requireUnusedCode && (!expiryDate || this.isMembershipExpired(expiryDate))) {
      return {
        status: 'invalid',
        message: expiryDate
          ? 'La membresía venció. Solicita la renovación de tu acceso.'
          : 'No se encontró la fecha de vencimiento de la membresía.',
      };
    }

    return {
      status: 'valid',
      cliente: {
        ...client,
        cedula,
        nombre: this.readString(client, 'nombre') || 'Cliente',
        tipoPago: this.readString(client, 'tipo_pago', 'tipoPago') || 'No especificada',
        fechaVencimiento: expiryDate,
      },
      daysRemaining,
    };
  }

  private async validateOnResume(): Promise<void> {
    if (this.resumeValidation || this.router.url.startsWith('/splash')) {
      return this.resumeValidation ?? Promise.resolve();
    }

    this.resumeValidation = this.validateStoredSession()
      .then(async (result) => {
        if (
          result.status === 'mismatch'
          || result.status === 'missing'
          || result.status === 'expired'
        ) {
          if (this.router.url !== '/login') {
            await this.router.navigateByUrl('/login', { replaceUrl: true });
          }
          return;
        }

        if (this.router.url === '/login' || this.router.url === '/enter-code') {
          await this.router.navigateByUrl('/home', { replaceUrl: true });
        }
      })
      .catch((error: unknown) => {
        console.error('No se pudo revalidar la sesión al volver a primer plano.', error);
        this.setNotice('No se pudo validar el acceso. Comprueba tu conexión e inténtalo de nuevo.');
      })
      .finally(() => {
        this.resumeValidation = null;
      });

    return this.resumeValidation;
  }

  private updateCurrentCliente(cliente: Cliente, daysRemaining: number): void {
    this.cliente = cliente;
    this.daysRemaining = daysRemaining;
    this.scheduleExpiryCheck();
  }

  private clearCurrentCliente(): void {
    this.cliente = null;
    this.daysRemaining = 0;
    if (this.expiryTimer !== undefined) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = undefined;
    }
  }

  private async clearAccessCodeSession(): Promise<void> {
    await Preferences.remove({ key: ACCESS_CODE_KEY });
    this.clearCurrentCliente();
  }

  private scheduleExpiryCheck(): void {
    if (this.expiryTimer !== undefined) {
      clearTimeout(this.expiryTimer);
    }
    const now = new Date();
    const nextLocalMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    this.expiryTimer = setTimeout(() => {
      const expiryDate = this.cliente
        ? this.readString(this.cliente, 'fechaVencimiento')
        : '';
      this.daysRemaining = this.getDaysRemaining(expiryDate);
      this.scheduleExpiryCheck();
    }, Math.max(1, nextLocalMidnight.getTime() - now.getTime()));
  }

  private getDaysRemaining(expiryDate: string): number {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(expiryDate);
    if (!match) {
      return 0;
    }

    const [, year, month, day] = match;
    const expiry = Date.UTC(Number(year), Number(month) - 1, Number(day));
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.floor((expiry - today) / MS_PER_DAY);
  }

  private isMembershipExpired(expiryDate: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(expiryDate);
    if (!match) {
      return true;
    }

    const [, year, month, day] = match;
    const expiryDay = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    ).getTime();
    return expiryDay <= Date.now();
  }

  private asRecords(value: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter(
      (row): row is Record<string, unknown> =>
        typeof row === 'object' && row !== null && !Array.isArray(row),
    );
  }

  private readString(record: Record<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  private readBoolean(
    record: Record<string, unknown>,
    ...keys: string[]
  ): boolean | undefined {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'boolean') {
        return value;
      }
      if (value === 1 || value === 'true' || value === '1') {
        return true;
      }
      if (value === 0 || value === 'false' || value === '0') {
        return false;
      }
    }
    return undefined;
  }
}
