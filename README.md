# Clima 3 Tec — Sistema de servicios técnicos Carrier (DEMO)

Aplicación web responsiva (PWA) de **Clima 3 del Pacífico, Centro de Servicio Autorizado Carrier**, para administrar, asignar, ejecutar y documentar tickets de servicio. El flujo principal es el **sistema de tickets Carrier**; la "bolsa de trabajos" anterior sigue disponible en `/bolsa.html` (técnico) y `/admin-bolsa.html` (admin).

## Arranque
```bash
npm install
node server.js        # http://localhost:3000
npm test              # prueba de punta a punta (python3 + playwright + poppler), levanta su propio servidor en :3200
```
- Login: `/` · Coordinación/admin: `/admin.html` · Técnico: `/tecnico.html`
- BD SQLite `clima3tec.db` (o `DB_FILE`). Fotos y firmas en `uploads/tickets/` (protegidas por sesión), PDFs por versión en `uploads/pdf/`.

## Usuarios DEMO (sin contraseña o `demo123`)
`admin` (coordinación) · `tec1` Juan Pérez · `tec2` Luis Ramírez · (`tec3` solo en la bolsa anterior)

## Sistema de tickets Carrier
- **Roles:** administrador/coordinador, técnico (solo ve sus tickets y los que apoya), cliente (firma en el dispositivo del técnico, sin cuenta).
- **Tickets** con folio único `C3-AAAA-NNNNN`, todos los campos del cliente/equipo, 11 estatus con historial fechado (y GPS en llegada).
- **3 tipos de proyecto** (instalación básica, validación de garantía, mantenimiento preventivo) que cargan su checklist automáticamente. Checklists y parámetros de operación **configurables por el admin** (BD).
- **Asistente paso a paso** del técnico: llegada → fotos antes → checklist → fotos durante → parámetros → reporte → fotos después → terminado/suspendido → firma del cliente (con resumen/hoja de conformidad) → enviar a revisión. Guardado automático.
- **Sin conexión:** service worker + cola IndexedDB (`public/offline.js`) que sincroniza al reconectar.
- **Firma protegida:** al firmar se guarda la huella SHA-256 del reporte; cualquier cambio posterior crea una nueva versión y queda en la auditoría; los tickets cerrados no admiten cambios.
- **PDF** (pdfkit, `lib/pdf.js`): reporte Clima 3 (logos Clima 3 y Carrier, checklist, parámetros, galería por etapa, firmas, versión) + **Formato Reporte Electrónico 1.1** para clientes Carrier (`cliente_carrier`), + reporte fotográfico (`?formato=fotos`).
- **Técnico Carrier autorizado** (bloque TÉCNICO CARRIER del formato 1.1): nombre + imagen del nombre manuscrito + firma, configurables en *Configuración*. Las imágenes **no se guardan en el repositorio (es público)**: se leen de la BD (subidas por el admin), de las variables `CARRIER_TEC_NOMBRE_B64` / `CARRIER_TEC_FIRMA_B64` (PNG en base64) o de la carpeta `privado/` (ignorada por git: `carrier_tec_nombre.png`, `carrier_tec_firma.png`). Si falta la firma, el formato sale con la línea en blanco y el admin ve un aviso.
- **Panel** con conteos por estatus, técnico, tipo de servicio, cliente, tiempos promedio y filtros; **expediente** por cliente/equipo con búsqueda por número de serie; auditoría; respaldo de BD; colores configurables.
- Logotipo Carrier: Wikimedia Commons ("Logo of the Carrier Corporation", dominio público) y la versión "turn to the experts" tomada del formato de referencia de Clima 3.

---

## Bolsa de trabajos (versión anterior)
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
