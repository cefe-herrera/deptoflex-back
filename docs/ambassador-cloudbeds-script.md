# Script de tracking de embajador para Cloudbeds

Script para pegar en el campo de **JavaScript personalizado** del Booking Engine de Cloudbeds.

> Esta integración **NO usa la API oficial de Cloudbeds**. Tras confirmar la reserva,
> el script avisa al backend y **redirige al usuario a DeptoFlex** (WeFlex).

## Flujo

1. DeptoFlex redirige al motor de Cloudbeds con parámetros en la URL:
   - `ambassador_id`, `session_id`, `return_url`, fechas, etc.
2. El script lee la metadata embebida en la página (`[data-metadata]`) y vigila los inputs del checkout.
3. El huésped completa la reserva en Cloudbeds.
4. El script escucha `reservation-created`, mezcla evento + formulario + metadata y hace `fetch` al backend.
5. Redirige a `return_url` (pantalla de confirmación en DeptoFlex) con `bookingId`.

**No se usa iframe ni postMessage** (Cloudbeds deprecó el embed por iframe).

## Qué trae el HTML vs el SPA

El HTML que ves en *Ver código fuente* es un **shell**: carga `main.js` y monta React en `#root`.
Los inputs del huésped **no están en el HTML inicial**; aparecen cuando el SPA renderiza el checkout.
Por eso el script:

- Parsea `[data-metadata]` (nombre del hotel, dirección, habitaciones con `rid=498379`, etc.).
- Usa `MutationObserver` + eventos `input`/`change` para capturar nombre, email y teléfono del DOM.

## Configuración

Reemplazá en el script:

| Variable | Ejemplo dev | Ejemplo prod |
|----------|-------------|--------------|
| `BACKEND_ENDPOINT` | `http://localhost:3000/api/v1/ambassadors/cloudbeds-reservation` | `https://api.deptoflex.com/api/v1/ambassadors/cloudbeds-reservation` |

`return_url` viene en la query de Cloudbeds (la arma DeptoFlex al redirigir). No hace falta hardcodear el front.

## Script

```html
<script>
(function () {
  console.log('[Ambassador Tracking] Script cargado dentro de Cloudbeds');

  var BACKEND_ENDPOINT = 'http://localhost:3000/api/v1/ambassadors/cloudbeds-reservation';

  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  var ambassadorId = getQueryParam('ambassador_id');
  var sessionId = getQueryParam('session_id');
  var returnUrl = getQueryParam('return_url');
  var guestStorageKey = 'ambassador_guest_form_' + (sessionId || 'unknown');
  var pageMetadata = null;

  console.log('[Ambassador Tracking] ambassador_id:', ambassadorId);
  console.log('[Ambassador Tracking] session_id:', sessionId);
  console.log('[Ambassador Tracking] return_url:', returnUrl);

  if (!ambassadorId || !sessionId) {
    console.warn('[Ambassador Tracking] Sin ambassador_id/session_id: reserva directa, sin tracking.');
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

  function redirectToApp(bookingId) {
    var target = returnUrl;
    if (!target) {
      console.warn('[Ambassador Tracking] Falta return_url, no se redirige a DeptoFlex');
      return;
    }
    var sep = target.indexOf('?') >= 0 ? '&' : '?';
    if (bookingId) {
      target = target + sep + 'bookingId=' + encodeURIComponent(bookingId);
    }
    console.log('[Ambassador Tracking] Redirigiendo a DeptoFlex:', target);
    window.location.href = target;
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
      console.log('[Ambassador Tracking] checkin_date:', reservation && reservation.checkin_date);
      console.log('[Ambassador Tracking] booking_total:', reservation && reservation.booking_total);
      console.log('[Ambassador Tracking] widget_property:', reservation && reservation.widget_property);

      var bookingId = reservation && reservation.booking_id;
      if (!bookingId) {
        console.warn('[Ambassador Tracking] La reserva no trae booking_id');
      }

      var dedupeKey = 'ambassador_reservation_sent_' + (bookingId || sessionId);
      if (sessionStorage.getItem(dedupeKey)) {
        console.warn('[Ambassador Tracking] Duplicado ignorado:', dedupeKey);
        redirectToApp(bookingId);
        return;
      }
      sessionStorage.setItem(dedupeKey, 'true');

      persistGuestForm();
      var guestForm = loadGuestForm() || captureGuestFormFromDom();
      console.log('[Ambassador Tracking] guestForm enviado:', guestForm);

      var payload = {
        source: 'cloudbeds-booking-engine',
        event: 'reservation-created',
        ambassadorId: ambassadorId,
        sessionId: sessionId,
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
          redirectToApp(bookingId);
        });
    });

    console.log('[Ambassador Tracking] Listener reservation-created registrado');
  });
})();
</script>
```

## Verificación

En la consola de Cloudbeds, al confirmar una reserva:

1. `pageMetadata:` con hotel **Usina Studio by FMA-Coliving** y dirección Salta
2. `guestForm guardado` al completar el checkout (nombre, email, teléfono)
3. `reservation-created detectado`
4. `Backend status: 200`
5. `Redirigiendo a DeptoFlex: ...`

En DeptoFlex deberías ver cliente real, fechas, monto y propiedad (si `cloudbedsWidgetPropertyId` / `cloudbedsRoomTypeId` están mapeados en admin).

## Notas

- Cloudbeds recomienda no depender del DOM para pagos custom; acá lo usamos solo para **datos del huésped** que el evento oficial no trae.
- Si tras un deploy de Cloudbeds deja de capturar el formulario, inspeccioná los inputs en checkout y ajustá los selectores.
- `rid=498379` en la metadata corresponde al `cloudbedsRoomTypeId` de la unidad en DeptoFlex.
