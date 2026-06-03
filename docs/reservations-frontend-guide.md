# Guía de integración de Reservas (Frontend)

Documento para el equipo de frontend. Describe **todos los flujos de reserva** (Temporal/Cloudbeds y Flex/mensualizado), los endpoints, sus payloads y los **cambios recientes** del backend.

> **Base URL**: todos los endpoints cuelgan del prefijo global `/api/v1`.
> Ej.: `POST /api/v1/booking/search`.
>
> **Auth**: los endpoints de Cloudbeds (`booking/*`, `reservation-intents/*`) son **públicos** (sin token), pero rate-limited. Los de `flex-bookings` y `bookings` requieren **Bearer token** y rol según el caso.

---

## 1. Conceptos

DeptoFlex maneja **dos modalidades** de reserva, y ambas quedan registradas en un **registro único** (`Booking`):

| Modalidad | Qué es | Dónde se concreta el pago/reserva | `source` |
|-----------|--------|-----------------------------------|----------|
| **Temporal** | Estadía corta (por noche), inventario de Cloudbeds | En el **motor oficial de Cloudbeds** | `CLOUDBEDS` |
| **Flex** | Alquiler mensualizado, inventario propio | En **nuestro backend** | `FLEX` |
| Directa | Carga manual interna | Backend | `DIRECT` |

Cada reserva puede asociarse a un **embajador** (`professionalProfileId`) y genera automáticamente una **comisión**.

---

## 2. Flujo TEMPORAL (Cloudbeds)

El usuario completa el pago en el motor oficial de Cloudbeds. Nosotros buscamos disponibilidad, registramos la "intención" y, al volver de Cloudbeds, **registramos la reserva en nuestro sistema**.

```
[1] POST /booking/search           → muestra habitaciones + tarifas
[2] POST /booking/calculate-totals → desglose de impuestos/fees + cartToken   (opcional, recomendado)
[3] POST /reservation-intents      → guarda intención + devuelve redirectUrl (con embajador)
[4] POST /reservation-intents/:id/redirected → tracking al abrir Cloudbeds
[5] (usuario paga en Cloudbeds y es redirigido a .../booking/confirmation?data_res=XXX)
[6] POST /booking/confirm          → registra Booking + Commission en nuestro sistema
```

### [1] Buscar disponibilidad — `POST /api/v1/booking/search`

```json
{
  "propertyId": "179484",
  "checkin": "2026-05-16",
  "checkout": "2026-05-18",
  "currencyCode": "ARS",
  "lang": "es",
  "adults": 2,
  "children": 0
}
```

Respuesta (resumen): `{ propertyId, propertyName, totalAvailable, rooms: [{ roomTypeId, rateId, name, totalAmount, minNightlyRate, photos, localUnits[...] }] }`.

### [2] Calcular totales — `POST /api/v1/booking/calculate-totals`

```json
{
  "propertyId": "179484",
  "checkin": "2026-05-16",
  "checkout": "2026-05-18",
  "currencyCode": "ARS",
  "lang": "es",
  "rates": [{ "rateId": "551718", "adults": 2, "kids": 0 }]
}
```

Respuesta clave: `{ subtotal, taxesTotal, feesTotal, grandTotal, cartToken, taxes[], fees[] }`. **Guardá el `cartToken`** si vas a usar `booking/prepare`.

### [3] Crear intención de reserva — `POST /api/v1/reservation-intents`

> **CAMBIO**: ahora acepta `professionalProfileId` (el embajador que origina la reserva). Es **opcional** pero recomendado: se usa para atribuir la comisión al confirmar.

```json
{
  "propertyId": "uuid-de-la-propiedad-local",
  "professionalProfileId": "uuid-del-embajador",
  "roomTypeId": "987654",
  "rateId": "551718",
  "checkin": "2026-05-16",
  "checkout": "2026-05-18",
  "currencyCode": "ARS",
  "lang": "es",
  "adults": 2,
  "children": 0,
  "totalAmount": 95000
}
```

> Nota: acá `propertyId` es el **UUID de la propiedad local** (no el widget id de Cloudbeds).

Respuesta:
```json
{
  "reservationIntentId": "uuid",
  "redirectUrl": "https://hotels.cloudbeds.com/es/reservation/...",
  "expiresAt": "2026-05-16T12:30:00.000Z",
  "validatedTotalAmount": 95000,
  "remaining": 3
}
```

El front debe **redirigir** al usuario a `redirectUrl`. **Guardá el `reservationIntentId`** (necesario en el paso 6).

### [4] Tracking de redirección — `POST /api/v1/reservation-intents/:id/redirected`

Sin body. Llamar al abrir la `redirectUrl`. Responde `204 No Content`.

### [6] Confirmar y registrar — `POST /api/v1/booking/confirm`  ⭐ NUEVO

Cuando Cloudbeds redirige a la página de confirmación, la URL contiene `?data_res=<token>`. El front extrae ese token y lo manda acá:

```json
{
  "dataRes": "<token data_res de la URL de confirmación>",
  "reservationIntentId": "uuid-del-paso-3",
  "professionalProfileId": "uuid-del-embajador"
}
```

- `dataRes`: **obligatorio**.
- `reservationIntentId`: **muy recomendado** — con él, propiedad, embajador, fechas y monto salen de datos validados por nosotros (no del scraping de la página).
- `professionalProfileId`: opcional, tiene prioridad sobre el de la intent.

Respuesta `201 Created`: el `Booking` registrado.
```json
{
  "id": "uuid",
  "source": "CLOUDBEDS",
  "status": "CONFIRMED",
  "cloudbedsReservationId": "2448738948993",
  "propertyId": "uuid",
  "professionalProfileId": "uuid-embajador",
  "clientName": "Ceferino Herrera",
  "checkInDate": "2026-05-16",
  "checkOutDate": "2026-05-18",
  "totalNights": 2,
  "totalAmount": "95000.00",
  "currency": "ARS"
}
```

**Idempotente**: si reenviás el mismo `data_res` (misma reserva de Cloudbeds), devuelve el `Booking` ya existente sin duplicar.

#### (Opcional) `POST /api/v1/booking/prepare`
Existe para flujos avanzados que crean la reserva server-side vía el endpoint `prepare` de Cloudbeds (requiere `cartToken` + datos del huésped). En el flujo estándar de redirección **no es necesario**.

---

## 3. Flujo FLEX (mensualizado)

Las reservas flex se gestionan **enteramente en nuestro backend**. Requieren **token + rol ADMIN/OPERATOR**.

### Crear — `POST /api/v1/flex-bookings`

```json
{
  "propertyFlexId": "uuid-property-flex",
  "professionalProfileId": "uuid-embajador",
  "clientName": "Juan Pérez",
  "clientEmail": "juan@mail.com",
  "clientPhone": "+54387...",
  "startDate": "2026-06-01",
  "endDate": "2026-12-01",
  "totalMonths": 6,
  "monthlyAmount": 250000,
  "totalAmount": 1500000,
  "depositAmount": 250000,
  "currency": "ARS",
  "notes": "..."
}
```

> **CAMBIO**: además de crear la `FlexBooking`, el backend ahora crea automáticamente el **registro unificado `Booking`** (`source=FLEX`) y su **`Commission`** en la misma transacción. El front no hace nada extra; solo recibe la `FlexBooking`.

Valida solapamiento de fechas para la misma propiedad (responde `400` si no está disponible).

### Otros endpoints flex
| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `GET` | `/api/v1/flex-bookings` | auth | Listado paginado con filtros (`propertyFlexId`, `professionalProfileId`, `status`, `startDateFrom`, `startDateTo`, `page`, `limit`) |
| `GET` | `/api/v1/flex-bookings/:id` | auth | Detalle |
| `PATCH` | `/api/v1/flex-bookings/:id` | ADMIN/OPERATOR | Cambiar `status`/`notes` |
| `DELETE` | `/api/v1/flex-bookings/:id` | ADMIN | Cancelar (soft delete) |

> **CAMBIO**: `PATCH` (cambio de estado) y `DELETE` ahora **sincronizan** el `Booking` espejo y su comisión (al cancelar, la comisión pasa a `CANCELLED`).

---

## 4. Embajador y comisión (ambos flujos)

- Si la reserva tiene `professionalProfileId`, se crea una `Commission`:
  - `commissionAmount = totalAmount * (defaultCommissionRate_del_embajador / 100)`
  - estado inicial `PENDING`.
- Si no hay embajador, la reserva igual se registra (comisión con rate 0).

---

## 5. Estados

**Booking / FlexBooking**: `PENDING` · `CONFIRMED` · `CANCELLED` · `COMPLETED` · (`NO_SHOW` solo Booking).
- Cloudbeds confirmado → `Booking.status = CONFIRMED` directo.
- Flex creado → `PENDING` (luego se confirma vía `PATCH`).

**ReservationIntent**: `PENDING` → `REDIRECTED` → `CONFIRMED` (nuevo) | `EXPIRED`.

---

## 6. Changelog para el Front

| Cambio | Impacto en el front |
|--------|---------------------|
| ⭐ Nuevo `POST /booking/confirm` | Llamarlo al volver de Cloudbeds con `data_res` (+ `reservationIntentId`) para registrar la reserva. |
| `reservation-intents` acepta `professionalProfileId` | Mandar el embajador al crear la intención para que herede la comisión. |
| `flex-bookings` crea Booking+Commission solo | Sin cambios de payload; el registro/comisión es automático. |
| `Booking` ahora tiene `source`, `propertyFlexId`, `cloudbedsReservationId`, etc. | Si listás `bookings`, contemplá `source` y que `unitId` puede venir `null`. |

---

## 7. Notas y errores comunes

- **Fechas**: formato `YYYY-MM-DD`. `checkout > checkin`; `checkin` no puede ser pasado.
- **`propertyId` ambiguo**: en `booking/search`, `calculate-totals` y `prepare` es el **widget id de Cloudbeds** (string, ej. `"179484"`). En `reservation-intents` es el **UUID de la propiedad local**.
- **Rate limits**: `search`/`calculate-totals`/`prepare` 30/min, `confirm` 20/min, `reservation-intents` 10/min. Manejar `429`.
- **`booking/confirm` sin `reservationIntentId`**: funciona, pero depende del parseo de la página de Cloudbeds (best-effort). Si no se puede resolver la propiedad, responde `400`. **Siempre mandar `reservationIntentId` cuando exista.**
- **502/503 de Cloudbeds**: el motor público puede fallar; reintentar con backoff y mostrar mensaje amable.

---

## 8. Referencia rápida de endpoints

| # | Método | Ruta | Auth | Uso |
|---|--------|------|------|-----|
| 1 | POST | `/api/v1/booking/search` | público | Disponibilidad temporal |
| 2 | POST | `/api/v1/booking/calculate-totals` | público | Totales + cartToken |
| - | POST | `/api/v1/booking/prepare` | público | (avanzado) crear reserva server-side |
| 3 | POST | `/api/v1/reservation-intents` | público | Intención + redirectUrl |
| - | GET | `/api/v1/reservation-intents/:id` | público | Estado de la intent |
| 4 | POST | `/api/v1/reservation-intents/:id/redirected` | público | Tracking |
| 6 | POST | `/api/v1/booking/confirm` | público | **Registrar reserva temporal** |
| - | POST | `/api/v1/flex-bookings` | ADMIN/OPERATOR | Crear reserva flex |
| - | GET/PATCH/DELETE | `/api/v1/flex-bookings/:id` | auth/roles | Gestión flex |
| - | GET | `/api/v1/bookings/:id` | auth | Detalle del registro unificado |

> Swagger interactivo: `http://localhost:3000/api/docs`.
