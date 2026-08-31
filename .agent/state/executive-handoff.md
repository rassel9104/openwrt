# Executive Handoff

project: openwrt_nano-m5
active_workstream: nano_monitor_quota_readback_r24
raykto_version: 9.20.1
install_manifest_sha256: e2b5474f373cb4f51e31cf1c85143eda5f1a6daed978d97a8e2c2d9c262ca300
model_policy_sha256: f354e4d41d2a7fa7fdd2e938ee5f28dc193946cac37d13e44dd43e2470dc6b31
last_updated: 2026-08-31T02:59:59Z

## Role and scope
- Owner outcome: disponer de Nano Monitor operativo en OpenWrt 24.10.5 con cuota diaria realmente individual, recuperación sin inflación después de reinicios, compensación de MB y velocidad por equipo y una vista LuCI rápida.
- End-user result: cada equipo de Otros dispone de una cuota diaria configurable —actualmente 800 MB— y 768/128 Kbit/s, baja a 64 Kbit/s al agotar su disponibilidad y puede recibir ajustes independientes sin afectar a los demás ni perder el consumo acumulado; `.58` y `.59` quedan fuera del shaping; LuCI muestra consumo, compensación y capacidad inequívocos. La navegación LAN↔LAN no se contabiliza ni limita. La velocidad, el consumo del PC y la atribución por aplicación se observan localmente en el PC, no cargando el Nano con esa función.
- Exclusiones deliberadas: no publicar backups ni credenciales; no cambiar radio, uplink ni qdisc ajenos; no añadir al Nano inspección o atribución de tráfico por aplicación.

## Accepted decisions and working conventions
- Idioma: español. Owner/autor: RaykTo; primario `raktodev@gmail.com`, secundario `raykto@aol.com`.
- La cuota base puede ajustarse durante el día sin reiniciar el consumo ni alterar las políticas individuales. Base activa confirmada: 800000000 bytes por dispositivo de Otros; la barra agregada usa cuota × cantidad de dispositivos; reinicio a las 00:01 en `America/New_York`.
- Topes por equipo de Otros: 768 Kbit/s de descarga y 128 Kbit/s de subida; degradación a 64 Kbit/s después de agotar la cuota.
- Prioritarios/exentos: `192.168.1.58` y `192.168.1.59`, clasificados hacia la cola directa HTB `major:0`, sin clase ni techo configurado por Nano Monitor.
- El owner autorizó commit y push de todos los cambios intencionados.
- El owner confirmó que la presentación en LuCI se ve bien.
- El owner rechazó el rendimiento de r13: login tardó más de 70 s, pantalla principal 117 s y las vistas tiempos similares. Esta corrección invalida la aceptación de rendimiento anterior.
- El owner confirmó que r14 resolvió el rendimiento.
- Ante la inflación no reconstruible de los contadores de hoy, el owner decidió compensar con MB adicionales por dispositivo en vez de inventar un reparto retroactivo. La compensación debe ser explícita e independiente; también debe poder asignarse más velocidad por equipo.
- El consumo histórico sin identidad no se reparte ni reatribuye. El owner corrigió la espera anterior y autorizó liberar ahora `identity-unknown-hold`, perdonando ese consumo e iniciando exactamente `e410880d8404`, `dc6ae7f1d451` y `dc9bd670f375` desde cero con cuota 700000000 y bonus cero.
- La liberación anticipada debe ser asistida, durable, ligada al conjunto exacto de IDs y cuota autorizados, con confirmación y readback; no puede ocurrir sólo por instalar el paquete.
- Preservar `.agent/state/agent-routing.json`; no hay bridge activo.
- El owner prefiere que la observación de velocidad, consumo y aplicaciones permanezca local y ligera en el PC. NetSpeedTray Monitor ya satisface ese uso; las alternativas quedan como opciones, no como migración aceptada.
- Los dispositivos temporales no deben recibir reservas ni presencia permanente salvo decisión explícita del owner. El owner dejó la MAC de Yady en modo fijo/real y decidió no hacer cambios adicionales hoy.

## Current validated state
- r24 corrige el readback de cuotas: `nftables` puede representar múltiplos binarios exactos con `kbytes`, `mbytes` o `gbytes`; daemon y RPC ahora normalizan sólo líneas completas de objetos `quota q_*` a bytes antes de calcular el fingerprint y siguen excluyendo únicamente el consumo mutable.
- El hotfix equivalente a r24 está activo en el Nano. Los hashes live, fuente y payload IPK coinciden: daemon `aaadcaa564af30657c713c55c985cc39c9dc5893d3de01ec6126d2da225f8fc9`; RPC `69e4e788bd9cb80fe9f42507599f0f3714a113f395fc6db5b302e0528cf440c9`.
- Estado live verificado: accounting `active/verified`; cuota base 800000000; límites 768/128 Kbit/s; degradación 64 Kbit/s; Yady `e410880d8404` +100 MB; Lourdes `dc6ae7f1d451` +350 MB; Vega `dc9bd670f375` sin bonus; shaping RPC `active/applied/verified`; `.58` y `.59` exentos.
- Las pruebas idempotentes reales `set_quota` a 800 MB y `set_device_policy` de Yady a +100 MB devolvieron `verified=1` sin perder consumo ni alterar los demás límites. El fingerprint canónico live coincide con el snapshot: `9abe71e2bacb6769afad94a677801d9c35127e28ef7bbaa50688dc2919d5d4ab`.
- El IPK reproducible `luci-app-nano-monitor_1.4.0-r24_mips_24kc.ipk` mide 49663 bytes y tiene SHA-256 `af00cd295c9dfe3b8a9f8475cc19da502f2d614bfcfb11be3f71a5f4e8773582`. Su control declara versión 1.4.0-r24, arquitectura mips_24kc y mantenedor RaykTo con ambos correos.
- Los conffiles activos conservaron sus hashes exactos; los respaldos live previos están sólo en `/tmp`. Quedan aproximadamente 164 KiB libres en overlay, por lo que no se debe reinstalar el IPK automáticamente cuando los archivos efectivos ya coinciden.
- El asset LuCI servido por HTTP coincide con el payload r23. Uplink `provider`→`pppoe-provider`, radio 167/HT20, flow offloading 0/0 y conectividad exterior 3/3 permanecen preservados.
- Pasaron sintaxis shell/JavaScript, `git diff --check`, build OpenWrt focalizado, comprobación del payload IPK, pruebas live y revisión independiente `PASS`; `shellcheck` no está instalado. `recovery-kit/` continúa local y excluido.
- El owner confirmó visualmente Yady con 50 MB extra en LuCI. El commit funcional r23 `2e14f3fcb31987f493f8321daedcb1e10a356440` está publicado y verificado en `fork/nano-m5-upper-5ghz`.
- El commit funcional r24 `278f4236ed1dbb68b62e648f1961acb8cb9302f8` está publicado y verificado en `fork/nano-m5-upper-5ghz`.
- Hecho verificado: las reglas activas de `nano_accounting` sólo contabilizan y aplican cuotas al tráfico reenviado `br-lan`↔`pppoe-provider`; el tráfico entre equipos o servicios locales no coincide con esas reglas y queda sin contabilidad ni límite de Nano Monitor. El shaping de `.58` y `.59` también sólo coincide al cruzar la WAN y los envía a la cola directa.
- Hecho verificado: `192.168.1.220` respondió al sondeo local con MAC privada `5e:f5:44:4d:ba:1e`; dnsmasq la nombró `Yady`. En esa comprobación, la reserva permanente de Yady seguía siendo `192.168.1.185`/`e4:10:88:0d:84:04`, y `.185` no respondió.
- Hecho verificado en el código activo: la lista visible de Otros se forma con reservas DHCP y leases DHCP activos. Una identidad sin reserva deja de aparecer al vencer su lease si no lo renueva; el estado diario interno por MAC puede conservarse hasta el reset para impedir que una desconexión reinicie el consumo, pero no crea una reserva ni presencia visible permanente.
- Hecho reportado por el owner, pendiente de nuevo readback: al fijar la MAC en el dispositivo, Yady vuelve a usar su MAC real asociada a `.185`.

## Source of truth
- Project source and effective runtime configuration; record exact paths when known.

## Access and runtime
- None recorded.

## Guardrails
- Preserve user work, keep secrets outside project state, and do not repeat an uncertain external mutation.

## Open blockers
- None recorded.

## Next safe action
- Mantener la operación normal sin cambios. No reinstalar el IPK sobre el Nano salvo petición explícita o necesidad de alinear la base de datos del paquete: el hotfix live ya coincide byte a byte y el overlay es limitado. En una sesión futura, únicamente si el owner lo pide, hacer un readback no mutante de leases/vecinos para confirmar `.185` y la desaparición de `.220`; no crear reservas para dispositivos temporales.

## Active references
- `package/luci-app-nano-monitor/`
- `package/luci-app-nano-monitor/root/usr/libexec/nano-monitor/device-registry`
- `package/luci-app-nano-monitor/root/usr/libexec/nano-monitor/accounting-daemon`
- `package/luci-app-nano-monitor/root/etc/init.d/nano-shaper`
- `package/luci-app-nano-monitor/root/etc/hotplug.d/dhcp/95-nano-shaper`
- `package/luci-app-nano-monitor/root/usr/libexec/rpcd/luci.nano-monitor`
- `.agent/state/next-actions.md`

## Additional active context
- Ruta no autorizada: convertir `.220` o el otro dispositivo conectado temporalmente en reservas estáticas, o mutar DHCP/Nano Monitor para ocultarlos antes de que caduquen.
- Alternativas abiertas para el PC: mantener NetSpeedTray Monitor; TrafficMonitor Lite si sólo se prioriza velocidad/totales; Windows integrado para consulta ocasional por aplicación; NetWorx como sustituto local más completo y comercial. GlassWire no aporta una ventaja proporcional para este alcance por su mayor peso.
- Cerrada: capacidad individual validada técnicamente y aceptada visualmente por el owner bajo r23; el fix backend r24 pasó validación técnica y no cambia esa presentación.
- Cerrada: tráfico local fuera de contabilidad y límites, confirmado contra reglas activas.
- Pendiente sólo si el owner lo solicita: confirmar que Yady reapareció como `.185` con MAC real y que `.220` desapareció después de no renovar su concesión. No hay bloqueo operativo; la desaparición depende del vencimiento DHCP y del estado real del cliente.
