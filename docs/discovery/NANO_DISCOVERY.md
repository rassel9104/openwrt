# Descubrimiento técnico de Nano Monitor

Fecha de observación: 2026-09-01  
Alcance: inspección de solo lectura del código del paquete y del NanoStation activo.  
Objetivo: describir la fuente real de cada dato de LuCI y la vía mínima para consumirlo desde una futura aplicación Windows, sin implementar ni cambiar el router.

## 1. Resumen ejecutivo

Nano Monitor ya dispone de una API JSON estructurada y no necesita scraping de LuCI. La vista `overview.js` invoca directamente el objeto ubus/rpcd `luci.nano-monitor` mediante tres métodos de lectura:

- `status`: última prueba pública de velocidad.
- `accounting`: consumo diario total, prioritario, de Otros y por dispositivo.
- `shaper`: configuración y readback efectivo de los topes de velocidad.

El transporte HTTP ya existe en uhttpd bajo `/ubus`, con HTTP y HTTPS en IPv4 e IPv6. Para una aplicación Windows, la solución mínima es autenticar una sesión rpcd con permisos exclusivamente de lectura, llamar esos tres métodos y normalizar sus respuestas en el cliente. No hace falta crear un servidor web, consultar HTML ni instalar una base de datos nueva.

La lectura live también descubrió un problema operativo que debe conservarse como estado observado, no ocultarse:

- `nano-accounting` está habilitado pero no mantiene una instancia procd en ejecución.
- `accounting` responde `verified=0`, `state=error` y comunica que la configuración, los dispositivos o la interfaz WAN no son válidos.
- `shaper` conserva un snapshot con estado `active`, pero su readback actual devuelve `verified=0` y `applied=0`.
- La cuota devuelta por el Nano es actualmente `700000000` bytes por dispositivo, no los `800000000` bytes del último estado operativo documentado.

Por tanto, los contadores numéricos siguen siendo útiles para diagnóstico, pero no deben presentarse como estado live verificado mientras `verified` no sea `1`. No se corrigió ni reinició nada durante esta auditoría.

## 2. Plataforma observada

### 2.1 Hardware y sistema

| Elemento | Valor observado |
|---|---|
| Equipo | Ubiquiti NanoStation M, variante XW |
| SoC | Atheros AR9342 rev. 2 |
| Firmware | OpenWrt 24.10.5 |
| Kernel | Linux 6.6.119 |
| Target | `ath79/generic` |
| Arquitectura | `mips_24kc` |
| Root filesystem | squashfs con overlay muy limitado |

### 2.2 Red

| Función | Interfaz observada | Notas |
|---|---|---|
| LAN lógica | `br-lan` | `192.168.1.1/24`; el bridge contiene `eth0.1` |
| Ethernet físico | `eth0` | VLAN LAN `eth0.1`; existe también `eth0.2` |
| Enlace de proveedor | `phy0-sta0` | Wi-Fi cliente, canal 167, 20 MHz |
| WAN lógica | `provider` | PPPoE sobre `phy0-sta0` |
| WAN L3 efectiva | `pppoe-provider` | Es la interfaz usada por accounting y shaping |

### 2.3 Servicios

| Servicio | Habilitado | Instancia reportada como running | Interpretación |
|---|---:|---:|---|
| `rpcd` | Sí | Sí | API ubus disponible |
| `uhttpd` | Sí | Sí | HTTP/HTTPS y `/ubus` disponibles |
| `nano-accounting` | Sí | No | Anómalo: su init script declara un daemon procd persistente con respawn |
| `nano-shaper` | Sí | No | No basta para diagnosticarlo: su `start_service()` aplica reglas y termina; la autoridad real es el readback RPC/tc/nft |

El paquete instalado en el router es `luci-app-nano-monitor 1.4.0-r23`. El árbol local inspeccionado declara `1.4.0-r24`; existe por tanto una diferencia de una revisión entre código local y payload desplegado.

También están instalados `vnstat`, `vnstati`, `nlbwmon`, su vista LuCI y compatibilidad iptables. No se encontró una base de datos de vnStat o nlbwmon en sus ubicaciones habituales, ni un crontab de root. Nano Monitor no consume esas herramientas: su fuente efectiva es nftables, tc, UCI y archivos de estado propios.

## 3. Arquitectura y flujo de datos

```text
Cloudflare HTTP
      │
      ▼
run-speedtest ──► /var/run/nano-monitor/*
                           │
                           └──► RPC status

tráfico LAN ↔ WAN
      │
      ├──► nftables inet nano_accounting
      │       │
      │       └──► accounting-daemon
      │               ├──► /var/run/nano-accounting/current-snapshot
      │               └──► /etc/nano-monitor/ (checkpoint durable diario)
      │
      └──► nftables inet nano_shaper + HTB/tc en LAN y WAN
              │
              └──► /var/run/nano-shaper/*

LuCI overview.js
      └──► rpc.declare() ──► rpcd/ubus luci.nano-monitor
                                  ├── status
                                  ├── accounting
                                  └── shaper
```

### 3.1 Identidad y clasificación de dispositivos

`device-registry` combina reservas DHCP UCI con leases activos. Los equipos definidos como prioritarios en `bwlimit.main.exempt_ip` quedan fuera de la lista de Otros. Para cada Otro se produce una identidad estable interna, IP, nombre y política efectiva.

No existe identificación de aplicaciones, dominios o procesos en Nano Monitor. Si la futura app Windows atribuye consumo a aplicaciones, esa observación debe ejecutarse en Windows y no inferirse a partir de los contadores del Nano.

### 3.2 Frecuencias

- La vista LuCI carga `status` inicialmente y después consulta `status`, `accounting` y `shaper` cada 30 segundos.
- `accounting-daemon` muestrea cada 10 segundos.
- El daemon hace una verificación profunda cada 300 segundos.
- El snapshot volátil se publica en cada ciclo estable.
- El checkpoint durable se controla por `quota_persist_interval` y `quota_persist_step_bytes`; los defaults del código son 1.800 segundos o 64.000.000 bytes de avance.
- El reset diario lo ejecuta el propio daemon a la hora configurada; no depende de cron.
- Shaping se reconcilia al iniciar/recargar servicios y ante cambios DHCP o de la WAN. El método RPC `shaper` realiza readback live de nftables y tc al ser consultado.

## 4. Inventario completo de datos de la interfaz

En las tablas siguientes, **R** significa lectura y **W** significa acción o configuración que altera el router. Casi todos los números del RPC actual llegan como strings decimales; el consumidor debe validarlos y convertirlos a tipos numéricos.

### 4.1 Configuración y prueba pública

| Etiqueta/función LuCI | Campo o método | Origen y transformación | Actualización | Acceso |
|---|---|---|---|---|
| Precisión | UCI `nano-monitor.main.profile`; también `status.profile` | Perfiles `quick`, `balanced`, `accurate` | Al guardar el formulario | R/W |
| Iniciar prueba pública | `start` | Lanza `run-speedtest` en segundo plano | Bajo demanda | W |
| Proveedor | `status.provider` | Constante `Cloudflare` | Al consultar | R |
| Estado | `status.state` | Archivo `/var/run/nano-monitor/state`; LuCI traduce estados internos | 30 s en LuCI; cambia durante la prueba | R |
| Mensaje | `status.message` | Archivo de estado de la prueba | Igual que estado | R |
| Descarga | `status.download_json.bits_per_second` | Medición HTTP; LuCI añade Kbit/s, Mbit/s y KB/s | Al terminar descarga; lectura cada 30 s | R |
| Subida | `status.upload_json.bits_per_second` | Medición HTTP; misma conversión | Al terminar subida; lectura cada 30 s | R |
| Latencia | `status.latency_ms` | Medición realizada por `run-speedtest` | Por prueba | R |
| CPU del Nano, descarga | `status.download_json.cpu` | Porcentaje observado durante transferencia | Por prueba | R |
| CPU del Nano, subida | `status.upload_json.cpu` | Porcentaje observado durante transferencia | Por prueba | R |
| Error de descarga | `status.download_error` o error de parseo | Archivo de error/validación JSON | Por prueba | R |
| Error de subida | `status.upload_error` o error de parseo | Archivo de error/validación JSON | Por prueba | R |

La última prueba observada estaba completada con el perfil `accurate`; el RPC entregó latencia, descarga, subida y CPU válidas. Esta medición es histórica hasta ejecutar una prueba nueva, no telemetría continua.

### 4.2 Contabilidad diaria y cuotas

| Etiqueta/función LuCI | Campo(s) RPC | Origen y transformación | Actualización | Acceso |
|---|---|---|---|---|
| Estado de contabilidad | `verified`, `state`, `message`, `degraded_count` | Snapshot + readback live de nftables, configuración y gates | Daemon 10 s; LuCI 30 s | R |
| Día contable | `period_day` | Periodo del snapshot | Reset diario | R |
| Zona y reinicio | `timezone`, `reset_at` | UCI system + configuración bwlimit | Al cambiar configuración/reset | R |
| Internet total de hoy | `internet_down + internet_up` | Contadores nftables WAN; suma en LuCI | Daemon 10 s y readback al consultar | R |
| PC + teléfono | `priority_down + priority_up` | Contadores del set prioritario | Igual | R |
| Otros | `others_down + others_up` | Contadores de tráfico no prioritario registrado | Igual | R |
| Cuota base individual | `quota_bytes` | Snapshot reconciliado con `bwlimit.main.quota_per_device_bytes` | Al reconciliar/configurar | R |
| Cuota habilitada | `quota_enabled` | UCI + snapshot | Al reconciliar | R |
| Capacidad agregada | `quota_capacity` | Suma de límites efectivos por dispositivo | Cada snapshot/readback | R |
| Bonus agregado | `quota_bonus_total` | Suma de compensaciones del día | Al ajustar dispositivo/reset | R |
| Consumo agregado de cuotas | `quota_used` | Suma de `devices[].used` | Cada snapshot/readback | R |
| Restante agregado | `quota_remaining` | Suma de `devices[].remaining` | Cada snapshot/readback | R |
| Dispositivos conocidos | `device_count`, `devices[]` | Registro DHCP filtrado | Cambios DHCP/reconciliación | R |
| Equipos degradados | `degraded_count`, `devices[].degraded` | `used >= limit` o migración preventiva | Cada ciclo | R |
| Cuota diaria por dispositivo | `set_quota(quota_mb)` | Escribe UCI, reconcilia y exige readback o rollback | Bajo confirmación humana | W |

`blocked` se devuelve actualmente como `0`: el diseño conserva conectividad degradada en vez de bloquear al agotar cuota.

### 4.3 Fila de cada dispositivo de Otros

| Elemento LuCI | Campo RPC | Uso | Acceso |
|---|---|---|---|
| Identidad interna | `devices[].id` | Target estable para una política; no mostrar como dato humano | R |
| Nombre | `devices[].name` | Etiqueta de reserva/lease | R |
| IP | `devices[].ip` | Diagnóstico local | R |
| MAC | `devices[].mac` | Reconciliación interna; debería descartarse en la app si no es imprescindible | R |
| Consumido | `devices[].used` | Bytes usados en la cuota individual | R |
| Límite efectivo | `devices[].limit_bytes` | Cuota base + bonus del día | R |
| Bonus | `devices[].bonus_bytes` | Compensación que vence en el reset diario | R |
| Restante | `devices[].remaining` | `max(límite - usado, 0)` | R |
| Degradado | `devices[].degraded` | Indica aplicación del perfil lento | R |
| Descarga individual | `devices[].down_kbit` | Tope normal de descarga | R |
| Subida individual | `devices[].up_kbit` | Tope normal de subida | R |
| Aplicar ajuste | `set_device_policy(device_id, bonus_mb, down_kbit, up_kbit)` | Guarda UCI, reconcilia tc/nft y exige readback o rollback | W |
| Usar valores generales | Mismo método con bonus cero y velocidades default | Elimina overrides innecesarios | W |

### 4.4 Shaping y prioridad

| Etiqueta/función LuCI | Campo(s) RPC | Origen y transformación | Actualización | Acceso |
|---|---|---|---|---|
| Estado efectivo | `enabled`, `state`, `message`, `verified`, `applied`, `verification_scope` | Snapshot firmado por el servicio + readback tc/nft | Reconciliación; consulta LuCI cada 30 s | R |
| WAN efectiva | `wan_if` | Estado ubus de la red `provider` | Reconciliación/readback | R |
| Máximo configurable por Otro | `total_down_kbit`, `total_up_kbit` | Configuración UCI y clases raíz HTB | Reconciliación/readback | R |
| Valor general por Otro | `effective_other_down_kbit`, `effective_other_up_kbit` | Perfil normal o fallback seguro | Reconciliación/readback | R |
| Perfil al agotar cuota | `other_degraded_kbit` | Configuración UCI y clases HTB lentas | Reconciliación/readback | R |
| Equipos prioritarios | `priority_ips.length` | Set prioritario verificado en nftables | Reconciliación/readback | R |
| Equipos de Otros | `other_count` | Registro aplicado al árbol tc | Reconciliación/readback | R |

Los campos `other_down_kbit` y `other_up_kbit` reflejan el snapshot aplicado; los campos `effective_*` son los que debe mostrar el consumidor porque incorporan un posible fallback seguro.

## 5. Topología RPC/HTTP reutilizable

### 5.1 Contrato callable observado

Objeto: `luci.nano-monitor`

| Método | Parámetros | Efecto |
|---|---|---|
| `status` | ninguno | Lectura |
| `accounting` | ninguno | Lectura con verificación nftables |
| `shaper` | ninguno | Lectura con verificación tc/nftables |
| `start` | ninguno | Inicia transferencia de prueba |
| `set_quota` | `quota_mb` | Muta cuota global y reconcilia |
| `set_device_policy` | `device_id`, `bonus_mb`, `down_kbit`, `up_kbit` | Muta política individual y reconcilia |

La ACL instalada separa correctamente los métodos de lectura (`status`, `accounting`, `shaper`) de las acciones (`start`, `set_quota`, `set_device_policy`). También permite lectura UCI de `nano-monitor` y `bwlimit`; la escritura UCI directa sólo contempla `nano-monitor`.

### 5.2 Transporte

- Endpoint JSON-RPC: `https://192.168.1.1/ubus` en la LAN observada.
- También existe HTTP, pero no debe usarse para credenciales o sesiones.
- `uhttpd.main.ubus_prefix` es `/ubus`.
- uhttpd escucha en puertos 80 y 443 sobre todas las direcciones IPv4 e IPv6.
- No se auditó desde fuera de la LAN la política efectiva de firewall; escuchar en todas las direcciones no demuestra por sí solo exposición desde WAN.

Una llamada sigue la forma JSON-RPC estándar de ubus:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "call",
  "params": ["<sesión-rpcd>", "luci.nano-monitor", "accounting", {}]
}
```

La sesión se obtiene mediante `session.login`. No se registran aquí credenciales, sesiones ni datos de autenticación reales.

### 5.3 Seguridad mínima para Windows

La configuración live sólo confirmó una identidad administrativa rpcd; no se observó una identidad dedicada a la futura app. No debe distribuirse la cuenta administrativa dentro de un ejecutable Windows.

La ruta mínima segura es:

1. Crear, en una fase posterior explícitamente autorizada, una identidad rpcd dedicada.
2. Asignarle únicamente el grupo ACL de lectura para los tres métodos existentes; sin acciones ni escritura UCI.
3. Usar HTTPS y validar o fijar el certificado del equipo.
4. Guardar la referencia de credencial en el almacén seguro de Windows, nunca en texto plano.
5. Mantener el acceso en LAN o VPN; no publicar `/ubus` directamente en Internet.
6. Cerrar la sesión al retirar el equipo y tratar expiración/reautenticación de forma explícita.

## 6. Exposición JSON mínima propuesta

### 6.1 Recomendación principal: sin endpoint nuevo

La aplicación llama `status`, `accounting` y `shaper`, y construye localmente un único modelo tipado. Esto reutiliza la implementación existente, evita otra capa en un MIPS con poca memoria y permite descartar MAC y otros datos que la UI no necesite.

Modelo normalizado recomendado:

```json
{
  "schema_version": 1,
  "captured_at": "2026-09-01T00:00:00Z",
  "health": {
    "accounting_verified": false,
    "shaper_verified": false,
    "shaper_applied": false,
    "message": "Estado no verificado"
  },
  "speedtest": {
    "provider": "Cloudflare",
    "profile": "accurate",
    "state": "done",
    "latency_ms": 0,
    "download_bps": 0,
    "upload_bps": 0,
    "download_cpu_percent": 0,
    "upload_cpu_percent": 0
  },
  "traffic_today": {
    "period_day": "2026-09-01",
    "timezone": "America/New_York",
    "reset_at": "00:01",
    "internet_down_bytes": 0,
    "internet_up_bytes": 0,
    "priority_down_bytes": 0,
    "priority_up_bytes": 0,
    "others_down_bytes": 0,
    "others_up_bytes": 0
  },
  "quota": {
    "enabled": true,
    "base_bytes_per_device": 700000000,
    "used_bytes": 0,
    "remaining_bytes": 0,
    "capacity_bytes": 0,
    "bonus_bytes": 0,
    "degraded_devices": 0
  },
  "shaping": {
    "wan_interface": "pppoe-provider",
    "max_down_kbit": 8800,
    "max_up_kbit": 4200,
    "default_down_kbit": 768,
    "default_up_kbit": 128,
    "degraded_kbit": 64,
    "priority_device_count": 2,
    "other_device_count": 0
  },
  "devices": [
    {
      "id": "<identidad-local>",
      "name": "<nombre>",
      "ip": "<dirección-LAN>",
      "used_bytes": 0,
      "limit_bytes": 0,
      "remaining_bytes": 0,
      "bonus_bytes": 0,
      "degraded": false,
      "down_kbit": 768,
      "up_kbit": 128
    }
  ]
}
```

Reglas del adaptador:

- Convertir strings decimales sólo después de validarlos; usar enteros de 64 bits para bytes.
- Considerar la muestra verificada únicamente cuando el RPC correspondiente devuelve `verified="1"`.
- Si la verificación falla, conservar los valores sólo como snapshot diagnóstico y mostrar el mensaje de error; no etiquetarlos como live.
- Usar `effective_other_*` para velocidades efectivas.
- No devolver MAC a capas de presentación salvo una necesidad explícita de soporte.
- No intentar deducir aplicaciones o dominios a partir de estos datos.
- Consultar accounting/shaper cada 30–60 segundos como máximo; ambos realizan readback relativamente caro en este hardware.

### 6.2 Alternativa posterior: agregador `rayknet.overview`

Sólo si se exige una única llamada al router, puede añadirse en una fase posterior un objeto read-only `rayknet` con método `overview` que produzca el mismo envelope. Debe reutilizar las funciones existentes, tener ACL propia únicamente de lectura y no introducir acciones de escritura. Esta alternativa reduce viajes HTTP, pero duplica contrato y código en el Nano; por eso no es la primera opción.

## 7. Estado live y límites de confianza

La consulta de auditoría obtuvo:

- Prueba de velocidad: respuesta completa y legible.
- Accounting: tres dispositivos de Otros enumerados, pero `verified=0` y `state=error`.
- Shaper: snapshot `active`, pero `verified=0`, `applied=0` y mensaje de readback no disponible.
- Cuota live reportada: 700 MB decimales por dispositivo.
- Valores configurados/reportados: 8.800/4.200 Kbit/s máximos, 768/128 Kbit/s generales y 64 Kbit/s degradados.
- Dos IP prioritarias fuera de shaping.

Los detalles personales de dispositivos, sus MAC y sus direcciones concretas se omitieron deliberadamente de este documento.

### Hallazgos prioritarios para una fase operativa separada

1. Diagnosticar por qué `nano-accounting` no conserva su instancia procd y por qué publicó el error actual.
2. Reconciliar la cuota esperada de 800 MB con los 700 MB observados, sin asumir cuál valor debe imponerse.
3. Tras recuperar accounting, verificar que `shaper` vuelve a `verified=1` y `applied=1` mediante readback real.
4. Confirmar qué revisión del paquete debe desplegarse, porque el router tiene r23 y el árbol local r24.
5. Sólo después, crear la identidad read-only de la app Windows y probar el recorrido login → llamadas → cierre de sesión.

Estos puntos son recomendaciones; esta auditoría no ejecutó ninguna de esas mutaciones.

## 8. Archivos fuente relevantes

- `htdocs/luci-static/resources/view/nano-monitor/overview.js`: presentación, transformaciones y polling.
- `root/usr/libexec/rpcd/luci.nano-monitor`: contrato RPC, validación y readback.
- `root/usr/share/rpcd/acl.d/luci-app-nano-monitor.json`: permisos read/write.
- `root/usr/libexec/nano-monitor/accounting-daemon`: contadores, snapshots, persistencia y reset.
- `root/etc/init.d/nano-accounting`: supervisión procd.
- `root/etc/init.d/nano-shaper`: árboles HTB/tc y verificación nftables.
- `root/etc/hotplug.d/dhcp/95-nano-shaper`: reconciliación por cambios de red/DHCP.
- `root/usr/libexec/nano-monitor/device-registry`: registro de Otros.
- `root/usr/libexec/nano-monitor/device-policy`: cuota, bonus y velocidades individuales.
- `root/usr/libexec/nano-monitor/run-speedtest`: medición pública.
- `root/etc/config/bwlimit`: defaults empaquetados.
- `root/etc/config/nano-monitor`: perfil de prueba.

## 9. Resultado de la auditoría

La vía JSON necesaria para Windows ya existe y es reutilizable. La decisión técnica recomendada es consumir los tres métodos read-only actuales mediante HTTPS/rpcd y agregar en Windows, no ampliar el router todavía. Antes de considerar esos datos aptos para operación normal debe recuperarse el estado verificado de accounting y shaping, y resolverse la divergencia de cuota y revisión desplegada.
