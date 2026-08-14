'use strict';
'require view';
'require form';
'require rpc';
'require poll';
'require ui';
'require uci';

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

var callDevices = rpc.declare({
	object: 'luci.nano-monitor',
	method: 'devices',
	expect: { '': {} }
});

var previousCounters = {};
var previousTime = 0;

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

function parseLeases(raw) {
	var byMac = {}, byIp = {};
	(raw || '').split(/\n/).forEach(function(line) {
		var fields = line.trim().split(/\s+/);
		if (fields.length >= 4) {
			var lease = { mac: fields[1].toLowerCase(), ip: fields[2], name: fields[3] === '*' ? '' : fields[3] };
			byMac[lease.mac] = lease;
			byIp[lease.ip] = lease;
		}
	});
	return { byMac: byMac, byIp: byIp };
}

function renderDevices(response) {
	var body = document.getElementById('nm-devices-body');
	var note = document.getElementById('nm-devices-note');
	if (!body || !note)
		return;

	var payload;
	try {
		payload = JSON.parse(response.nlbw || '');
		if (!Array.isArray(payload.columns) || !Array.isArray(payload.data))
			throw new Error('shape');
	}
	catch (e) {
		body.replaceChildren();
		note.textContent = response.error || (response.nlbw ? 'nlbwmon devolvió JSON no válido.' : 'nlbwmon está iniciando; vuelve a comprobar en unos segundos.');
		previousCounters = {};
		previousTime = 0;
		return;
	}

	var columns = {}, leases = parseLeases(response.leases), now = Date.now(), rows = [];
	payload.columns.forEach(function(name, index) { columns[name] = index; });
	if (columns.ip == null || columns.mac == null || columns.rx_bytes == null || columns.tx_bytes == null) {
		body.replaceChildren();
		note.textContent = 'nlbwmon no entregó las columnas esperadas.';
		return;
	}

	payload.data.forEach(function(record) {
		var ip = String(record[columns.ip] || ''), mac = String(record[columns.mac] || '').toLowerCase();
		var down = Number(record[columns.rx_bytes]) || 0, up = Number(record[columns.tx_bytes]) || 0;
		var key = ip + '|' + mac, old = previousCounters[key], seconds = previousTime ? (now - previousTime) / 1000 : 0;
		var downRate = old && seconds > 0 ? Math.max(0, down - old.down) / seconds : 0;
		var upRate = old && seconds > 0 ? Math.max(0, up - old.up) / seconds : 0;
		var lease = leases.byMac[mac] || leases.byIp[ip] || {};
		rows.push({ key: key, ip: ip, mac: mac, name: lease.name || 'Sin nombre', down: down, up: up, downRate: downRate, upRate: upRate });
	});

	rows.sort(function(a, b) { return (b.down + b.up) - (a.down + a.up); });
	var maxRate = rows.reduce(function(max, row) { return Math.max(max, row.downRate + row.upRate); }, 1);
	body.replaceChildren.apply(body, rows.map(function(row) {
		var speed = row.downRate + row.upRate;
		return E('tr', {}, [
			E('td', { 'data-title': 'Equipo' }, [ E('strong', {}, row.name), E('small', {}, row.ip + ' · ' + (row.mac || 'MAC desconocida')) ]),
			E('td', { 'data-title': 'Descarga' }, formatBytes(row.down)),
			E('td', { 'data-title': 'Subida' }, formatBytes(row.up)),
			E('td', { 'data-title': 'Velocidad' }, [
				E('span', {}, '↓ ' + formatBytes(row.downRate) + '/s · ↑ ' + formatBytes(row.upRate) + '/s'),
				E('span', { 'class': 'nm-bar', 'aria-hidden': 'true' }, E('i', { 'style': 'width:' + Math.min(100, speed / maxRate * 100).toFixed(1) + '%' }))
			])
		]);
	}));

	previousCounters = {};
	rows.forEach(function(row) { previousCounters[row.key] = { down: row.down, up: row.up }; });
	previousTime = now;
	note.textContent = rows.length ? 'Velocidad estimada entre consultas de 10 segundos.' : 'Todavía no hay equipos contabilizados.';
}

function refreshAll() {
	return Promise.all([
		L.resolveDefault(callStatus(), {}),
		L.resolveDefault(callDevices(), { error: 'No se pudo consultar nlbwmon.' })
	]).then(function(data) {
		renderStatus(data[0]);
		renderDevices(data[1]);
	});
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callStatus(), {}),
			L.resolveDefault(callDevices(), { error: 'No se pudo consultar nlbwmon.' }),
			uci.load('bwlimit')
		]);
	},

	render: function(initial) {
		var map = new form.Map('nano-monitor', 'Monitor Nano', 'Prueba pública iniciada por el propio Nano y consumo acumulado de la red local. Los resultados de velocidad son temporales y desaparecen al reiniciar.');
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
			return this.map.save().then(callStart).then(function(result) {
				if (result.ok !== '1')
					throw new Error(result.error || 'No se pudo iniciar la prueba.');
				renderStatus({ state: 'queued', message: 'Prueba en cola…' });
				ui.addNotification(null, E('p', {}, 'Prueba iniciada; descarga y subida se ejecutarán de forma secuencial.'), 'info');
			}).catch(function(error) {
				ui.addNotification(null, E('p', {}, error.message), 'error');
			});
		};

		var downLimit = Number(uci.get('bwlimit', 'main', 'down_kbytes')) || 0;
		var upLimit = Number(uci.get('bwlimit', 'main', 'up_kbytes')) || 0;
		var limitsEnabled = uci.get('bwlimit', 'main', 'enabled') === '1';
		var exempt = uci.get('bwlimit', 'main', 'exempt_ip') || [];
		if (!Array.isArray(exempt))
			exempt = [ exempt ];

		var dashboard = E('div', { 'class': 'nm-shell' }, [
			E('style', {}, '\
.nm-shell{--nm-blue:#1677ff;--nm-green:#20a66a;--nm-ink:#172033;display:grid;gap:1rem;margin-top:1.2rem}.nm-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem}.nm-card{border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:12px;padding:1rem;background:color-mix(in srgb,var(--nm-blue) 4%,transparent)}.nm-card small,.nm-device small{display:block;opacity:.68;margin-top:.3rem}.nm-value{font-size:1.25rem;font-weight:700;color:var(--nm-ink)}.dark .nm-value{color:#eef4ff}.nm-state{display:flex;align-items:center;gap:.5rem}.nm-state:before{content:"";width:.65rem;height:.65rem;border-radius:50%;background:var(--nm-green)}.nm-errors{color:#b42318;min-height:1.2em}.nm-table-wrap{overflow-x:auto}.nm-table{width:100%}.nm-table td{vertical-align:middle}.nm-bar{display:block;width:100%;height:.32rem;margin-top:.45rem;border-radius:99px;background:color-mix(in srgb,currentColor 12%,transparent);overflow:hidden}.nm-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--nm-blue),var(--nm-green));border-radius:inherit}.nm-note{opacity:.7;margin:.5rem 0 0}@media(max-width:800px){.nm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.nm-grid{grid-template-columns:1fr}.nm-table thead{display:none}.nm-table tr{display:block;border-bottom:1px solid color-mix(in srgb,currentColor 16%,transparent);padding:.5rem 0}.nm-table td{display:grid;grid-template-columns:6.5rem 1fr;border:0;padding:.35rem}.nm-table td:before{content:attr(data-title);font-weight:600;opacity:.7}}'),
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
			E('section', { 'aria-labelledby': 'nm-devices-title' }, [
				E('h2', { 'id': 'nm-devices-title' }, 'Consumo por equipo'),
				E('p', { 'class': 'nm-note' }, limitsEnabled
					? 'Límite agregado activo: ↓ ' + formatRate(downLimit * 8000) + ' · ↑ ' + formatRate(upLimit * 8000) + (exempt.length ? ' · Exentos: ' + exempt.join(', ') : '')
					: 'El límite agregado bwlimit está desactivado.'),
				E('div', { 'class': 'nm-table-wrap' }, E('table', { 'class': 'table nm-table' }, [
					E('thead', {}, E('tr', {}, [ E('th', {}, 'Equipo'), E('th', {}, 'Descarga acumulada'), E('th', {}, 'Subida acumulada'), E('th', {}, 'Velocidad actual') ])),
					E('tbody', { 'id': 'nm-devices-body' })
				])),
				E('p', { 'id': 'nm-devices-note', 'class': 'nm-note', 'role': 'status' }, '')
			])
		]);

		return map.render().then(function(formNode) {
			window.setTimeout(function() {
				var startButton = formNode.querySelector('.cbi-button-apply');
				if (startButton)
					startButton.setAttribute('data-nano-start', '1');
				renderStatus(initial[0]);
				renderDevices(initial[1]);
				poll.add(refreshAll, 10);
			}, 0);
			return E([ formNode, dashboard ]);
		});
	}
});
