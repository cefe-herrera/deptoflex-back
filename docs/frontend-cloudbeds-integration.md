# Integracion del flujo de reserva Cloudbeds - Guia para Frontend

## Contexto

El backend NestJS de DeptoFlex intermedia con el booking engine publico de
Cloudbeds.

Flujo principal actual:

1. Buscar disponibilidad y tarifas.
2. Calcular el total final con impuestos/fees y obtener `cartToken`.
3. Pedir datos del huesped.
4. Preparar la reserva en Cloudbeds con `POST /booking/prepare`.
5. Mostrar el resultado de la reserva o continuar con el flujo de pago si el
   producto lo requiere.

Todos los endpoints de este flujo son publicos y tienen rate limiting por IP.

> Importante: `propertyId` en los endpoints `/booking/*` es el
> `cloudbedsWidgetPropertyId` de Cloudbeds, por ejemplo `"179484"`, no el UUID
> local de nuestra base.

## Base URL

`{API_BASE_URL}` debe incluir el prefijo configurado por ambiente. En local suele
ser:

```txt
http://localhost:3000/api/v1
```

---

## Flujo recomendado

1. Search:
   `POST /booking/search`

2. Review/precio final:
   `POST /booking/calculate-totals`

3. Formulario de huesped:
   nombre, apellido, email, telefono, pais y hora estimada de llegada.

4. Confirmar/preparar reserva:
   `POST /booking/prepare`

El `cartToken` que devuelve `/booking/calculate-totals` es obligatorio para
`/booking/prepare`. Si viene `null`, no permitir confirmar y pedir al usuario que
reintente el calculo.

---

## Endpoint 1 - Buscar disponibilidad

`POST /booking/search`

- Headers: `Content-Type: application/json`
- Rate limit: 30 req/min por IP

### Request body

```json
{
  "propertyId": "179484",
  "checkin": "2026-06-01",
  "checkout": "2026-06-03",
  "currencyCode": "ARS",
  "lang": "es",
  "adults": 2,
  "children": 0
}
```

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `propertyId` | string | si | `cloudbedsWidgetPropertyId`, por ejemplo `"179484"`. |
| `checkin` | string | si | `YYYY-MM-DD`. No puede ser pasado. |
| `checkout` | string | si | `YYYY-MM-DD`. Debe ser mayor a `checkin`. |
| `currencyCode` | string | no | Default `"ARS"`. |
| `lang` | string | no | Default `"es"`. |
| `adults` | number | no | 1-20. |
| `children` | number | no | 0-20. |

### Response 200

```ts
{
  propertyId: string;         // UUID local de la Property
  propertyName: string;
  propertyExternalId: string; // widget id de Cloudbeds
  checkin: string;
  checkout: string;
  currencyCode: string;
  lang: string;
  totalAvailable: number;
  rooms: Array<{
    roomTypeId: string;
    rateId: string | null;
    name: string;
    title: string;
    descriptionHtml: string | null;
    maxGuests: number | null;
    maxAdults: number | null;
    maxChildren: number | null;
    remaining: number;
    totalRooms: number;
    totalAmount: number | null;
    minNightlyRate: number | null;
    maxNightlyRate: number | null;
    detailedRates: Array<{ date: string; rate: number; baseRate: number }>;
    photos: string[];
    featuredPhoto: string | null;
    features: string[];
    unitIds: string[];
    otaComparison?: Array<{
      channelName: string;
      channelPrice: number;
      directPrice: number;
    }>;
    localUnits: Array<{
      id: string;
      name: string;
      description: string | null;
      bedrooms: number;
      bathrooms: number;
      maxOccupancy: number;
    }>;
  }>;
  meta?: Record<string, unknown>;
}
```

### Uso en UI

- Mostrar solo habitaciones con `remaining > 0`.
- Para continuar al calculo de totales, usar el `rateId` del room elegido.
- Sanitizar `descriptionHtml` antes de renderizarlo.

---

## Endpoint 2 - Calcular totales y obtener cartToken

`POST /booking/calculate-totals`

- Headers: `Content-Type: application/json`
- Rate limit: 30 req/min por IP

### Request body

```json
{
  "propertyId": "179484",
  "checkin": "2026-06-01",
  "checkout": "2026-06-03",
  "currencyCode": "ARS",
  "lang": "es",
  "rates": [
    {
      "rateId": "551718",
      "adults": 1,
      "kids": 0
    }
  ]
}
```

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `propertyId` | string | si | Mismo widget id usado en search. |
| `checkin` | string | si | `YYYY-MM-DD`. |
| `checkout` | string | si | `YYYY-MM-DD`. |
| `currencyCode` | string | no | Default `"ARS"`. |
| `lang` | string | no | Default `"es"`. |
| `rates` | array | si | 1-10 items. |
| `rates[].rateId` | string | si | El `rateId` elegido. |
| `rates[].adults` | number | si | 1-20. |
| `rates[].kids` | number | no | 0-20. Default `0`. |

### Response 200

```ts
{
  propertyExternalId: string;
  checkin: string;
  checkout: string;
  currencyCode: string;
  days: number;
  rooms: Array<{
    name: string;
    rateId: string | null;
    adults: number;
    kids: number;
    count: number;
    isPrivate: boolean;
    rateWithoutInclusiveTaxAndFees: number | null;
  }>;
  subtotal: number;
  taxesTotal: number;
  feesTotal: number;
  deposit: number;
  grandTotal: number;
  totalAdults: number;
  totalKids: number;
  totalGuests: number;
  cntRooms: number;
  taxes: Array<{ id: string | null; name: string; amount: number }>;
  fees: Array<{ id: string | null; name: string; amount: number }>;
  cartToken: string | null;
  currencyRate: number | null;
}
```

### Uso en UI

- Mostrar `grandTotal` como total final.
- Mostrar desglose con `subtotal`, `taxesTotal`, `feesTotal` y `deposit`.
- Guardar `cartToken` en state para el siguiente paso.
- Si `cartToken === null`, bloquear confirmacion y permitir reintentar.

---

## Endpoint 3 - Preparar reserva

`POST /booking/prepare`

- Headers: `Content-Type: application/json`
- Rate limit: 30 req/min por IP

Este endpoint llama a `https://hotels.cloudbeds.com/booking/prepare` desde el
backend. Internamente el backend transforma el body JSON del frontend al
`application/x-www-form-urlencoded` que espera Cloudbeds.

### Request body

```json
{
  "propertyId": "179484",
  "checkin": "2026-06-01",
  "checkout": "2026-06-03",
  "currencyCode": "ARS",
  "lang": "es",
  "rooms": [
    {
      "rateId": "551718",
      "adults": 1,
      "kids": 0,
      "addons": []
    }
  ],
  "cartToken": "Lx71gN//LvcUx7ExL4usBL+WwTjnBr4iPbdd0x4s8DY",
  "firstName": "Ceferino Armando",
  "lastName": "Herrera",
  "email": "c3f3.dev@gmail.com",
  "phone": "+543874025678",
  "country": "AR",
  "bookingEstimatedArrivalTime": 1,
  "sessionId": "acb86933-2a32-4704-9b62-00b9d026e813",
  "paymentSdk": true,
  "cfarOffersPresented": false,
  "bookingEngineSource": "hosted",
  "iframe": false
}
```

| Campo | Tipo | Obligatorio | Notas |
| --- | --- | --- | --- |
| `propertyId` | string | si | Widget id de Cloudbeds. |
| `checkin` | string | si | `YYYY-MM-DD`. No puede ser pasado. |
| `checkout` | string | si | `YYYY-MM-DD`. Debe ser mayor a `checkin`. |
| `currencyCode` | string | no | Default `"ARS"`. |
| `lang` | string | no | Default `"es"`. |
| `rooms` | array | si | 1-10 items. |
| `rooms[].rateId` | string | si | Rate elegido, por ejemplo `"551718"`. |
| `rooms[].adults` | number | si | 1-20. |
| `rooms[].kids` | number | no | 0-20. Default `0`. |
| `rooms[].addons` | array | no | Default `[]`. Usar solo si Cloudbeds devuelve add-ons. |
| `cartToken` | string | si | Viene de `/booking/calculate-totals`. |
| `firstName` | string | si | 1-100 caracteres. |
| `lastName` | string | si | 1-100 caracteres. |
| `email` | string | si | Email valido. |
| `phone` | string | si | 5-30 caracteres. Enviar con codigo pais si es posible. |
| `country` | string | si | ISO alpha-2, por ejemplo `"AR"`. |
| `bookingEstimatedArrivalTime` | number | no | 0-23. Default `1`. |
| `sessionId` | string | no | UUID. Se puede generar en frontend con `crypto.randomUUID()`. |
| `paymentSdk` | boolean | no | Default `true`. |
| `cfarOffersPresented` | boolean | no | Default `false`. |
| `bookingEngineSource` | string | no | Default `"hosted"`. |
| `iframe` | boolean | no | Default `false`. |

### Response 200

```ts
{
  propertyExternalId: string;
  checkin: string;
  checkout: string;
  currencyCode: string;
  success: boolean;
  reservationId: string | null;
  encryptedReservationId: string | null;
  customerId: string | null;
  status: string | null; // por ejemplo "confirmed"
  raw: unknown;
  httpStatus: number;
  durationMs: number;
}
```

Ejemplo:

```json
{
  "propertyExternalId": "179484",
  "checkin": "2026-06-01",
  "checkout": "2026-06-03",
  "currencyCode": "ARS",
  "success": true,
  "reservationId": "2448738948993",
  "encryptedReservationId": "rQ91TZxsYxa8iKSxOkdZ3r%2F50a9y4dMFqOy3cNMdnXBzr3oWdVugNJV9LPRDZkdtQO%2Fz4epF%2BE4nToemWAlN5AwLCoZ0FyqhpatRrKvWDSqbLBbk1yb31DMrIs5hOMtD",
  "customerId": "176234319",
  "status": "confirmed",
  "httpStatus": 200,
  "durationMs": 850
}
```

### Uso en UI

- Deshabilitar el boton mientras el request esta en curso.
- Si `success === true`, mostrar pantalla de exito/resumen con
  `reservationId`.
- Guardar `reservationId`, `encryptedReservationId` y `customerId` si el front
  necesita reanudar o mostrar confirmacion.
- Si el backend responde `503`, Cloudbeds rechazo o fallo el prepare. Mostrar
  mensaje reintentable y recomendar recalcular totales si el usuario reintenta.

---

## Errores comunes

Todos los endpoints pueden responder:

- `400`: validacion de body o fechas invalidas.
- `404`: `Property not found`.
- `429`: rate limit excedido.
- `503`: problema con Cloudbeds o combinacion rechazada por el booking engine.

Mensajes relevantes:

- `checkout must be after checkin`
- `checkin cannot be in the past`
- `Booking engine upstream error`
- `Booking engine returned invalid response`
- `Booking engine returned unexpected payload`
- `Booking engine rejected the totals request`
- `Booking engine rejected the prepare request`

El frontend deberia mapear:

- `400` fechas/body: mostrar validacion inline.
- `404`: propiedad no disponible.
- `429`: pedir esperar unos segundos.
- `503`: mostrar retry. Si ocurre en prepare, recalcular totales antes de un
  segundo intento es la opcion mas segura.

---

## Tipos TypeScript sugeridos

```ts
export type SearchAvailabilityRequest = {
  propertyId: string;
  checkin: string;
  checkout: string;
  currencyCode?: string;
  lang?: string;
  adults?: number;
  children?: number;
};

export type AvailabilityRoom = {
  roomTypeId: string;
  rateId: string | null;
  name: string;
  title: string;
  descriptionHtml: string | null;
  maxGuests: number | null;
  maxAdults: number | null;
  maxChildren: number | null;
  remaining: number;
  totalRooms: number;
  totalAmount: number | null;
  minNightlyRate: number | null;
  maxNightlyRate: number | null;
  detailedRates: Array<{ date: string; rate: number; baseRate: number }>;
  photos: string[];
  featuredPhoto: string | null;
  features: string[];
  unitIds: string[];
  otaComparison?: Array<{
    channelName: string;
    channelPrice: number;
    directPrice: number;
  }>;
  localUnits: Array<{
    id: string;
    name: string;
    description: string | null;
    bedrooms: number;
    bathrooms: number;
    maxOccupancy: number;
  }>;
};

export type SearchAvailabilityResponse = {
  propertyId: string;
  propertyName: string;
  propertyExternalId: string;
  checkin: string;
  checkout: string;
  currencyCode: string;
  lang: string;
  totalAvailable: number;
  rooms: AvailabilityRoom[];
  meta?: Record<string, unknown>;
};

export type CalculateTotalsRate = {
  rateId: string;
  adults: number;
  kids?: number;
};

export type CalculateTotalsRequest = {
  propertyId: string;
  checkin: string;
  checkout: string;
  currencyCode?: string;
  lang?: string;
  rates: CalculateTotalsRate[];
};

export type TotalsTaxOrFee = {
  id: string | null;
  name: string;
  amount: number;
};

export type TotalsRoomBreakdown = {
  name: string;
  rateId: string | null;
  adults: number;
  kids: number;
  count: number;
  isPrivate: boolean;
  rateWithoutInclusiveTaxAndFees: number | null;
};

export type CalculateTotalsResponse = {
  propertyExternalId: string;
  checkin: string;
  checkout: string;
  currencyCode: string;
  days: number;
  rooms: TotalsRoomBreakdown[];
  subtotal: number;
  taxesTotal: number;
  feesTotal: number;
  deposit: number;
  grandTotal: number;
  totalAdults: number;
  totalKids: number;
  totalGuests: number;
  cntRooms: number;
  taxes: TotalsTaxOrFee[];
  fees: TotalsTaxOrFee[];
  cartToken: string | null;
  currencyRate: number | null;
};

export type PrepareBookingRoom = {
  rateId: string;
  adults: number;
  kids?: number;
  addons?: unknown[];
};

export type PrepareBookingRequest = {
  propertyId: string;
  checkin: string;
  checkout: string;
  currencyCode?: string;
  lang?: string;
  rooms: PrepareBookingRoom[];
  cartToken: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  bookingEstimatedArrivalTime?: number;
  sessionId?: string;
  paymentSdk?: boolean;
  cfarOffersPresented?: boolean;
  bookingEngineSource?: string;
  iframe?: boolean;
};

export type PrepareBookingResponse = {
  propertyExternalId: string;
  checkin: string;
  checkout: string;
  currencyCode: string;
  success: boolean;
  reservationId: string | null;
  encryptedReservationId: string | null;
  customerId: string | null;
  status: string | null;
  raw: unknown;
  httpStatus: number;
  durationMs: number;
};
```

---

## Ejemplo de implementacion

```ts
const search = await api.post<SearchAvailabilityResponse>('/booking/search', {
  propertyId: '179484',
  checkin,
  checkout,
  currencyCode: 'ARS',
  lang: 'es',
  adults,
  children,
});

const selectedRoom = search.rooms.find((room) => room.rateId);
if (!selectedRoom?.rateId) throw new Error('No rate available');

const totals = await api.post<CalculateTotalsResponse>('/booking/calculate-totals', {
  propertyId: '179484',
  checkin,
  checkout,
  currencyCode: 'ARS',
  lang: 'es',
  rates: [{ rateId: selectedRoom.rateId, adults, kids: children }],
});

if (!totals.cartToken) throw new Error('Missing cart token');

const reservation = await api.post<PrepareBookingResponse>('/booking/prepare', {
  propertyId: '179484',
  checkin,
  checkout,
  currencyCode: 'ARS',
  lang: 'es',
  rooms: [{ rateId: selectedRoom.rateId, adults, kids: children }],
  cartToken: totals.cartToken,
  firstName: guest.firstName,
  lastName: guest.lastName,
  email: guest.email,
  phone: guest.phone,
  country: guest.country,
  bookingEstimatedArrivalTime: guest.arrivalHour ?? 1,
  sessionId: crypto.randomUUID(),
});
```

---

## Checklist para el dev front

- [ ] Configurar cliente HTTP con `{API_BASE_URL}`.
- [ ] Validar fechas en cliente: `checkout > checkin` y `checkin >= hoy`.
- [ ] Buscar disponibilidad con `POST /booking/search`.
- [ ] Mostrar habitaciones disponibles con `remaining > 0`.
- [ ] Sanitizar `descriptionHtml`.
- [ ] Calcular totales con `POST /booking/calculate-totals`.
- [ ] Mostrar `grandTotal`, impuestos, fees y deposito.
- [ ] Guardar `cartToken` en state.
- [ ] Capturar datos del huesped.
- [ ] Generar `sessionId` con `crypto.randomUUID()` si no existe uno.
- [ ] Preparar reserva con `POST /booking/prepare`.
- [ ] Mostrar confirmacion con `reservationId` y `status`.
- [ ] Manejar `400`, `404`, `429` y `503`.

---

## Flujo legacy/opcional: reservation intents

Los endpoints de reservation intents siguen existiendo para el flujo anterior
basado en redireccion a Cloudbeds:

- `POST /reservation-intents`
- `POST /reservation-intents/:id/redirected`
- `GET /reservation-intents/:id`

No son necesarios para el flujo principal con `/booking/prepare`, salvo que el
producto decida mantener tracking de redireccion o fallback a la pagina oficial.
