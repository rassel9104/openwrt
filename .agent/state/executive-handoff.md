# Executive Handoff

project: openwrt_nano-m5
active_workstream: nano_monitor_individual_quotas_1_4
raykto_version: 9.20.0
last_updated: 2026-08-27

## Role and scope
- Owner outcome: disponer de Nano Monitor operativo en OpenWrt 24.10.5 con cuota diaria realmente individual, recuperación sin inflación después de reinicios, compensación de MB y velocidad por equipo y una vista LuCI rápida.
- End-user result: cada equipo de Otros parte de 700 MB diarios y 768/128 Kbit/s, baja a 64 Kbit/s al agotar su disponibilidad y puede recibir ajustes independientes sin afectar a los demás; `.58` y `.59` quedan fuera del shaping; LuCI muestra consumo, compensación y capacidad inequívocos.
- Exclusiones deliberadas: no publicar backups ni credenciales; no cambiar radio, uplink ni qdisc ajenos.

## Accepted decisions and working conventions
- Idioma: español. Owner/autor: RaykTo; primario `raktodev@gmail.com`, secundario `raykto@aol.com`.
- Cuota diaria: 700000000 bytes por dispositivo de Otros; la barra agregada usa cuota × cantidad de dispositivos; reinicio a las 00:01 en `America/New_York`.
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

## Current validated state
- `luci-app-nano-monitor_1.4.0-r23` está instalado en `Raul-M5`; IPK SHA-256 `a66dd15ddb47147d91fce5cebbc534af8780cc5056bb092a5a10660bf804dbb0`, arquitectura `mips_24kc` y autoría RaykTo verificadas.
- r23 corrige la incidencia individual con hasta dos reconciliaciones completas, esperas acotadas de 15 comprobaciones y rollback por los mismos helpers verificados; LuCI acepta bonus en pasos de 1 MB.
- Una prueba r22 bajo lock ejercitó el segundo ciclo y convergió en 29 s. La limpieza posterior reveló además que el hotplug podía detener accounting al vencer su espera interna de 10 s; r23 la amplía a 15 s y fue revisado independientemente con `PASS`.
- Bajo r23, Yady completó 50→0→50 MB por RPC real en 21/23 s. Estado final: `bonus_bytes=50000000`, `limit_bytes=750000000`, accounting `active/verified`, shaper `verified/applied`, un solo daemon y sin pending ni gates.
- Los conffiles activos conservaron sus hashes exactos; IPK temporal, respaldos RAM y defaults `-opkg` se retiraron sólo tras verificarlos. Quedan 168 KiB libres en overlay.
- El asset LuCI servido por HTTP coincide con el payload r23. Uplink `provider`→`pppoe-provider`, radio 167/HT20, flow offloading 0/0 y conectividad exterior 3/3 permanecen preservados.
- Pasaron sintaxis shell/JavaScript, `git diff --check`, build OpenWrt, pruebas enfocadas, readback live y revisión independiente. `recovery-kit/` continúa local y excluido.
- El owner confirmó visualmente Yady con 50 MB extra en LuCI. El commit funcional r23 `2e14f3fcb31987f493f8321daedcb1e10a356440` está publicado y verificado en `fork/nano-m5-upper-5ghz`.

## Open decision / acceptance boundary
- Cerrada: capacidad individual validada técnicamente y aceptada visualmente por el owner bajo r23.

## Next safe action
- Ninguna acción pendiente; mantener operación normal y observar sólo ante una incidencia nueva.

## Active references
- `package/luci-app-nano-monitor/`
- `.agent/state/next-actions.md`
