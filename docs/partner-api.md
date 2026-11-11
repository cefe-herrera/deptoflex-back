# Partner API (API de disponibilidad para terceros) — DeptoFlex

## Resumen

Organizaciones externas (agencias, OTAs, etc.) consultan la disponibilidad de las **propiedades temporales** (`Property` con Cloudbeds) y **solicitan reservas y cancelaciones** usando una API key. Las propiedades flex no entran.

Como la integración con Cloudbeds es de solo lectura, las reservas **no se crean automáticamente**: el partner manda una solicitud, se notifica a los admins, un admin la carga a mano en Cloudbeds y registra el resultado en el panel.

No hay facturación por uso ni límites de consumo en esta etapa. Sí se registran métricas de cada request.

- Código: `src/modules/partner-api/`
- Documentación para el partner: pestaña **Documentación** del panel (`deptFlex-front/src/components/api/ApiDocs.tsx`). Si cambia el contrato, actualizar ambos.

---

## Actores y accesos

| Actor | Dónde | Qué puede hacer |
|---|---|---|
| Admin de Weflex (rol `ADMIN`) | `/admin/api-clients`, `/admin/api-reservas` | Invitar organizaciones, suspenderlas, eliminarlas, ver su consumo, revocar keys, gestionar solicitudes de reserva |
| Cuenta principal de la organización (`OWNER`) | `/dashboard/api` | Generar/revocar keys, invitar usuarios, ver consumo y reservas |
| Administrador de la organización (`ADMIN`) | `/dashboard/api` | Igual que OWNER, salvo que no puede quitar al OWNER |
| Solo métricas (`VIEWER`) | `/dashboard/api` | Ver consumo, reservas y documentación |
| Integración del partner | `/api/v1/partner/*` con header `X-Api-Key` | Consultar propiedades y disponibilidad, solicitar y cancelar reservas |

Los usuarios de una organización reciben el rol de plataforma `API_CLIENT`. Si **solo** tienen ese rol, el dashboard les muestra únicamente la sección API (`isApiOnly` en `AuthContext`). Una cuenta pertenece como máximo a una organización.

---

## Flujo de alta

1. El admin invita una organización (`POST /admin/api-clients`) con nombre y **email principal**.
2. Se crea `ApiClient` y una `ApiClientInvitation` con rol `OWNER`; se envía el email (Resend) con el link `FRONTEND_URL/api-invitacion?token=…` (vence en 7 días).
3. El invitado acepta (`POST /api-invitations/:token/accept`):
   - sin cuenta activa: crea la cuenta (nombre, apellido, contraseña) con email verificado;
   - con cuenta: tiene que estar logueado con ese email.
4. Desde `/dashboard/api` genera sus API keys e invita a su equipo (`ADMIN` o `VIEWER`), también por email.

Quitar a un miembro borra su membresía y el rol `API_CLIENT`, y cierra sus sesiones. Si la cuenta no tenía otros roles, queda desactivada (se reactiva si la vuelven a invitar).

---

## API keys

- Formato `dfx_` + 40 caracteres aleatorios. En DB solo se guardan el **sha256** (`ApiKey.keyHash`) y un prefijo visible.
- La key en claro se devuelve una sola vez, al crearla.
- Validación en `ApiKeyGuard` con caché en memoria de 30 s: una revocación o suspensión tarda hasta 30 s en propagarse a otras instancias.
- 30 intentos por minuto con keys inválidas desde la misma IP → 429 hasta que termina el minuto.
- `ApiClient.rpmLimit` es opcional (NULL = sin límite, que es el valor actual). Si se setea, aplica por organización y devuelve headers `X-RateLimit-*`.
- Rate limit y caché viven en memoria: con varias instancias del backend cuentan por separado (mover a Redis si se escala).

---

## Endpoints

### Partner (`X-Api-Key`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/partner/properties` | Propiedades `ACTIVE` con Cloudbeds configurado |
| GET | `/partner/availability` | Disponibilidad y tarifas (usa `CloudbedsService.searchAvailability`, con caché 5–15 min) |
| POST | `/partner/bookings` | Solicitar reserva |
| GET | `/partner/bookings` | Listar solicitudes (`status`, `externalReference`, `limit`) |
| GET | `/partner/bookings/:id` | Estado de una solicitud |
| POST | `/partner/bookings/:id/cancel` | Solicitar cancelación (`{ reason }`) |

### Portal de la organización (JWT + membresía)

`/api-portal/me`, `usage`, `usage/events`, `bookings`, `keys` (CRUD), `members`, `invitations` (crear, reenviar, cancelar). Keys y usuarios requieren rol `OWNER` o `ADMIN`.

### Invitaciones (públicos)

`GET /api-invitations/:token` (datos para la pantalla) y `POST /api-invitations/:token/accept`.

### Admin (rol `ADMIN`)

| Método | Ruta | Descripción |
|---|---|---|
| GET/POST | `/admin/api-clients` | Listar / invitar organización |
| GET/PATCH/DELETE | `/admin/api-clients/:id` | Detalle (con keys, miembros e invitaciones) / suspender-reactivar / eliminar |
| POST | `/admin/api-clients/:id/owner-invitation` | Reenviar invitación a la cuenta principal |
| DELETE | `/admin/api-clients/:id/keys/:keyId` | Revocar key |
| GET | `/admin/api-clients/:id/usage`, `/usage/events` | Consumo de una organización |
| GET | `/admin/api-usage` | Consumo global |
| GET | `/admin/api-bookings` | Solicitudes de reserva (con conteo por estado) |
| GET | `/admin/api-bookings/:id` | Detalle |
| POST | `/admin/api-bookings/:id/confirm` | `{ cloudbedsReservationId, adminNotes? }` |
| POST | `/admin/api-bookings/:id/reject` | `{ reason }` |
| POST | `/admin/api-bookings/:id/confirm-cancellation` | `{ adminNotes? }` |

---

## Reservas

### Modelo de precio

El partner le cobra al huésped **su comisión como seña** y se la queda. Weflex crea la reserva y le cobra al huésped **el resto**.

| Campo | Significado |
|---|---|
| `finalPrice` | Total de la reserva. Debe ser nuestra cotización (`totalAmount` de `/partner/availability`), que es el precio final con impuestos y tasas cuando `priceStatus = FINAL`. |
| `partnerCommission` | Lo que cobró el partner. |
| `netPrice` (DB) / `amountToCollect` (API) | `finalPrice − partnerCommission`: lo que cobra Weflex. |
| `quotedPrice` | Nuestra cotización al momento de la solicitud. |
| `priceMismatch` | `true` si `finalPrice` difiere de `quotedPrice` en más de 1. La solicitud entra igual, marcada para revisión. |

Ejemplo: reserva de 100 con 15% → el partner cobra 15, Weflex cobra 85.

### Creación (`PartnerBookingsService.create`)

1. Rechaza si la comisión supera el total (400).
2. Si viene `externalReference` y ya existe para la organización, devuelve la existente (idempotencia; también cubre la carrera por el índice único).
3. Vuelve a consultar disponibilidad. Si la moneda no coincide → 400. Si la habitación (`roomTypeId` y, si viene, `rateId`) no está o `remaining < 1` → 409.
4. Guarda la solicitud en `PENDING` con la cotización y notifica a todos los admins (`NotificationsService.sendToRole('ADMIN')`: in-app, push y email según preferencias) con link a `/admin/api-reservas?id=…`.

### Estados

```
PENDING ──confirm (admin)──▶ CONFIRMED ──cancel (partner)──▶ CANCELLATION_REQUESTED ──confirm-cancellation (admin)──▶ CANCELLED
   │                                                                                        
   ├──reject (admin)──▶ REJECTED
   └──cancel (partner)──▶ CANCELLED   (todavía no se había creado en Cloudbeds; se avisa al admin igual)
```

- Las transiciones son atómicas (`updateMany` con el estado esperado): si dos admins actúan a la vez, el segundo recibe 409.
- Cancelar dos veces no tiene efecto. No se puede cancelar una `REJECTED`.
- Cada acción del admin queda en auditoría (`ActivityLog`) y se avisa por email al `contactEmail` de la organización (con el código de Cloudbeds y el monto a cobrar si se confirma, o el motivo si se rechaza).
- No hay webhooks hacia el partner: consulta el estado por polling.

### Operación del admin

1. Llega la notificación "Nueva reserva de {organización} para crear en Cloudbeds".
2. En `/admin/api-reservas` abre la solicitud. Si dice **Revisar precio**, compara el total con la cotización antes de seguir.
3. **Copiar datos para Cloudbeds** y crear la reserva en Cloudbeds, cobrando al huésped el "A cobrar al huésped".
4. **Confirmar reserva** con el número de Cloudbeds (o **Rechazar** con motivo).
5. Para cancelaciones: cancelar en Cloudbeds y **Confirmar cancelación**.

---

## Métricas de uso

Cada request autenticada (incluidas las rechazadas por rate limit) se guarda en `ApiUsageEvent` desde `ApiUsageInterceptor`, sin bloquear la respuesta. `ApiUsageService.summary` calcula, por organización o global:

- requests, errores 4xx/5xx, rate limited, latencia promedio y p95;
- tasa de caché y consultas reales a Cloudbeds;
- búsquedas sin disponibilidad, anticipación promedio al checkin y noches promedio;
- desglose por día (zona America/Argentina/Buenos_Aires), endpoint, key, propiedad y organización.

No hay retención automática todavía: conviene agregar un cron que borre eventos viejos (p. ej. > 90 días).

---

## Modelo de datos

| Tabla | Contenido |
|---|---|
| `api_clients` | Organización: nombre, email principal, estado (`ACTIVE`/`SUSPENDED`), `rpm_limit` opcional, soft delete |
| `api_keys` | Hash, prefijo, último uso/IP, vencimiento, revocación |
| `api_client_members` | Usuario ↔ organización con rol `OWNER`/`ADMIN`/`VIEWER` (un usuario, una organización) |
| `api_client_invitations` | Invitaciones por email (hash del token, rol, vencimiento, aceptación/revocación) |
| `api_usage_events` | Log crudo de requests para métricas (sin FKs) |
| `partner_booking_requests` | Solicitudes de reserva/cancelación con huésped, precios y estado |

Migraciones: `20261109120000_partner_api`, `20261109140000_partner_api_optional_rpm_limit`, `20261110120000_partner_api_members` (crea también el rol `API_CLIENT`), `20261110180000_partner_booking_requests`.

## Configuración

| Variable | Uso |
|---|---|
| `FRONTEND_URL` | Base de los links de invitación (en producción, el dominio real) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Envío de invitaciones y avisos |
| `NEXT_PUBLIC_PARTNER_API_URL` (front) | URL que muestra la documentación al partner (default `https://deptoflex-back.vercel.app/api/v1`) |
