# DeptoFlex — Sistema de Notificaciones Push

Guía completa para que el frontend integre el sistema de notificaciones.

El backend implementa **3 capas combinadas**:

1. **Persistencia en DB** — historial de notificaciones por usuario (`GET /notifications`)
2. **WebSocket (Socket.IO)** — entrega en tiempo real cuando la app está abierta
3. **Push real al dispositivo** — FCM (móvil/web) y Web Push (browser) cuando la app está cerrada

---

## 1. Variables de entorno (backend)

Agregar al `.env` del backend:

```bash
# ── Web Push (browser) ────────────────────────────
WEBPUSH_ENABLED=true
WEBPUSH_VAPID_PUBLIC_KEY=BNGmoxnEIWcrhBkAjuvp5uvrI7MWsI2QMjHjTbuwXpDjwJL-uFKP8LS_o-BXDVb4S29PzF-BPDZigjyuxdreyZY
WEBPUSH_VAPID_PRIVATE_KEY=JBVQC_rkp46fQRe9eIuX_rBeCEkbt1pecFSC8ysJxgk
WEBPUSH_VAPID_SUBJECT=mailto:admin@deptoflex.com

# ── FCM (Firebase Cloud Messaging) ────────────────
# Obtener desde Firebase Console → Project Settings → Service Accounts → Generate new private key
FCM_ENABLED=true
FCM_PROJECT_ID=tu-project-id
FCM_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-project-id.iam.gserviceaccount.com
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> El backend funciona aunque FCM/Web Push estén deshabilitados (solo perderán las notifs fuera de la app).

**La VAPID public key también la necesita el frontend** para suscribirse a Web Push.

---

## 2. Endpoints REST

Todos requieren `Authorization: Bearer <accessToken>`.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/v1/notifications?page=1&limit=20&unread=true` | Lista notificaciones del usuario (paginadas) |
| `GET` | `/api/v1/notifications/unread-count` | Devuelve `{ count: number }` |
| `PATCH` | `/api/v1/notifications/:id/read` | Marcar una como leída |
| `PATCH` | `/api/v1/notifications/read-all` | Marcar todas como leídas |
| `DELETE` | `/api/v1/notifications/:id` | Borrar |
| `POST` | `/api/v1/notifications/devices` | Registrar device token (FCM o Web Push) |
| `GET` | `/api/v1/notifications/devices` | Listar devices registrados del usuario |
| `DELETE` | `/api/v1/notifications/devices` | Body: `{ "token": "..." }` — elimina ese device |

### Estructura de una notificación

```json
{
  "id": "uuid",
  "userId": "uuid",
  "type": "LEAD_NEW",
  "title": "Nuevo lead recibido",
  "body": "Juan Pérez está interesado en Edificio Pueyrredón",
  "data": {
    "leadId": "uuid",
    "propertyId": "uuid"
  },
  "readAt": null,
  "createdAt": "2026-05-06T17:00:00Z"
}
```

### Tipos (`type`)

`LEAD_NEW`, `LEAD_UPDATED`, `BOOKING_CREATED`, `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `AMBASSADOR_REQUEST`, `AMBASSADOR_VERIFIED`, `AMBASSADOR_REJECTED`, `PROPERTY_PUBLISHED`, `COMMISSION_CREATED`, `GENERIC`.

El front puede usar `type` para decidir el icono, color y la ruta de navegación al hacer click.

---

## 3. WebSocket en tiempo real (Socket.IO)

### Conexión

```
URL:        ws://localhost:3000/notifications     (en prod: wss://<dominio>/notifications)
Namespace:  /notifications
Auth:       JWT en handshake.auth.token o ?token=
```

### Ejemplo de cliente (web)

```ts
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:3000/notifications', {
  auth: { token: accessToken },     // mismo JWT del login
  transports: ['websocket'],
});

socket.on('connect', () => console.log('Conectado a notificaciones'));

socket.on('notification:new', (notif) => {
  // notif: { id, type, title, body, data, ... }
  showToast(notif.title, notif.body);
  prependToList(notif);
});

socket.on('notification:unread-count', ({ count }) => {
  setBadge(count);
});

socket.on('disconnect', () => console.log('WS desconectado'));
```

### Eventos emitidos por el server

| Evento | Payload | Cuándo |
|--------|---------|--------|
| `notification:new` | objeto `Notification` completo | Cuando se crea una notif para el usuario |
| `notification:unread-count` | `{ count: number }` | Después de cada nueva notif o `read-all` |

> Si el JWT expira, hay que reconectar con un token nuevo (refresh).

---

## 4. Push real al dispositivo

### 4.A — Web Push (browser, sin Firebase)

Usá la VAPID public key del backend.

#### Service worker (`/public/sw.js`)

```js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      data: data.data,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(clients.openWindow(url));
});
```

#### Suscripción y registro en el backend

```ts
const VAPID_PUBLIC_KEY = 'BNGmoxnEIWcrhBkAjuvp5uvrI7MWsI2QMjHjTbuwXpDjwJL-uFKP8LS_o-BXDVb4S29PzF-BPDZigjyuxdreyZY';

async function subscribeWebPush(accessToken: string) {
  // 1. Pedir permiso
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  // 2. Registrar SW
  const reg = await navigator.serviceWorker.register('/sw.js');

  // 3. Suscribir al push manager
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  // 4. Mandar al backend
  const json = sub.toJSON(); // { endpoint, keys: { p256dh, auth } }
  await fetch('/api/v1/notifications/devices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      platform: 'WEB',
      provider: 'WEBPUSH',
      token: json.endpoint,        // usamos endpoint como token único
      endpoint: json.endpoint,
      p256dh: json.keys!.p256dh,
      authKey: json.keys!.auth,
      userAgent: navigator.userAgent,
    }),
  });
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
```

### 4.B — FCM (móvil + web)

#### Web

```ts
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const app = initializeApp({ /* config Firebase del proyecto */ });
const messaging = getMessaging(app);

const fcmToken = await getToken(messaging, { vapidKey: '<FCM_VAPID_KEY>' });

await fetch('/api/v1/notifications/devices', {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    platform: 'WEB',
    provider: 'FCM',
    token: fcmToken,
    userAgent: navigator.userAgent,
  }),
});

// Foreground (también podés solo confiar en el WebSocket)
onMessage(messaging, (payload) => console.log('FCM foreground', payload));
```

#### React Native (Expo / bare)

```ts
import messaging from '@react-native-firebase/messaging';

await messaging().requestPermission();
const fcmToken = await messaging().getToken();

await api.post('/notifications/devices', {
  platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
  provider: 'FCM',
  token: fcmToken,
});

// Refrescar si Firebase rota el token
messaging().onTokenRefresh(async (newToken) => {
  await api.post('/notifications/devices', { /* ...mismo body con newToken */ });
});
```

### 4.C — Body del `POST /notifications/devices`

```json
{
  "platform": "WEB",                 // WEB | IOS | ANDROID
  "provider": "WEBPUSH",             // WEBPUSH | FCM
  "token": "https://fcm.googleapis.com/...",
  "endpoint": "https://fcm.googleapis.com/...",  // solo Web Push
  "p256dh": "...",                   // solo Web Push
  "authKey": "...",                  // solo Web Push
  "userAgent": "Mozilla/5.0..."      // opcional
}
```

> El backend hace `upsert` por `(userId, token)` así que llamarlo varias veces es seguro.

---

## 5. Flujo recomendado en el frontend

1. **Al login** → conectar WebSocket + intentar registrar device push (sin bloquear UI)
2. **Al montar layout principal** → `GET /notifications/unread-count` para badge inicial
3. **Escuchar `notification:new`** → toast + actualizar lista + incrementar badge
4. **Escuchar `notification:unread-count`** → actualizar badge
5. **Página de notificaciones** → `GET /notifications?page=1&limit=20`
6. **Al click en notif** → `PATCH /notifications/:id/read` y navegar usando `notif.data`
7. **Al logout** → `DELETE /notifications/devices` con el token actual + `socket.disconnect()`

---

## 6. Eventos que disparan notificaciones (backend)

Por ahora el `NotificationsService.sendToUser()` está **listo para ser llamado** desde cualquier módulo, pero las integraciones automáticas con eventos de negocio (lead nuevo, booking confirmado, etc.) se agregan a medida que se necesiten.

Ejemplo de uso desde otro service:

```ts
// En leads.service.ts (ejemplo)
constructor(private notifications: NotificationsService) {}

async create(dto: CreateLeadDto) {
  const lead = await this.prisma.lead.create({ data: dto });

  await this.notifications.sendToRole('OPERATOR', {
    type: 'LEAD_NEW',
    title: 'Nuevo lead',
    body: `${lead.firstName} ${lead.lastName} consultó por una propiedad`,
    data: { leadId: lead.id },
  });

  return lead;
}
```

Si querés que active triggers automáticos para leads/bookings/embajadores, avisame y los agrego.
