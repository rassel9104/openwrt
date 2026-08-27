'use strict';
'require view';
'require form';
'require rpc';
'require poll';
'require ui';

/* SPDX-License-Identifier: MIT
 * Copyright (C) 2026 RaykTo <raktodev@gmail.com>
 */

var callStatus = rpc.declare({
	object: 'luci.nano-monitor',
	method: 'status',
	expect: { '': {} }
});

var callStart = rpc.declare({
	object: 'luci.nano-monitor',
	method: 'start',
	expect: { '': {} }
});

var callAccounting = rpc.declare({
	object: 'luci.nano-monitor',
	method: 'accounting',
	expect: { '': {} }
});

var callShaper = rpc.declare({
	object: 'luci.nano-monitor',
	method: 'shaper',
	expect: { '': {} }
});

var callSetQuota = rpc.declare({
	object: 'luci.nano-monitor',
	method: 'set_quota',
	params: [ 'quota_mb' ],
	expect: { '': {} }
});

var callSetDevicePolicy = rpc.declare({
	object: 'luci.nano-monitor',
	method: 'set_device_policy',
	params: [ 'device_id', 'bonus_mb', 'down_kbit', 'up_kbit' ],
	expect: { '': {} }
});

var statusEpoch = 0;
var statusActions = 0;
var accountingEpoch = 0;
var accountingActions = 0;

function beginStatusAction() {
	statusActions++;
	statusEpoch++;
}

function endStatusAction() {
	statusActions = Math.max(0, statusActions - 1);
	statusEpoch++;
}

function beginAccountingAction() {
	accountingActions++;
	accountingEpoch++;
}

function endAccountingAction() {
	accountingActions = Math.max(0, accountingActions - 1);
	accountingEpoch++;
}

function setText(id, text) {
	var node = document.getElementById(id);
	if (node)
		node.textContent = text;
}

function formatRate(bits) {
	if (!isFinite(bits) || bits < 0)
		return '—';
	var bitRate = bits < 1000000
		? (bits / 1000).toFixed(1) + ' Kbit/s'
		: (bits / 1000000).toFixed(2) + ' Mbit/s';
	return bitRate + ' · ' + (bits / 8000).toFixed(1) + ' KB/s';
}

function formatBytes(bytes) {
	var units = [ 'B', 'KB', 'MB', 'GB', 'TB' ], index = 0, value = Number(bytes) || 0;
	while (value >= 1000 && index < units.length - 1) {
		value /= 1000;
		index++;
	}
	return value.toFixed(index === 0 ? 0 : 1) + ' ' + units[index];
}

function parseMeasurement(raw) {
	if (!raw)
		return null;
	try {
		var data = JSON.parse(raw);
		return {
			bits: Number(data.bits_per_second),
			cpu: Number(data.cpu),
			error: ''
		};
	}
	catch (e) {
		return { bits: NaN, cpu: NaN, error: 'Resultado de medición no válido' };
	}
}

function renderStatus(status) {
	var stateNames = {
		idle: 'Sin pruebas', queued: 'En cola', ping: 'Latencia',
		download: 'Descarga', upload: 'Subida', done: 'Completada',
		partial: 'Parcial', error: 'Error'
	};
	var down = parseMeasurement(status.download_json);
	var up = parseMeasurement(status.upload_json);
	var busy = [ 'queued', 'ping', 'download', 'upload' ].indexOf(status.state) !== -1;

	setText('nm-state', stateNames[status.state] || status.state || 'Desconocido');
	setText('nm-message', status.message || 'Listo para medir contra Cloudflare.');
	setText('nm-download', down ? formatRate(down.bits) : '—');
	setText('nm-upload', up ? formatRate(up.bits) : '—');
	setText('nm-latency', status.latency_ms ? status.latency_ms + ' ms' : 'No disponible');
	setText('nm-cpu', [
		down && isFinite(down.cpu) ? '↓ ' + down.cpu.toFixed(1) + '%' : '',
		up && isFinite(up.cpu) ? '↑ ' + up.cpu.toFixed(1) + '%' : ''
	].filter(Boolean).join(' · ') || 'No disponible');

	var errors = [ down && down.error, up && up.error, status.download_error, status.upload_error ].filter(Boolean);
	setText('nm-errors', errors.join(' · '));
	var startButton = document.querySelector('[data-nano-start="1"]');
	if (startButton) {
		startButton.disabled = busy;
		startButton.setAttribute('aria-busy', busy ? 'true' : 'false');
	}
}

function renderAccounting(response) {
	var total = Number(response.internet_down) + Number(response.internet_up);
	var priority = Number(response.priority_down) + Number(response.priority_up);
	var others = Number(response.others_down) + Number(response.others_up);
	var quota = Number(response.quota_bytes) || 1;
	var maxBonusMb = Math.max(0, Math.floor((1000000000000 - quota) / 1000000));
	var devices = Array.isArray(response.devices) ? response.devices : [];
	var capacity = Number(response.quota_capacity) || quota * devices.length;
	var bonusTotal = Number(response.quota_bonus_total) || 0;
	var used = Number(response.quota_used) || 0;
	var progress = capacity > 0 ? Math.min(100, used / capacity * 100) : 0;
	var degradedCount = Number(response.degraded_count) || 0;
	var verified = response.verified === '1';
	var deviceLabel = devices.length + ' equipo' + (devices.length === 1 ? '' : 's');
	var quotaSummary = formatBytes(used) + ' consumidos de ' + formatBytes(capacity) + ' disponibles (' + deviceLabel + ' × ' + formatBytes(quota) + ' base' + (bonusTotal ? ' + ' + formatBytes(bonusTotal) + ' extra hoy' : '') + ')';

	setText('nm-account-state', verified ? (degradedCount ? degradedCount + ' degradado' + (degradedCount === 1 ? '' : 's') : 'Contabilidad activa') : 'Requiere atención');
	setText('nm-account-message', response.message || 'Esperando readback de nftables.');
	setText('nm-daily-total', formatBytes(total));
	setText('nm-daily-priority', formatBytes(priority));
	setText('nm-daily-others', formatBytes(others));
	setText('nm-quota-remaining', formatBytes(quota) + ' base por dispositivo');
	setText('nm-quota-label', quotaSummary + ' · reinicio ' + (response.reset_at || '00:01') + ' ' + (response.timezone || 'hora local'));
	var bar = document.getElementById('nm-quota-progress');
	if (bar) {
		bar.style.width = progress.toFixed(1) + '%';
		bar.parentNode.setAttribute('aria-valuenow', progress.toFixed(0));
		bar.parentNode.setAttribute('aria-valuetext', quotaSummary);
		bar.classList.toggle('is-blocked', degradedCount > 0);
	}
	var input = document.getElementById('nm-quota-input');
	if (input && document.activeElement !== input)
		input.value = Math.round(quota / 1000000);

	var list = document.getElementById('nm-device-list');
	var editingDevice = list && list.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
	if (list && !editingDevice) {
		list.replaceChildren();
		if (!devices.length) {
			list.appendChild(E('p', { 'class': 'nm-note' }, 'No hay dispositivos de Otros con reserva o lease DHCP activo.'));
		}
		devices.forEach(function(device) {
			var deviceUsed = Number(device.used) || 0;
			var deviceLimit = Number(device.limit_bytes) || quota;
			var deviceBonus = Number(device.bonus_bytes) || 0;
			var down = Number(device.down_kbit) || Number(response.default_down_kbit) || 768;
			var up = Number(device.up_kbit) || Number(response.default_up_kbit) || 128;
			var deviceProgress = Math.min(100, deviceUsed / deviceLimit * 100);
			var degraded = device.degraded === '1';
			var title = device.name && device.name !== '*' ? device.name : (device.ip || 'Dispositivo');
			list.appendChild(E('article', { 'class': 'nm-device' + (degraded ? ' is-degraded' : '') }, [
				E('div', { 'class': 'nm-device-head' }, [
					E('div', {}, [ E('strong', {}, title), E('small', {}, (device.ip || 'Sin IP') + ' · ' + (device.mac || 'MAC no disponible')) ]),
					E('span', { 'class': 'nm-device-state' }, degraded ? String(response.degraded_kbit || 64) + ' Kbit/s' : down + '/' + up + ' Kbit/s')
				]),
				E('div', { 'class': 'nm-meter', 'role': 'progressbar', 'aria-label': 'Cuota consumida por ' + title, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': deviceProgress.toFixed(0) },
					E('i', { 'class': degraded ? 'is-blocked' : '', 'style': 'width:' + deviceProgress.toFixed(1) + '%' })),
				E('small', {}, formatBytes(deviceUsed) + ' de ' + formatBytes(deviceLimit) + ' · quedan ' + formatBytes(Number(device.remaining)) + (deviceBonus ? ' · compensación: +' + formatBytes(deviceBonus) + ' hoy' : '')),
				E('div', { 'class': 'nm-device-policy' }, [
					E('label', {}, [ 'MB extra hoy', E('input', { 'id': 'nm-bonus-' + device.id, 'type': 'number', 'min': '0', 'max': String(maxBonusMb), 'step': '100', 'inputmode': 'numeric', 'value': String(Math.round(deviceBonus / 1000000)) }) ]),
					E('label', {}, [ 'Descarga Kbit/s', E('input', { 'id': 'nm-down-' + device.id, 'type': 'number', 'min': String(response.degraded_kbit || 64), 'max': String(response.max_down_kbit || 8800), 'step': '64', 'inputmode': 'numeric', 'value': String(down) }) ]),
					E('label', {}, [ 'Subida Kbit/s', E('input', { 'id': 'nm-up-' + device.id, 'type': 'number', 'min': String(response.degraded_kbit || 64), 'max': String(response.max_up_kbit || 4200), 'step': '64', 'inputmode': 'numeric', 'value': String(up) }) ]),
					E('div', { 'class': 'nm-device-actions' }, [
						E('button', { 'type': 'button', 'class': 'cbi-button cbi-button-apply', 'click': function(ev) { return applyDevicePolicy(device, response, false, ev.currentTarget); } }, 'Aplicar ajuste'),
						E('button', { 'type': 'button', 'class': 'cbi-button cbi-button-reset', 'click': function(ev) { return applyDevicePolicy(device, response, true, ev.currentTarget); } }, 'Usar valores generales')
					])
				])
			]));
		});
	}
}

function applyDevicePolicy(device, response, reset, button) {
	if (response.migration_hold === '1') {
		ui.addNotification(null, E('p', {}, 'La migración preventiva conserva Otros a 64 Kbit/s hasta el próximo reset diario; después podrá aplicar ajustes individuales.'), 'info');
		return Promise.resolve();
	}
	var defaultDown = Number(response.default_down_kbit) || 768;
	var defaultUp = Number(response.default_up_kbit) || 128;
	var degraded = Number(response.degraded_kbit) || 64;
	var maxDown = Number(response.max_down_kbit) || 8800;
	var maxUp = Number(response.max_up_kbit) || 4200;
	var quota = Number(response.quota_bytes) || 700000000;
	var maxBonus = Math.max(0, Math.floor((1000000000000 - quota) / 1000000));
	var bonus = reset ? 0 : Number((document.getElementById('nm-bonus-' + device.id) || {}).value);
	var down = reset ? defaultDown : Number((document.getElementById('nm-down-' + device.id) || {}).value);
	var up = reset ? defaultUp : Number((document.getElementById('nm-up-' + device.id) || {}).value);
	var title = device.name && device.name !== '*' ? device.name : (device.ip || 'el dispositivo');

	if (reset && !window.confirm('Se retirarán los MB extra de hoy y la velocidad personalizada de ' + title + '. ¿Continuar?'))
		return Promise.resolve();
	if (!Number.isInteger(bonus) || bonus < 0 || bonus > maxBonus) {
		ui.addNotification(null, E('p', {}, 'Los MB extra deben ser un entero entre 0 y ' + maxBonus + '.'), 'error');
		return Promise.resolve();
	}
	if (!Number.isInteger(down) || down < degraded || down > maxDown || !Number.isInteger(up) || up < degraded || up > maxUp) {
		ui.addNotification(null, E('p', {}, 'La velocidad debe respetar el máximo configurable para Otros.'), 'error');
		return Promise.resolve();
	}
	if (button)
		button.disabled = true;
	beginAccountingAction();
	return callSetDevicePolicy(device.id, bonus, down, up).then(function(result) {
		if (result.verified !== '1')
			throw new Error(result.error || 'El ajuste no superó el readback de cuota y velocidad.');
		renderAccounting(result);
		ui.addNotification(null, E('p', {}, reset ? 'Valores generales restaurados y verificados.' : 'Compensación y velocidad aplicadas con readback verificado.'), 'info');
	}).catch(function(error) {
		ui.addNotification(null, E('p', {}, error.message || 'No se pudo aplicar el ajuste individual.'), 'error');
		return L.resolveDefault(callAccounting(), {}).then(renderAccounting);
	}).finally(function() {
		endAccountingAction();
		if (button)
			button.disabled = false;
	});
}

function renderShaper(response) {
	var requiredRates = [ 'total_down_kbit', 'total_up_kbit', 'effective_other_down_kbit', 'effective_other_up_kbit', 'other_degraded_kbit', 'other_count' ];
	var valid = response && (response.enabled === '0' || response.enabled === '1') && requiredRates.every(function(field) {
		var value = Number(response[field]);
		return Number.isFinite(value) && value >= 0;
	});
	if (!valid) {
		setText('nm-shaper-state', 'Lectura no disponible');
		setText('nm-shaper-message', 'LuCI no recibió el estado del servicio; volverá a consultarlo automáticamente.');
		setText('nm-shaper-total', '—');
		setText('nm-shaper-ordinary', '—');
		setText('nm-shaper-degraded', '—');
		setText('nm-shaper-priority', '—');
		setText('nm-shaper-count', '—');
		return;
	}
	var active = response.applied === '1';
	var safeFallback = active && response.verification_scope === 'safe_fallback';
	var liveReadback = active && response.verification_scope === 'live_readback';
	var priority = Array.isArray(response.priority_ips) ? response.priority_ips : [];
	setText('nm-shaper-state', safeFallback ? 'Perfil preventivo verificado' : (liveReadback ? 'Aplicación verificada en vivo' : (active ? 'Aplicación verificada' : (response.enabled === '1' ? 'Requiere atención' : 'Desactivado'))));
	setText('nm-shaper-message', response.message || 'Esperando readback del servicio.');
	setText('nm-shaper-total', formatRate(Number(response.total_down_kbit) * 1000) + ' ↓ · ' + formatRate(Number(response.total_up_kbit) * 1000) + ' ↑');
	setText('nm-shaper-ordinary', formatRate(Number(response.effective_other_down_kbit) * 1000) + ' ↓ · ' + formatRate(Number(response.effective_other_up_kbit) * 1000) + ' ↑');
	setText('nm-shaper-degraded', 'Al agotar su cuota: ' + formatRate(Number(response.other_degraded_kbit) * 1000));
	setText('nm-shaper-priority', priority.length + ' equipos · fuera del shaping');
	setText('nm-shaper-count', String(response.other_count || 0) + ' equipos conocidos');
}

function applyQuota(button) {
	var input = document.getElementById('nm-quota-input');
	var quota = input ? Number(input.value) : NaN;
	if (!Number.isInteger(quota) || quota < 100 || quota > 1000000) {
		ui.addNotification(null, E('p', {}, 'Introduce una cuota entera entre 100 MB y 1.000.000 MB.'), 'error');
		return Promise.resolve();
	}
	if (button)
		button.disabled = true;
	beginAccountingAction();
	return callSetQuota(quota).then(function(result) {
		if (result.verified !== '1')
			throw new Error(result.error || 'La cuota no superó el readback.');
		renderAccounting(result);
		ui.addNotification(null, E('p', {}, 'Cuota diaria aplicada y verificada.'), 'info');
	}).catch(function(error) {
		ui.addNotification(null, E('p', {}, error.message || 'No se pudo aplicar la cuota.'), 'error');
		return L.resolveDefault(callAccounting(), {}).then(renderAccounting);
	}).finally(function() {
		endAccountingAction();
		if (button)
			button.disabled = false;
	});
}

function refreshAll() {
	var currentStatusEpoch = statusEpoch;
	var currentAccountingEpoch = accountingEpoch;
	return Promise.all([
		L.resolveDefault(callStatus(), {}).then(function(response) {
			if (!statusActions && currentStatusEpoch === statusEpoch)
				renderStatus(response);
		}),
		L.resolveDefault(callAccounting(), {}).then(function(response) {
			if (!accountingActions && currentAccountingEpoch === accountingEpoch)
				renderAccounting(response);
		}),
		L.resolveDefault(callShaper(), {}).then(renderShaper)
	]);
}

return view.extend({
	load: function() {
		// Keep initial navigation independent from the comparatively expensive
		// nftables/tc readback on low-memory MIPS hardware. Live values populate
		// immediately after the view is visible.
		return L.resolveDefault(callStatus(), {});
	},

	render: function(initial) {
		var map = new form.Map('nano-monitor', 'Monitor Nano', 'Velocidad pública y consumo diario exclusivamente de Internet. No se conserva historial de días anteriores.');
		var section = map.section(form.NamedSection, 'main', 'nano-monitor', 'Medición pública');
		var option;

		option = section.option(form.ListValue, 'profile', 'Precisión');
		option.value('quick', 'Rápida · 2 MB ↓ / 1 MB ↑');
		option.value('balanced', 'Equilibrada · 5 MB ↓ / 2 MB ↑');
		option.value('accurate', 'Alta · 10 MB ↓ / 4 MB ↑');
		option.default = 'balanced';
		option.rmempty = false;
		option.description = 'Cloudflare selecciona automáticamente un punto de presencia cercano. Una prueba mayor reduce el efecto de la latencia inicial, pero consume más datos.';

		option = section.option(form.Button, '_start', 'Prueba de velocidad');
		option.inputtitle = 'Iniciar prueba pública';
		option.inputstyle = 'apply';
		option.onclick = function(ev) {
			var button = ev && ev.currentTarget;
			if (button)
				button.setAttribute('data-nano-start', '1');
			beginStatusAction();
			return this.map.save().then(callStart).then(function(result) {
				if (result.ok !== '1')
					throw new Error(result.error || 'No se pudo iniciar la prueba.');
				renderStatus({ state: 'queued', message: 'Prueba en cola…' });
				ui.addNotification(null, E('p', {}, 'Prueba iniciada; descarga y subida se ejecutarán de forma secuencial.'), 'info');
			}).catch(function(error) {
				ui.addNotification(null, E('p', {}, error.message), 'error');
			}).finally(function() {
				endStatusAction();
			});
		};

		var dashboard = E('div', { 'class': 'nm-shell' }, [
			E('style', {}, '\
.nm-shell{--nm-blue:#1677ff;--nm-green:#20a66a;--nm-red:#d92d20;--nm-error:#b42318;--nm-text:var(--text-color-highest,#172033);--nm-muted:var(--text-color-high,#39465a);--nm-surface:var(--background-color-high,#fff);--nm-border:var(--border-color-medium,#d7e0eb);display:grid;gap:1.35rem;margin-top:1.2rem;color:var(--nm-text)}:root[data-darkmode="true"] .nm-shell{--nm-error:#ff8a80}.nm-shell h2{color:var(--nm-text);margin-bottom:.7rem}.nm-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem}.nm-card,.nm-quota{border:1px solid var(--nm-border);border-radius:14px;padding:1rem;background:color-mix(in srgb,var(--nm-blue) 6%,var(--nm-surface));box-shadow:0 1px 2px color-mix(in srgb,var(--nm-text) 9%,transparent)}.nm-card small,.nm-quota small{display:block;color:var(--nm-muted);opacity:1;margin-top:.3rem;line-height:1.4}.nm-value{font-size:1.25rem;font-weight:700;line-height:1.35;color:var(--nm-text)}.nm-state{display:flex;align-items:center;gap:.5rem}.nm-state:before{content:"";flex:0 0 auto;width:.65rem;height:.65rem;border-radius:50%;background:var(--nm-green);box-shadow:0 0 0 3px color-mix(in srgb,var(--nm-green) 18%,transparent)}.nm-errors{color:var(--nm-error);min-height:1.2em}.nm-quota{margin-top:.75rem}.nm-quota-head,.nm-quota-form{display:flex;align-items:end;justify-content:space-between;gap:1rem;flex-wrap:wrap}.nm-meter{height:.6rem;margin:.8rem 0 .7rem;border-radius:99px;background:var(--border-color-high,#d8e0ea);overflow:hidden}.nm-meter i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--nm-blue),var(--nm-green));transition:width .25s ease}.nm-meter i.is-blocked{background:var(--nm-red)}.nm-quota-form label{display:grid;gap:.3rem;font-weight:600;color:var(--nm-text)}.nm-quota-form input{max-width:11rem;color:var(--nm-text);background:var(--nm-surface);border-color:var(--nm-border)}.nm-note{color:var(--nm-muted);opacity:1;line-height:1.55;margin:.6rem 0 0}@media(max-width:800px){.nm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.nm-grid{grid-template-columns:1fr}.nm-quota-form>*{width:100%}.nm-quota-form input{max-width:none}}'),
			E('style', {}, '.nm-device-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:.75rem;margin-top:.9rem}.nm-device{border:1px solid var(--nm-border);border-radius:12px;padding:.85rem;background:var(--nm-surface)}.nm-device.is-degraded{border-color:color-mix(in srgb,var(--nm-red) 55%,var(--nm-border));background:color-mix(in srgb,var(--nm-red) 5%,var(--nm-surface))}.nm-device-head{display:flex;justify-content:space-between;align-items:flex-start;gap:.75rem}.nm-device-head strong{display:block;overflow-wrap:anywhere}.nm-device-head small{display:block;color:var(--nm-muted);margin-top:.25rem;overflow-wrap:anywhere}.nm-device-state{flex:none;font-size:.78rem;font-weight:700;color:var(--nm-text);border:1px solid var(--nm-border);border-radius:99px;padding:.2rem .5rem}.nm-device.is-degraded .nm-device-state{color:var(--nm-red);border-color:currentColor}.nm-device-policy{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem;margin-top:.8rem;padding-top:.75rem;border-top:1px solid var(--nm-border)}.nm-device-policy label{display:grid;gap:.25rem;color:var(--nm-muted);font-size:.78rem;font-weight:600}.nm-device-policy input{width:100%;min-width:0;box-sizing:border-box;color:var(--nm-text);background:var(--nm-surface);border-color:var(--nm-border)}.nm-device-actions{grid-column:1/-1;display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.15rem}.nm-device-actions .cbi-button{flex:1 1 9rem}@media(max-width:420px){.nm-device-policy{grid-template-columns:1fr}.nm-device-actions{grid-column:auto}}'),
			E('section', { 'aria-labelledby': 'nm-speed-title' }, [
				E('h2', { 'id': 'nm-speed-title' }, 'Última prueba'),
				E('div', { 'class': 'nm-grid' }, [
					E('div', { 'class': 'nm-card' }, [ E('small', {}, 'Estado'), E('div', { 'id': 'nm-state', 'class': 'nm-value nm-state', 'aria-live': 'polite' }, '—'), E('small', { 'id': 'nm-message' }, '') ]),
					E('div', { 'class': 'nm-card' }, [ E('small', {}, 'Descarga'), E('div', { 'id': 'nm-download', 'class': 'nm-value' }, '—') ]),
					E('div', { 'class': 'nm-card' }, [ E('small', {}, 'Subida'), E('div', { 'id': 'nm-upload', 'class': 'nm-value' }, '—') ]),
					E('div', { 'class': 'nm-card' }, [ E('small', {}, 'Latencia · CPU del Nano'), E('div', { 'id': 'nm-latency', 'class': 'nm-value' }, '—'), E('small', { 'id': 'nm-cpu' }, '—') ])
				]),
				E('p', { 'id': 'nm-errors', 'class': 'nm-errors', 'role': 'status' }, '')
			]),
			E('section', { 'aria-labelledby': 'nm-account-title' }, [
				E('h2', { 'id': 'nm-account-title' }, 'Internet de hoy'),
				E('div', { 'class': 'nm-grid' }, [
					E('div', { 'class': 'nm-card' }, [ E('small', {}, 'Estado'), E('div', { 'id': 'nm-account-state', 'class': 'nm-value nm-state', 'aria-live': 'polite' }, '—'), E('small', { 'id': 'nm-account-message' }, '') ]),
					E('div', { 'class': 'nm-card' }, [ E('small', {}, 'Total · subida + descarga'), E('div', { 'id': 'nm-daily-total', 'class': 'nm-value' }, '—') ]),
					E('div', { 'class': 'nm-card' }, [ E('small', {}, 'PC + teléfono'), E('div', { 'id': 'nm-daily-priority', 'class': 'nm-value' }, '—'), E('small', {}, 'No reduce la cuota') ]),
					E('div', { 'class': 'nm-card' }, [ E('small', {}, 'Otros'), E('div', { 'id': 'nm-daily-others', 'class': 'nm-value' }, '—'), E('small', {}, 'Sí reduce la cuota') ])
				]),
				E('div', { 'class': 'nm-quota' }, [
					E('div', { 'class': 'nm-quota-head' }, [ E('div', {}, [ E('small', {}, 'Cuota diaria individual'), E('div', { 'id': 'nm-quota-remaining', 'class': 'nm-value' }, '—') ]), E('small', { 'id': 'nm-quota-label' }, '—') ]),
					E('div', { 'class': 'nm-meter', 'role': 'progressbar', 'aria-label': 'Consumo agregado de las cuotas individuales', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, E('i', { 'id': 'nm-quota-progress' })),
					E('div', { 'class': 'nm-quota-form' }, [
						E('label', {}, [ 'Cuota diaria por dispositivo (MB)', E('input', { 'id': 'nm-quota-input', 'type': 'number', 'min': '100', 'max': '1000000', 'step': '100', 'inputmode': 'numeric' }) ]),
						E('button', { 'type': 'button', 'class': 'cbi-button cbi-button-apply', 'click': function(ev) { return applyQuota(ev.currentTarget); } }, 'Aplicar cuota')
					]),
					E('div', { 'id': 'nm-device-list', 'class': 'nm-device-list', 'aria-live': 'polite' }),
					E('p', { 'class': 'nm-note' }, 'Los MB extra son una compensación sólo para hoy y vencen en el reinicio diario. Una velocidad personalizada permanece hasta pulsar “Usar valores generales”.')
				])
			]),
			E('section', { 'aria-labelledby': 'nm-shaper-title' }, [
				E('h2', { 'id': 'nm-shaper-title' }, 'Prioridad de red'),
				E('div', { 'class': 'nm-grid' }, [
					E('div', { 'class': 'nm-card' }, [ E('small', {}, 'Estado efectivo'), E('div', { 'id': 'nm-shaper-state', 'class': 'nm-value nm-state' }, '—'), E('small', { 'id': 'nm-shaper-message' }, '') ]),
					E('div', { 'class': 'nm-card' }, [ E('small', {}, 'Máximo configurable por Otro'), E('div', { 'id': 'nm-shaper-total', 'class': 'nm-value' }, '—') ]),
					E('div', { 'class': 'nm-card' }, [ E('small', {}, 'Valor general por cada Otro'), E('div', { 'id': 'nm-shaper-ordinary', 'class': 'nm-value' }, '—'), E('small', { 'id': 'nm-shaper-degraded' }, '—') ]),
					E('div', { 'class': 'nm-card' }, [ E('small', {}, 'Equipos prioritarios'), E('div', { 'id': 'nm-shaper-priority', 'class': 'nm-value' }, '—'), E('small', { 'id': 'nm-shaper-count' }, '—') ])
				]),
				E('p', { 'class': 'nm-note' }, 'PC y teléfono prioritarios no pasan por los topes de Nano Monitor; su velocidad depende sólo de la red y del proveedor. Otros parte de 768/128 Kbit/s salvo ajuste individual; al agotar su disponibilidad diaria continúa conectado a 64 Kbit/s.')
			])
		]);

		return map.render().then(function(formNode) {
			window.setTimeout(function() {
				var startButton = formNode.querySelector('.cbi-button-apply');
				if (startButton)
					startButton.setAttribute('data-nano-start', '1');
				renderStatus(initial);
				// poll.add() performs the first refresh immediately. A daily dashboard
				// does not need deep nftables/tc verification every ten seconds.
				poll.add(refreshAll, 30);
			}, 0);
			return E([ formNode, dashboard ]);
		});
	}
});
