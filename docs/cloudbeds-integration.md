# Integración Cloudbeds — DeptoFlex

## Resumen ejecutivo

Cloudbeds es un PMS (Property Management System) que administra disponibilidad, tarifas y reservas de propiedades hoteleras/de renta. La integración permite que DeptoFlex use los datos de Cloudbeds como fuente de verdad para disponibilidad y tarifas, mientras mantiene su propio catálogo de propiedades para el flujo comercial (leads, comisiones, embajadores).

**Modelo de relación**: cada `Property` en DeptoFlex referencia un `propertyID` de Cloudbeds, y cada `Unit` referencia un `roomTypeID` de Cloudbeds. La sincronización es **unidireccional por defecto** (Cloudbeds → DeptoFlex) para disponibilidad/tarifas, y **bidireccional** para reservas confirmadas.

---

## Arquitectura de la integración

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                   │
│  Ver propiedad → llama GET /api/v1/properties/:id/availability      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                       DEPTOFLEX BACKEND                             │
│                                                                     │
│  PropertiesController                                               │
│       │                                                             │
│       ├── CloudbedsService.getAvailability(cloudbedsPropertyId)     │
│       │         │                                                   │
│       │         └── Cloudbeds REST API (con token OAuth)            │
│       │                                                             │
│       └── (fallback) UnitAvailability local en PostgreSQL           │
│                                                                     │
│  BookingsController                                                 │
│       │                                                             │
│       └── CloudbedsService.createReservation(...)                   │
│                 │                                                   │
│                 └── POST /reservations en Cloudbeds                 │
│                                                                     │
│  CloudbedsWebhookController  ←── Webhooks de Cloudbeds              │
│       │                                                             │
│       └── Sync automático de cambios de disponibilidad/reservas     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Autenticación con la API de Cloudbeds (OAuth 2.0)

Cloudbeds usa **OAuth 2.0 Authorization Code flow**. Cada empresa (`CompanyProfile`) conecta su cuenta de Cloudbeds una vez; el token se almacena y renueva automáticamente.

### 1.1 Flujo de conexión

```
1. Admin de empresa hace clic en "Conectar Cloudbeds"
2. Backend genera URL de autorización con client_id + redirect_uri
3. Usuario es redirigido a Cloudbeds, aprueba el acceso
4. Cloudbeds redirige a /api/v1/integrations/cloudbeds/callback?code=XXX
5. Backend intercambia code por access_token + refresh_token
6. Tokens se guardan cifrados en CloudbedsConnection (tabla nueva)
```

### 1.2 Endpoints de Cloudbeds

```
Base URL: https://hotels.cloudbeds.com/api/v1.2

OAuth:
  Authorize:    GET  https://hotels.cloudbeds.com/api/v1.2/oauth2/authorize
  Token:        POST https://hotels.cloudbeds.com/api/v1.2/oauth2/token
  Refresh:      POST https://hotels.cloudbeds.com/api/v1.2/oauth2/token (grant_type=refresh_token)

Properties:
  GET /properties                           → listar propiedades del usuario
  GET /rooms?propertyID={id}                → listar rooms/room types
  GET /getAvailability?propertyID={id}&... → disponibilidad por fecha

Rates:
  GET /getRates?propertyID={id}&...         → tarifas por fecha

Reservations:
  GET  /getReservations?propertyID={id}     → listar reservas
  POST /postReservation                     → crear reserva
  PUT  /putReservation?reservationID={id}   → modificar reserva
```

---

## 2. Cambios en el modelo de datos

### 2.1 Nuevos campos en modelos existentes

```prisma
model Property {
  // ... campos existentes ...
  
  // Referencia a Cloudbeds
  cloudbedsPropertyId   String?  @unique @map("cloudbeds_property_id") @db.VarChar(100)
  cloudbedsLastSyncAt   DateTime? @map("cloudbeds_last_sync_at") @db.Timestamptz
}

model Unit {
  // ... campos existentes ...
  
  // Referencia al room type en Cloudbeds
  cloudbedsRoomTypeId   String?  @map("cloudbeds_room_type_id") @db.VarChar(100)
}
```

### 2.2 Nueva tabla: `cloudbeds_connections`

Almacena los tokens OAuth por empresa. Los tokens van **cifrados** (AES-256) en la DB.

```prisma
model CloudbedsConnection {
  id                  String    @id @default(uuid()) @db.Uuid
  companyProfileId    String    @unique @map("company_profile_id") @db.Uuid
  cloudbedsUserId     String    @map("cloudbeds_user_id") @db.VarChar(100)
  accessToken         String    @map("access_token") @db.Text     // cifrado
  refreshToken        String    @map("refresh_token") @db.Text    // cifrado
  tokenExpiresAt      DateTime  @map("token_expires_at") @db.Timestamptz
  scope               String?   @db.Text
  isActive            Boolean   @default(true) @map("is_active")
  connectedAt         DateTime  @default(now()) @map("connected_at") @db.Timestamptz
  lastUsedAt          DateTime? @map("last_used_at") @db.Timestamptz
  disconnectedAt      DateTime? @map("disconnected_at") @db.Timestamptz

  companyProfile      CompanyProfile @relation(fields: [companyProfileId], references: [id])

  @@map("cloudbeds_connections")
}
```

### 2.3 Nueva tabla: `cloudbeds_sync_logs`

Para auditoría y debugging de sincronizaciones.

```prisma
enum CloudbedsSyncStatus {
  SUCCESS
  PARTIAL
  FAILED
}

enum CloudbedsSyncType {
  AVAILABILITY
  RATES
  RESERVATIONS
  PROPERTY_MAP
}

model CloudbedsSyncLog {
  id               String              @id @default(uuid()) @db.Uuid
  companyProfileId String              @map("company_profile_id") @db.Uuid
  propertyId       String?             @map("property_id") @db.Uuid
  syncType         CloudbedsSyncType   @map("sync_type")
  status           CloudbedsSyncStatus
  recordsProcessed Int                 @default(0) @map("records_processed")
  errorMessage     String?             @map("error_message") @db.Text
  startedAt        DateTime            @default(now()) @map("started_at") @db.Timestamptz
  completedAt      DateTime?           @map("completed_at") @db.Timestamptz

  @@index([companyProfileId])
  @@index([propertyId])
  @@map("cloudbeds_sync_logs")
}
```

---

## 3. Módulo NestJS: `CloudbedsModule`

### 3.1 Estructura de archivos

```
src/modules/cloudbeds/
├── cloudbeds.module.ts
├── cloudbeds.service.ts          # lógica principal (HTTP a API de Cloudbeds)
├── cloudbeds-auth.service.ts     # OAuth flow + refresh automático
├── cloudbeds-sync.service.ts     # sincronización disponibilidad/tarifas
├── cloudbeds-webhook.service.ts  # procesamiento de webhooks entrantes
├── controllers/
│   ├── cloudbeds-oauth.controller.ts    # GET /connect, GET /callback
│   └── cloudbeds-webhook.controller.ts  # POST /webhook
└── dto/
    ├── connect-cloudbeds.dto.ts
    └── cloudbeds-availability.dto.ts
```

### 3.2 `cloudbeds-auth.service.ts` (esqueleto)

```typescript
@Injectable()
export class CloudbedsAuthService {
  private readonly CLOUDBEDS_TOKEN_URL = 'https://hotels.cloudbeds.com/api/v1.2/oauth2/token';

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,  // @nestjs/axios
    private readonly config: ConfigService,
  ) {}

  /** Genera URL de autorización para redirigir al admin */
  getAuthorizationUrl(companyProfileId: string): string {
    const params = new URLSearchParams({
      client_id: this.config.get('CLOUDBEDS_CLIENT_ID'),
      redirect_uri: this.config.get('CLOUDBEDS_REDIRECT_URI'),
      response_type: 'code',
      scope: 'read:property read:rooms read:availability read:rates write:reservations',
      state: companyProfileId, // CSRF protection + identificador de empresa
    });
    return `https://hotels.cloudbeds.com/api/v1.2/oauth2/authorize?${params}`;
  }

  /** Intercambia code por tokens y guarda en DB */
  async handleCallback(code: string, companyProfileId: string): Promise<void> {
    const response = await firstValueFrom(
      this.httpService.post(this.CLOUDBEDS_TOKEN_URL, {
        grant_type: 'authorization_code',
        client_id: this.config.get('CLOUDBEDS_CLIENT_ID'),
        client_secret: this.config.get('CLOUDBEDS_CLIENT_SECRET'),
        redirect_uri: this.config.get('CLOUDBEDS_REDIRECT_URI'),
        code,
      }),
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    await this.prisma.cloudbedsConnection.upsert({
      where: { companyProfileId },
      create: {
        companyProfileId,
        cloudbedsUserId: response.data.user_id,
        accessToken: this.encrypt(access_token),  // cifrar antes de guardar
        refreshToken: this.encrypt(refresh_token),
        tokenExpiresAt: expiresAt,
        scope: response.data.scope,
      },
      update: {
        accessToken: this.encrypt(access_token),
        refreshToken: this.encrypt(refresh_token),
        tokenExpiresAt: expiresAt,
        isActive: true,
        disconnectedAt: null,
      },
    });
  }

  /** Obtiene access token válido, renovando si está por expirar */
  async getValidAccessToken(companyProfileId: string): Promise<string> {
    const conn = await this.prisma.cloudbedsConnection.findUnique({
      where: { companyProfileId, isActive: true },
    });
    if (!conn) throw new Error('Cloudbeds not connected for this company');

    // Renovar si expira en menos de 5 minutos
    const expiresIn = conn.tokenExpiresAt.getTime() - Date.now();
    if (expiresIn < 5 * 60 * 1000) {
      return this.refreshAccessToken(conn);
    }

    await this.prisma.cloudbedsConnection.update({
      where: { id: conn.id },
      data: { lastUsedAt: new Date() },
    });

    return this.decrypt(conn.accessToken);
  }

  private async refreshAccessToken(conn: CloudbedsConnection): Promise<string> {
    const response = await firstValueFrom(
      this.httpService.post(this.CLOUDBEDS_TOKEN_URL, {
        grant_type: 'refresh_token',
        client_id: this.config.get('CLOUDBEDS_CLIENT_ID'),
        client_secret: this.config.get('CLOUDBEDS_CLIENT_SECRET'),
        refresh_token: this.decrypt(conn.refreshToken),
      }),
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    await this.prisma.cloudbedsConnection.update({
      where: { id: conn.id },
      data: {
        accessToken: this.encrypt(access_token),
        refreshToken: this.encrypt(refresh_token),
        tokenExpiresAt: expiresAt,
      },
    });

    return access_token;
  }

  private encrypt(text: string): string {
    // Usar crypto.createCipheriv con AES-256-GCM y CLOUDBEDS_ENCRYPTION_KEY del env
    // ...implementación real...
    return text; // placeholder
  }

  private decrypt(ciphertext: string): string {
    // ...implementación real...
    return ciphertext; // placeholder
  }
}
```

### 3.3 `cloudbeds.service.ts` (llamadas a la API)

```typescript
@Injectable()
export class CloudbedsService {
  private readonly BASE_URL = 'https://hotels.cloudbeds.com/api/v1.2';

  constructor(
    private readonly cloudbedsAuth: CloudbedsAuthService,
    private readonly httpService: HttpService,
  ) {}

  /** Lista propiedades disponibles en la cuenta de Cloudbeds */
  async getProperties(companyProfileId: string) {
    const token = await this.cloudbedsAuth.getValidAccessToken(companyProfileId);
    const res = await firstValueFrom(
      this.httpService.get(`${this.BASE_URL}/properties`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    return res.data.data; // array de { propertyID, propertyName, ... }
  }

  /** Lista room types de una propiedad Cloudbeds */
  async getRooms(companyProfileId: string, cloudbedsPropertyId: string) {
    const token = await this.cloudbedsAuth.getValidAccessToken(companyProfileId);
    const res = await firstValueFrom(
      this.httpService.get(`${this.BASE_URL}/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { propertyID: cloudbedsPropertyId },
      }),
    );
    return res.data.data;
  }

  /** Disponibilidad de rooms para un rango de fechas */
  async getAvailability(
    companyProfileId: string,
    cloudbedsPropertyId: string,
    startDate: string,  // YYYY-MM-DD
    endDate: string,
  ) {
    const token = await this.cloudbedsAuth.getValidAccessToken(companyProfileId);
    const res = await firstValueFrom(
      this.httpService.get(`${this.BASE_URL}/getAvailability`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          propertyID: cloudbedsPropertyId,
          startDate,
          endDate,
        },
      }),
    );
    return res.data.data;
  }

  /** Tarifas por rango de fechas */
  async getRates(
    companyProfileId: string,
    cloudbedsPropertyId: string,
    startDate: string,
    endDate: string,
  ) {
    const token = await this.cloudbedsAuth.getValidAccessToken(companyProfileId);
    const res = await firstValueFrom(
      this.httpService.get(`${this.BASE_URL}/getRates`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          propertyID: cloudbedsPropertyId,
          startDate,
          endDate,
        },
      }),
    );
    return res.data.data;
  }

  /** Crea una reserva en Cloudbeds cuando se confirma una reserva en DeptoFlex */
  async createReservation(
    companyProfileId: string,
    cloudbedsPropertyId: string,
    data: CreateCloudbedsReservationDto,
  ) {
    const token = await this.cloudbedsAuth.getValidAccessToken(companyProfileId);
    const res = await firstValueFrom(
      this.httpService.post(`${this.BASE_URL}/postReservation`, data, {
        headers: { Authorization: `Bearer ${token}` },
        params: { propertyID: cloudbedsPropertyId },
      }),
    );
    return res.data;
  }
}
```

---

## 4. Flujo: vincular una propiedad DeptoFlex con Cloudbeds

### 4.1 Pasos desde el frontend (admin de empresa)

```
1. Admin va a Configuración → Integraciones → Cloudbeds
2. Hace clic en "Conectar cuenta"
   → GET /api/v1/integrations/cloudbeds/connect?companyId=XXX
   → Backend redirige al usuario a OAuth de Cloudbeds
3. Aprueba en Cloudbeds
   → Callback a GET /api/v1/integrations/cloudbeds/callback?code=YYY&state=companyId
   → Backend guarda tokens
4. Admin va a la propiedad → Editar → sección "Integración Cloudbeds"
5. Dropdown que carga las propiedades de Cloudbeds:
   → GET /api/v1/integrations/cloudbeds/properties (usa token guardado)
6. Admin elige el propertyID de Cloudbeds correspondiente
   → PATCH /api/v1/properties/:id { cloudbedsPropertyId: "12345" }
7. Para cada unit, admin vincula el room type:
   → GET /api/v1/integrations/cloudbeds/properties/12345/rooms
   → PATCH /api/v1/units/:id { cloudbedsRoomTypeId: "ABC" }
```

### 4.2 Endpoints del controller

```typescript
// GET /api/v1/integrations/cloudbeds/connect
// Redirige al admin a OAuth de Cloudbeds
@Get('connect')
async connect(@Query('companyId') companyId: string, @Res() res: Response) {
  const url = this.cloudbedsAuth.getAuthorizationUrl(companyId);
  res.redirect(url);
}

// GET /api/v1/integrations/cloudbeds/callback
// Cloudbeds redirige aquí tras la autorización
@Get('callback')
async callback(@Query('code') code: string, @Query('state') companyId: string) {
  await this.cloudbedsAuth.handleCallback(code, companyId);
  return { message: 'Cloudbeds conectado exitosamente' };
}

// GET /api/v1/integrations/cloudbeds/properties
// Lista las propiedades disponibles en la cuenta de Cloudbeds
@Get('properties')
async listCloudbedsProperties(@CurrentCompany() companyId: string) {
  return this.cloudbedsService.getProperties(companyId);
}

// GET /api/v1/integrations/cloudbeds/properties/:cloudbedsPropertyId/rooms
// Lista room types para vincular con units de DeptoFlex
@Get('properties/:cloudbedsPropertyId/rooms')
async listCloudbedsRooms(
  @Param('cloudbedsPropertyId') cloudbedsPropertyId: string,
  @CurrentCompany() companyId: string,
) {
  return this.cloudbedsService.getRooms(companyId, cloudbedsPropertyId);
}
```

---

## 5. Flujo: disponibilidad en tiempo real

Cuando el frontend pide la disponibilidad de una propiedad:

```typescript
// En PropertiesController: GET /api/v1/properties/:id/availability
async getAvailability(
  @Param('id') propertyId: string,
  @Query('startDate') startDate: string,
  @Query('endDate') endDate: string,
) {
  const property = await this.prisma.property.findUnique({
    where: { id: propertyId },
    include: { company: true },
  });

  // Si la propiedad tiene integración con Cloudbeds, usa su disponibilidad
  if (property.cloudbedsPropertyId && property.company) {
    const conn = await this.prisma.cloudbedsConnection.findUnique({
      where: { companyProfileId: property.company.id, isActive: true },
    });
    if (conn) {
      return this.cloudbedsService.getAvailability(
        property.company.id,
        property.cloudbedsPropertyId,
        startDate,
        endDate,
      );
    }
  }

  // Fallback: disponibilidad local en PostgreSQL
  return this.unitsService.getLocalAvailability(propertyId, startDate, endDate);
}
```

---

## 6. Sincronización por Webhooks (Cloudbeds → DeptoFlex)

Cloudbeds puede enviar webhooks cuando cambia disponibilidad, se crea una reserva, etc. Registrar el webhook endpoint en el dashboard de Cloudbeds.

```typescript
// POST /api/v1/integrations/cloudbeds/webhook
@Post('webhook')
async handleWebhook(
  @Headers('X-Cloudbeds-Signature') signature: string,
  @Body() payload: any,
  @Req() req: Request,
) {
  // 1. Verificar firma HMAC-SHA256 con CLOUDBEDS_WEBHOOK_SECRET
  this.verifySignature(req.rawBody, signature);

  // 2. Procesar según tipo de evento
  switch (payload.event) {
    case 'reservation/created':
    case 'reservation/modified':
      await this.cloudbedsWebhook.syncReservation(payload.data);
      break;
    case 'availability/modified':
      await this.cloudbedsWebhook.syncAvailability(payload.data);
      break;
  }

  return { received: true };
}
```

### 6.1 Sincronización de reservas entrantes (Cloudbeds → DeptoFlex)

Cuando alguien reserva directamente en Cloudbeds (no via DeptoFlex), el webhook crea un bloqueo de disponibilidad en `UnitAvailability`:

```typescript
async syncReservation(data: any) {
  const unit = await this.prisma.unit.findFirst({
    where: { cloudbedsRoomTypeId: data.roomTypeID, deletedAt: null },
  });
  if (!unit) return;

  await this.prisma.unitAvailability.upsert({
    where: { /* índice por cloudbedsReservationId */ },
    create: {
      unitId: unit.id,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      isAvailable: false,
      reason: 'EXTERNAL_BOOKING', // añadir a enum AvailabilityReason
    },
    update: {
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    },
  });
}
```

---

## 7. Sincronización periódica (cron)

Como respaldo ante webhooks perdidos, un cron job sincroniza cada hora:

```typescript
@Cron(CronExpression.EVERY_HOUR)
async syncAllConnectedProperties() {
  const connections = await this.prisma.cloudbedsConnection.findMany({
    where: { isActive: true },
    include: { companyProfile: { include: { properties: true } } },
  });

  for (const conn of connections) {
    for (const property of conn.companyProfile.properties) {
      if (!property.cloudbedsPropertyId) continue;
      try {
        await this.cloudbedsSync.syncAvailability(
          conn.companyProfileId,
          property.id,
          property.cloudbedsPropertyId,
        );
      } catch (err) {
        this.logger.error(`Sync failed for property ${property.id}: ${err.message}`);
      }
    }
  }
}
```

---

## 8. Variables de entorno requeridas

```env
# Cloudbeds OAuth App (crear en https://hotels.cloudbeds.com/api/v1.2/docs)
CLOUDBEDS_CLIENT_ID=your_client_id
CLOUDBEDS_CLIENT_SECRET=your_client_secret
CLOUDBEDS_REDIRECT_URI=https://api.deptoflex.com/api/v1/integrations/cloudbeds/callback
CLOUDBEDS_WEBHOOK_SECRET=your_webhook_secret

# Cifrado de tokens en DB (32 bytes en hex)
CLOUDBEDS_ENCRYPTION_KEY=a1b2c3d4e5f6...
```

---

## 9. Plan de implementación por fases

| Fase | Descripción | Prioridad |
|------|-------------|-----------|
| **1** | Añadir `cloudbedsPropertyId` y `cloudbedsRoomTypeId` al schema + migración | Alta |
| **2** | Crear tabla `cloudbeds_connections` con cifrado de tokens | Alta |
| **3** | OAuth flow: `/connect` y `/callback` + guardado de tokens | Alta |
| **4** | Endpoint listado de propiedades/rooms de Cloudbeds para el frontend | Alta |
| **5** | PATCH en properties y units para vincular IDs | Alta |
| **6** | `GET /properties/:id/availability` con lógica de fallback | Alta |
| **7** | Webhook handler + verificación de firma | Media |
| **8** | Sincronización bidireccional de reservas (crear reserva en Cloudbeds al confirmar booking) | Media |
| **9** | Cron de sincronización periódica como respaldo | Baja |
| **10** | Dashboard de estado de integración + `cloudbeds_sync_logs` | Baja |

---

## 10. Consideraciones de seguridad

- **Tokens cifrados en DB**: usar AES-256-GCM con una `CLOUDBEDS_ENCRYPTION_KEY` en env, nunca en texto plano.
- **State en OAuth**: el parámetro `state` usa `companyProfileId` + HMAC corto para prevenir CSRF.
- **Validación de firma en webhooks**: verificar `X-Cloudbeds-Signature` (HMAC-SHA256 del body raw con `CLOUDBEDS_WEBHOOK_SECRET`) antes de procesar cualquier payload.
- **Rate limiting**: Cloudbeds tiene límites de ~1000 req/hora por propiedad; la capa de caché (Redis o en-memoria con TTL de 5 min) evita excederlos.
- **Scope mínimo**: solo solicitar los permisos necesarios en el OAuth scope.

---

## 11. Resumen de cambios en el schema Prisma

```prisma
// Campos a agregar en modelos existentes:

model Property {
  cloudbedsPropertyId  String?   @unique @map("cloudbeds_property_id") @db.VarChar(100)
  cloudbedsLastSyncAt  DateTime? @map("cloudbeds_last_sync_at") @db.Timestamptz
}

model Unit {
  cloudbedsRoomTypeId  String?  @map("cloudbeds_room_type_id") @db.VarChar(100)
}

// Modelos nuevos:
// - CloudbedsConnection (tokens OAuth por empresa)
// - CloudbedsSyncLog   (auditoría de sincronizaciones)

// Enum a extender:
enum AvailabilityReason {
  // ... existentes ...
  EXTERNAL_BOOKING   // reserva que vino desde Cloudbeds directamente
}
```
