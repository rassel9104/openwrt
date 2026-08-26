# Next Actions

> Max 2 KB. Preserve only current direction, not history.

## Now
- [x] Nano Monitor 1.4.0-r14 compilado, instalado y verificado.
- [x] Cuotas individuales, RPC, hotplug, servicios y UI validados técnicamente.
- [x] Shaping y contabilidad activos, verificados y habilitados al arranque.
- [x] Redmi Note 13 recibe la reserva estática `192.168.1.59` y queda prioritario.

## Next
- [x] Build, IPK y correcciones runtime revisadas con resultado `PASS`.
- [x] Persistencia validada contra el reinicio real: boot ID nuevo, cuotas restauradas y servicio `active/verified`.
- [x] Commit funcional `5610376d924` creado con autoría RaykTo.
- [x] Rama `nano-m5-upper-5ghz` publicada en el fork autorizado.
- [x] Reparación de reinicio publicada en `0fa7cabea6e`.
- [x] Carga inicial diferida y polling reducido publicados en `6c9f4cbb823`; revisión independiente final `PASS`.
- [x] RPC rápidos mediante snapshots, topología canónica, fallback explícito y publicaciones fail-closed validados con revisión final `PASS`.
- [x] Commit funcional `e888b7f` creado con autoría RaykTo.
- [x] Rendimiento r13 rechazado por el owner; causa raíz identificada en la clasificación del tráfico local del router.
- [x] r14 exime sólo tráfico local hacia `br-lan`, reduce cbi.js de 1.956 s a 0.023 s y obtuvo revisión independiente `PASS`.

## Waiting / parked
- [x] Presentación confirmada visualmente por el owner.
- [ ] Confirmar con `Ctrl+F5` que login, pantalla principal y cambios de vista en r14 ahora cargan rápidamente.
