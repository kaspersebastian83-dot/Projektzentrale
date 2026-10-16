// Word-Schreiber: gültiges Paket, korrektes XML, Maskierung, Tabellen, Bilder, nur direkte Formatierung.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const lade = require('./lade.cjs');
const { DOCX } = lade();
const dec = new TextDecoder();

// 1×1-PNG
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
const bytes = DOCX.build({ title: 'Test <&>', author: 'Projektzentrale', created: '2026-10-16T16:00:00.000Z', blocks: [
  { t: 'p', text: 'Überschrift & „Anführung“ <b>', size: 12, u: true },
  { t: 'p', runs: [{ text: 'fett', b: true }, { text: ' kursiv\nneue Zeile\tTab', i: true }], align: 'both' },
  { t: 'p', text: 'Steuerzeichen\u0001\u0008 weg, Emoji 🔥 bleibt, einzelnes Surrogat \uD800 weg' },
  { t: 'table', widths: [3000, 3000, 3070], rows: [
    { header: true, cells: [{ text: 'A', b: true, shade: 'F2F2F2' }, { text: 'B' }, { text: 'C' }] },
    { cells: [{ text: 'über zwei', span: 2 }, { text: '' }] }] },
  { t: 'pagebreak' },
  { t: 'image', data: png, ext: 'png', widthMm: 50, heightMm: 50, alt: 'Foto "1"' },
] });
const files = lade.unzip(bytes, DOCX.crc32);
for (const n of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/settings.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml', 'docProps/app.xml', 'word/media/bild1.png'])
  assert.ok(files[n], 'Teil vorhanden: ' + n);
assert.deepEqual(Array.from(files['word/media/bild1.png']), Array.from(png), 'Bild unverändert');
const doc = dec.decode(files['word/document.xml']);
assert.match(doc, /Überschrift &amp; „Anführung“ &lt;b&gt;/);
assert.match(doc, /<w:u w:val="single"\/>/);
assert.match(doc, /<w:t xml:space="preserve"> kursiv<\/w:t><\/w:r>|<w:t xml:space="preserve"> kursiv<\/w:t><w:br\/>/);
assert.match(doc, /<w:br\/><w:t xml:space="preserve">neue Zeile<\/w:t><w:tab\/>/);
assert.doesNotMatch(doc, /[\u0001\u0008]/, 'Steuerzeichen entfernt');
assert.ok(doc.includes('🔥'), 'Emoji bleibt');
assert.doesNotMatch(doc, /\uD800(?![\uDC00-\uDFFF])/, 'einzelnes Surrogat entfernt');
assert.match(doc, /<w:gridSpan w:val="2"\/>/);
assert.match(doc, /<w:tblHeader\/>/);
assert.match(doc, /<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"\/>/);
assert.match(doc, /<w:br w:type="page"\/>/);
assert.match(doc, /r:embed="rIdImg1"/);
assert.match(doc, /<wp:extent cx="1800000" cy="1800000"\/>/, '50 mm = 1 800 000 EMU');
assert.match(doc, /descr="Foto &quot;1&quot;"/);
assert.match(doc, /<w:pgSz w:w="11906" w:h="16838"\/>/, 'A4');
assert.match(doc, /w:right="1418" [^>]*w:left="1418"/, '25 mm seitlich wie im Bericht');
assert.doesNotMatch(doc, /headerReference|footerReference/, 'keine Kopf-/Fußzeilen');
assert.doesNotMatch(doc, /<w:pStyle /, 'nur direkte Formatierung – keine Formatvorlagen, die der Bericht überschreiben würde');
assert.match(doc, /<w:rFonts w:ascii="Arial"/);
assert.match(doc, /<\/w:tbl><w:p>/, 'nach einer Tabelle folgt ein Absatz');
assert.match(dec.decode(files['docProps/core.xml']), /<dc:title>Test &lt;&amp;&gt;<\/dc:title>/);
assert.match(dec.decode(files['word/_rels/document.xml.rels']), /Target="media\/bild1.png"/);
assert.match(dec.decode(files['[Content_Types].xml']), /Extension="png"/);
assert.throws(() => DOCX.build({ blocks: [{ t: 'table', widths: [100, 100], rows: [{ cells: [{ text: 'x' }] }] }] }), /1 statt 2 Spalten/);
assert.throws(() => DOCX.build({ blocks: [{ t: 'video' }] }), /Unbekannter Baustein/);
{ const f = DOCX.fit(4000, 3000, 160, 100); assert.equal(f.heightMm, 100); assert.ok(Math.abs(f.widthMm - 133.333) < 0.001, 'Seitenverhältnis bleibt'); }
assert.equal(DOCX.build({ created: '2026-10-16T16:00:00.000Z', blocks: [{ t: 'p', text: 'x' }] }).length,
  DOCX.build({ created: '2026-10-16T16:00:00.000Z', blocks: [{ t: 'p', text: 'x' }] }).length, 'deterministisch');

// XML wohlgeformt (Python-Standardbibliothek), falls vorhanden
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-'));
const datei = path.join(tmp, 'test.docx');
fs.writeFileSync(datei, bytes);
try{
  execFileSync('python3', ['-I', '-c', `import sys,zipfile,xml.dom.minidom as m
z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
for n in z.namelist():
    if n.endswith('.xml') or n.endswith('.rels'): m.parseString(z.read(n))
print('xml ok')`, datei], { stdio: 'pipe' });
}catch(e){
  if (e.code === 'ENOENT') console.log('(python3 fehlt – XML-Prüfung übersprungen)');
  else throw new Error('XML nicht wohlgeformt: ' + (e.stderr || e.message));
}
console.log('DOCX: alle Prüfungen bestanden');
