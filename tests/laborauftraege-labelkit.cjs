// Kopie gegen LabelKit (ab Projektzentrale 1.55.0, Plan projektzentrale-auftraege-plan.md P4): laborauftraege.js rechnet die Regel von
// LabelKit 5.5.0 nach (index.html, Block „NACHAUFTRAG (5.5.0)“: auftraegeAnwenden, auftraegePruefen, auftragMerkmalGilt, auftragVon,
// nrIstFest, neueProbenListen). Gleiche Projektdatei → gleiche Kennung je Probe, gleiche Aufträge (Kennung, Tag, Proben), gleiche neue
// Proben, gleiches „neu aufgebaut“. Ändert LabelKit die Regel, wird dieser Test rot. Muster: ResultKit tests/auftrag-labelkit.mjs.
// Nur erfundene Proben. LabelKit daneben (../labelkit oder LABELKIT_DIR); in der CI Pflicht (LABELKIT_PFLICHT=1), sonst SKIP.
'use strict';
process.env.TZ = process.env.TZ || 'Europe/Berlin';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = require('../laborauftraege.js');

const lk = path.resolve(process.env.LABELKIT_DIR || path.join(__dirname, '..', '..', 'labelkit')), datei = path.join(lk, 'index.html');
if (!fs.existsSync(datei)){
  if (process.env.LABELKIT_PFLICHT === '1'){ console.error(`LabelKit fehlt: ${datei} (LABELKIT_PFLICHT=1)`); process.exit(1); }
  console.log(`SKIP Kopie Laborauftrag: ${datei} nicht gefunden`); process.exit(0);
}
const html = fs.readFileSync(datei, 'utf8');
const zeile = start => { const i = html.indexOf(start); assert.ok(i >= 0, `LabelKit index.html: ${start}`); return html.slice(i, html.indexOf('\n', i)); };
const block = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, `LabelKit index.html: Block ${a}`); return html.slice(i, j); };
const code = [zeile('function nrIstFest(p)'), zeile('function istStorniert('), zeile('function aktiv(liste)'), zeile('function nummerierteListen()'),
  block('// ── NACHAUFTRAG (5.5.0)', '// ── /NACHAUFTRAG')].join('\n');
const LISTEN = ['proben', 'chloridProben', 'asbestProben', 'sonstigeProben'];

/** LabelKit mit der Projektdatei laden (auftraegeAnwenden wie in applyProjektData) und fragen: Kennung je Probe, Aufträge, neue Proben. */
function labelkit(data){
  const c = { console, APP_VERSION: '5.5.0', document: { getElementById: () => null }, PROJEKTORDNER: { state: { pj: null }, projektdaten: () => ({}) }, PROJEKT_URL: { projekt: null, mitteilung: null } };
  for (const k of LISTEN) c[k] = data[k] || [];
  vm.createContext(c); vm.runInContext(code + '\n;globalThis.__get = n => eval(n);', c);
  c.auftraegeAnwenden(data);
  const proben = LISTEN.flatMap(k => c[k]);
  const nr = p => Number(p._nr) || Number(p.chloridNr) || Number(p.id) || 0;
  const neu = c.neueProbenListen().flat().map(nr).filter(Boolean).sort((a, b) => a - b);
  const auftraege = JSON.parse(JSON.stringify(c.auftraegeBekannt())).map(a => ({ id: a.id, am: /^\d{4}-\d{2}-\d{2}$/.test(String(a.am || '').slice(0, 10)) ? String(a.am).slice(0, 10) : '',
    proben: c.aktiv(proben).filter(p => c.auftragVon(p) === a.id).map(nr).filter(Boolean).sort((x, y) => x - y) }));
  return JSON.parse(JSON.stringify({ kennung: proben.map(p => c.auftragVon(p)), aufgebaut: c.__get('auftragAufgebaut') !== '', auftraege, neu }));   // aus dem vm-Kontext lösen
}
function projektzentrale(data){
  const r = L.lesen(data), proben = LISTEN.flatMap(k => Array.isArray(data[k]) ? data[k] : []);
  return { kennung: proben.map(p => r.von(p)), aufgebaut: r.aufgebaut, auftraege: r.auftraege.map(a => ({ id: a.id, am: a.am, proben: a.proben })), neu: r.neu };
}

// Erfundenes Projekt wie LabelKit 5.5.0 es schreibt: Runde 1 (14.08.) P1–P8 PAK, P9–P13 Chlorid → a1; Runde 2 (22.08.) P14–P17 PAK, P18–P21 Asbest → a2
const r = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const fest = tag => ({ am: `${tag}T10:00:00.000Z`, anlass: 'Abschluss' });
const probe = (n, a, x = {}) => ({ id: n, _nr: n, matrix: 'Wischprobe', datum: a === 'a2' ? '2026-08-20' : '2026-08-12', z2: `EG Raum ${n}`, z3: 'verrußt', z4: 'Untersicht', nrFest: fest(a === 'a1' ? '2026-08-14' : '2026-08-22'), ...(a ? { auftrag: a } : {}), ...x });
const gespeichert = () => ({ version: '5.5.0', nrSchutz: 1, projekt: { nr: '26.0999' },
  proben: [...r(1, 8).map(n => probe(n, 'a1')), ...r(14, 17).map(n => probe(n, 'a2'))], chloridProben: r(9, 13).map(n => probe(n, 'a1', { chloridNr: n })),
  asbestProben: r(18, 21).map(n => probe(n, 'a2', { matrix: 'Material (mineralisch)' })), sonstigeProben: [],
  weitereAuftraege: [{ id: 'a2', am: '2026-08-22', von: 'Ka', proben: r(14, 21) }], auftragZaehler: 2, auftrag1: { am: '2026-08-14', quelle: 'Laborübergabe vom 14.08.2026', proben: r(1, 13) } });
const ohne = (d, ...felder) => { for (const f of felder) delete d[f]; return d; };
const fixture = path.join(__dirname, 'fixtures', 'labelkit-5.5.0-zwei-auftraege.json');
const FAELLE = [
  ['wie gespeichert', gespeichert()],
  ['von LabelKit 5.5.0 im Browser geschrieben (Vorlage)', JSON.parse(fs.readFileSync(fixture, 'utf8'))],
  ['Liste und Zähler entfernt (5.4.0 hat gespeichert)', ohne(gespeichert(), 'weitereAuftraege', 'auftragZaehler', 'auftrag1')],
  ['nur weitereAuftraege fehlt', ohne(gespeichert(), 'weitereAuftraege')],
  ['nur auftrag1 fehlt', ohne(gespeichert(), 'auftrag1')],
  ['nur der Zähler fehlt', ohne(gespeichert(), 'auftragZaehler')],
  ['Kopie P22 mit Merkmal a2 ohne feste Nummer', (d => { d.proben.push({ ...probe(22, 'a2'), nrFest: undefined }); return d; })(gespeichert())],
  ['P5 mit Merkmal a2, aber nicht in der Liste von Auftrag 2', (d => { d.proben[4].auftrag = 'a2'; return d; })(gespeichert())],
  ['P14 in der Liste, aber ohne feste Nummer', (d => { delete d.proben[8].nrFest; return d; })(gespeichert())],
  ['Merkmal a7 ohne Liste mit fester Nummer (wird aufgebaut)', (d => { d.proben.push(probe(22, 'a7', { nrFest: fest('2026-09-01') })); return d; })(gespeichert())],
  ['Merkmal a7 ohne feste Nummer und ohne Liste', (d => { d.proben.push({ ...probe(22, 'a7'), nrFest: undefined }); return d; })(gespeichert())],
  ['ein Auftrag (keine Merkmale)', ohne((d => { for (const l of ['proben', 'chloridProben', 'asbestProben']) for (const p of d[l]) delete p.auftrag; return d; })(gespeichert()), 'weitereAuftraege', 'auftragZaehler', 'auftrag1')],
  ['ein Auftrag, Runde 1 von LabelKit 5.5.0 im Browser geschrieben (Vorlage)', JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'labelkit-5.5.0-ein-auftrag.json'), 'utf8'))],
  ['stornierte Probe mit Merkmal (storniert macht die Nummer fest)', (d => { d.proben.push({ ...probe(22, 'a2'), nrFest: undefined, storniert: { am: '2026-08-23', kuerzel: 'Ka', grund: 'doppelt' } }); d.weitereAuftraege[0].proben.push(22); return d; })(gespeichert())],
  ['neue Proben ohne Merkmal neben zwei Aufträgen', (d => { d.proben.push({ ...probe(22, ''), nrFest: undefined }, probe(23, '')); return d; })(gespeichert())],
  ['seltsame Merkmale (a0, b2, Zahl, leer, null)', (d => { d.proben[0].auftrag = 'a0'; d.proben[1].auftrag = 'b2'; d.proben[2].auftrag = 2; d.proben[3].auftrag = ''; d.proben[4].auftrag = null; return d; })(gespeichert())],
  ['Liste mit Nummern als Text, kaputte Einträge', (d => { d.auftrag1.proben = d.auftrag1.proben.map(String); d.weitereAuftraege.push(null, { id: 'x9' }, { id: 'a3' }); return d; })(gespeichert())],
  ['auftrag1 ohne Probenliste', (d => { d.auftrag1 = { am: '2026-08-14' }; return d; })(gespeichert())],
  ['Chlorid ohne _nr (nur chloridNr), Liste fehlt', (d => { for (const p of d.chloridProben) delete p._nr; return ohne(d, 'weitereAuftraege', 'auftragZaehler', 'auftrag1'); })(gespeichert())],
  ['drei Aufträge, Auftrag 2 zurückgenommen (Kennung verbraucht)', (d => { d.proben.push(...[22, 23].map(n => probe(n, 'a3', { nrFest: fest('2026-09-03') }))); d.weitereAuftraege = [{ id: 'a3', am: '2026-09-03', von: 'Ka', proben: [22, 23] }]; d.auftragZaehler = 3;
    for (const p of [...d.proben, ...d.asbestProben]) if (p.auftrag === 'a2') delete p.auftrag; return d; })(gespeichert())],
];
let n = 0;
for (const [name, data] of FAELLE){
  const a = labelkit(JSON.parse(JSON.stringify(data))), b = projektzentrale(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(b.kennung, a.kennung, `${name}: Kennung je Probe`);
  assert.equal(b.aufgebaut, a.aufgebaut, `${name}: Liste neu aufgebaut`);
  assert.deepEqual(b.auftraege, a.auftraege, `${name}: Aufträge (Kennung, Tag, Proben)`);
  assert.deepEqual(b.neu, a.neu, `${name}: neue Proben`);
  n++;
}
// Gegenprobe: die Fälle unterscheiden wirklich (sonst prüfte der Vergleich nichts)
const k = i => labelkit(JSON.parse(JSON.stringify(FAELLE[i][1])));
assert.equal(k(0).kennung.filter(Boolean).length, 21);
assert.deepEqual(k(1).auftraege.map(a => [a.id, a.am, a.proben.length]), [['a1', '2026-08-14', 13], ['a2', '2026-08-22', 8]], 'Vorlage aus dem Browser: zwei Aufträge');
assert.equal(k(2).aufgebaut, true); assert.equal(k(0).aufgebaut, false);
assert.deepEqual(k(6).neu, [22], 'Kopie ohne feste Nummer ist neu'); assert.deepEqual(k(7).neu, [5], 'nicht in der Liste ist neu');
assert.deepEqual(k(11).auftraege, [], 'ein Auftrag: keine Aufträge'); assert.deepEqual(k(12).auftraege, []);
// Was nur die Projektzentrale braucht: mehrere, Kennung je Label, Probenahme, Lesart „ein Auftrag“
const v = L.lesen(FAELLE[1][1]);
assert.equal(v.mehrere, true);
assert.equal(v.kennungJe.P13, 'a1'); assert.equal(v.kennungJe.P14, 'a2');
assert.deepEqual(v.auftraege.map(a => [a.nr, a.von, a.probenahme]), [[1, '', ['2026-08-12', '2026-08-12']], [2, 'Ka', ['2026-08-20', '2026-08-20']]]);
assert.equal(L.nrListeText(v.auftraege[1].proben), 'P14–P21');
assert.equal(L.lesen(FAELLE[12][1]).mehrere, false, 'Runde 1: ein Auftrag');
assert.deepEqual(L.lesen(FAELLE[12][1]).kennungJe, {});
assert.equal(L.lesen(null).mehrere, false); assert.deepEqual(L.lesen({}).auftraege, []);
const vorher = JSON.stringify(FAELLE[0][1]); L.lesen(FAELLE[0][1]); assert.equal(JSON.stringify(FAELLE[0][1]), vorher, 'ändert die Datei nicht');
console.log(`OK Kopie LabelKit: Laborauftrag je Probe, Aufträge und neue Proben gleich (${n} Fälle, ${lk})`);
