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
- `luci-app-nano-monitor_1.4.0-r21` está instalado en `Raul-M5`; IPK SHA-256 `c557217d52546c79729ade2a0e4f281146432b4682063b2bd9089937bc29d4c9` (48.0 KiB), con paridad source/payload minificado.
- r19 reveló live un fingerprint tc inestable por contadores, pseudo-clases fq_codel y `leaf`; r20 canonicaliza sólo esos valores runtime, conserva la topología real y obtuvo revisión independiente `PASS`.
- r21 corrige la regresión visual observada: una respuesta RPC ausente ya muestra `Lectura no disponible` y guiones, no `Requiere atención` con velocidades y equipos falsamente en cero. El asset corregido está instalado, servido por HTTP y confirmado visualmente por el owner con los valores efectivos.
- La liberación coincidió con el reset de las 00:01 y dejó temporalmente el tráfico reenviado congelado y la transición incompleta. Tras reconciliar contabilidad y reiniciar shaper, no queda gate, marker ni hold.
- RPC accounting está `active/verified`, día `2026-08-27`, `migration_hold=0`, tres IDs exactos con límite 700000000, bonus cero y sin degradación; el consumo live posterior ya puede ser mayor que cero.
- RPC shaper está `active/verified/applied` con readback live estable, `.58/.59` por bypass directo y Otros bajo HTB. El router alcanzó `1.1.1.1` con 3/3 respuestas.
- El owner confirmó que Internet volvió en su PC. La instalación r21 preservó los dos conffiles activos; los defaults `-opkg` se eliminaron sólo tras verificar sus hashes exactos.
- Un proceso huérfano iniciado anteriormente como `accounting-daemon reconcile` (el daemon no tiene modo one-shot) competía con el servicio y causó un readback `verified=0`. Se retiró por PID y cmdline exactos sin ejecutar su cleanup compartido; queda un solo daemon y RPC accounting volvió a `active/verified`.
- Uplink `provider`→`pppoe-provider`, radio 167/HT20 y flow offloading desactivado permanecen preservados.
- Pasaron sintaxis shell/JavaScript, `git diff --check`, build OpenWrt, pruebas enfocadas, readback live y revisión independiente.
- Rollback r16 y backups live permanecen fuera de Git; `recovery-kit/` continúa local y excluido.
- Commit funcional de cierre `88dfaaca62e5f0a9d340c5813b0625bfe501a187` publicado y verificado en `fork/nano-m5-upper-5ghz` con autoría RaykTo.

## Open decision / acceptance boundary
- Cerrada: recuperación técnica, conectividad del PC, presentación r21 y publicación remota confirmadas.

## Next safe action
- Ninguna acción de cierre pendiente; mantener operación normal y observar sólo ante una incidencia nueva.

## Active references
- `package/luci-app-nano-monitor/`
- `.agent/state/next-actions.md`
