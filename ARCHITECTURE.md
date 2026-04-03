# DeptoFlex Backend — Arquitectura

> API REST construida con **NestJS 11** + **Prisma** + **PostgreSQL**, orientada a la gestión de propiedades de alquiler temporal.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | NestJS 11 (Node.js + TypeScript) |
| ORM | Prisma 5 |
| Base de datos | PostgreSQL |
| Autenticación | JWT (access token 15m + refresh token 7d) + Passport |
| Almacenamiento de archivos | Cloudflare R2 (compatible S3) |
| Hashing de contraseñas | Argon2 |
| Rate limiting | `@nestjs/throttler` |
| Tareas programadas | `@nestjs/schedule` |
| Health check | `@nestjs/terminus` |
| Validación de DTOs | `class-validator` + `class-transformer` |
| Seguridad HTTP | Helmet + Compression + CORS |

---

## Estructura de carpetas

```
src/
├── app.module.ts          # Raíz — registra todos los módulos
├── main.ts                # Bootstrap, middlewares globales
├── config/                # Configuración tipada por namespace
│   ├── app.config.ts
│   ├── auth.config.ts
│   ├── r2.config.ts
│   └── validation.schema.ts
├── common/                # Utilidades transversales
│   ├── decorators/        # @CurrentUser, @Public, @Roles
│   ├── filters/           # HttpExceptionFilter
│   ├── guards/            # JwtAuthGuard, RolesGuard
│   └── interceptors/      # TransformInterceptor, ClassSerializerInterceptor
└── modules/               # Módulos de dominio
    ├── prisma/            # Singleton del cliente Prisma
    ├── r2/                # Servicio de almacenamiento R2
    ├── auth/
    ├── users/
    ├── roles/
    ├── professionals/
    ├── properties/
    ├── units/
    ├── amenities/
    ├── leads/
    ├── bookings/
    ├── commissions/
    ├── media/
    └── health/
```

---

## Módulos y responsabilidades

### Infraestructura

| Módulo | Descripción |
|---|---|
| `PrismaModule` | Provee `PrismaService` (singleton), exportado globalmente |
| `R2Module` | Wrapper del cliente `@aws-sdk/client-s3` para Cloudflare R2 |
| `HealthModule` | Endpoint de health check vía `@nestjs/terminus` |

### Dominio

| Módulo | Descripción |
|---|---|
| `AuthModule` | Registro, login, refresh token, logout, verificación de email, reset de contraseña |
| `UsersModule` | CRUD de usuarios, asignación de roles, soft delete |
| `RolesModule` | Catálogo de roles del sistema |
| `ProfessionalsModule` | Perfiles de profesionales/embajadores, verificación, suspensión |
| `PropertiesModule` | CRUD de propiedades, amenities, imágenes |
| `UnitsModule` | CRUD de unidades por propiedad, disponibilidad, tarifas, amenities, imágenes |
| `AmenitiesModule` | Catálogo de amenities reutilizables |
| `LeadsModule` | Gestión de leads, notas, conversión a reservas |
| `BookingsModule` | Consulta de reservas por ID |
| `CommissionsModule` | Consulta de comisiones |
| `MediaModule` | Generación de presigned URLs y confirmación de subidas a R2 |

---

## Guardias y seguridad globales

Los siguientes guardias se aplican **a todas las rutas** vía `APP_GUARD`:

- **`JwtAuthGuard`** — Verifica el JWT en el header `Authorization: Bearer <token>`. Las rutas marcadas con `@Public()` quedan exentas.
- **`RolesGuard`** — Verifica que el usuario tenga el rol requerido. Las rutas marcadas con `@Roles(...)` lo activan.

Roles disponibles: `ADMIN`, `OPERATOR`, `PROFESSIONAL`, `AMBASSADOR`.

---

## Interceptores y filtros globales

| Clase | Función |
|---|---|
| `ClassSerializerInterceptor` | Excluye campos marcados con `@Exclude()` en las respuestas |
| `TransformInterceptor` | Envuelve todas las respuestas en un formato estándar `{ data, ... }` |
| `HttpExceptionFilter` | Normaliza errores HTTP en un formato JSON consistente |

---

## Rate limiting

Configurado con dos perfiles en `ThrottlerModule`:

| Perfil | TTL | Límite |
|---|---|---|
| `global` | 60s | 100 req |
| `auth` | 60s | 5 req (login/register) / 3 req (forgot-password) |

---

## Endpoints

Prefijo global: **`/api/v1`**

### Auth — `/api/v1/auth`

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `POST` | `/register` | 🔓 Public | Crea un nuevo usuario |
| `POST` | `/login` | 🔓 Public | Inicia sesión, retorna access + refresh token |
| `POST` | `/refresh` | 🔓 Public | Renueva el access token con el refresh token |
| `POST` | `/logout` | 🔒 JWT | Invalida el refresh token |
| `POST` | `/verify-email` | 🔓 Public | Verifica el email con token OTP |
| `POST` | `/forgot-password` | 🔓 Public | Solicita reset de contraseña |
| `POST` | `/reset-password` | 🔓 Public | Establece nueva contraseña |
| `GET` | `/me` | 🔒 JWT | Retorna el perfil del usuario autenticado |

### Users — `/api/v1/users`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/me` | JWT | Perfil propio |
| `PATCH` | `/me` | JWT | Actualiza perfil propio |
| `GET` | `/` | ADMIN, OPERATOR | Lista todos los usuarios (paginado) |
| `GET` | `/:id` | ADMIN, OPERATOR | Obtiene usuario por ID |
| `PATCH` | `/:id` | ADMIN | Actualiza usuario |
| `DELETE` | `/:id` | ADMIN | Soft delete de usuario |
| `POST` | `/:id/roles` | ADMIN | Asigna un rol al usuario |
| `DELETE` | `/:id/roles/:roleId` | ADMIN | Elimina un rol del usuario |

### Professionals — `/api/v1/professionals`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/me` | JWT | Perfil profesional propio |
| `PATCH` | `/me` | JWT | Actualiza perfil profesional propio |
| `GET` | `/` | ADMIN, OPERATOR | Lista todos los perfiles |
| `GET` | `/:id` | ADMIN, OPERATOR | Obtiene perfil por ID |
| `PATCH` | `/:id` | ADMIN | Actualización administrativa |
| `POST` | `/:id/verify` | ADMIN | Verifica al profesional |
| `POST` | `/:id/suspend` | ADMIN | Suspende al profesional |

### Properties — `/api/v1/properties`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `POST` | `/` | ADMIN, OPERATOR | Crea propiedad |
| `GET` | `/` | JWT | Lista propiedades (filtrable) |
| `GET` | `/:id` | JWT | Obtiene propiedad |
| `PATCH` | `/:id` | ADMIN, OPERATOR | Actualiza propiedad |
| `DELETE` | `/:id` | ADMIN | Soft delete |
| `POST` | `/:id/amenities` | ADMIN, OPERATOR | Agrega amenity |
| `DELETE` | `/:id/amenities/:amenityId` | ADMIN, OPERATOR | Elimina amenity |
| `POST` | `/:id/images/presign` | ADMIN, OPERATOR | Genera URL firmada para subir imagen |
| `POST` | `/:id/images/confirm` | ADMIN, OPERATOR | Confirma upload y registra imagen |
| `DELETE` | `/:id/images/:imageId` | ADMIN, OPERATOR | Elimina imagen |

### Units — `/api/v1/units`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `POST` | `/` | ADMIN, OPERATOR | Crea unidad |
| `GET` | `/` | JWT | Lista unidades (filtrable por propiedad/estado) |
| `GET` | `/:id` | JWT | Obtiene unidad |
| `PATCH` | `/:id` | ADMIN, OPERATOR | Actualiza unidad |
| `DELETE` | `/:id` | ADMIN | Soft delete |
| `GET` | `/:id/availability` | JWT | Disponibilidad de la unidad |
| `POST` | `/:id/availability` | ADMIN, OPERATOR | Establece disponibilidad |
| `GET` | `/:id/rates` | JWT | Tarifas de la unidad |
| `PUT` | `/:id/rates` | ADMIN, OPERATOR | Configura reglas de tarifas |
| `POST` | `/:id/amenities` | ADMIN, OPERATOR | Agrega amenity |
| `DELETE` | `/:id/amenities/:amenityId` | ADMIN, OPERATOR | Elimina amenity |
| `POST` | `/:id/images/presign` | ADMIN, OPERATOR | URL firmada para imagen |
| `POST` | `/:id/images/confirm` | ADMIN, OPERATOR | Confirma upload de imagen |
| `DELETE` | `/:id/images/:imageId` | ADMIN, OPERATOR | Elimina imagen |

### Amenities — `/api/v1/amenities`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/` | JWT | Lista todos los amenities |
| `POST` | `/` | ADMIN | Crea amenity |
| `PATCH` | `/:id` | ADMIN | Actualiza amenity |
| `DELETE` | `/:id` | ADMIN | Elimina amenity |

### Leads — `/api/v1/leads`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `POST` | `/` | ADMIN, OPERATOR, PROFESSIONAL, AMBASSADOR | Crea lead |
| `GET` | `/` | JWT | Lista leads (scope según rol) |
| `GET` | `/:id` | JWT | Obtiene lead |
| `PATCH` | `/:id` | JWT | Actualiza lead |
| `DELETE` | `/:id` | ADMIN | Soft delete |
| `POST` | `/:id/notes` | JWT | Agrega nota al lead |
| `POST` | `/:id/convert-to-booking` | JWT | Convierte lead en reserva |

### Bookings — `/api/v1/bookings`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/:id` | JWT | Obtiene reserva por ID |

### Commissions — `/api/v1/commissions`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/` | JWT | Lista comisiones |

### Health — `/api/v1/health`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del servicio y conectividad DB |

---

## Variables de entorno requeridas

Todas las variables son validadas al iniciar con **Joi**. Si alguna requerida falta, la app no arranca.

| Variable | Requerida | Default | Descripción |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Entorno (`development`, `production`, `test`) |
| `PORT` | No | `3000` | Puerto del servidor |
| `DATABASE_URL` | **Sí** | — | Connection string de PostgreSQL (Prisma) |
| `JWT_SECRET` | **Sí** | — | Secreto JWT (mínimo 32 caracteres) |
| `JWT_EXPIRES_IN` | No | `15m` | Duración del access token |
| `REFRESH_TOKEN_EXPIRES_DAYS` | No | `7` | Días de validez del refresh token |
| `R2_ENDPOINT` | **Sí** | — | URL del endpoint de Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | **Sí** | — | Access Key ID de R2 |
| `R2_SECRET_ACCESS_KEY` | **Sí** | — | Secret Access Key de R2 |
| `R2_BUCKET` | **Sí** | — | Nombre del bucket R2 |
| `R2_PUBLIC_BASE_URL` | **Sí** | — | URL pública base para los archivos en R2 |
| `APP_ALLOWED_ORIGINS` | No | `http://localhost:3001` | Orígenes CORS permitidos (separados por coma) |

### Ejemplo de `.env`

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/deptoflex
JWT_SECRET=un-secreto-muy-largo-de-al-menos-32-caracteres
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET=deptoflex-media
R2_PUBLIC_BASE_URL=https://media.yourdomain.com
APP_ALLOWED_ORIGINS=http://localhost:3001,https://app.deptoflex.com
```

---

## Comandos útiles

```bash
# Desarrollo con hot-reload
npm run start:dev

# Compilar para producción
npm run build

# Iniciar en producción
npm run start:prod

# Migraciones Prisma
npx prisma migrate dev --name <nombre>
npx prisma migrate deploy      # producción

# Generar cliente Prisma
npx prisma generate

# Ver DB en Prisma Studio
npx prisma studio

# Tests
npm run test
npm run test:e2e
npm run test:cov
```

---

## Flujo de autenticación

```
Cliente
  │
  ├─► POST /auth/login  ──► { accessToken (15m), refreshToken (7d) }
  │
  ├─► Peticiones protegidas: Authorization: Bearer <accessToken>
  │
  ├─► POST /auth/refresh  (con refreshToken)  ──► nuevo accessToken
  │
  └─► POST /auth/logout  (invalida refreshToken en DB)
```

## Flujo de subida de imágenes (R2)

```
Cliente
  │
  ├─► POST /properties/:id/images/presign  ──► { uploadUrl, key }
  │        (URL firmada de S3 válida por tiempo limitado)
  │
  ├─► PUT <uploadUrl>  (subida directa del archivo a R2)
  │
  └─► POST /properties/:id/images/confirm  (con { key })
           Registra la imagen en la DB y retorna la URL pública
```
