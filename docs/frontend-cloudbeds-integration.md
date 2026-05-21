# Integración del flujo de reserva Cloudbeds — Guía para Frontend

## Contexto

El backend NestJS de DeptoFlex intermedia con el motor de reservas público de
Cloudbeds. **Nuestro sistema nunca confirma reservas**: el usuario final
siempre termina la compra en el motor oficial de Cloudbeds.

El frontend tiene que:

1. Buscar disponibilidad/tarifas para una propiedad y un rango de fechas.
2. Mostrarle al usuario las habitaciones disponibles con sus precios.
3. Cuando el usuario elige una habitación, crear una "reservation intent" en
   nuestro backend.
4. Redirigir al usuario a la URL oficial de Cloudbeds que devuelve esa intent.
5. Notificar al backend que efectivamente redirigimos (tracking).

Todos los endpoints son **públicos** (no requieren auth). Hay rate-limiting
por IP.

## Base URL

`{API_BASE_URL}` (configurable, ej. `https://api.deptoflex.com`).

---

## Endpoint 1 — Buscar disponibilidad

`POST /booking/search`

- **Headers:** `Content-Type: application/json`.
- **Rate limit:** 30 req/min por IP.

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

| Campo          | Tipo     | Obligatorio | Notas                                                                                  |
| -------------- | -------- | ----------- | -------------------------------------------------------------------------------------- |
| `propertyId`   | string   | sí          | Es el `cloudbedsWidgetPropertyId`, **no** el UUID local. Lo configura el admin.        |
| `checkin`      | string   | sí          | `YYYY-MM-DD`. No puede ser pasado.                                                     |
| `checkout`     | string   | sí          | `YYYY-MM-DD`. Debe ser estrictamente mayor a `checkin`.                                |
| `currencyCode` | string   | no          | Default `"ARS"`.                                                                       |
| `lang`         | string   | no          | Default `"es"`.                                                                        |
| `adults`       | number   | no          | 1-20.                                                                                  |
| `children`     | number   | no          | 0-20.                                                                                  |

### Response 200

```ts
{
  propertyId: string;            // UUID local de la Property — usarlo en /reservation-intents
  propertyName: string;
  propertyExternalId: string;    // widget id de Cloudbeds
  checkin: string;               // "YYYY-MM-DD"
  checkout: string;
  currencyCode: string;
  lang: string;
  totalAvailable: number;
  rooms: Array<{
    roomTypeId: string;          // usar al crear la intent
    rateId: string | null;       // usar al crear la intent (si existe)
    name: string;
    title: string;
    descriptionHtml: string | null;
    maxGuests: number | null;
    maxAdults: number | null;
    maxChildren: number | null;
    remaining: number;           // habitaciones libres; mostrar solo si > 0
    totalRooms: number;
    totalAmount: number | null;  // precio total para el rango
    minNightlyRate: number | null;
    maxNightlyRate: number | null;
    detailedRates: Array<{ date: string; rate: number; baseRate: number }>;
    photos: string[];
    featuredPhoto: string | null;
    features: string[];
    unitIds: string[];
    otaComparison?: Array<{ channelName: string; channelPrice: number; directPrice: number }>;
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

### Errores

- **400** — `Invalid checkin/checkout date`, `checkout must be after checkin`,
  `checkin cannot be in the past`.
- **404** — `Property not found` (no existe ninguna property con ese widget id).
- **503** — `Booking engine upstream error` (problema upstream con Cloudbeds,
  reintentable).
- **429** — rate limit excedido.

---

## Endpoint 2 — Calcular totales (taxes, fees, grandTotal, cartToken)

`POST /booking/calculate-totals`

- **Headers:** `Content-Type: application/json`.
- **Rate limit:** 30 req/min por IP.

Llama al endpoint `calculateTotals` del motor público de Cloudbeds y
devuelve el desglose final de precios para una selección de tarifas, más un
`cartToken` opaco que va a ser necesario en pasos posteriores del flujo de
reserva.

### Request body

```json
{
  "propertyId": "179484",
  "checkin": "2026-05-20",
  "checkout": "2026-05-21",
  "currencyCode": "ARS",
  "lang": "es",
  "rates": [
    { "rateId": "551718", "adults": 1, "kids": 0 }
  ]
}
```

| Campo          | Tipo                              | Obligatorio | Notas                                                                                  |
| -------------- | --------------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `propertyId`   | string                            | sí          | `cloudbedsWidgetPropertyId` (mismo que en `/booking/search`).                          |
| `checkin`      | string                            | sí          | `YYYY-MM-DD`. No puede ser pasado.                                                     |
| `checkout`     | string                            | sí          | `YYYY-MM-DD`. Debe ser estrictamente mayor a `checkin`.                                |
| `currencyCode` | string                            | no          | Default `"ARS"`.                                                                       |
| `lang`         | string                            | no          | Default `"es"`.                                                                        |
| `rates`        | array (1-10)                      | sí          | Tarifas a cotizar. Cada item: `{ rateId, adults, kids? }`.                             |
| `rates[].rateId`  | string                         | sí          | El `rateId` que vino en `rooms[]` del search.                                          |
| `rates[].adults`  | number                         | sí          | 1-20.                                                                                  |
| `rates[].kids`    | number                         | no          | 0-20. Default `0`.                                                                     |

### Response 200

```ts
{
  propertyExternalId: string;       // widget id de Cloudbeds
  checkin: string;
  checkout: string;
  currencyCode: string;
  days: number;                     // nº de noches
  rooms: Array<{
    name: string;
    rateId: string | null;
    adults: number;
    kids: number;
    count: number;
    isPrivate: boolean;
    rateWithoutInclusiveTaxAndFees: number | null;
  }>;
  subtotal: number;                 // suma de tarifas sin impuestos exclusivos
  taxesTotal: number;               // suma de todos los impuestos
  feesTotal: number;                // suma de todos los fees
  deposit: number;                  // depósito requerido (0 si no aplica)
  grandTotal: number;               // TOTAL FINAL a mostrar al usuario
  totalAdults: number;
  totalKids: number;
  totalGuests: number;
  cntRooms: number;
  taxes: Array<{ id: string | null; name: string; amount: number }>;
  fees:  Array<{ id: string | null; name: string; amount: number }>;
  cartToken: string | null;         // ← guardar para pasos siguientes
  currencyRate: number | null;
}
```

### Errores

- **400** — fechas inválidas.
- **404** — `Property not found`.
- **503** — `Booking engine upstream error` (problema upstream o el motor
  rechazó la combinación de tarifas/fechas).
- **429** — rate limit.

### Cuándo llamarlo

- En la pantalla de "review/confirmar" cuando el usuario ya eligió un room
  y un rate, **antes** de redirigir o crear la intent.
- Usar `grandTotal` como precio "oficial" mostrado al usuario. Es el monto
  real que cobra Cloudbeds (incluye impuestos y fees).
- Persistir el `cartToken` en memoria de la sesión / state: lo vas a
  necesitar más adelante.

---

## Endpoint 3 — Crear reservation intent

`POST /reservation-intents`

- **Rate limit:** 10 req/min por IP.

### Request body

```json
{
  "propertyId": "UUID-de-la-property-local",
  "roomTypeId": "249030",
  "rateId": "551718",
  "checkin": "2026-06-01",
  "checkout": "2026-06-03",
  "currencyCode": "ARS",
  "lang": "es",
  "adults": 2,
  "children": 0,
  "totalAmount": 95000
}
```

| Campo          | Tipo   | Obligatorio | Notas                                                                                |
| -------------- | ------ | ----------- | ------------------------------------------------------------------------------------ |
| `propertyId`   | string | sí          | UUID local (el `propertyId` que vino en la response del search).                     |
| `roomTypeId`   | string | sí          | Del room elegido.                                                                    |
| `rateId`       | string | no          | Del room elegido.                                                                    |
| `checkin`      | string | sí          | `YYYY-MM-DD`.                                                                        |
| `checkout`     | string | sí          | `YYYY-MM-DD`.                                                                        |
| `currencyCode` | string | no          |                                                                                      |
| `lang`         | string | no          |                                                                                      |
| `adults`       | number | no          | 1-20.                                                                                |
| `children`     | number | no          | 0-20.                                                                                |
| `totalAmount`  | number | no          | Precio mostrado al usuario; el backend valida drift contra precio fresco.            |

### Response 201

```ts
{
  reservationIntentId: string;       // UUID. Guardar para tracking.
  redirectUrl: string;               // URL oficial de Cloudbeds.
  expiresAt: string;                 // ISO date, típicamente +30min.
  validatedTotalAmount: number | null;
  remaining: number;
}
```

### Errores

- **400** — `Selected room type is no longer available` o `Selected room is sold out`.
  Mostrar al usuario "habitación ya no disponible" y forzar nueva búsqueda.
- **404** — `Property not found`.
- **429** — rate limit.

> **Importante:** el backend re-consulta disponibilidad fresca al crear la
> intent. Si `validatedTotalAmount` difiere significativamente del
> `totalAmount` que mostraste, considerá reconfirmar con el usuario antes de
> redirigir.

---

## Endpoint 4 — Marcar intent como redirigida (tracking)

`POST /reservation-intents/:id/redirected`

- Sin body.
- Response **204**.

Llamarlo **inmediatamente antes** (o justo después) de hacer
`window.location.href = redirectUrl`. Es fire-and-forget para tracking — no
bloquees la redirección si falla.

---

## Endpoint 5 — Consultar intent (opcional)

`GET /reservation-intents/:id`

Devuelve el detalle: `status` (`PENDING | REDIRECTED | EXPIRED`), fechas,
`redirectUrl`. Útil para resumir o reanudar flujo si el usuario vuelve.

---

## Flujo UX recomendado

1. Pantalla de búsqueda con date pickers + selector de adultos/niños.
   Submit → `POST /booking/search`.
2. Mostrar `rooms[]` filtrando `remaining > 0`. Por cada room: foto, nombre,
   descripción, capacidad, `totalAmount` y precio por noche
   (`totalAmount / nNights`). Si hay `otaComparison`, mostrar el ahorro vs
   OTAs como gancho.
3. Cuando el usuario elige un room/rate → pantalla de "review". Llamar
   `POST /booking/calculate-totals` con `{ rateId, adults, kids }`. Mostrar
   `grandTotal` con el desglose de `taxes` y `fees`. Guardar `cartToken`.
4. Botón "Reservar" → `POST /reservation-intents` con los datos elegidos.
5. Con la `redirectUrl`:
   - Llamar `POST /reservation-intents/:id/redirected` (fire-and-forget).
   - `window.location.href = redirectUrl`. Mejor que `target=_blank` por
     bloqueadores de popups.
6. Manejo de errores:
   - **429** → "demasiados intentos, esperá un momento".
   - **400** con `sold out` / `no longer available` → "esta habitación ya no
     está disponible" + auto-refresh del search.
   - **503** → "el motor de reservas no está respondiendo, reintentá en unos
     segundos" con retry button.
7. Cache cliente: el backend ya no cachea, así que evitá disparar searches a
   cada keystroke. Debounce 400-600ms o trigger explícito on-submit.

## Estados a manejar

- **Loading** (search y create intent).
- **Empty** (`rooms[]` vacío o todos `remaining = 0`).
- **Error** (con código y mensaje del backend).
- **Stale price** (si `validatedTotalAmount` ≠ el que mostraste, aviso antes
  de redirigir).
- **Expired intent** (si el usuario tarda y vuelve, comparar `expiresAt` con
  ahora; si pasó, forzar nuevo search).

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
};

export type CreateIntentRequest = {
  propertyId: string; // UUID local
  roomTypeId: string;
  rateId?: string;
  checkin: string;
  checkout: string;
  currencyCode?: string;
  lang?: string;
  adults?: number;
  children?: number;
  totalAmount?: number;
};

export type CreateIntentResponse = {
  reservationIntentId: string;
  redirectUrl: string;
  expiresAt: string;
  validatedTotalAmount: number | null;
  remaining: number;
};

export type CalculateTotalsRate = {
  rateId: string;
  adults: number;
  kids?: number;
};

export type CalculateTotalsRequest = {
  propertyId: string; // widget id
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
```

## Checklist para el dev front

- [ ] Cliente HTTP con base URL configurable.
- [ ] Pantalla de search con validación de fechas en cliente
      (`checkout > checkin`, `checkin >= hoy`).
- [ ] Listado de rooms con foto + precio + CTA.
- [ ] Detalle/expand del room (descripción HTML sanitizada, amenities, fotos).
- [ ] Pantalla de review: `POST /booking/calculate-totals` y mostrar
      desglose (`subtotal`, `taxes`, `fees`, `grandTotal`). Guardar
      `cartToken` en state.
- [ ] Disparo de `POST /reservation-intents` al click "Reservar" — guardar
      `reservationIntentId` en `localStorage` por si el usuario vuelve.
- [ ] Llamada a `/reservation-intents/:id/redirected` antes de redirigir.
- [ ] Pantalla de fallback si la redirección falla.
- [ ] Manejo de los códigos de error mencionados.
