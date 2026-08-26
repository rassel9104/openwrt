# Executive Handoff

project: openwrt_nano-m5
active_workstream: nano_monitor_individual_quotas_1_4
raykto_version: 9.20.0
last_updated: 2026-08-26

## Role and scope
- Owner outcome: disponer de Nano Monitor 1.4.0-r5 operativo en OpenWrt 24.10.5 con cuota diaria individual, límites por equipo, recuperación después de reinicios y una vista LuCI que aparezca sin esperar el readback profundo.
- End-user result: cada equipo de Otros dispone de 700 MB diarios, 768/128 Kbit/s y 64 Kbit/s al agotar su cuota; LuCI muestra consumo individual y capacidad agregada inequívoca.
- Exclusiones deliberadas: no publicar backups ni credenciales; no cambiar radio, uplink, prioridades ni qdisc ajenos.

## Accepted decisions and working conventions
- Idioma: español. Owner/autor: RaykTo; primario `raktodev@gmail.com`, secundario `raykto@aol.com`.
- Cuota diaria: 700000000 bytes por dispositivo de Otros; la barra agregada usa cuota × cantidad de dispositivos; reinicio a las 00:01 en `America/New_York`.
- Topes por equipo de Otros: 768 Kbit/s de descarga y 128 Kbit/s de subida; degradación a 64 Kbit/s después de agotar la cuota.
- Prioritarios/exentos: `192.168.1.58` y `192.168.1.59`.
- El owner autorizó commit y push de todos los cambios intencionados.
- El owner confirmó que la presentación en LuCI se ve bien.
- Preservar `.agent/state/agent-routing.json`; no hay bridge activo.

## Current validated state
- `luci-app-nano-monitor_1.4.0-r5` fue compilado, instalado y verificado; SHA-256 del IPK: `4c735fc9c0284f329564eb84ae61eb1e434a2a6ef8dba6728ba7707379e397f0`.
- Contabilidad y shaping están activos y habilitados al arranque; RPC confirma readback verificado, tres equipos de Otros y capacidad agregada de 2.1 GB.
- Los árboles HTB propios usan handles `1001:`/`1002:` y el clasificador nft conserva la firma `nano-monitor-owned-v1`.
- Se corrigió compatibilidad BusyBox `flock`, firma fq_codel con whitespace final y texto accesible de cuota agregada.
- La reserva del Redmi Note 13 quedó aplicada como `A4:E2:87:13:34:FA` → `192.168.1.59`; se retiraron `match_tag=known` y el broadcast forzado que impedían completar DHCP. DHCPACK, lease infinito y ping fueron verificados.
- Se corrigió `inspect_boot()`: un boot ID nuevo ya no se interpreta como fallo. Tras el corte real, r3 recuperó las cuotas durables conservadoras (837617721 bytes agregados), actualizó el boot ID y volvió a estado `active/verified`.
- La vista ya no bloquea la navegación con accounting/shaper: espera sólo status, muestra la página y completa cada dominio de forma independiente. El polling profundo pasa de 10 a 30 segundos y las acciones descartan únicamente respuestas obsoletas de su dominio.
- Radio preservada: país `00`, canal `167`, `HT20`, BSSID `6C:3B:6B:76:7B:85`.
- Pasaron sintaxis shell/JavaScript, `git diff --check`, build OpenWrt, inspección IPK y revisión focal final `PASS`.
- `recovery-kit/` continúa local, excluido de Git y no debe publicarse.
- Commit `5610376d924` publicado en `fork/nano-m5-upper-5ghz`.
- Commit de reparación `0fa7cabea6e` publicado en `fork/nano-m5-upper-5ghz`.
- Commit de rendimiento `6c9f4cbb823` publicado en `fork/nano-m5-upper-5ghz`.

## Open decision / acceptance boundary
- Resultado técnico validado; mejora de tiempo de carga `pending_owner_acceptance`.

## Next safe action
- El owner debe recargar LuCI con `Ctrl+F5` y confirmar que la vista aparece rápidamente; los valores profundos pueden completarse unos segundos después.

## Active references
- `package/luci-app-nano-monitor/`
- `.agent/state/next-actions.md`
