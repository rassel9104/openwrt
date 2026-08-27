# Next Actions

> Max 2 KB. Preserve only current direction, not history.

## Now
- [x] Nano Monitor 1.4.0-r21 compilado e instalado; fingerprint tc live estable y RPC shaper `verified/applied`.
- [x] Recuperación exacta no acumulativa, bonus diario y velocidad reversible por dispositivo implementados con readback LuCI.
- [x] Hold liberado para los tres IDs exactos: marker ausente, `migration_hold=0`, 700000000 por equipo, bonus cero y sin degradación.
- [x] Tras colisión con el reset de 00:01, contabilidad y shaper reconciliados; gates ausentes y router con conectividad exterior.
- [x] El owner confirmó que Internet volvió en su PC.
- [x] El owner confirmó visualmente r21: LuCI muestra el readback efectivo y ya no convierte una lectura RPC fallida en ceros engañosos.
- [x] Retirado un proceso huérfano de reconciliación por identidad exacta; queda un solo daemon de contabilidad y RPC volvió a `verified=1`.

## Next
- [x] Completar comprobación de checkpoints y preservaciones restantes.
- [x] Commit funcional `88dfaaca62e5f0a9d340c5813b0625bfe501a187` publicado y verificado en `fork/nano-m5-upper-5ghz`.
- [x] Cierre operativo actualizado; no queda acción pendiente.

## Waiting / parked
- [x] Presentación base de r14 confirmada visualmente por el owner.
- [x] El owner confirmó que r14 resolvió el rendimiento.
- [x] La instrucción de esperar el reset fue sustituida por autorización explícita del owner para liberación anticipada, exacta y asistida.
