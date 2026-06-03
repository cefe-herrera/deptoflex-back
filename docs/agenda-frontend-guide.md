# Guía de integración de Agenda (Frontend)

Documento para el equipo de frontend. Describe el módulo de **Agenda** (libreta de contactos personal) y su **sistema de notas de seguimiento**.

> **Base URL**: prefijo global `/api/v1`. Ej.: `GET /api/v1/agenda/contacts`.
>
> **Auth**: **todos** los endpoints requieren **Bearer token**. La agenda es **personal**: cada usuario solo ve y gestiona sus propios contactos y notas (el backend filtra por el usuario autenticado; intentar acceder a contactos ajenos devuelve `404`).

---

## 1. Concepto

Cada usuario tiene su propia **agenda de contactos**. Sobre cada contacto se pueden registrar **notas de seguimiento** (historial de llamadas/WhatsApp/observaciones).

- **`AgendaContact`**: contacto (nombre, teléfono, email, etc.) con `lastContactedAt` para ordenar "Últimos contactos".
- **`AgendaNote`**: nota de seguimiento asociada a un contacto.

> Fuera de alcance del backend (los maneja el front): el contador **"X visitas agendadas para hoy"** y el botón **"Mirar tu Google Calendar"**.

---

## 2. Modelo de datos

### Contacto (`AgendaContact`)
```json
{
  "id": "uuid",
  "ownerId": "uuid",
  "firstName": "Rebeca",
  "lastName": "García",
  "phone": "+54223443442244",
  "email": "rebeca@mail.com",
  "company": "Inmobiliaria Sur",
  "avatarColor": "#1d4ed8",
  "lastContactedAt": "2026-06-03T18:00:00.000Z",
  "createdAt": "2026-06-01T12:00:00.000Z",
  "updatedAt": "2026-06-03T18:00:00.000Z",
  "deletedAt": null
}
```
- `firstName` es **obligatorio**; el resto opcional.
- `displayName` e iniciales (`RG`) los arma el **front** (`firstName + lastName`).
- `avatarColor` es opcional; si no lo seteás, el front puede generarlo.

### Nota (`AgendaNote`)
```json
{
  "id": "uuid",
  "contactId": "uuid",
  "createdById": "uuid",
  "body": "Llamé, le interesa el depto de Dean Funes. Volver a contactar el viernes.",
  "createdAt": "2026-06-03T18:00:00.000Z",
  "createdBy": { "id": "uuid", "firstName": "Juan", "lastName": "Operador" }
}
```

---

## 3. Endpoints

### Contactos

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/agenda/contacts` | Crear contacto ("Nuevo") |
| GET | `/api/v1/agenda/contacts` | Listar (paginado, con `search` y `sort`) |
| GET | `/api/v1/agenda/contacts/:id` | Detalle + notas de seguimiento |
| PATCH | `/api/v1/agenda/contacts/:id` | Editar contacto |
| DELETE | `/api/v1/agenda/contacts/:id` | Eliminar (soft delete) → `204` |
| POST | `/api/v1/agenda/contacts/:id/contacted` | Marcar como contactado ahora |

### Notas de seguimiento

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/agenda/contacts/:id/notes` | Agregar nota (actualiza `lastContactedAt`) |
| GET | `/api/v1/agenda/contacts/:id/notes` | Listar notas (más recientes primero) |
| DELETE | `/api/v1/agenda/notes/:noteId` | Eliminar una nota → `204` |

---

## 4. Pantallas → llamadas

### Crear contacto ("Nuevo")
`POST /api/v1/agenda/contacts`
```json
{
  "firstName": "Rebeca",
  "lastName": "García",
  "phone": "+54223443442244",
  "email": "rebeca@mail.com",
  "company": "Inmobiliaria Sur",
  "avatarColor": "#1d4ed8"
}
```
Respuesta: el contacto creado.

### "Últimos contactos"
`GET /api/v1/agenda/contacts?sort=recent&limit=3`
- Ordena por `lastContactedAt` desc (los que nunca fueron contactados van al final), luego por `createdAt` desc.

### Listado "A-Z"
`GET /api/v1/agenda/contacts?sort=alpha`
- Ordena por `firstName` asc, luego `lastName` asc.
- El front arma los encabezados de letra agrupando por la inicial.

### Buscador
`GET /api/v1/agenda/contacts?search=reb`
- Busca (case-insensitive) en `firstName`, `lastName`, `phone` y `email`.

**Respuesta de listado** (los 3 casos):
```json
{
  "items": [ { /* AgendaContact */ } ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### Botón llamar / WhatsApp
Al iniciar contacto, llamar (opcional pero recomendado) para mantener "Últimos contactos" al día:
`POST /api/v1/agenda/contacts/:id/contacted` — sin body. Devuelve el contacto con `lastContactedAt` actualizado.

> El número para `tel:` / `https://wa.me/<phone>` lo arma el front con el campo `phone`.

### Detalle del contacto + seguimiento
`GET /api/v1/agenda/contacts/:id` → incluye `agendaNotes` (historial, más recientes primero).

Agregar nota de seguimiento:
`POST /api/v1/agenda/contacts/:id/notes`
```json
{ "body": "Le interesa el depto de Dean Funes. Volver a contactar el viernes." }
```
- Crea la nota **y** actualiza `lastContactedAt` del contacto.

---

## 5. Parámetros de query (listado)

| Param | Tipo | Default | Notas |
|-------|------|---------|-------|
| `page` | number | `1` | |
| `limit` | number | `20` | |
| `search` | string | — | nombre/apellido/tel/email |
| `sort` | `recent` \| `alpha` | `alpha` | `recent` = Últimos contactos; `alpha` = A-Z |

---

## 6. Validaciones y errores

- `firstName`: requerido, máx 100.
- `email`: formato email válido (si se envía).
- `phone`: máx 30; `company` máx 150; `avatarColor` máx 20.
- Nota `body`: requerido, 1–2000 caracteres.
- `404` si el contacto/nota no existe **o** no pertenece al usuario autenticado.
- `401` sin token; `400` por validación de payload.

---

## 7. Referencia rápida

| # | Método | Ruta | Uso |
|---|--------|------|-----|
| 1 | POST | `/api/v1/agenda/contacts` | Crear |
| 2 | GET | `/api/v1/agenda/contacts?sort=recent` | Últimos contactos |
| 3 | GET | `/api/v1/agenda/contacts?sort=alpha` | A-Z |
| 4 | GET | `/api/v1/agenda/contacts?search=` | Buscar |
| 5 | GET | `/api/v1/agenda/contacts/:id` | Detalle + notas |
| 6 | PATCH | `/api/v1/agenda/contacts/:id` | Editar |
| 7 | DELETE | `/api/v1/agenda/contacts/:id` | Eliminar |
| 8 | POST | `/api/v1/agenda/contacts/:id/contacted` | Marcar contactado |
| 9 | POST | `/api/v1/agenda/contacts/:id/notes` | Agregar nota |
| 10 | GET | `/api/v1/agenda/contacts/:id/notes` | Listar notas |
| 11 | DELETE | `/api/v1/agenda/notes/:noteId` | Borrar nota |

> Swagger interactivo: `http://localhost:3000/api/docs` (tag **Agenda**).
