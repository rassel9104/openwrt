# Executive Handoff

project: openwrt_nano-m5
active_workstream: nano_monitor_individual_quotas_1_4
raykto_version: 9.20.0
last_updated: 2026-08-26

## Role and scope
- Owner outcome: disponer de Nano Monitor operativo en OpenWrt 24.10.5 con cuota diaria realmente individual, recuperación sin inflación después de reinicios, compensación de MB y velocidad por equipo y una vista LuCI rápida.
- End-user result: cada equipo de Otros parte de 700 MB diarios y 768/128 Kbit/s, baja a 64 Kbit/s al agotar su disponibilidad y puede recibir ajustes independientes sin afectar a los demás; LuCI muestra consumo, compensación y capacidad inequívocos.
- Exclusiones deliberadas: no publicar backups ni credenciales; no cambiar radio, uplink, prioridades ni qdisc ajenos.

## Accepted decisions and working conventions
- Idioma: español. Owner/autor: RaykTo; primario `raktodev@gmail.com`, secundario `raykto@aol.com`.
- Cuota diaria: 700000000 bytes por dispositivo de Otros; la barra agregada usa cuota × cantidad de dispositivos; reinicio a las 00:01 en `America/New_York`.
- Topes por equipo de Otros: 768 Kbit/s de descarga y 128 Kbit/s de subida; degradación a 64 Kbit/s después de agotar la cuota.
- Prioritarios/exentos: `192.168.1.58` y `192.168.1.59`.
- El owner autorizó commit y push de todos los cambios intencionados.
- El owner confirmó que la presentación en LuCI se ve bien.
- El owner rechazó el rendimiento de r13: login tardó más de 70 s, pantalla principal 117 s y las vistas tiempos similares. Esta corrección invalida la aceptación de rendimiento anterior.
- El owner confirmó que r14 resolvió el rendimiento.
- Ante la inflación no reconstruible de los contadores de hoy, el owner decidió compensar con MB adicionales por dispositivo en vez de inventar un reparto retroactivo. La compensación debe ser explícita e independiente; también debe poder asignarse más velocidad por equipo.
- El consumo histórico sin identidad no se reparte ni reatribuye: `identity-unknown-hold` mantiene Otros a 64 Kbit/s hasta el siguiente reset diario válido.
- Preservar `.agent/state/agent-routing.json`; no hay bridge activo.

## Current validated state
- `luci-app-nano-monitor_1.4.0-r18` fue compilado, revisado, instalado y verificado en `Raul-M5`; IPK SHA-256 `76098c1c867732900ad5d78a809d5bf019cfb0639640334543433eb44377570c` (40757 bytes).
- r18 corrige el fingerprint nft para aceptar tanto la omisión de `used 0 bytes` como `used N bytes`, limitado estrictamente al cuerpo de cuotas; revisión independiente final `PASS`.
- RPC accounting permanece `active/verified`, `migration_hold=1`, capacidad 2.1 GB y tres equipos con uso individual cero, límite 700000000, bonus cero y perfil degradado.
- El marcador durable conserva `day=2026-08-26` y `mode=identity-unknown-hold`; no quedaron checkpoints individuales heredados. Un ciclo periódico posterior mantuvo la verificación y los tres usos en cero.
- La tabla `inet nano_accounting` conserva firma `nano-monitor-accounting-v1`, dos reglas hold y tres cuotas; shaper está `active` y las clases `1001:20`/`1002:20` tienen techo 64 Kbit/s.
- La gate transitoria de despliegue fue eliminada tras convergencia. Radio `00`/167/HT20, BSSID `6C:3B:6B:76:7B:85`, uplink `provider`→`pppoe-provider`, flow offloading desactivado y árboles qdisc propios permanecen intactos.
- Pasaron sintaxis shell/JavaScript/JSON, `git diff --check`, build OpenWrt, pruebas enfocadas, readback live y revisión independiente.
- Rollback r16 y backups live permanecen fuera de Git; `recovery-kit/` continúa local y excluido.
- Commit funcional `ff12ddc212f70585befe8fb5b1fd146e3ac78e35` publicado en `fork/nano-m5-upper-5ghz` con autoría RaykTo.

## Open decision / acceptance boundary
- La implementación y el estado live son técnicamente válidos. La presentación de los nuevos controles individuales queda `pending_owner_acceptance` hasta revisión explícita del owner.
- La salida automática del hold sólo puede aceptarse después del siguiente reset diario real; no adelantarlo ni simular consumo en el router productivo.

## Next safe action
- Después del siguiente reset de las 00:01 `America/New_York`, verificar marker ausente, checkpoints `exact-v1`, usos desde cero y retorno de Otros a 768/128 Kbit/s; no aplicar mutaciones antes de ese evento.

## Active references
- `package/luci-app-nano-monitor/`
- `.agent/state/next-actions.md`
