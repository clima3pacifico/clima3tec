# Clima 3 Tec — Prototipo (DEMO)

App tipo Uber de **red cerrada** para Clima 3 del Pacífico (Hermosillo): Clima 3 publica trabajos y **solo los técnicos que Clima 3 dio de alta** pueden verlos y tomarlos.

## Arranque
```bash
npm install
node server.js        # http://localhost:3000
```
- Inicio / login: `/` · Panel admin: `/admin.html` · App técnico (PWA): `/tecnico.html`
- Base de datos SQLite: `clima3tec.db` (bórrala para reiniciar con los datos DEMO). Fotos y firmas: `uploads/`.

## Credenciales DEMO (ficticias)
| Rol | Usuario | Contraseña | Especialidades / zona |
|---|---|---|---|
| Admin | admin | demo123 | — |
| Técnico | tec1 (Juan Pérez DEMO) | demo123 | minisplit, central · Norte |
| Técnico | tec2 (Luis Ramírez DEMO) | demo123 | chiller, refrigeración · Centro |
| Técnico | tec3 (Ana Torres DEMO) | demo123 | minisplit, refrigeración · Sur |

## Qué hace
**Admin:** alta, suspensión y activación de técnicos (si lo suspendes, pierde la sesión al momento) · publicar trabajos para todos, por especialidad, por zona o con asignación directa · tablero con 6 estados · ver checklist, lecturas, materiales, fotos de antes y después, firma y bitácora GPS · aprobar · reporte de pagos.
**Técnico:** bolsa en vivo (SSE más polling de respaldo) · aceptar con transacción SQLite (el primero gana y los demás reciben 409) · estados aceptado → en camino → en sitio → terminado, cada uno con GPS · checklist, lecturas (presión, amperaje, temperatura), materiales, fotos desde la cámara, firma en canvas · no se puede terminar sin firma y foto de después · ganancias.

## Prueba de punta a punta
`python3 prueba_e2e.py` (con el servidor corriendo) prueba la carrera entre 3 técnicos, el filtro, el flujo completo, la evidencia, la aprobación y la suspensión, y genera las capturas en `capturas/`.

## Falta para producción
- **Hosting:** VPS o Render/Railway con HTTPS (obligatorio para GPS, cámara y PWA), dominio (p. ej. tec.clima3.mx), respaldos; migrar a Postgres y guardar fotos en S3/R2.
- **Seguridad:** sesiones con expiración, cambio de contraseña, límite de intentos, auditoría.
- **Tiendas:** empaquetar con Capacitor (o TWA en Android). Google Play cuesta USD 25 una vez y Apple Developer USD 99 al año; hay que pasar revisión, poner política de privacidad y justificar el uso de ubicación.
- **Notificaciones push:** Web Push (VAPID) o Firebase Cloud Messaging; hoy solo avisa con la app abierta.
- **Mapas:** Google Maps o Mapbox para ver a los técnicos en vivo, rutas y ETA (hoy solo guarda coordenadas y tiene un enlace a Google Maps).
- Otros: facturación y pagos reales a técnicos, calificaciones, historial por cliente, e integración con la app Clima 3 Clientes.

## Subir a Render (plan gratis)
1. Sube esta carpeta a un repo de GitHub.
2. En Render: **New → Blueprint** (usa `render.yaml`), o **New → Web Service** con build `npm install`, start `npm start` y Node 20.
3. Render asigna `PORT` y una URL HTTPS (`https://clima3tec-xxxx.onrender.com`); el servidor lee `process.env.PORT`.

> ⚠️ **Solo para demo:** en el plan gratis el disco es efímero. Cada reinicio, deploy o "sleep" (tras unos 15 minutos sin uso) **borra la base de datos y las fotos** y vuelve a crear los datos DEMO. El primer acceso después de dormir tarda alrededor de un minuto. Para uso real: disco persistente (plan de pago) o Postgres y almacenamiento externo para las fotos.
