# Cloudbeds Integration (read-only)

Integración con el **booking engine público** de Cloudbeds para consultar
disponibilidad, tarifas, fotos y amenities, y redirigir al usuario al motor
oficial de Cloudbeds para concretar la reserva.

> ⚠️ Esta integración es **solo lectura** y consume un endpoint público no
> documentado oficialmente. La reserva final ocurre en Cloudbeds, no en
> nuestro sistema.

---

## Arquitectura

```
src/modules/cloudbeds/
├── providers/
│   ├── booking-provider.interface.ts          # Abstracción
│   ├── cloudbeds-public-booking.provider.ts   # Implementación actual
│   └── cloudbeds-response.schema.ts           # Zod schema (valida payload externo)
├── dto/
│   ├── search-availability.dto.ts
│   └── create-reservation-intent.dto.ts
├── availability-cache.service.ts              # TTL cache en memoria
├── availability-snapshots.service.ts          # Persiste auditoría
├── cloudbeds.service.ts                       # Orquesta búsqueda + enriquece
├── reservation-intents.service.ts             # Crea intents + job de expiración
├── cloudbeds.controller.ts
└── cloudbeds.module.ts
```

El `BOOKING_PROVIDER` token se resuelve hoy a `CloudbedsPublicBookingProvider`.
Para migrar a la API oficial cuando esté disponible:

1. Crear `CloudbedsOfficialApiProvider implements BookingProvider`.
2. Cambiar el `useExisting` en `cloudbeds.module.ts`.
3. Cero cambios en consumers.

---

## Configuración

### Mapeo de propiedades

Cada `Property` local debe tener:

- `cloudbedsWidgetPropertyId` — el ID del widget público (ej `179484`).
- `cloudbedsBookingSlug` — opcional, slug del motor oficial (ej `ZBC4Bn`)
  para construir URLs de redirect prolijas. Si falta, se usa fallback genérico.
- `defaultCurrency` (default `ARS`).
- `defaultLanguage` (default `es`).

Cada `Unit` local debe tener:

- `cloudbedsRoomTypeId` — el `room_type_id` que devuelve el endpoint
  (ej `249030`). Permite enriquecer la respuesta con datos locales (descripción,
  fotos propias, etc.).
- `cloudbedsUnitId` — opcional, id de unidad física Cloudbeds (ej `249030-10`).

### Variables de entorno

Ver `.env.example`. Todas son opcionales con defaults sensatos:

```
CLOUDBEDS_BOOKING_ROOMS_URL=https://hotels.cloudbeds.com/booking/rooms
CLOUDBEDS_RESERVATION_BASE_URL=https://hotels.cloudbeds.com
CLOUDBEDS_HTTP_USER_AGENT=deptoflex-backend/1.0 (+integration)
CLOUDBEDS_HTTP_TIMEOUT_MS=10000
CLOUDBEDS_CACHE_TTL_MS=300000           # 5 min
CLOUDBEDS_INTENT_TTL_MS=1800000         # 30 min
```

---

## Endpoints

### `POST /booking/search`

Public. Rate-limited a 30 req/min.

```bash
curl -X POST http://localhost:3000/booking/search \
  -H 'Content-Type: application/json' \
  -d '{
    "propertyId": "00000000-0000-0000-0000-000000000000",
    "checkin": "2026-05-16",
    "checkout": "2026-05-18",
    "currencyCode": "ARS",
    "lang": "es",
    "adults": 2,
    "children": 0
  }'
```

Response (resumen):

```json
{
  "propertyId": "...",
  "propertyName": "...",
  "propertyExternalId": "179484",
  "checkin": "2026-05-16",
  "checkout": "2026-05-18",
  "currencyCode": "ARS",
  "totalAvailable": 16,
  "fromCache": false,
  "rooms": [
    {
      "roomTypeId": "249030",
      "rateId": "551718",
      "name": "Monoambientes",
      "totalAmount": 95000,
      "minNightlyRate": 45000,
      "maxNightlyRate": 50000,
      "remaining": 15,
      "detailedRates": [
        { "date": "2026-05-16", "rate": 50000, "baseRate": 50000 },
        { "date": "2026-05-17", "rate": 45000, "baseRate": 45000 }
      ],
      "photos": ["https://..."],
      "features": ["Wifi", "AC"],
      "unitIds": ["249030-10", "249030-11"],
      "otaComparison": [
        { "channelName": "Expedia", "channelPrice": 118750, "directPrice": 95000 }
      ],
      "localUnits": [
        { "id": "uuid", "name": "Mono A", "bedrooms": 1, "maxOccupancy": 2 }
      ]
    }
  ]
}
```

### `POST /reservation-intents`

Public. Rate-limited a 10 req/min. Re-consulta disponibilidad y crea una
intent con la `redirectUrl` oficial.

```bash
curl -X POST http://localhost:3000/reservation-intents \
  -H 'Content-Type: application/json' \
  -d '{
    "propertyId": "00000000-0000-0000-0000-000000000000",
    "roomTypeId": "249030",
    "rateId": "551718",
    "checkin": "2026-05-16",
    "checkout": "2026-05-18",
    "currencyCode": "ARS",
    "lang": "es",
    "adults": 2,
    "totalAmount": 95000
  }'
```

Response:

```json
{
  "reservationIntentId": "uuid",
  "redirectUrl": "https://hotels.cloudbeds.com/es/reservation/ZBC4Bn/?currency=ars&checkin=2026-05-16&checkout=2026-05-18&room_type_id=249030&rate_id=551718&adults=2",
  "expiresAt": "2026-05-14T13:00:00.000Z",
  "validatedTotalAmount": 95000,
  "remaining": 15
}
```

### `POST /reservation-intents/:id/redirected`

El frontend lo llama cuando efectivamente abre la `redirectUrl`. Cambia
status `PENDING → REDIRECTED` para tracking del funnel.

### `GET /reservation-intents/:id`

Devuelve el detalle de la intent.

---

## Reglas de negocio implementadas

- ✅ `checkout > checkin`.
- ✅ `checkin >= hoy`.
- ✅ Property debe tener `cloudbedsWidgetPropertyId`.
- ✅ Habitaciones con `remaining <= 0` se ocultan en `/booking/search`.
- ✅ `totalAmount` cae a `null` si `rate_basic` es 0/null y no hay `detailed_rates`.
- ✅ Cache TTL configurable (5 min default) por `propertyId+checkin+checkout+currency+lang`.
- ✅ Cada búsqueda no-cacheada se persiste como `AvailabilitySnapshot`.
- ✅ Re-consulta de disponibilidad antes de crear `ReservationIntent`.
- ✅ Job cron cada 10 min marca como `EXPIRED` las intents PENDING vencidas.
- ✅ Rate limit por endpoint (`booking` throttler).

---

## Seguridad

- ❌ Nunca se envían cookies, Authorization, ni tokens privados.
- ❌ Nunca se almacena nada capturado del navegador.
- ✅ User-Agent genérico de backend, no se hace browser spoofing.
- ✅ Validación Zod estricta sobre la respuesta upstream.
- ✅ Logs sin datos sensibles (solo IDs, status, duración).
- ⚠️ El frontend debe **sanitizar** `room_type_desc` antes de renderizarlo
  (viene HTML del operador del hotel — usar DOMPurify o equivalente).

---

## Limitaciones (importante)

- **No es un contrato oficial.** El endpoint `/booking/rooms` puede cambiar
  shape o desaparecer sin aviso. Los snapshots + Zod mitigan, pero no
  evitan, el riesgo.
- **Solo lectura.** No se deben crear reservas mediante endpoints privados de
  Cloudbeds. La reserva final ocurre en el motor oficial vía `redirectUrl`.
- **Precios pueden estar desactualizados** entre la búsqueda y el redirect
  (mitigamos con re-fetch en `/reservation-intents`, pero no es 100%).
- **Para operación robusta multi-propiedad y creación real de reservas**, hay
  que migrar a la API oficial de Cloudbeds. La interface `BookingProvider`
  está diseñada para hacer ese swap sin tocar consumers.

---

## Tests

```bash
npx jest src/modules/cloudbeds
```

Cubre: normalización del payload, validación de fechas, construcción de
form-urlencoded, redirectUrl con/sin slug, manejo de errores HTTP/timeout,
cache hit/miss, ocultar rooms sin disponibilidad, lookup de property y
ausencia de mapping Cloudbeds.

---

## Migración

```bash
npx prisma migrate dev --name cloudbeds_integration
```

(La migration ya está creada en `prisma/migrations/20260514120000_cloudbeds_integration`.)
