# Executive Handoff

project: openwrt_nano-m5
active_workstream: nano_monitor_individual_quotas_1_4
raykto_version: 9.20.0
last_updated: 2026-08-26

## Role and scope
- Owner outcome: disponer de Nano Monitor 1.4.0-r2 operativo en OpenWrt 24.10.5 con cuota diaria individual, límites por equipo y degradación segura.
- End-user result: cada equipo de Otros dispone de 700 MB diarios, 768/128 Kbit/s y 64 Kbit/s al agotar su cuota; LuCI muestra consumo individual y capacidad agregada inequívoca.
- Exclusiones deliberadas: no publicar backups ni credenciales; no cambiar radio, uplink, prioridades ni qdisc ajenos.

## Accepted decisions and working conventions
- Idioma: español. Owner/autor: RaykTo; primario `raktodev@gmail.com`, secundario `raykto@aol.com`.
- Cuota diaria: 700000000 bytes por dispositivo de Otros; la barra agregada usa cuota × cantidad de dispositivos; reinicio a las 00:01 en `America/New_York`.
- Topes por equipo de Otros: 768 Kbit/s de descarga y 128 Kbit/s de subida; degradación a 64 Kbit/s después de agotar la cuota.
- Prioritarios/exentos: `192.168.1.58` y `192.168.1.59`.
- El owner autorizó commit y push de todos los cambios intencionados.
- Preservar `.agent/state/agent-routing.json`; no hay bridge activo.

## Current validated state
- `luci-app-nano-monitor_1.4.0-r2` fue compilado, inspeccionado, instalado y verificado; SHA-256 del IPK: `d038673c4ae705bf619fb10235888af378e1f4db6f0ac1d42d4daaffb171a523`.
- Contabilidad y shaping están activos y habilitados al arranque; RPC confirma readback verificado, tres equipos de Otros y capacidad agregada de 2.1 GB.
- Los árboles HTB propios usan handles `1001:`/`1002:` y el clasificador nft conserva la firma `nano-monitor-owned-v1`.
- Se corrigió compatibilidad BusyBox `flock`, firma fq_codel con whitespace final y texto accesible de cuota agregada.
- La reserva del Redmi Note 13 quedó aplicada como `A4:E2:87:13:34:FA` → `192.168.1.59`; se retiraron `match_tag=known` y el broadcast forzado que impedían completar DHCP. DHCPACK, lease infinito y ping fueron verificados.
- Radio preservada: país `00`, canal `167`, `HT20`, BSSID `6C:3B:6B:76:7B:85`.
- Pasaron sintaxis shell/JavaScript, `git diff --check`, build OpenWrt, inspección IPK y revisión focal final `PASS`.
- `recovery-kit/` continúa local, excluido de Git y no debe publicarse.

## Open decision / acceptance boundary
- No quedan decisiones funcionales abiertas. La presentación actualizada queda disponible para confirmación visual del owner en LuCI.

## Next safe action
- Crear el commit de cierre y publicar la rama autorizada.

## Active references
- `package/luci-app-nano-monitor/`
- `.agent/state/next-actions.md`
