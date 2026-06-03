# Flujo de reservas (Temporal + Flex) — Implementación

## Concepto

`Booking` es el **registro único** de reservas. Toda reserva —temporal (Cloudbeds) o flex (in-app)— queda registrada en `bookings` con un embajador opcional y su `Commission`.

| Modalidad | Dónde se concreta | Registro en `Booking` | `source` |
|-----------|-------------------|------------------------|----------|
| **Temporal** | Motor oficial de Cloudbeds | Al confirmar (`POST /booking/confirm`) | `CLOUDBEDS` |
| **Flex** | Nuestro backend | Al crear la `FlexBooking` | `FLEX` |
| Directa/manual | Nuestro backend | Manual | `DIRECT` |

---

## Cambios en el modelo `Booking`

Nuevos campos (todos compatibles con las reservas temporales existentes):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `source` | `BookingSource` | `CLOUDBEDS` / `FLEX` / `DIRECT` (default) |
| `unitId` | UUID? | **Ahora opcional** (las flex/cloudbeds pueden no mapear unidad) |
| `propertyId` | UUID? | Propiedad (temporal Cloudbeds) |
| `propertyFlexId` | UUID? | Propiedad flex |
| `flexBookingId` | UUID? unique | Link 1:1 al detalle `FlexBooking` |
| `reservationIntentId` | UUID? unique | Intent Cloudbeds que originó la reserva |
| `cloudbedsReservationId` | varchar? unique | Id de reserva en Cloudbeds (idempotencia) |

`ReservationIntent` ahora captura `professionalProfileId` (embajador) y soporta el estado `CONFIRMED`.

---

## Flujo TEMPORAL (Cloudbeds)

```
1. POST /booking/search            → disponibilidad (read-only)
2. POST /reservation-intents       → crea ReservationIntent (con professionalProfileId del embajador)
                                      devuelve redirectUrl al motor oficial
3. (usuario completa la reserva en Cloudbeds)
4. Cloudbeds redirige a:
   GET https://hotels.cloudbeds.com/booking/confirmation?data_res=<token>
5. POST /booking/confirm           → registra la reserva en nuestro sistema
```

### `POST /booking/confirm`

Público, rate-limited (20/min).

```bash
curl -X POST http://localhost:3000/booking/confirm \
  -H 'Content-Type: application/json' \
  -d '{
    "dataRes": "m407x7FBF6DTw5CnBcKOIZyE4I4w9qrY327s7h4MzOMlvehRcBE00hsUgQfbJYxU4TRyW1jXc6yxfFHydsyryBpWF44umaT4xI/X81 QjUNU6I65/Jl xu2YuQB/sWp4",
    "reservationIntentId": "uuid-de-la-intent",
    "professionalProfileId": "uuid-del-embajador"
  }'
```

**Qué hace:**
1. Descarga y parsea la página de confirmación (`getConfirmation` en el provider) — extrae id de reserva, huésped, fechas, total, moneda (best-effort: JSON embebido + regex de fallback; siempre guarda el `raw`).
2. Resuelve la **propiedad** (vía `reservationIntentId` o `widget_property` parseado).
3. Resuelve el **embajador** (`professionalProfileId` del body > el de la intent).
4. **Idempotencia**: si ya existe un `Booking` con ese `cloudbedsReservationId`, lo devuelve sin duplicar.
5. Crea `Booking` (`source=CLOUDBEDS`, `status=CONFIRMED`) + `BookingStatusHistory` + `Commission` (rate = `defaultCommissionRate` del embajador) en una transacción.
6. Marca la `ReservationIntent` como `CONFIRMED`.

> Las fechas/monto canónicos se toman de la **intent** (validados server-side) cuando está disponible; si no, de lo parseado en la página.

---

## Flujo FLEX (in-app)

```
1. POST /flex-bookings  → crea FlexBooking (detalle) + Booking (registro, source=FLEX) + Commission
```

`POST /flex-bookings` ahora corre todo en una transacción:
- `FlexBooking` (tabla operativa de detalle flex)
- `Booking` (`source=FLEX`, `status=PENDING`, `flexBookingId` + `propertyFlexId`)
- `BookingStatusHistory`
- `Commission` (PENDING, rate = `defaultCommissionRate` del embajador)

**Sincronización de estado:**
- `PATCH /flex-bookings/:id` con `status` → actualiza el `Booking` espejo + historial; si pasa a `CANCELLED`, cancela la comisión.
- `DELETE /flex-bookings/:id` → cancela el `Booking` espejo y su comisión (soft delete).

Mapeo de estados `FlexBookingStatus → BookingStatus`: `PENDING→PENDING`, `CONFIRMED→CONFIRMED`, `CANCELLED→CANCELLED`, `COMPLETED→COMPLETED`.

---

## Comisiones (ambos flujos)

La comisión se calcula con la tasa por defecto del embajador:

```
commissionAmount = baseAmount * (professionalProfile.defaultCommissionRate / 100)
```

- Si no hay embajador, `rate = 0` y `commissionAmount = 0` (la reserva igual se registra).
- `baseAmount = totalAmount` de la reserva.
- Estado inicial `PENDING` (se aprueba/paga después vía el módulo de comisiones).

---

## Variables de entorno nuevas

```
# Endpoint de la página de confirmación de Cloudbeds (override opcional)
CLOUDBEDS_BOOKING_CONFIRMATION_URL=https://hotels.cloudbeds.com/booking/confirmation
```

---

## Migración

```bash
# Detener el dev server primero (libera el DLL del query engine en Windows), luego:
npx prisma migrate dev --name unify_booking_registry_and_confirmation
```

---

## Limitación importante del parseo de confirmación

La página `/booking/confirmation` es **HTML no documentado** y puede cambiar. El parser (`parseConfirmation`) es best-effort:
- Intenta extraer un JSON embebido (`__INITIAL_STATE__`, `reservationData`, etc.).
- Cae a regex puntuales para id de reserva, fechas y total.
- Siempre persiste/retorna el `raw` (truncado) para auditoría.

Por eso es **fuertemente recomendable** pasar `reservationIntentId`: así propiedad, embajador, fechas y monto salen de datos validados por nosotros y no dependemos del scraping. Para robustez total, migrar a la API oficial de Cloudbeds (la interfaz `BookingProvider` ya está lista para el swap).
