// Hilfe-Links ins Handbuch: nur feste Kapiteladressen aus AidKit (hilfe-anker.json), gemeinsames Fenster „aidkit“ –
// Projektzentrale (handbuchLink) und Datenarchiv (archiv/index.html). Liegt AidKit daneben, wird dessen Liste gelesen.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');
const FEST = ['start', 'brandschaden', 'bohrkern-ablauf', 'app-projektzentrale', 'app-labelkit', 'app-fotokit', 'app-resultkit', 'app-plankit', 'app-belegkit', 'app-spesenkit', 'app-datenarchiv', 'bohrkern', 'wischprobe', 'raumkuerzel'];
const neben = path.join(root, '..', 'aidkit', 'hilfe-anker.json');
const anker = fs.existsSync(neben) ? Object.keys(JSON.parse(fs.readFileSync(neben, 'utf8')).anker) : FEST;
if (fs.existsSync(neben)) assert.deepEqual([...anker].sort(), [...FEST].sort(), 'Liste hier = hilfe-anker.json in AidKit');
const pz = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), ar = fs.readFileSync(path.join(root, 'archiv', 'index.html'), 'utf8');
const pzIds = [...pz.matchAll(/handbuchLink\('([a-z0-9-]+)'/g)].map(m => m[1]);
assert.deepEqual(pzIds.sort(), ['app-projektzentrale', 'app-projektzentrale', 'brandschaden'], 'Projektdaten + Kurzanleitung');
assert.match(pz, /const handbuchLink = [^\n]*href="\$\{AIDKIT_URL\}#\$\{anker\}" target="aidkit" rel="noopener"/, 'gemeinsames Fenster „aidkit“');
const arLinks = [...ar.matchAll(/<a\b[^>]*href="\.\.\/\.\.\/aidkit\/#([^"]+)"[^>]*>/g)];
assert.equal(arLinks.length, 1); assert.equal(arLinks[0][1], 'app-datenarchiv'); assert.match(arLinks[0][0], /target="aidkit" rel="noopener"/);
for (const id of [...pzIds, ...arLinks.map(l => l[1])]) assert.ok(anker.includes(id), `#${id} ist keine feste Handbuch-Adresse`);
console.log(`OK Hilfe-Links: ${pzIds.length + arLinks.length} Links auf feste Handbuch-Adressen${fs.existsSync(neben) ? ' (mit AidKit-Liste geprüft)' : ''}`);
