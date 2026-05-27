# PropertyFlex — Implementación

## Contexto

El modelo de datos fue actualizado para soportar dos tipos de alquiler de forma independiente:

| Modalidad | Gestión | Descripción |
|-----------|---------|-------------|
| **TEMPORAL** | Cloudbeds (PMS externo) | Noches/semanas; disponibilidad consultada vía API de Cloudbeds usando `cloudbedsWidgetPropertyId` en `Property` |
| **FLEX** | Esta app (in-app) | Mensualizado; cada propiedad flex es su propia unidad independiente con dirección, precio y disponibilidad propios |

---

## Decisión de diseño

### ¿Por qué `PropertyFlex` es una entidad separada y no una `Unit`?

La entidad `Unit` existe para representar habitaciones/dptos. dentro de un edificio/complejo (`Property`). En FLEX, cada propiedad (dpto., monoambiente, casa) es **auto-contenida**: tiene su propia dirección, precio, fotos e identidad completa. Dos monoambientes en el mismo edificio son dos `PropertyFlex` distintas.

Por esto, `PropertyFlex` combina atributos de `Property` (dirección, tipo, imágenes, amenities) y de `Unit` (habitaciones, baños, ocupación, tamaño) en una única entidad plana.

La tabla `units` **no fue modificada** (reservada para temporales con Cloudbeds).

---

## Modelos de datos nuevos

### `PropertyFlex` → tabla `property_flex`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK |
| `companyId` | UUID? | FK a `company_profiles` |
| `name` | varchar(200) | Nombre de la propiedad |
| `description` | text? | Descripción libre |
| `type` | enum `PropertyType` | APARTMENT / HOUSE / STUDIO / OFFICE / OTHER |
| `status` | enum `PropertyStatus` | DRAFT / ACTIVE / INACTIVE / HIDDEN |
| `floor` | smallint? | Piso |
| `bedrooms` | smallint | Dormitorios |
| `bathrooms` | smallint | Baños |
| `maxOccupancy` | smallint | Máx. personas |
| `sizeM2` | decimal(8,2)? | Superficie en m² |
| `monthlyRate` | decimal(10,2) | Precio mensual |
| `currency` | varchar(3) | Moneda (default ARS) |
| `minMonths` | smallint | Mínimo de meses (default 1) |
| `maxMonths` | smallint? | Máximo de meses |
| `depositAmount` | decimal(10,2)? | Depósito requerido |
| `createdAt/updatedAt/deletedAt` | timestamptz | Timestamps + soft delete |

**Relaciones:**
- `address` → `PropertyFlexAddress` (1:1, cascade delete)
- `images` → `PropertyFlexImage[]`
- `amenities` → `PropertyFlexAmenity[]` (junction con `Amenity`)
- `bookings` → `FlexBooking[]`
- `company` → `CompanyProfile`

### `PropertyFlexAddress` → tabla `property_flex_addresses`
Misma estructura que `PropertyAddress`: calle, número, piso, ciudad, estado, país, lat/lon.

### `PropertyFlexImage` → tabla `property_flex_images`
Misma estructura que `PropertyImage`: mediaFileId, isPrimary, caption, sortOrder.

### `PropertyFlexAmenity` → tabla `property_flex_amenities`
Junction table `(propertyFlexId, amenityId)`. Reutiliza los mismos `Amenity` del catálogo.

### `FlexBooking` → tabla `flex_bookings`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK |
| `propertyFlexId` | UUID | FK a `property_flex` |
| `professionalProfileId` | UUID? | FK a `professional_profiles` |
| `clientName` | varchar(200) | Nombre del cliente |
| `clientEmail` | varchar(255)? | Email |
| `clientPhone` | varchar(30)? | Teléfono |
| `startDate` | date | Inicio del contrato |
| `endDate` | date | Fin del contrato |
| `totalMonths` | smallint | Cantidad de meses |
| `monthlyAmount` | decimal(10,2) | Monto mensual acordado |
| `totalAmount` | decimal(10,2) | Monto total |
| `depositAmount` | decimal(10,2)? | Depósito |
| `currency` | varchar(3) | Moneda |
| `status` | enum `FlexBookingStatus` | PENDING / CONFIRMED / CANCELLED / COMPLETED |
| `notes` | text? | Notas internas |
| `createdAt/updatedAt/deletedAt` | timestamptz | Timestamps + soft delete |

**Enum `FlexBookingStatus`:** `PENDING | CONFIRMED | CANCELLED | COMPLETED`

---

## Nuevas tablas modificadas en modelos existentes

| Modelo | Cambio |
|--------|--------|
| `CompanyProfile` | +relación `propertyFlex PropertyFlex[]` |
| `Amenity` | +relación `propertyFlexAmenities PropertyFlexAmenity[]` |
| `MediaFile` | +relación `propertyFlexImages PropertyFlexImage[]` |
| `ProfessionalProfile` | +relación `flexBookings FlexBooking[]` |

---

## API Endpoints

### Property Flex — `/property-flex`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/property-flex` | ADMIN, OPERATOR | Crear propiedad flex |
| `GET` | `/property-flex` | Autenticado | Listar (paginado, filtros) |
| `GET` | `/property-flex/:id` | Autenticado | Detalle |
| `PATCH` | `/property-flex/:id` | ADMIN, OPERATOR | Actualizar |
| `DELETE` | `/property-flex/:id` | ADMIN | Soft delete |
| `GET` | `/property-flex/:id/availability?startDate&endDate` | Autenticado | Consultar disponibilidad |
| `POST` | `/property-flex/:id/amenities` | ADMIN, OPERATOR | Agregar amenity |
| `DELETE` | `/property-flex/:id/amenities/:amenityId` | ADMIN, OPERATOR | Quitar amenity |
| `POST` | `/property-flex/:id/images/presign` | ADMIN, OPERATOR | Presign URL para subida |
| `POST` | `/property-flex/:id/images/confirm` | ADMIN, OPERATOR | Confirmar imagen subida |
| `DELETE` | `/property-flex/:id/images/:imageId` | ADMIN, OPERATOR | Eliminar imagen |

#### Filtros disponibles en `GET /property-flex`
- `page`, `limit` (paginación)
- `companyId` (UUID)
- `status` (PropertyStatus)
- `type` (PropertyType)
- `city` (búsqueda insensible a mayúsculas)
- `bedrooms`, `bathrooms` (número exacto)
- `maxMonthlyRate` (precio mensual máximo)

---

### Flex Bookings — `/flex-bookings`

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| `POST` | `/flex-bookings` | ADMIN, OPERATOR | Crear reserva (valida disponibilidad) |
| `GET` | `/flex-bookings` | Autenticado | Listar (paginado, filtros) |
| `GET` | `/flex-bookings/:id` | Autenticado | Detalle |
| `PATCH` | `/flex-bookings/:id` | ADMIN, OPERATOR | Cambiar status/notas |
| `DELETE` | `/flex-bookings/:id` | ADMIN | Cancelar (soft delete) |

#### Filtros disponibles en `GET /flex-bookings`
- `page`, `limit`
- `propertyFlexId` (UUID)
- `professionalProfileId` (UUID)
- `status` (PENDING / CONFIRMED / CANCELLED / COMPLETED)
- `startDateFrom`, `startDateTo` (rango de fechas de inicio)

#### Lógica de disponibilidad
Al crear una `FlexBooking`, el servicio verifica que no exista ninguna otra reserva **no cancelada** que se superponga con el período solicitado (`startDate < endDate` del conflicto Y `endDate > startDate` del conflicto). Si hay conflicto se retorna `400 Bad Request`.

El endpoint `GET /property-flex/:id/availability?startDate=&endDate=` permite consultar disponibilidad sin crear una reserva.

---

## Cómo aplicar la migración

```bash
# 1. Generar cliente de Prisma (elimina los errores de TS en el IDE)
npx prisma generate

# 2. Crear y aplicar la migración en la base de datos
npx prisma migrate dev --name property_flex_and_flex_bookings
```

> **Nota:** La tabla `units` no fue modificada. Las propiedades con `cloudbedsWidgetPropertyId` siguen funcionando igual para reservas temporales vía Cloudbeds.

---

## Flujo de imágenes (R2/S3)

Las imágenes de `PropertyFlex` siguen el mismo flujo de dos pasos que `Property` y `Unit`:

1. `POST /property-flex/:id/images/presign` → retorna `{ uploadUrl, objectKey, mediaFileId, expiresIn }`
2. Cliente sube el archivo directamente al R2 usando `uploadUrl`
3. `POST /property-flex/:id/images/confirm` → confirma la subida, registra en `property_flex_images`

Los archivos se almacenan bajo el prefijo `property-flex/{propertyFlexId}/{uuid}.{ext}`.
