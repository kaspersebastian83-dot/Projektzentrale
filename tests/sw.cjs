// Service Worker: alle Dateien, die offline vorgehalten werden, gibt es; pdf.js (Arbeitszettel einlesen) ist dabei.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const assets = [...sw.match(/const ASSETS = \[([\s\S]*?)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
for (const a of assets) if (a !== './') assert.ok(fs.existsSync(path.join(root, a)), 'fehlt: ' + a);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pdfjs = html.match(/const PDFJS = '([^']+)'/)[1];
for (const f of ['pdf.min.js', 'pdf.worker.min.js']) assert.ok(assets.includes('./' + pdfjs + f), 'offline vorhalten: ' + pdfjs + f);
console.log('Service Worker: ' + assets.length + ' Dateien, alle vorhanden, pdf.js dabei');
