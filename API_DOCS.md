# DeptoFlex API — Documentación Frontend

> **Base URL (dev):** `http://localhost:3000/api/v1`  
> **Base URL (prod):** `https://<dominio>/api/v1`

## Autenticación

Todos los endpoints **excepto los marcados como `🔓 Público`** requieren:

```
Authorization: Bearer <accessToken>
```

El `accessToken` expira a los **15 minutos**. Usar `POST /auth/refresh` para renovarlo.

### Roles disponibles

| Rol | Descripción |
|-----|-------------|
| `ADMIN` | Acceso total al sistema |
| `OPERATOR` | Gestión de propiedades, unidades, embajadores (sin borrar) |
| `AMBASSADOR` | Usuario verificado como profesional inmobiliario |
| `USER` | Usuario registrado básico |

---

## Modelo de negocio

```
CompanyProfile
  └── Property  (edificio físico con dirección)
        ├── PropertyAmenity → Amenity  (amenities del edificio, ej. pileta, gym)
        ├── PropertyImage
        └── Unit  (espacio rentable individual: depto A, depto B, PH...)
              ├── UnitAmenity → Amenity  (amenities del depto, ej. Smart TV, AC)
              ├── UnitImage
              ├── PricingRule  (precios por noche/semana/mes)
              ├── UnitAvailability  (calendario de disponibilidad)
              └── Booking  (reservas confirmadas, vía Lead)

Lead  →  Booking  (un lead se convierte en reserva)
ProfessionalProfile  (perfil de embajador, 1:1 con User)
```

---

## Índice de módulos

- [Auth](#auth)
- [Users](#users)
- [Properties](#properties)
- [Units](#units)
- [Amenities](#amenities)
- [Professionals / Embajadores](#professionals--embajadores)
- [Leads](#leads)
- [Bookings](#bookings)
- [Commissions](#commissions)
- [Admin](#admin)

---

## Auth

### `POST /auth/register` 🔓 Público

Registra un nuevo usuario. Crea automáticamente un `ProfessionalProfile` asociado.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "Abc12345",
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "+5493874000000"
}
```

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `email` | string | ✅ | Email único, normalizado a minúsculas |
| `password` | string (8–72) | ✅ | Debe tener mayúscula, minúscula y número |
| `firstName` | string (2–100) | ✅ | Nombre |
| `lastName` | string (2–100) | ✅ | Apellido |
| `phone` | string (≤30) | ❌ | Teléfono |

**Respuesta `201`:**
```json
{
  "id": "uuid",
  "email": "usuario@ejemplo.com"
}
```

> ⚠️ La verificación de email está temporalmente deshabilitada. El usuario queda activo directamente.

---

### `POST /auth/login` 🔓 Público

Autentica con email y contraseña. Límite: 5 intentos/minuto.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "Abc12345"
}
```

**Respuesta `200`:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "usuario@ejemplo.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "roles": ["USER"]
  }
}
```

**Errores:**
- `401` — Credenciales inválidas o email no verificado

---

### `POST /auth/google` 🔓 Público

Autenticación con Google OAuth. Recibe el `id_token` generado por Google en el frontend, lo verifica y devuelve tokens del sistema. Si el usuario no existe, lo crea automáticamente.

**Body:**
```json
{
  "token": "<GOOGLE_ID_TOKEN>"
}
```

**Respuesta `200`:** igual que `POST /auth/login`

---

### `POST /auth/apple` 🔓 Público

> ⚠️ **No implementado todavía.** Retorna `400 Bad Request`.

Autenticación con Apple Sign-In (pendiente implementación real).

**Body:**
```json
{
  "token": "<APPLE_ID_TOKEN>",
  "firstName": "Juan",
  "lastName": "Pérez"
}
```

> Apple solo envía `firstName`/`lastName` en el primer login. Enviarlos si están disponibles.

---

### `POST /auth/refresh` 🔓 Público

Renueva el `accessToken` usando el `refreshToken`.

**Body:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Respuesta `200`:** igual que `POST /auth/login`

**Errores:**
- `401` — Token inválido o expirado

---

### `POST /auth/logout` 🔒 Auth requerido

Invalida el `refreshToken` actual.

**Body:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Respuesta `204`:** sin cuerpo

---

### `POST /auth/forgot-password` 🔓 Público

Solicita un email para resetear la contraseña. Límite: 3 intentos/minuto.

**Body:**
```json
{
  "email": "usuario@ejemplo.com"
}
```

**Respuesta `200`:**
```json
{
  "message": "If the email exists, a reset link was sent"
}
```

---

### `POST /auth/reset-password` 🔓 Público

Resetea la contraseña usando el token recibido por email.

**Body:**
```json
{
  "token": "<reset_token>",
  "password": "NuevaPass123"
}
```

**Respuesta `200`:**
```json
{
  "message": "Password updated"
}
```

---

### `GET /auth/me` 🔒 Auth requerido

Devuelve los datos del usuario autenticado.

**Respuesta `200`:**
```json
{
  "id": "uuid",
  "email": "usuario@ejemplo.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "isActive": true,
  "emailVerified": true,
  "roles": ["USER"],
  "createdAt": "2026-01-01T00:00:00Z"
}
```

---

## Users

### `GET /users/me` 🔒 Auth requerido

Datos completos del usuario autenticado.

**Respuesta `200`:** objeto `User` completo con `roles`

---

### `PATCH /users/me` 🔒 Auth requerido

Edita el perfil del usuario autenticado.

**Body (todos opcionales):**
```json
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "+5493874000000"
}
```

**Respuesta `200`:** objeto `User` actualizado

---

### `GET /users` 🔒 ADMIN | OPERATOR

Lista todos los usuarios con paginación.

**Query params:**
| Param | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `page` | number | 1 | Página |
| `limit` | number | 20 | Resultados por página |

**Respuesta `200`:**
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

---

### `GET /users/:id` 🔒 ADMIN | OPERATOR

Detalle de un usuario por ID.

---

### `PATCH /users/:id` 🔒 ADMIN

Edita los datos de cualquier usuario.

**Body:** igual que `PATCH /users/me`

---

### `DELETE /users/:id` 🔒 ADMIN

Soft delete de un usuario (no lo borra físicamente).

**Respuesta `204`:** sin cuerpo

---

### `POST /users/:id/roles` 🔒 ADMIN

Asigna un rol a un usuario.

**Body:**
```json
{
  "roleId": 2
}
```

> Roles disponibles: `1=ADMIN`, `2=USER`, `3=OPERATOR`, `4=AMBASSADOR`

---

### `DELETE /users/:id/roles/:roleId` 🔒 ADMIN

Quita un rol de un usuario.

**Respuesta `204`:** sin cuerpo

---

## Properties

### `POST /properties` 🔒 ADMIN | OPERATOR

Crea una nueva propiedad (edificio).

**Body:**
```json
{
  "name": "Edificio Pueyrredón",
  "type": "APARTMENT",
  "description": "Edificio de departamentos en el centro",
  "status": "ACTIVE",
  "companyId": "uuid-opcional",
  "address": {
    "street": "Av. Pueyrredón",
    "number": "916",
    "apartment": null,
    "neighborhood": "Centro",
    "city": "Salta",
    "state": "Salta",
    "country": "Argentina",
    "postalCode": "4400",
    "latitude": -24.7821,
    "longitude": -65.4232
  }
}
```

| Campo | Tipo | Req | Valores |
|-------|------|-----|---------|
| `name` | string (≤200) | ✅ | — |
| `type` | enum | ✅ | `APARTMENT` `HOUSE` `STUDIO` `OFFICE` `OTHER` |
| `description` | string | ❌ | — |
| `status` | enum | ❌ | `DRAFT` `ACTIVE` `INACTIVE` `HIDDEN` (default: `DRAFT`) |
| `companyId` | uuid | ❌ | ID de la empresa propietaria |
| `address` | objeto | ❌ | Ver campos arriba |

**Respuesta `201`:** objeto `Property` creado

---

### `GET /properties` 🔒 Auth requerido

Lista propiedades con filtros y paginación.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `page` | number | Default: 1 |
| `limit` | number | Default: 20, máx: 100 |
| `status` | enum | `DRAFT` `ACTIVE` `INACTIVE` `HIDDEN` |
| `type` | enum | `APARTMENT` `HOUSE` `STUDIO` `OFFICE` `OTHER` |
| `city` | string | Filtrar por ciudad |
| `companyId` | uuid | Filtrar por empresa |

**Respuesta `200`:**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Edificio Pueyrredón",
      "type": "APARTMENT",
      "status": "ACTIVE",
      "address": {
        "street": "Av. Pueyrredón",
        "number": "916",
        "city": "Salta",
        "state": "Salta",
        "country": "Argentina",
        "latitude": -24.7821,
        "longitude": -65.4232
      },
      "propertyImages": [
        { "isPrimary": true, "mediaFile": { "url": "https://cdn.../properties/uuid/foto.jpg" } }
      ],
      "_count": { "units": 5 },
      "createdAt": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 30,
  "page": 1,
  "limit": 20
}
```

> En la lista solo se devuelve la **imagen primaria**. Para todas las imágenes usar `GET /properties/:id`.

---

### `GET /properties/:id` 🔒 Auth requerido

Detalle completo de una propiedad.

**Respuesta `200`:**
```json
{
  "id": "uuid",
  "name": "Edificio Pueyrredón",
  "type": "APARTMENT",
  "status": "ACTIVE",
  "description": "...",
  "address": { "street": "...", "city": "Salta", ... },
  "propertyAmenities": [
    { "amenity": { "id": "uuid", "name": "Pileta", "category": "OUTDOOR", "icon": "pool" } }
  ],
  "propertyImages": [
    {
      "id": "uuid",
      "isPrimary": true,
      "sortOrder": 0,
      "caption": null,
      "mediaFile": { "url": "https://cdn.../properties/uuid/foto.jpg" }
    }
  ],
  "_count": { "units": 5 },
  "createdAt": "2026-01-01T00:00:00Z"
}
```

---

### `PATCH /properties/:id` 🔒 ADMIN | OPERATOR

Edita una propiedad existente. Todos los campos son opcionales.

**Body:** mismos campos que `POST /properties`

**Respuesta `200`:** objeto `Property` actualizado

---

### `DELETE /properties/:id` 🔒 ADMIN

Soft delete de la propiedad (queda como `INACTIVE` con `deletedAt`).

**Respuesta `204`:** sin cuerpo

---

### `POST /properties/:id/amenities` 🔒 ADMIN | OPERATOR

Asocia un amenity del catálogo a la propiedad.

**Body:**
```json
{
  "amenityId": "uuid"
}
```

**Respuesta `201`:** registro `PropertyAmenity` creado

---

### `DELETE /properties/:id/amenities/:amenityId` 🔒 ADMIN | OPERATOR

Desasocia un amenity de la propiedad.

**Respuesta `204`:** sin cuerpo

---

### Imágenes de propiedad — Flujo en 3 pasos

**Paso 1 — Solicitar URL firmada**

`POST /properties/:id/images/presign` 🔒 ADMIN | OPERATOR

```json
{
  "filename": "foto-exterior.jpg",
  "contentType": "image/jpeg",
  "fileSize": 2048576
}
```

| `contentType` válidos | Tamaño máximo |
|-----------------------|--------------|
| `image/jpeg` `image/png` `image/webp` `image/avif` | 10 MB |

**Respuesta `201`:**
```json
{
  "uploadUrl": "https://r2.cloudflarestorage.com/...",
  "objectKey": "properties/uuid/abc123.jpg",
  "mediaFileId": "uuid",
  "expiresIn": 300
}
```

**Paso 2 — Subir archivo directo a Cloudflare R2**

```
PUT {uploadUrl}
Content-Type: image/jpeg
Body: <archivo binario>
```

> Este request va directamente a R2, **sin pasar por el backend**.

**Paso 3 — Confirmar la imagen**

`POST /properties/:id/images/confirm` 🔒 ADMIN | OPERATOR

```json
{
  "mediaFileId": "uuid",
  "isPrimary": true,
  "caption": "Vista exterior",
  "sortOrder": 0
}
```

**Respuesta `201`:**
```json
{
  "id": "uuid",
  "propertyId": "uuid",
  "mediaFileId": "uuid",
  "isPrimary": true,
  "sortOrder": 0,
  "caption": "Vista exterior"
}
```

---

### `DELETE /properties/:id/images/:imageId` 🔒 ADMIN | OPERATOR

Elimina una imagen de la propiedad (borra de R2 también).

**Respuesta `204`:** sin cuerpo

---

## Units

### `POST /units` 🔒 ADMIN | OPERATOR

Crea una unidad (depto/espacio rentable) dentro de una propiedad.

**Body:**
```json
{
  "propertyId": "uuid",
  "name": "Depto 3A",
  "description": "Departamento luminoso con vista al parque",
  "floor": 3,
  "bedrooms": 2,
  "bathrooms": 1,
  "maxOccupancy": 4,
  "sizeM2": 65,
  "status": "ACTIVE",
  "rentalModality": "TEMPORAL"
}
```

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `propertyId` | uuid | ✅ | Propiedad padre |
| `name` | string (≤100) | ✅ | Nombre de la unidad |
| `description` | string | ❌ | Descripción |
| `floor` | number | ❌ | Piso |
| `bedrooms` | number (0–20) | ✅ | Cantidad de habitaciones |
| `bathrooms` | number (0–10) | ✅ | Cantidad de baños |
| `maxOccupancy` | number (1–50) | ✅ | Máximo de huéspedes |
| `sizeM2` | number \| string | ❌ | Metros cuadrados. Acepta `65` o `"65"` |
| `status` | enum | ❌ | `DRAFT` `ACTIVE` `INACTIVE` `HIDDEN` `MAINTENANCE` (default: `DRAFT`) |
| `rentalModality` | enum | ❌ | `FLEX` `TEMPORAL` — tipo de alquiler de la unidad |

**Respuesta `201`:** objeto `Unit` creado

---

### `GET /units` 🔒 Auth requerido

Lista unidades con filtros.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `page` | number | Default: 1 |
| `limit` | number | Default: 20 |
| `propertyId` | uuid | Filtrar por propiedad |
| `status` | enum | `DRAFT` `ACTIVE` `INACTIVE` `HIDDEN` `MAINTENANCE` |
| `rentalModality` | enum | `FLEX` `TEMPORAL` — filtrar por tipo de alquiler |

**Respuesta `200`:**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Depto 3A",
      "status": "ACTIVE",
      "rentalModality": "TEMPORAL",
      "floor": 3,
      "bedrooms": 2,
      "bathrooms": 1,
      "maxOccupancy": 4,
      "sizeM2": "65",
      "property": {
        "id": "uuid",
        "name": "Edificio Pueyrredón",
        "address": {
          "city": "Salta",
          "state": "Salta",
          "country": "Argentina",
          "latitude": -24.7821,
          "longitude": -65.4232
        }
      },
      "unitImages": [
        { "isPrimary": true, "mediaFile": { "url": "https://cdn.../units/uuid/foto.jpg" } }
      ]
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 20
}
```

> En la lista solo se devuelve la **imagen primaria**. Para todas las imágenes usar `GET /units/:id`.

---

### `GET /units/:id` 🔒 Auth requerido

Detalle completo de una unidad.

**Respuesta `200`:**
```json
{
  "id": "uuid",
  "name": "Depto 3A",
  "status": "ACTIVE",
  "rentalModality": "TEMPORAL",
  "floor": 3,
  "bedrooms": 2,
  "bathrooms": 1,
  "maxOccupancy": 4,
  "sizeM2": "65",
  "property": {
    "id": "uuid",
    "name": "Edificio Pueyrredón",
    "address": {
      "street": "Av. Pueyrredón",
      "city": "Salta",
      "state": "Salta",
      "country": "Argentina",
      "latitude": -24.7821,
      "longitude": -65.4232
    }
  },
  "unitAmenities": [
    { "amenity": { "id": "uuid", "name": "Smart TV", "category": "ENTERTAINMENT" } }
  ],
  "unitImages": [
    { "id": "uuid", "isPrimary": true, "mediaFile": { "url": "https://cdn...jpg" } }
  ],
  "pricingRules": [ ... ],
  "createdAt": "2026-01-01T00:00:00Z"
}
```

---

### `PATCH /units/:id` 🔒 ADMIN | OPERATOR

Edita una unidad. Todos los campos son opcionales.

**Body:** mismos campos que `POST /units`, todos opcionales.

```json
{
  "status": "ACTIVE"
}
```

Status válidos: `DRAFT` `ACTIVE` `INACTIVE` `HIDDEN` `MAINTENANCE`

---

### `DELETE /units/:id` 🔒 ADMIN

Soft delete de la unidad.

**Respuesta `204`:** sin cuerpo

---

### `GET /units/:id/availability` 🔒 Auth requerido

Consulta el calendario de disponibilidad de una unidad.

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| `from` | `YYYY-MM-DD` | Fecha inicio del rango |
| `to` | `YYYY-MM-DD` | Fecha fin del rango |

**Respuesta `200`:** array de `UnitAvailability`
```json
[
  {
    "id": "uuid",
    "startDate": "2026-05-01",
    "endDate": "2026-05-10",
    "isAvailable": false,
    "reason": "BOOKED"
  }
]
```

---

### `POST /units/:id/availability` 🔒 ADMIN | OPERATOR

Bloquea o libera un rango de fechas.

**Body:**
```json
{
  "startDate": "2026-05-01",
  "endDate": "2026-05-10",
  "isAvailable": false,
  "reason": "BLOCKED"
}
```

| `reason` valores | Descripción |
|-----------------|-------------|
| `BLOCKED` | Bloqueado manualmente |
| `BOOKED` | Reservado |
| `MAINTENANCE` | En mantenimiento |

---

### `GET /units/:id/rates` 🔒 Auth requerido

Obtiene las reglas de precio de la unidad.

**Respuesta `200`:** array de `PricingRule`
```json
[
  {
    "id": "uuid",
    "name": "Tarifa estándar",
    "baseRate": "1500.00",
    "currency": "ARS",
    "rateType": "NIGHTLY",
    "minNights": 2,
    "maxNights": null,
    "isDefault": true,
    "startDate": null,
    "endDate": null
  }
]
```

---

### `PUT /units/:id/rates` 🔒 ADMIN | OPERATOR

Reemplaza todas las reglas de precio de la unidad.

**Body:**
```json
{
  "rules": [
    {
      "name": "Tarifa estándar",
      "baseRate": 1500,
      "currency": "ARS",
      "rateType": "NIGHTLY",
      "minNights": 2,
      "maxNights": null,
      "isDefault": true,
      "startDate": null,
      "endDate": null
    },
    {
      "name": "Tarifa temporada alta",
      "baseRate": 2000,
      "rateType": "NIGHTLY",
      "minNights": 3,
      "isDefault": false,
      "startDate": "2026-12-15",
      "endDate": "2027-01-15"
    }
  ]
}
```

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `baseRate` | number | ✅ | Precio base |
| `rateType` | enum | ✅ | `NIGHTLY` `WEEKLY` `MONTHLY` |
| `minNights` | number | ✅ | Mínimo de noches |
| `isDefault` | boolean | ✅ | Si es la tarifa por defecto |
| `name` | string | ❌ | Nombre descriptivo |
| `currency` | string | ❌ | Default: ARS |
| `maxNights` | number | ❌ | Máximo de noches |
| `startDate` / `endDate` | `YYYY-MM-DD` | ❌ | Vigencia de la tarifa |

---

### `POST /units/:id/amenities` 🔒 ADMIN | OPERATOR

Asocia un amenity a la unidad.

**Body:** `{ "amenityId": "uuid" }`

---

### `DELETE /units/:id/amenities/:amenityId` 🔒 ADMIN | OPERATOR

Desasocia un amenity de la unidad.

**Respuesta `204`:** sin cuerpo

---

### Imágenes de unidad — mismo flujo 3 pasos que propiedad

```
POST /units/:id/images/presign   → obtener uploadUrl + mediaFileId
PUT {uploadUrl}                  → subir directo a R2
POST /units/:id/images/confirm   → confirmar imagen
DELETE /units/:id/images/:imageId → eliminar imagen
```

Los bodies son idénticos a los de propiedad.

---

## Amenities

Catálogo global de amenities reutilizable en propiedades y unidades.

### `GET /amenities` 🔒 Auth requerido

Lista todos los amenities del catálogo.

**Respuesta `200`:**
```json
[
  {
    "id": "uuid",
    "name": "Pileta",
    "category": "OUTDOOR",
    "icon": "pool"
  }
]
```

Categorías: `GENERAL` `KITCHEN` `BATHROOM` `BEDROOM` `ENTERTAINMENT` `SAFETY` `ACCESSIBILITY` `OUTDOOR` `OTHER`

---

### `POST /amenities` 🔒 ADMIN

Crea un nuevo amenity en el catálogo.

**Body:**
```json
{
  "name": "Pileta",
  "category": "OUTDOOR",
  "icon": "pool"
}
```

---

### `PATCH /amenities/:id` 🔒 ADMIN

Edita un amenity. Todos los campos son opcionales.

---

### `DELETE /amenities/:id` 🔒 ADMIN

Elimina un amenity del catálogo.

**Respuesta `204`:** sin cuerpo

---

## Professionals / Embajadores

Los embajadores son usuarios con un `ProfessionalProfile` que solicitaron verificación.

### `GET /professionals/me` 🔒 Auth requerido

Devuelve el perfil profesional del usuario autenticado.

**Respuesta `200`:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "+5493874000000",
  "avatarUrl": "https://cdn.../professionals/uuid/avatar.jpg",
  "bio": "Asesor con 10 años de experiencia",
  "licenseNumber": "MAT-12345",
  "defaultCommissionRate": "5.00",
  "isVerified": false,
  "status": "PENDING",
  "ambassadorRequestedAt": "2026-04-01T00:00:00Z",
  "user": { "email": "juan@ejemplo.com" },
  "companyMemberships": [ ... ]
}
```

---

### `PATCH /professionals/me` 🔒 Auth requerido

Edita el propio perfil profesional.

**Body (todos opcionales):**
```json
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "+5493874000000",
  "bio": "Asesor con 10 años de experiencia",
  "licenseNumber": "MAT-12345"
}
```

---

### `POST /professionals/me/request-ambassador` 🔒 Auth requerido

Solicita convertirse en embajador. Solo puede hacerse una vez.

**Respuesta `201`:** perfil actualizado con `status: PENDING` y `ambassadorRequestedAt` seteado

**Errores:**
- `409` — Ya es embajador activo o ya hay solicitud pendiente

---

### Subir avatar propio — Flujo 3 pasos

```
POST /professionals/me/avatar/presign   → obtener uploadUrl + mediaFileId
PUT {uploadUrl}                         → subir directo a R2
POST /professionals/me/avatar/confirm   → confirmar, actualiza avatarUrl en el perfil
```

**Body presign:** `{ "filename": "foto.jpg", "contentType": "image/jpeg", "fileSize": 1024000 }`

**Body confirm:** `{ "mediaFileId": "uuid" }`

**Respuesta confirm `201`:** `{ "avatarUrl": "https://cdn.../professionals/uuid/foto.jpg" }`

---

### `GET /professionals` 🔒 ADMIN | OPERATOR

Lista todos los perfiles profesionales.

**Query params:**
| Param | Tipo | Default |
|-------|------|---------|
| `page` | number | 1 |
| `limit` | number | 20 |

> Para filtrar solo solicitudes pendientes de embajador, filtrar del lado frontend por `ambassadorRequestedAt != null && status == "PENDING"`.

**Respuesta `200`:**
```json
{
  "items": [
    {
      "id": "uuid",
      "firstName": "Juan",
      "lastName": "Pérez",
      "avatarUrl": "https://cdn...",
      "status": "PENDING",
      "isVerified": false,
      "ambassadorRequestedAt": "2026-04-01T00:00:00Z",
      "user": { "email": "juan@ejemplo.com", "isActive": true }
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 20
}
```

---

### `GET /professionals/:id` 🔒 ADMIN | OPERATOR

Detalle de un perfil profesional.

---

### `PATCH /professionals/:id` 🔒 ADMIN

Edita el perfil de cualquier profesional (incluye campos admin).

**Body (todos opcionales):**
```json
{
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "+5493874000000",
  "bio": "...",
  "licenseNumber": "MAT-12345",
  "defaultCommissionRate": "7.50",
  "status": "ACTIVE"
}
```

Status válidos: `PENDING` `ACTIVE` `REJECTED` `SUSPENDED`

---

### `POST /professionals/:id/verify` 🔒 ADMIN

Aprueba la solicitud de embajador. Asigna rol `AMBASSADOR`, pone `isVerified=true` y `status=ACTIVE`.

**Respuesta `201`:** `{ "message": "Ambassador approved" }`

---

### `POST /professionals/:id/reject` 🔒 ADMIN

Rechaza la solicitud. Pone `status=REJECTED` y limpia `ambassadorRequestedAt`.

**Respuesta `201`:** perfil actualizado

---

### `POST /professionals/:id/suspend` 🔒 ADMIN

Suspende a un embajador activo.

**Respuesta `201`:** perfil actualizado con `status=SUSPENDED`

---

### Subir avatar de un profesional (admin) — Flujo 3 pasos

```
POST /professionals/:id/avatar/presign   🔒 ADMIN | OPERATOR
PUT {uploadUrl}                          → subir directo a R2
POST /professionals/:id/avatar/confirm   🔒 ADMIN | OPERATOR
```

Los bodies son idénticos al avatar propio.

---

## Leads

Un lead es una consulta/interés de un cliente en una unidad. Puede convertirse en reserva (`Booking`).

### `POST /leads` 🔒 ADMIN | OPERATOR | AMBASSADOR

Crea un nuevo lead.

**Body:**
```json
{
  "unitId": "uuid",
  "clientName": "María García",
  "clientEmail": "maria@ejemplo.com",
  "clientPhone": "+5493874111111",
  "checkInDate": "2026-06-01",
  "checkOutDate": "2026-06-07",
  "adults": 2,
  "children": 1,
  "notes": "Prefiere piso alto",
  "source": "Instagram"
}
```

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `clientName` | string (≤200) | ✅ | Nombre del cliente |
| `unitId` | uuid | ❌ | Unidad de interés |
| `clientEmail` | string | ❌ | Email del cliente |
| `clientPhone` | string (≤30) | ❌ | Teléfono del cliente |
| `checkInDate` | `YYYY-MM-DD` | ❌ | Fecha de entrada |
| `checkOutDate` | `YYYY-MM-DD` | ❌ | Fecha de salida |
| `adults` | number | ✅ | Adultos |
| `children` | number | ❌ | Niños |
| `notes` | string | ❌ | Notas internas |
| `source` | string (≤100) | ❌ | Origen del lead (Instagram, WhatsApp, etc.) |

**Respuesta `201`:** objeto `Lead` creado

---

### `GET /leads` 🔒 Auth requerido

Lista leads. Los `ADMIN`/`OPERATOR` ven todos. Los ambassadors ven solo los suyos.

**Query params:** `page` (default 1), `limit` (default 20)

**Respuesta `200`:**
```json
{
  "items": [
    {
      "id": "uuid",
      "clientName": "María García",
      "status": "NEW",
      "checkInDate": "2026-06-01",
      "checkOutDate": "2026-06-07",
      "adults": 2,
      "source": "Instagram",
      "unit": { "id": "uuid", "name": "Depto 3A" },
      "createdAt": "2026-04-17T00:00:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

Status posibles: `NEW` `CONTACTED` `QUALIFIED` `PROPOSAL_SENT` `NEGOTIATING` `WON` `LOST` `CANCELLED`

---

### `GET /leads/:id` 🔒 Auth requerido

Detalle completo de un lead, incluye notas.

---

### `PATCH /leads/:id` 🔒 Auth requerido

Edita un lead. Todos los campos opcionales.

**Body:** mismos campos que `POST /leads` + `status`

```json
{
  "status": "CONTACTED",
  "notes": "Llamado el 17/04"
}
```

---

### `DELETE /leads/:id` 🔒 ADMIN

Soft delete del lead.

**Respuesta `204`:** sin cuerpo

---

### `POST /leads/:id/notes` 🔒 Auth requerido

Agrega una nota interna al lead.

**Body:**
```json
{
  "message": "Cliente confirmó interés. Enviamos propuesta."
}
```

**Respuesta `201`:** objeto `LeadNote` creado

---

### `POST /leads/:id/convert-to-booking` 🔒 Auth requerido

Convierte el lead en una reserva confirmada (`Booking`).

**Body:**
```json
{
  "unitId": "uuid",
  "checkInDate": "2026-06-01",
  "checkOutDate": "2026-06-07",
  "baseAmount": 9000,
  "totalAmount": 9000,
  "currency": "ARS",
  "notes": "Pago confirmado"
}
```

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `unitId` | uuid | ✅ | Unidad a reservar |
| `checkInDate` | `YYYY-MM-DD` | ✅ | Fecha de entrada |
| `checkOutDate` | `YYYY-MM-DD` | ✅ | Fecha de salida |
| `baseAmount` | number | ✅ | Monto base |
| `totalAmount` | number | ✅ | Monto total |
| `currency` | string | ❌ | Default: ARS |
| `notes` | string | ❌ | Notas de la reserva |

**Respuesta `201`:** objeto `Booking` creado

---

## Bookings

### `GET /bookings/:id` 🔒 Auth requerido

Detalle de una reserva.

**Respuesta `200`:**
```json
{
  "id": "uuid",
  "checkInDate": "2026-06-01",
  "checkOutDate": "2026-06-07",
  "baseAmount": "9000.00",
  "totalAmount": "9000.00",
  "currency": "ARS",
  "status": "CONFIRMED",
  "unit": { "id": "uuid", "name": "Depto 3A" },
  "lead": { "id": "uuid", "clientName": "María García" },
  "createdAt": "2026-04-17T00:00:00Z"
}
```

---

## Commissions

### `GET /commissions` 🔒 Auth requerido

Lista todas las comisiones del sistema.

**Respuesta `200`:** array de `Commission`

---

## Admin

### `GET /admin/stats` 🔒 ADMIN

Estadísticas generales del dashboard.

**Respuesta `200`:**
```json
{
  "totalUsers": 150,
  "totalProperties": 25,
  "pendingAmbassadors": 3,
  "activeAmbassadors": 12,
  "totalLeads": 89,
  "newLeads": 7
}
```

---

## Códigos de error comunes

| Código | Significado |
|--------|-------------|
| `400` | Body inválido / campo con valor incorrecto |
| `401` | No autenticado o token expirado |
| `403` | Sin permisos suficientes (rol incorrecto) |
| `404` | Recurso no encontrado |
| `409` | Conflicto (ej: email ya registrado) |
| `429` | Rate limit excedido |

**Formato de error:**
```json
{
  "statusCode": 400,
  "message": ["campo debe ser un UUID válido"],
  "timestamp": "2026-04-17T17:33:12.051Z",
  "path": "/api/v1/properties"
}
```

---

## Flujo de imágenes (resumen)

Aplica igual para propiedades, unidades y avatares de profesionales.

```
Frontend                       Backend                    Cloudflare R2
   |                              |                              |
   |-- POST .../presign --------> |                              |
   |                              |-- genera signed PUT URL ---> |
   |<-- { uploadUrl, mediaFileId }|                              |
   |                              |                              |
   |-- PUT {uploadUrl} ---------------------------------------->|
   |<-- 200 OK --------------------------------------------------|
   |                              |                              |
   |-- POST .../confirm --------> |                              |
   |                              |-- verifica que existe -----> |
   |                              |<-- HeadObject 200 ----------|
   |<-- { url / image object } ---|                              |
```

> El archivo nunca pasa por el backend. Esto reduce latencia y costo.
