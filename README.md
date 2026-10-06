# Xtreme Gym Mobile

Aplicación Angular 17 con Ionic para el flujo de acceso de Xtreme Group Gym.

## Ejecutar

```bash
npm install
npm start
```

La aplicación se inicia en `/splash`, pasa al login después de 2,5 segundos y
continúa por `/enter-code`, `/splash2` y `/home`.

El enlace directo `/apiukabrir` valida el código guardado en este dispositivo,
muestra el resultado durante 2,5 segundos y redirige a `/home` si es válido o a
`/login` si no existe una sesión activa.

Para preparar Android por primera vez, instala Android Studio/SDK y ejecuta:

```bash
npx cap add android
npm run cap:sync
npx cap open android
```

Después de cambios web, ejecuta `npm run cap:sync` para recompilar y sincronizar
el proyecto nativo.

Coloca el logo del gimnasio en `src/assets/logo.png`; esa imagen se sirve como
`assets/logo.png` en todas las pantallas que muestran el logo.

## API y sesión

La URL de desarrollo se configura en `src/environments/environment.ts`; para
producción reemplaza `backendUrl` en `environment.prod.ts`. La app guarda el
código como `accessCode` mediante Capacitor Preferences, consulta su estado al
arrancar y al volver a primer plano, y calcula los días restantes con
`fecha_vencimiento` o `fecha_fin`. Al validar un código nuevo, la app lo marca
como usado con `PATCH /rest/v1/codigo/:cedula`. Las revalidaciones aceptan el
código ya usado mientras siga coincidiendo con el registro de la base de datos.
La sesión y el código guardado se eliminan cuando el código ya no coincide o
cuando el contador de vencimiento llega a cero. Home no tiene botón de cierre de
sesión.

La comprobación de un código no usado y el posterior PATCH son peticiones
separadas. Para garantizar el uso único ante ingresos simultáneos desde varios
dispositivos, el backend debería validar y marcar como usado de forma atómica,
idealmente devolviendo una sesión/token del dispositivo para poder revalidarla
después sin reutilizar el código. La app no usa un flag local como sustituto de
esa garantía.

En un dispositivo físico, `localhost` apunta al propio dispositivo, no al PC
que ejecuta el backend. Usa una URL accesible por la red local para desarrollo
y HTTPS en producción.
