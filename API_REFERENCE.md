# DeptoFlex API — Referencia para el Frontend

## Información general

| Dato | Valor |
|---|---|
| Base URL (dev) | `http://localhost:3000/api/v1` |
| Base URL (prod) | `https://api.deptoflex.com/api/v1` |
| Formato | JSON (`Content-Type: application/json`) |
| Autenticación | Bearer Token en el header `Authorization` |

---

## Autenticación

La API usa **JWT de corta duración** (15 minutos) + **Refresh Token de larga duración** (7 días).

### Flujo de uso

```
1. POST /auth/login  →  recibís { accessToken, refreshToken }
2. Guardás ambos tokens (accessToken en memoria, refreshToken en localStorage/cookie segura)
3. En cada request: Authorization: Bearer <accessToken>
4. Cuando el accessToken expira (401) → POST /auth/refresh con el refreshToken
5. POST /auth/logout para invalidar la sesión
```

### Header de autenticación

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Las rutas marcadas como 🔓 **no requieren** el header. El resto sí.

---

## Formato de respuestas

Todas las respuestas exitosas vienen envueltas en:

```json
{
  "data": { ... }
}
```

> ⚠️ **Importante**: Siempre acceder a `response.data` para obtener el payload real.

### Errores

```json
{
  "statusCode": 400,
  "message": "Descripción del error o array de mensajes de validación",
  "error": "Bad Request"
}
```

Errores comunes:

| HTTP | Significado |
|---|---|
| `400` | Body inválido / validación fallida |
| `401` | No autenticado o token expirado |
| `403` | Sin permisos (rol insuficiente) |
| `404` | Recurso no encontrado |
| `409` | Conflicto (ej: email ya registrado) |
| `429` | Rate limit alcanzado |
| `500` | Error interno del servidor |

---

## Roles del sistema

| Rol | Puede hacer |
|---|---|
| `ADMIN` | Todo |
| `OPERATOR` | CRUD de propiedades, unidades, leads |
| `PROFESSIONAL` | Crear y ver sus propios leads |
| `AMBASSADOR` | Crear leads |

---

## Módulos

---

## 🔐 Auth — `/auth`

### Registrarse

```http
POST /auth/register
🔓 No requiere token
```

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "MiPass123",
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "+5491112345678"
}
```

**Validaciones:**
- `password`: 8–72 caracteres, debe tener mayúscula, minúscula y número
- `firstName` / `lastName`: 2–100 caracteres
- `phone`: opcional, hasta 30 caracteres

**Respuesta `201`:**
```json
{
  "data": {
    "id": "uuid",
    "email": "usuario@ejemplo.com",
    "emailVerified": false
  }
}
```

---

### Login

```http
POST /auth/login
🔓 No requiere token
```

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "MiPass123"
}
```

**Respuesta `200`:**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "a1b2c3...",
    "user": {
      "id": "uuid",
      "email": "usuario@ejemplo.com",
      "roles": ["OPERATOR"]
    }
  }
}
```

---

### Renovar token

```http
POST /auth/refresh
🔓 No requiere token
```

**Body:**
```json
{
  "refreshToken": "a1b2c3..."
}
```

**Respuesta `200`:** Misma estructura que login.

> ⚠️ Cada uso del `refreshToken` lo invalida y genera uno nuevo (**rotación**). Guardar el nuevo token inmediatamente.

---

### Cerrar sesión

```http
POST /auth/logout
🔒 Requiere token
```

**Body:**
```json
{
  "refreshToken": "a1b2c3..."
}
```

**Respuesta `204`:** Sin body.

---

### Verificar email

```http
POST /auth/verify-email
🔓 No requiere token
```

**Body:**
```json
{
  "token": "token-recibido-por-email"
}
```

**Respuesta `200`:** Confirmación de verificación.

---

### Solicitar reset de contraseña

```http
POST /auth/forgot-password
🔓 No requiere token
```

**Body:**
```json
{
  "email": "usuario@ejemplo.com"
}
```

**Respuesta `200`:** Siempre responde OK (por seguridad, aunque el email no exista).

---

### Resetear contraseña

```http
POST /auth/reset-password
🔓 No requiere token
```

**Body:**
```json
{
  "token": "token-recibido-por-email",
  "password": "NuevaPass456"
}
```

---

### Perfil del usuario autenticado

```http
GET /auth/me
🔒 Requiere token
```

**Respuesta `200`:**
```json
{
  "data": {
    "id": "uuid",
    "email": "usuario@ejemplo.com",
    "emailVerified": true,
    "roles": ["OPERATOR"],
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

## 👤 Users — `/users`

### Mi perfil

```http
GET /users/me
🔒 Requiere token
```

### Actualizar mi perfil

```http
PATCH /users/me
🔒 Requiere token
```

**Body (todos opcionales):**
```json
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "+5491199999999"
}
```

### Listar usuarios *(ADMIN, OPERATOR)*

```http
GET /users?page=1&limit=20
🔒 Requiere token | Roles: ADMIN, OPERATOR
```

**Query params:** `page` (default: 1), `limit` (default: 20)

### Obtener usuario por ID *(ADMIN, OPERATOR)*

```http
GET /users/:id
🔒 Requiere token | Roles: ADMIN, OPERATOR
```

### Actualizar usuario *(ADMIN)*

```http
PATCH /users/:id
🔒 Requiere token | Roles: ADMIN
```

### Eliminar usuario *(ADMIN)*

```http
DELETE /users/:id
🔒 Requiere token | Roles: ADMIN
```

**Respuesta `204`:** Sin body (soft delete).

### Asignar rol *(ADMIN)*

```http
POST /users/:id/roles
🔒 Requiere token | Roles: ADMIN
```

**Body:**
```json
{
  "roleId": "uuid-del-rol"
}
```

### Quitar rol *(ADMIN)*

```http
DELETE /users/:id/roles/:roleId
🔒 Requiere token | Roles: ADMIN
```

**Respuesta `204`:** Sin body.

---

## 🏢 Professionals — `/professionals`

### Mi perfil profesional

```http
GET /professionals/me
🔒 Requiere token
```

**Respuesta `200`:**
```json
{
  "data": {
    "id": "uuid",
    "firstName": "Ana",
    "lastName": "García",
    "status": "ACTIVE",
    "isVerified": true,
    "defaultCommissionRate": "5.00"
  }
}
```

**Status posibles:** `PENDING` | `ACTIVE` | `SUSPENDED` | `REJECTED`

### Actualizar mi perfil profesional

```http
PATCH /professionals/me
🔒 Requiere token
```

**Body (todos opcionales):**
```json
{
  "firstName": "Ana",
  "lastName": "García",
  "phone": "+5491188888888",
  "bio": "Especialista en alquileres temporales",
  "licenseNumber": "MAT-12345"
}
```

### Listar profesionales *(ADMIN, OPERATOR)*

```http
GET /professionals?page=1&limit=20
🔒 Roles: ADMIN, OPERATOR
```

### Verificar profesional *(ADMIN)*

```http
POST /professionals/:id/verify
🔒 Roles: ADMIN
```

### Suspender profesional *(ADMIN)*

```http
POST /professionals/:id/suspend
🔒 Roles: ADMIN
```

---

## 🏠 Properties — `/properties`

### Crear propiedad *(ADMIN, OPERATOR)*

```http
POST /properties
🔒 Roles: ADMIN, OPERATOR
```

**Body:**
```json
{
  "name": "Edificio Las Palmas",
  "type": "APARTMENT",
  "description": "Edificio de 10 pisos en Palermo",
  "companyId": "uuid-opcional",
  "address": {
    "street": "Av. Santa Fe",
    "number": "1234",
    "apartment": "3B",
    "neighborhood": "Palermo",
    "city": "Buenos Aires",
    "state": "CABA",
    "country": "Argentina",
    "postalCode": "1060",
    "latitude": -34.5925,
    "longitude": -58.3976
  }
}
```

**`type` posibles:** `APARTMENT` | `HOUSE` | `STUDIO` | `OFFICE` | `OTHER`

### Listar propiedades

```http
GET /properties
🔒 Requiere token
```

Soporta filtros por query string (ver `QueryPropertiesDto`).

### Obtener propiedad

```http
GET /properties/:id
🔒 Requiere token
```

### Actualizar propiedad *(ADMIN, OPERATOR)*

```http
PATCH /properties/:id
🔒 Roles: ADMIN, OPERATOR
```

**Body:** Mismo formato que create, todos los campos opcionales.

### Eliminar propiedad *(ADMIN)*

```http
DELETE /properties/:id
🔒 Roles: ADMIN
```

**Respuesta `204`:** Sin body (soft delete).

### Agregar amenity a propiedad *(ADMIN, OPERATOR)*

```http
POST /properties/:id/amenities
🔒 Roles: ADMIN, OPERATOR
```

**Body:**
```json
{
  "amenityId": "uuid-del-amenity"
}
```

### Quitar amenity de propiedad *(ADMIN, OPERATOR)*

```http
DELETE /properties/:id/amenities/:amenityId
🔒 Roles: ADMIN, OPERATOR
```

### Subir imagen a propiedad — Paso 1: Presign *(ADMIN, OPERATOR)*

```http
POST /properties/:id/images/presign
🔒 Roles: ADMIN, OPERATOR
```

**Body:**
```json
{
  "fileName": "foto-salon.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 204800
}
```

**Respuesta `201`:**
```json
{
  "data": {
    "uploadUrl": "https://r2.cloudflarestorage.com/...?X-Amz-Signature=...",
    "key": "properties/uuid/foto-salon.jpg",
    "mediaFileId": "uuid"
  }
}
```

### Subir imagen a propiedad — Paso 2: Upload directo a R2

```http
PUT <uploadUrl>
Content-Type: image/jpeg
Body: <archivo binario>
```

> ⚠️ Este request va **directamente a R2** (Cloudflare), NO al backend de DeptoFlex.

### Subir imagen a propiedad — Paso 3: Confirmar *(ADMIN, OPERATOR)*

```http
POST /properties/:id/images/confirm
🔒 Roles: ADMIN, OPERATOR
```

**Body:**
```json
{
  "mediaFileId": "uuid",
  "key": "properties/uuid/foto-salon.jpg",
  "isPrimary": false,
  "caption": "Salón principal",
  "sortOrder": 1
}
```

### Eliminar imagen de propiedad *(ADMIN, OPERATOR)*

```http
DELETE /properties/:id/images/:imageId
🔒 Roles: ADMIN, OPERATOR
```

**Respuesta `204`:** Sin body.

---

## 🏡 Units — `/units`

### Crear unidad *(ADMIN, OPERATOR)*

```http
POST /units
🔒 Roles: ADMIN, OPERATOR
```

**Body:**
```json
{
  "propertyId": "uuid-de-la-propiedad",
  "name": "Depto 3A",
  "description": "Luminoso, 2 ambientes",
  "floor": 3,
  "bedrooms": 1,
  "bathrooms": 1,
  "maxOccupancy": 2,
  "sizeM2": "45.50"
}
```

### Listar unidades

```http
GET /units?page=1&limit=20&propertyId=uuid&status=ACTIVE
🔒 Requiere token
```

**Query params:**
- `page` / `limit`: paginación
- `propertyId`: filtrar por propiedad
- `status`: `DRAFT` | `ACTIVE` | `INACTIVE` | `HIDDEN` | `MAINTENANCE`

### Obtener unidad

```http
GET /units/:id
🔒 Requiere token
```

### Actualizar unidad *(ADMIN, OPERATOR)*

```http
PATCH /units/:id
🔒 Roles: ADMIN, OPERATOR
```

### Eliminar unidad *(ADMIN)*

```http
DELETE /units/:id
🔒 Roles: ADMIN
```

**Respuesta `204`:** Sin body.

### Ver disponibilidad de unidad

```http
GET /units/:id/availability?from=2026-05-01&to=2026-05-31
🔒 Requiere token
```

**Query params:** `from` y `to` en formato `YYYY-MM-DD`.

### Establecer disponibilidad *(ADMIN, OPERATOR)*

```http
POST /units/:id/availability
🔒 Roles: ADMIN, OPERATOR
```

**Body:**
```json
{
  "startDate": "2026-05-01",
  "endDate": "2026-05-31",
  "isAvailable": false,
  "reason": "MAINTENANCE"
}
```

**`reason` posibles:** `BOOKED` | `BLOCKED` | `MAINTENANCE`

### Ver tarifas de unidad

```http
GET /units/:id/rates
🔒 Requiere token
```

### Configurar tarifas *(ADMIN, OPERATOR)*

```http
PUT /units/:id/rates
🔒 Roles: ADMIN, OPERATOR
```

**Body:**
```json
{
  "rules": [
    {
      "name": "Tarifa base",
      "baseRate": 15000,
      "rateType": "NIGHTLY",
      "minNights": 2,
      "maxNights": 30,
      "isDefault": true,
      "currency": "ARS"
    },
    {
      "name": "Temporada alta",
      "startDate": "2026-12-15",
      "endDate": "2027-01-15",
      "baseRate": 22000,
      "rateType": "NIGHTLY",
      "minNights": 3,
      "isDefault": false,
      "currency": "ARS"
    }
  ]
}
```

**`rateType` posibles:** `NIGHTLY` | `WEEKLY` | `MONTHLY`

> ⚠️ Este endpoint **reemplaza** todas las reglas existentes de la unidad.

### Agregar / quitar amenity en unidad *(ADMIN, OPERATOR)*

```http
POST /units/:id/amenities        { "amenityId": "uuid" }
DELETE /units/:id/amenities/:amenityId
```

### Imágenes de unidad

Mismo flujo de 3 pasos que las propiedades:

```http
POST /units/:id/images/presign
PUT  <uploadUrl>  (directo a R2)
POST /units/:id/images/confirm
DELETE /units/:id/images/:imageId
```

---

## ✨ Amenities — `/amenities`

### Listar amenities

```http
GET /amenities
🔒 Requiere token
```

**Respuesta `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "WiFi",
      "category": "GENERAL",
      "icon": "wifi"
    }
  ]
}
```

**Categorías posibles:** `GENERAL` | `KITCHEN` | `BATHROOM` | `BEDROOM` | `ENTERTAINMENT` | `SAFETY` | `ACCESSIBILITY` | `OUTDOOR` | `OTHER`

### Crear amenity *(ADMIN)*

```http
POST /amenities
🔒 Roles: ADMIN
```

**Body:**
```json
{
  "name": "Pileta",
  "category": "OUTDOOR",
  "icon": "pool"
}
```

### Actualizar / Eliminar amenity *(ADMIN)*

```http
PATCH /amenities/:id   { "name": "Pileta climatizada" }
DELETE /amenities/:id
```

---

## 📋 Leads — `/leads`

### Crear lead

```http
POST /leads
🔒 Roles: ADMIN, OPERATOR, PROFESSIONAL, AMBASSADOR
```

**Body:**
```json
{
  "clientName": "Carlos Rodríguez",
  "clientEmail": "carlos@email.com",
  "clientPhone": "+5491177777777",
  "unitId": "uuid-opcional",
  "checkInDate": "2026-06-01",
  "checkOutDate": "2026-06-10",
  "adults": 2,
  "children": 1,
  "notes": "Busca algo tranquilo en Núñez",
  "source": "WhatsApp"
}
```

### Listar leads

```http
GET /leads?page=1&limit=20
🔒 Requiere token
```

> El backend filtra automáticamente los leads según el rol: ADMIN/OPERATOR ven todos, PROFESSIONAL ve solo los suyos.

### Obtener lead

```http
GET /leads/:id
🔒 Requiere token
```

**Respuesta incluye `status`:**
`NEW` | `CONTACTED` | `QUALIFIED` | `PROPOSAL_SENT` | `NEGOTIATING` | `WON` | `LOST` | `CONVERTED`

### Actualizar lead

```http
PATCH /leads/:id
🔒 Requiere token
```

**Body (todos opcionales):**
```json
{
  "status": "CONTACTED",
  "notes": "Llamado realizado, interesado"
}
```

### Eliminar lead *(ADMIN)*

```http
DELETE /leads/:id
🔒 Roles: ADMIN
```

**Respuesta `204`:** Sin body.

### Agregar nota al lead

```http
POST /leads/:id/notes
🔒 Requiere token
```

**Body:**
```json
{
  "message": "El cliente confirmó el interés por el depto 3A"
}
```

### Convertir lead en reserva

```http
POST /leads/:id/convert-to-booking
🔒 Requiere token
```

**Body:**
```json
{
  "unitId": "uuid",
  "checkInDate": "2026-06-01",
  "checkOutDate": "2026-06-10",
  "baseAmount": 135000,
  "totalAmount": 148500,
  "currency": "ARS",
  "notes": "Incluye ropa blanca"
}
```

---

## 📅 Bookings — `/bookings`

### Obtener reserva por ID

```http
GET /bookings/:id
🔒 Requiere token
```

**Respuesta incluye `status`:**
`PENDING` | `CONFIRMED` | `CANCELLED` | `COMPLETED` | `NO_SHOW`

---

## 💰 Commissions — `/commissions`

### Listar comisiones

```http
GET /commissions
🔒 Requiere token
```

---

## ❤️ Health — `/health`

```http
GET /health
🔓 No requiere token
```

**Respuesta `200`:**
```json
{
  "status": "ok",
  "info": { "database": { "status": "up" } }
}
```

---

## Ejemplos prácticos (JavaScript / Fetch)

### Cliente base recomendado

```javascript
const API_URL = 'http://localhost:3000/api/v1';

async function apiFetch(endpoint, options = {}) {
  const accessToken = localStorage.getItem('accessToken');

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Token expirado → intentar renovar
    return await refreshAndRetry(endpoint, options);
  }

  if (!response.ok) {
    const error = await response.json();
    throw error;
  }

  if (response.status === 204) return null;

  const json = await response.json();
  return json.data; // ← siempre retorna el payload desenvuelto
}

async function refreshAndRetry(endpoint, options) {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    // Redirigir al login
    window.location.href = '/login';
    return;
  }

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    localStorage.clear();
    window.location.href = '/login';
    return;
  }

  const { data } = await res.json();
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);

  // Reintentar el request original con el nuevo token
  return apiFetch(endpoint, options);
}
```

### Login

```javascript
const user = await apiFetch('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'user@test.com', password: 'MiPass123' }),
});

localStorage.setItem('accessToken', user.accessToken);
localStorage.setItem('refreshToken', user.refreshToken);
```

### Listar propiedades

```javascript
const properties = await apiFetch('/properties');
```

### Crear lead

```javascript
const lead = await apiFetch('/leads', {
  method: 'POST',
  body: JSON.stringify({
    clientName: 'Carlos López',
    clientEmail: 'carlos@email.com',
    adults: 2,
    checkInDate: '2026-07-01',
    checkOutDate: '2026-07-10',
  }),
});
```

### Subida de imagen (flujo completo)

```javascript
async function uploadPropertyImage(propertyId, file) {
  // Paso 1 — Obtener URL firmada
  const presign = await apiFetch(`/properties/${propertyId}/images/presign`, {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });

  // Paso 2 — Subir directamente a R2
  await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  // Paso 3 — Confirmar en el backend
  const image = await apiFetch(`/properties/${propertyId}/images/confirm`, {
    method: 'POST',
    body: JSON.stringify({
      mediaFileId: presign.mediaFileId,
      key: presign.key,
      isPrimary: false,
    }),
  });

  return image;
}
```

---

## Rate limits

| Ruta | Límite |
|---|---|
| `POST /auth/login` | 5 req / 60s |
| `POST /auth/register` | 5 req / 60s |
| `POST /auth/forgot-password` | 3 req / 60s |
| Resto de endpoints | 100 req / 60s |

Cuando se supera el límite, el servidor responde `429 Too Many Requests`.

---

## Enums de referencia rápida

```typescript
// Tipos de propiedad
PropertyType: "APARTMENT" | "HOUSE" | "STUDIO" | "OFFICE" | "OTHER"

// Estado de propiedad
PropertyStatus: "DRAFT" | "ACTIVE" | "INACTIVE" | "HIDDEN"

// Estado de unidad
UnitStatus: "DRAFT" | "ACTIVE" | "INACTIVE" | "HIDDEN" | "MAINTENANCE"

// Tipo de tarifa
RateType: "NIGHTLY" | "WEEKLY" | "MONTHLY"

// Razón de no disponibilidad
AvailabilityReason: "BOOKED" | "BLOCKED" | "MAINTENANCE"

// Estado de lead
LeadStatus: "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "NEGOTIATING" | "WON" | "LOST" | "CONVERTED"

// Estado de reserva
BookingStatus: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW"

// Estado de comisión
CommissionStatus: "PENDING" | "APPROVED" | "PAID" | "CANCELLED"

// Categoría de amenity
AmenityCategory: "GENERAL" | "KITCHEN" | "BATHROOM" | "BEDROOM" | "ENTERTAINMENT" | "SAFETY" | "ACCESSIBILITY" | "OUTDOOR" | "OTHER"

// Estado de profesional
ProfessionalStatus: "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED"

// Roles del sistema
Role: "ADMIN" | "OPERATOR" | "PROFESSIONAL" | "AMBASSADOR"
```
