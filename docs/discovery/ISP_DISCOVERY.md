# Descubrimiento de integración ISP — StormNet

Fecha de observación: 2026-09-01  
Destino previsto: aplicación Windows  
Estado: descubrimiento técnico completado; integración no implementada

## 1. Alcance y método

Se auditó el portal autenticado `https://stormnet.org/` en modo estrictamente
de solo lectura. La evidencia procede de:

- la SPA pública y sus bundles JavaScript;
- una sesión HTTPS real con las credenciales aportadas localmente;
- respuestas autenticadas de los endpoints de consulta;
- observaciones de red de solo lectura en el Nano.

No se investigó la identidad corporativa de StormNet en fuentes externas. No se
alteraron datos de la cuenta, velocidad, preferencias, facturas, pagos, estado
del servicio ni configuración del Nano. La sesión de auditoría terminó con un
`POST /api/auth/logout` exitoso.

Este documento no contiene usuario, contraseña, valores de cookie, nombre,
teléfono, identificadores internos ni número completo de cuenta.

## 2. Resultado ejecutivo

La mejor integración no requiere RPA ni scraping visual. El portal usa una API
JSON relativa a `/api`, accesible desde un cliente HTTP nativo de Windows tras
autenticarse con una cookie de sesión.

La ruta recomendada es un conector de solo lectura que:

1. recibe las credenciales del usuario y las protege con Windows Credential
   Manager;
2. inicia sesión mediante `POST /api/auth/portal/login`;
3. conserva la cookie únicamente en un `CookieContainer` controlado;
4. consulta una lista cerrada de endpoints `GET`;
5. normaliza contadores y cantidades antes de calcular;
6. cierra sesión cuando termina una sincronización puntual o al desconectar la
   cuenta.

La API observada es la API interna de la aplicación web. No se verificó un
contrato público o compromiso externo de estabilidad, por lo que el conector
debe tolerar campos nuevos, nulos y cambios de esquema.

### Hallazgos que afectan directamente al producto

- `bytes_in` y `bytes_out` llegan como **cadenas decimales**, no como números
  JSON. La SPA los suma con `+` sin convertirlos primero, lo que puede concatenar
  cadenas y producir KPIs agregados incorrectos. La app Windows debe convertir
  cada contador a entero de 64 bits antes de sumar.
- El KPI de la SPA llamado **“Este Mes”** suma todos los días devueltos por la
  API. En la observación, la respuesta abarcaba del 14 de agosto al 1 de
  septiembre, por lo que no representaba un mes calendario.
- `quota` fue `null`. En el estado actual no existe evidencia suficiente para
  calcular “saldo del día”, consumo restante ni hora exacta de reinicio.
- El precio mensual está disponible, pero la moneda no está incluida en el
  contrato observado. No debe mostrarse un símbolo monetario inferido.
- “Servicio activo” y “equipo conectado” son estados distintos y deben
  conservarse por separado.

## 3. Foto autenticada observada

Lectura realizada el 2026-09-01 alrededor de las 19:36 UTC:

| Dato | Valor observado | Interpretación segura |
|---|---:|---|
| Estado del servicio | `active` | El contrato aparece activo. |
| Conexión | `online: true` | El equipo estaba conectado en ese momento. |
| Plan | `12G` | Etiqueta del plan; no se debe interpretar como cuota de 12 GB. |
| Velocidad contratada | `50M` | Etiqueta de velocidad expuesta por la API. |
| Velocidad elegida | `current_speed_label: null` | No había una reducción elegida identificada. |
| Máxima del plan | `at_max: true` | Se encontraba en la velocidad máxima disponible. |
| Precio mensual | `50.00` | Cantidad decimal; moneda no informada. |
| Facturas | 1 pagada | No había facturas pendientes en la respuesta. |
| Deuda pendiente calculable | `0` | Suma de facturas con estado `pending`; no equivale a un saldo contable oficial. |
| Cuota/saldo diario | `quota: null` | No disponible; no debe inventarse desde el nombre del plan. |

### Consumo normalizado correctamente

La API devolvió 16 filas diarias, desde `2026-08-14` hasta `2026-09-01`.
Tras convertir las cadenas a enteros antes de sumar:

| Ventana | Bytes | Aproximación binaria |
|---|---:|---:|
| Día indicado por `today` | 7,607,896,029 | 7.1 GiB |
| Últimos 7 días, incluido `today` | 67,489,761,889 | 62.9 GiB |
| Todas las filas devueltas | 162,389,346,782 | 151.2 GiB |

El último valor debe llamarse **“periodo disponible”** o similar. Para mostrar
un mes calendario real, la app debe sumar sólo las filas cuyo `YYYY-MM` coincida
con el `YYYY-MM` de `today`.

Los números anteriores son una foto puntual, no límites ni garantías de
facturación.

## 4. Autenticación y transporte

### Inicio de sesión

```http
POST /api/auth/portal/login
Content-Type: application/json

{
  "router_username": "<usuario>",
  "password": "<contraseña>"
}
```

Respuesta exitosa observada:

```json
{ "ok": true }
```

El servidor establece una cookie denominada `token`. Se observaron atributos
de cookie como `HttpOnly`, `Path`, `Max-Age` y `SameSite`; el atributo `Secure`
no apareció en el `Set-Cookie` auditado. Nunca se capturó ni persistió el valor
de la cookie. Las peticiones posteriores usan esa cookie y
`credentials: include` en la SPA. No se observó un header `Authorization` en el
flujo del portal.

### Comprobación y cierre

- `GET /api/auth/me` devuelve las claves `role` y `sub` cuando la sesión es
  válida.
- `POST /api/auth/logout` devolvió HTTP 200 con `{ "ok": true }`.
- Los errores de la SPA suelen extraerse de una respuesta JSON con campo
  `error`.

### Consideraciones para Windows

- Validar TLS siempre; no permitir certificados inválidos.
- No enviar la cookie a HTTP aunque el servidor no haya marcado `Secure`; una
  integración basada en navegador debería considerar esa ausencia un punto de
  endurecimiento pendiente del proveedor.
- No registrar bodies de login, cookies, headers completos ni respuestas con
  datos personales.
- En producción, usar Windows Credential Manager o protección DPAPI; no usar un
  `.env` distribuido con la aplicación.
- Mantener la cookie en memoria cuando sea posible. Si se necesita sesión
  persistente, cifrarla y limitar su vida útil, aunque es preferible volver a
  autenticar.
- Ante HTTP 401, intentar una sola reautenticación controlada. Si falla, pedir
  intervención al usuario.
- Las respuestas 200 observadas no incluían `Cache-Control`; el cliente debe
  impedir por su cuenta el cacheado en disco de respuestas personales.

## 5. Superficie de lectura verificada

Base observada: `https://stormnet.org/api`.

| Método y ruta | Campos o forma observada | Uso recomendado |
|---|---|---|
| `GET /auth/me` | `role`, `sub` | Validar sesión; no exponer `sub`. |
| `GET /portal/me` | `status`, `plan_name`, `speed_label`, `current_speed_label`, `at_max`, `monthly_price` y datos personales | Estado, plan y precio; descartar campos personales no necesarios. |
| `GET /portal/usage` | `today`, `days[]`, `quota` | Consumo y cuota opcional. |
| `GET /portal/invoices` | Array de facturas | Estado de pagos y vencimientos. |
| `GET /portal/connection` | `online` | Estado instantáneo de conexión. |
| `GET /portal/speed-options` | `enabled`, `at_max`, `can_change_at`, `current_override_option_id`, `options[]` | Sólo para describir velocidad; no cambiarla. |
| `GET /portal/telegram` | `enabled`, `linked`, `linked_at`, `url` | No necesario para el dashboard base. Evitar almacenar `url`. |
| `GET /portal/notification-prefs` | `has_phone`, `telegram`, `telegram_linked`, `wa_configured`, `whatsapp` | Opcional y de solo lectura. |

### Formas de datos relevantes

`/portal/usage`:

```json
{
  "today": "YYYY-MM-DD",
  "days": [
    {
      "date": "<fecha o timestamp>",
      "bytes_in": "<entero decimal como cadena>",
      "bytes_out": "<entero decimal como cadena>"
    }
  ],
  "quota": null
}
```

Aunque `quota` fue nulo, el código de la SPA contempla estos campos cuando
existe:

```json
{
  "available_bytes": "<contador>",
  "saved_bytes": "<contador>",
  "throttled": false,
  "next_reset": "<fecha/timestamp>"
}
```

Esa segunda forma procede del consumidor frontend, no de una respuesta no nula
observada. Debe tratarse como hipótesis de compatibilidad hasta recibirla en una
respuesta real.

`/portal/invoices` devuelve elementos con:

```text
id, amount, due_date, period_start, period_end, status
```

Estados manejados por la SPA: `paid`, `cancelled` y `pending`. La etiqueta
“vencida” se calcula en el cliente cuando una factura pendiente tiene una
`due_date` anterior al momento local.

## 6. Cálculos correctos para la app

### Conversión obligatoria

1. Validar que cada contador contenga sólo dígitos decimales.
2. Convertirlo a `UInt64`, `Int64` comprobado o un entero arbitrario.
3. Sumar entrada y salida como números.
4. Conservar los bytes crudos como verdad canónica.

Nunca sumar directamente valores JSON sin normalizarlos. Para dinero, usar un
tipo decimal, no `float` o `double`.

### Ventanas

- **Hoy:** fila cuyo `date[0..10]` coincida con `today`.
- **Últimos 7 días:** desde `today - 6 días` hasta `today`, inclusive.
- **Mes calendario:** filas cuyo año y mes coincidan con `today`.
- **Periodo devuelto:** suma de todas las filas, con fechas inicial/final
  visibles para evitar llamarlo “mes”.
- **Restante diario:** sólo `quota.available_bytes` cuando `quota` sea un objeto
  válido. Si es nulo, mostrar “No informado por el proveedor”.

### Unidades

La SPA divide por 1024 y etiqueta el resultado como `KB`, `MB`, `GB` o `TB`, con
un decimal. Matemáticamente esos resultados corresponden a KiB, MiB, GiB y TiB.

La aplicación debe elegir una convención explícita:

- bytes / 1024³ y etiqueta **GiB**, recomendado para precisión; o
- bytes / 1000³ y etiqueta **GB**.

No conviene reproducir la mezcla de escala binaria y etiqueta decimal sin al
menos explicarla en un tooltip.

## 7. Facturación, precio y vencimientos

- `monthly_price` es una cadena decimal. En la observación fue `50.00`.
- La moneda no aparece en `/portal/me` ni en los campos de factura observados.
  Mostrar `50.00` acompañado de “moneda no informada” hasta obtener una fuente
  autoritativa.
- No existe un campo de saldo contable general en la superficie observada.
- Una **deuda operativa estimada** puede calcularse sumando `amount` de facturas
  `pending`, pero debe etiquetarse como “facturas pendientes”, no “saldo oficial”.
- El próximo vencimiento puede obtenerse de la factura pendiente con la
  `due_date` más temprana.
- En la foto auditada no había factura pendiente, por lo que no existía un
  próximo vencimiento calculable.
- La renovación del servicio no se expone como campo independiente. No inferirla
  del final del periodo de una factura ya pagada sin una decisión de producto.

La SPA muestra el periodo, la fecha de vencimiento y el estado de cada factura,
pero no usa el importe como KPI principal.

## 8. Tiempo, reinicio y timezone

La API entrega un `today` autoritativo y las respuestas HTTP observadas incluyen
una cabecera `Date` en GMT. No se encontró un campo que declare el timezone de
negocio del proveedor.

La interfaz afirma que una reducción por cuota dura “hasta las 12 de la noche”
y formatea `quota.next_reset` cuando existe. Como `quota` fue nulo, no se pudo
verificar:

- el formato real de `next_reset`;
- si contiene offset;
- el timezone que define esa medianoche.

Regla recomendada:

1. usar `today` como `DateOnly` para agrupar;
2. si `next_reset` incluye offset, conservarlo como instante autoritativo;
3. si no incluye offset, no convertirlo suponiendo el timezone local de
   Windows;
4. mostrar “zona horaria no informada” antes que inventar una hora de reinicio.

## 9. Operaciones que deben quedar bloqueadas

La SPA contiene operaciones mutantes que no forman parte del dashboard de
lectura:

- `POST /api/portal/change-speed` con `option_id`;
- `POST /api/portal/invoices/{id}/notify-payment`;
- actualización de preferencias de notificación;
- rutas administrativas.

El conector debe usar una allowlist rígida. Sólo se permiten los `GET` descritos
y los `POST` de login/logout. No debe ofrecer un cliente HTTP genérico ni aceptar
rutas construidas desde contenido remoto.

## 10. Estrategias de integración A–E

### A. Cliente directo de la API del portal — recomendado

Cliente HTTP nativo con cookie jar, normalización y endpoints permitidos.

**Ventajas:** fiable, rápido, bajo consumo, sin navegador embebido y con control
claro de privacidad.  
**Riesgo:** contrato interno no versionado; requiere detección de cambios.  
**Uso:** integración principal.

### B. WebView2 para autenticación asistida

Abrir el portal real en WebView2 y dejar que el usuario inicie sesión. Sólo sería
útil si en el futuro el login directo deja de funcionar o incorpora un flujo que
no deba replicarse.

**Ventajas:** el proveedor conserva la UX de autenticación.  
**Riesgos:** extraer o compartir cookies entre WebView2 y el cliente nativo
aumenta complejidad y superficie sensible.  
**Uso:** fallback diseñado, no primera opción.

### C. Mostrar el portal como superficie externa

Botón “Abrir mi cuenta” que lanza el navegador del sistema. La app puede seguir
mostrando sólo datos locales si el conector falla.

**Ventajas:** muy seguro y poco frágil.  
**Limitación:** no entrega un dashboard integrado ni sincronización automática.  
**Uso:** modo degradado siempre disponible.

### D. Automatización RPA/Playwright

Automatizar formularios y leer el DOM.

**Ventaja:** podría sobrevivir sin acceso directo a la API.  
**Riesgos:** selectores frágiles, navegador pesado, manejo de credenciales y
resultados afectados por errores de cálculo de la propia SPA.  
**Uso:** último recurso, sólo con confirmación explícita.

### E. Scraping HTML o interceptación de red

No aporta ventaja sobre el endpoint JSON y puede capturar datos personales,
tokens o enlaces de vinculación.

**Uso:** descartado para la implementación normal.

## 11. Arquitectura mínima recomendada para Windows

```text
Windows UI
   |
   v
ISP Dashboard Service
   |-- Credential Vault (Windows Credential Manager)
   |-- StormNet Read-only Connector
   |     |-- HTTPS + CookieContainer
   |     |-- endpoint allowlist
   |     `-- schema/type validation
   |-- Normalizer
   |     |-- bytes string -> UInt64
   |     |-- money string -> Decimal
   |     `-- DateOnly / timestamp preservation
   |-- Snapshot Store (sin credenciales ni cookies)
   `-- Optional Reconciler
         |-- Provider usage
         `-- Nano local usage
```

Separar el conector del modelo de UI permite reemplazar la fuente si cambia el
portal, sin reescribir el dashboard.

### Contrato normalizado propuesto

```text
ProviderSnapshot
  capturedAtUtc
  sourceStatus
  service
    status
    connectionOnline
  plan
    name
    contractedSpeedLabel
    currentSpeedLabel?
    atMaximumSpeed
    monthlyPrice?
    currency?              // null hasta contar con evidencia
  usage
    providerToday
    daily[]
      date
      inboundBytes
      outboundBytes
      totalBytes
    todayTotalBytes?
    rolling7TotalBytes?
    calendarMonthTotalBytes?
    returnedWindowTotalBytes?
    returnedWindowStart?
    returnedWindowEnd?
    quota?
      availableBytes?
      savedBytes?
      throttled?
      nextReset?
      timezoneKnown
  billing
    invoices[]
      periodStart
      periodEnd
      amount
      status
      dueDate
    pendingAmount?
    nextPendingDueDate?
  diagnostics[]
```

Los datos personales e identificadores remotos pueden utilizarse internamente
para la sesión si son imprescindibles, pero no deben entrar en este snapshot.

### Actualización y degradación

- Conexión al abrir el dashboard: cada 15–30 segundos, sólo mientras la vista
  esté visible; la SPA usa 15 segundos.
- Consumo: al abrir, manualmente y cada 5–15 minutos.
- Plan y facturas: al abrir y cada 30–60 minutos.
- Si falla un endpoint, conservar módulos independientes: un fallo de facturas
  no debe borrar el último consumo válido.
- Mostrar hora de la última lectura exitosa y si el valor procede de caché.
- Aplicar backoff; no insistir continuamente ante 401, 429 o errores 5xx.

## 12. Papel del Nano

El Nano confirmó una conexión de proveedor mediante PPPoE sobre la interfaz de
estación inalámbrica, con un enlace punto a punto de direccionamiento privado.
Esto describe la topología local, pero no identifica de forma fiable empresas o
intermediarios. La consulta de metadatos de salida desde el Nano no produjo una
respuesta utilizable, por lo que no se atribuye el tránsito a ninguna entidad.

El Nano puede convertirse en una segunda fuente de medición local, pero no debe
reemplazar la verdad de facturación del portal:

- **Portal ISP:** estado contractual, facturas, precio y consumo que reconoce el
  proveedor.
- **Nano:** tráfico que atraviesa el router y diagnóstico de conectividad.
- **Windows:** atribución por aplicación y experiencia del usuario.

No deben mezclarse límites o saldos entre fuentes sin comprobar que comparten
interfaz, direcciones contadas, periodo, timezone y regla de reinicio. En este
momento el accounting del Nano está en estado de error y su cuota local no es
evidencia de una cuota del ISP.

Una reconciliación futura puede comparar tendencias y alertar de discrepancias,
pero nunca modificar facturación, velocidad o servicio automáticamente.

## 13. Riesgos y controles

| Riesgo | Control recomendado |
|---|---|
| API interna cambia | Parser tolerante, pruebas de contrato y fallo por módulo. |
| Contadores como cadenas | Validación decimal y conversión antes de sumar. |
| Overflow | Enteros de 64 bits comprobados o precisión arbitraria. |
| KPI mensual mal etiquetado | Calcular mes calendario y conservar periodo devuelto aparte. |
| Moneda desconocida | No inferir símbolo ni código. |
| Timezone desconocido | Usar `today`; preservar offset; mostrar incertidumbre. |
| Cookie o credenciales filtradas | Vault, cookie jar privado y logs redactados. |
| Mutación accidental | Allowlist de métodos/rutas y ausencia de UI de escritura. |
| Datos obsoletos | `capturedAtUtc`, estado de caché y refresco manual. |
| Portal corrige su contrato | Aceptar números o cadenas sin perder validación estricta. |

## 14. Criterios de aceptación para una implementación futura

La integración estará completa cuando una prueba end-to-end real demuestre que:

1. el usuario puede vincular su cuenta sin editar archivos ni entregar
   credenciales a un segundo operador;
2. las credenciales y cookies no aparecen en logs ni almacenamiento plano;
3. servicio activo y conexión online se presentan como conceptos separados;
4. los contadores de cadena se convierten antes de sumar;
5. hoy, últimos 7 días y mes calendario se calculan sobre fechas explícitas;
6. `quota: null` produce “no informado”, nunca un saldo inventado;
7. precio sin moneda y ausencia de deuda oficial se comunican con precisión;
8. una respuesta parcial o campo nuevo no inutiliza todo el dashboard;
9. sólo se ejecutan login, logout y endpoints GET permitidos;
10. la sesión puede cerrarse y el portal confirma el logout.

## 15. Decisión recomendada

Implementar primero la estrategia A como un conector read-only pequeño y
aislado. Mantener C —abrir el portal real— como fallback visible. No iniciar
WebView2 o RPA mientras el flujo JSON autenticado siga funcionando.

La primera superficie debe limitarse a estado, conexión, plan, precio sin moneda,
consumo diario/semanal/mensual correcto, periodo devuelto y facturas pendientes.
La cuota restante debe permanecer explícitamente no disponible hasta que el
proveedor devuelva un objeto `quota` real con un reinicio interpretable.
