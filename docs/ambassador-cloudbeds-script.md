# Script de tracking de embajador para Cloudbeds

Script para pegar en el campo de **JavaScript personalizado** del Booking Engine de Cloudbeds.

> Esta integración **NO usa la API oficial de Cloudbeds**. Tras confirmar la reserva,
> el script avisa al backend y redirige según `mode`:
> - `ambassador` → `return_url` (panel DeptoFlex)
> - `guest` → opcionalmente `guest_return_url`; si no existe, queda en Cloudbeds

## Flujo

1. DeptoFlex crea una sesión segura (`session_id` + `tracking_token`) y abre Cloudbeds con:
   - `ambassador_id`, `session_id`, `tracking_token`, `mode`, fechas, etc.
   - `return_url` solo en `mode=ambassador`
   - `guest_return_url` en `mode=guest` (por defecto: `{FRONTEND_URL}/p/reserva/gracias`)
2. El script lee metadata embebida y vigila inputs del checkout.
3. Al confirmar, escucha `reservation-created` y envía payload al backend.
4. Redirección condicional según `mode`.

**Reservas directas sin `session_id`:** el script no hace tracking (compatibilidad).

## Configuración

| Variable | Ejemplo prod |
|----------|--------------|
| `BACKEND_ENDPOINT` | `https://deptoflex-back.vercel.app/api/v1/ambassadors/cloudbeds-reservation` |

## Script

```html
<script>
(function () {
  console.log('[Ambassador Tracking] Script cargado dentro de Cloudbeds');

  var BACKEND_ENDPOINT = 'https://deptoflex-back.vercel.app/api/v1/ambassadors/cloudbeds-reservation';

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  var ambassadorId = getQueryParam('ambassador_id');
  var sessionId = getQueryParam('session_id');
  var trackingToken = getQueryParam('tracking_token');
  var mode = (getQueryParam('mode') || 'ambassador').toLowerCase();
  var returnUrl = getQueryParam('return_url');
  var guestReturnUrl = getQueryParam('guest_return_url');
  var guestStorageKey = 'ambassador_guest_form_' + (sessionId || 'unknown');
  var pageMetadata = null;

  console.log('[Ambassador Tracking] session_id:', sessionId);
  console.log('[Ambassador Tracking] mode:', mode);
  console.log('[Ambassador Tracking] return_url:', returnUrl);
  console.log('[Ambassador Tracking] guest_return_url:', guestReturnUrl);

  if (!sessionId) {
    console.warn('[Ambassador Tracking] Sin session_id: reserva directa, sin tracking.');
    return;
  }

  function readInputValue(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.value && String(el.value).trim()) {
        return String(el.value).trim();
      }
    }
    return null;
  }

  function captureGuestFormFromDom() {
    return {
      firstName: readInputValue([
        'input[autocomplete="given-name"]',
        'input[name*="first" i]',
        'input[id*="first" i]',
        'input[placeholder*="nombre" i]',
        'input[placeholder*="first" i]'
      ]),
      lastName: readInputValue([
        'input[autocomplete="family-name"]',
        'input[name*="last" i]',
        'input[id*="last" i]',
        'input[placeholder*="apellido" i]',
        'input[placeholder*="last" i]'
      ]),
      email: readInputValue([
        'input[type="email"]',
        'input[autocomplete="email"]',
        'input[name*="email" i]',
        'input[id*="email" i]'
      ]),
      phone: readInputValue([
        'input[type="tel"]',
        'input[autocomplete="tel"]',
        'input[name*="phone" i]',
        'input[id*="phone" i]',
        'input[name*="telefono" i]',
        'input[id*="telefono" i]'
      ]),
      capturedAt: new Date().toISOString()
    };
  }

  function persistGuestForm() {
    var form = captureGuestFormFromDom();
    if (form.firstName || form.lastName || form.email || form.phone) {
      sessionStorage.setItem(guestStorageKey, JSON.stringify(form));
      console.log('[Ambassador Tracking] guestForm guardado', form);
    }
  }

  function loadGuestForm() {
    try {
      var raw = sessionStorage.getItem(guestStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function readPageMetadata() {
    var meta = {
      propertyCode: null,
      hotelName: null,
      streetAddress: null,
      city: null,
      region: null,
      roomTypes: []
    };

    try {
      var pathMatch = window.location.pathname.match(/\/reservation\/([^/?#]+)/i);
      if (pathMatch) meta.propertyCode = pathMatch[1];

      var el = document.querySelector('[data-metadata]');
      if (el && el.textContent) {
        var json = JSON.parse(el.textContent.trim());
        meta.hotelName = json.name || null;
        if (json.address) {
          meta.streetAddress = json.address.streetAddress || null;
          meta.city = json.address.addressLocality || null;
          meta.region = json.address.addressRegion || null;
        }
        if (Array.isArray(json.containsPlace)) {
          json.containsPlace.forEach(function (room) {
            var rid = null;
            if (room['@id']) {
              var m = String(room['@id']).match(/[?&]rid=(\d+)/);
              if (m) rid = m[1];
            }
            var roomName = null;
            if (Array.isArray(room.name) && room.name[0]) {
              roomName = room.name[0]['@value'] || room.name[0];
            }
            if (rid) meta.roomTypes.push({ rid: rid, name: roomName });
          });
        }
      }
    } catch (e) {
      console.warn('[Ambassador Tracking] No se pudo leer data-metadata', e);
    }

    return meta;
  }

  function startGuestFormWatcher() {
    persistGuestForm();
    document.addEventListener('input', persistGuestForm, true);
    document.addEventListener('change', persistGuestForm, true);
    document.addEventListener('submit', persistGuestForm, true);

    var root = document.getElementById('root');
    if (root && window.MutationObserver) {
      new MutationObserver(persistGuestForm).observe(root, {
        childList: true,
        subtree: true
      });
    }
  }

  pageMetadata = readPageMetadata();
  console.log('[Ambassador Tracking] pageMetadata:', pageMetadata);
  startGuestFormWatcher();

  function redirectAmbassador(bookingId) {
    var target = returnUrl;
    if (!target) {
      console.warn('[Ambassador Tracking] Falta return_url, no se redirige a DeptoFlex');
      return;
    }
    var sep = target.indexOf('?') >= 0 ? '&' : '?';
    if (bookingId) {
      target = target + sep + 'bookingId=' + encodeURIComponent(bookingId);
    }
    console.log('[Ambassador Tracking] Redirigiendo a DeptoFlex (ambassador):', target);
    window.location.href = target;
  }

  function redirectGuest(bookingId) {
    if (!guestReturnUrl) {
      console.log('[Ambassador Tracking] mode=guest sin guest_return_url: permanece en Cloudbeds');
      return;
    }
    var target = guestReturnUrl;
    var sep = target.indexOf('?') >= 0 ? '&' : '?';
    if (bookingId) {
      target = target + sep + 'bookingId=' + encodeURIComponent(bookingId);
    }
    console.log('[Ambassador Tracking] Redirigiendo a página pública (guest):', target);
    window.location.href = target;
  }

  function handlePostReservation(bookingId) {
    if (mode === 'guest') {
      redirectGuest(bookingId);
    } else {
      redirectAmbassador(bookingId);
    }
  }

  window.addEventListener('on-booking-engine-ready', function (e) {
    console.log('[Ambassador Tracking] on-booking-engine-ready detectado');

    var eventSystem = e.detail && e.detail.eventSystem;
    if (!eventSystem) {
      console.warn('[Ambassador Tracking] No se encontró eventSystem');
      return;
    }

    eventSystem.addEventListener('reservation-created', function (reservation) {
      console.log('[Ambassador Tracking] reservation-created detectado', reservation);

      var bookingId = reservation && reservation.booking_id;
      if (!bookingId) {
        console.warn('[Ambassador Tracking] La reserva no trae booking_id');
      }

      var dedupeKey = 'ambassador_reservation_sent_' + (bookingId || sessionId);
      if (sessionStorage.getItem(dedupeKey)) {
        console.warn('[Ambassador Tracking] Duplicado ignorado:', dedupeKey);
        handlePostReservation(bookingId);
        return;
      }
      sessionStorage.setItem(dedupeKey, 'true');

      persistGuestForm();
      var guestForm = loadGuestForm() || captureGuestFormFromDom();

      var payload = {
        source: 'cloudbeds-booking-engine',
        event: 'reservation-created',
        mode: mode,
        ambassadorId: ambassadorId,
        sessionId: sessionId,
        trackingToken: trackingToken,
        bookingId: bookingId,
        reservation: reservation,
        guestForm: guestForm,
        pageMetadata: pageMetadata,
        cloudbedsUrl: window.location.href,
        createdAt: new Date().toISOString()
      };

      fetch(BACKEND_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      })
        .then(function (response) {
          console.log('[Ambassador Tracking] Backend status:', response.status);
          return response.text();
        })
        .then(function (text) {
          console.log('[Ambassador Tracking] Backend response:', text);
        })
        .catch(function (error) {
          console.error('[Ambassador Tracking] Error enviando al backend:', error);
        })
        .finally(function () {
          handlePostReservation(bookingId);
        });
    });

    console.log('[Ambassador Tracking] Listener reservation-created registrado');
  });
})();
</script>
```

## Parámetros de URL

| Parámetro | Requerido | Descripción |
|-----------|-----------|-------------|
| `session_id` | Sí (tracking) | UUID de sesión creada en DeptoFlex |
| `tracking_token` | Sí (sesiones nuevas) | Token validado en backend |
| `mode` | Sí | `ambassador` o `guest` |
| `ambassador_id` | Informativo | UUID del embajador (no confiable solo) |
| `return_url` | mode=ambassador | Retorno al panel embajador |
| `guest_return_url` | mode=guest | Página pública de agradecimiento (default: `/p/reserva/gracias`) |

## Verificación

1. `mode=ambassador`: confirma reserva → backend 200 → redirige a `/reservar/confirmacion`
2. `mode=guest`: confirma reserva → backend 200 → NO redirige al panel embajador
3. Re-disparo del evento → dedupe en sessionStorage + backend por `bookingId`

## Seguridad

- El backend valida `session_id` + `tracking_token` (hash SHA-256 en DB).
- El `ambassador_id` real se toma de la sesión, no del payload.
- Sesiones expiran a los 7 días.
