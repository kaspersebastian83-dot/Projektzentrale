// Link „💬 Rückmeldung“ unter „Weitere Apps“: eigenes Fenster, Programm + Version immer, Projekt nur als Nummer.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const pick = re => { const m = html.match(re); assert.ok(m, 'fehlt: ' + re); return m[0]; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const APP_VERSION = pick(/const APP_VERSION = '[^']+'/).split("'")[1];
const RUECKMELDUNG_URL = pick(/const RUECKMELDUNG_URL = '[^']+'/).split("'")[1];
assert.equal(RUECKMELDUNG_URL, '../rueckmeldung/');
const fn = pick(/function rueckmeldungUrl\(\)\{[\s\S]*?\n\}/);
const make = S => new Function('S', 'esc', 'APP_VERSION', 'RUECKMELDUNG_URL', fn + '; return rueckmeldungUrl();')(S, esc, APP_VERSION, RUECKMELDUNG_URL);
assert.equal(make({ sel: null }), `../rueckmeldung/?app=projektzentrale&amp;version=${APP_VERSION}`);
const mit = make({ sel: { nr: '26.0123', name: '26.0123 Köln Nad' } }).replace(/&amp;/g, '&');
const q = new URLSearchParams(mit.split('?')[1]);
assert.equal(q.get('app'), 'projektzentrale'); assert.equal(q.get('version'), APP_VERSION); assert.equal(q.get('projekt'), '26.0123');
assert.ok(!/K%C3%B6ln|Köln/.test(mit), 'kein Ort im Link');
const a = pick(/<a class="app" id="goRueck"[^>]*>/);
assert.match(a, /href="\$\{rueckmeldungUrl\(\)\}"/); assert.match(a, /target="rueckmeldung" rel="noopener"/);
console.log('OK Rückmeldung-Link: eigenes Fenster, Programm/Version, Projekt nur als Nummer');
