// Lücken-Prüfung vor der Übergabe (word-luecken.js): echte BerichtKit-Berichte mit und ohne Lücken, dazu kleine
// Word-Dateien wie aus Word gespeichert (komprimiert, Läufe geteilt, Kopfzeile, Textfeld, Änderungen nachverfolgen).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const W = require('../word-luecken.js');
const fx = n => fs.readFileSync(path.join(__dirname, 'fixtures', n));

/** Kleiner ZIP-Schreiber: komprimiert (8) oder gespeichert (0); mit Datendeskriptor wie manche Programme (Größen im lokalen Kopf 0). */
function zip(teile, { methode = 8, deskriptor = false } = {}){
  const lokal = [], zentral = []; let off = 0;
  for (const [name, text] of Object.entries(teile)){
    const roh = Buffer.from(text, 'utf8'), daten = methode === 8 ? zlib.deflateRawSync(roh) : roh, n = Buffer.from(name);
    const crc = zlib.crc32(roh), flags = deskriptor ? 8 : 0;
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(flags, 6); h.writeUInt16LE(methode, 8);
    if (!deskriptor){ h.writeUInt32LE(crc, 14); h.writeUInt32LE(daten.length, 18); h.writeUInt32LE(roh.length, 22); }
    h.writeUInt16LE(n.length, 26);
    const dd = deskriptor ? Buffer.alloc(16) : Buffer.alloc(0);
    if (deskriptor){ dd.writeUInt32LE(0x08074b50, 0); dd.writeUInt32LE(crc, 4); dd.writeUInt32LE(daten.length, 8); dd.writeUInt32LE(roh.length, 12); }
    lokal.push(h, n, daten, dd);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(flags, 8); c.writeUInt16LE(methode, 10);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(daten.length, 20); c.writeUInt32LE(roh.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    zentral.push(c, n);
    off += 30 + n.length + daten.length + dd.length;
  }
  const z = Buffer.concat(zentral), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(zentral.length / 2, 8); e.writeUInt16LE(zentral.length / 2, 10); e.writeUInt32LE(z.length, 12); e.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...lokal, z, e]));
}
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const doc = body => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}</w:body></w:document>`;
const r = (text, gelb) => `<w:r><w:rPr><w:rFonts w:ascii="Arial"/>${gelb ? '<w:highlight w:val="yellow"/>' : ''}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;
const p = (...runs) => `<w:p><w:pPr><w:jc w:val="both"/></w:pPr>${runs.join('')}</w:p>`;
const texte = async b => (await W.pruefen(b)).luecken.map(l => l.text);

(async () => {
  // Echte Berichte aus BerichtKit 1.3 (gespeichert, wie die docx-Bibliothek sie schreibt)
  assert.deepEqual((await W.pruefen(fx('1._Mitteilung_Luecken.docx'))).luecken, [{ text: '[Eingangsdatum]', anzahl: 4 }, { text: '[Sachverständige(r)]', anzahl: 1 }],
    'Lücken aus BerichtKit: gelb und in Klammern – je Stelle einmal gezählt, auch in der Kopfzeile');
  assert.deepEqual(await texte(fx('1._Mitteilung_fertig.docx')), [], 'vollständiger Bericht: keine Lücke');

  // Wie aus Word gespeichert: komprimiert; ein gelber Text über mehrere Läufe ist eine Lücke; Kopfzeile wird gelesen
  const word = zip({
    '[Content_Types].xml': '<Types/>',
    'word/document.xml': doc(
      p(r('Am '), r('[Auftrags', true), r('datum]', true), r(' wurde unser Büro beauftragt.')) +
      p(r('KI-Wert: '), r('[KI-Wert]'), r(' – Einheit [mg/kg], Quelle [1], Hinweis [ergänzen]')) +
      p(r('Ausgefüllt, Markierung vergessen: '), r('Herrn Cremer', true), r(' und '), r('16.10.2026', true)) +
      `<w:p><w:pPr><w:rPr><w:highlight w:val="yellow"/></w:rPr></w:pPr>${r('Absatzmarke gelb, Text nicht')}</w:p>` +
      p(r('Anführung &amp; &lt;Zeichen&gt; '), r('[Foto fehlt: P3 &amp; P4]', true)) +
      p(`<w:del><w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:delText>[gelöscht]</w:delText></w:r></w:del>`, r('Andere Farbe: '), `<w:r><w:rPr><w:highlight w:val="green"/></w:rPr><w:t>grün</w:t></w:r>`) +
      // Textfeld in einem Lauf: verschachtelte Absätze und Läufe
      p(`<w:r><w:drawing><w:txbxContent>${p(r('[Versicherer]', true))}</w:txbxContent></w:drawing></w:r>`, r(' danach')) +
      p(r('x'.repeat(30) + 'y'.repeat(50), true))),
    'word/header2.xml': `<w:hdr ${NS}>${p(r('Kopf '), r('[Projektnummer]', true))}</w:hdr>`,
    'word/media/bild1.png': 'kein XML – wird nicht gelesen',
  });
  assert.deepEqual(await texte(word), ['[Auftragsdatum]', '[KI-Wert]', 'Herrn Cremer', '16.10.2026', '[Foto fehlt: P3 & P4]', '[Versicherer]', 'x'.repeat(30) + 'y'.repeat(29) + '…', '[Projektnummer]'],
    'gelbe Läufe zusammengefasst, Marken mit Großbuchstaben, Einheiten/Verweise/Kleinschreibung nicht, Gelöschtes und andere Farben nicht, Textfeld und Kopfzeile gelesen, lange Stellen gekürzt');

  // gespeichert (ohne Kompression) und mit Datendeskriptor (Größen nur im Verzeichnis)
  const klein = { 'word/document.xml': doc(p(r('[Probenehmer]', true))) };
  assert.deepEqual(await texte(zip(klein, { methode: 0 })), ['[Probenehmer]']);
  assert.deepEqual(await texte(zip(klein, { deskriptor: true })), ['[Probenehmer]']);

  // Kein Word: klare Fehlermeldung (die Projektzentrale fragt dann, ob ungeprüft übergeben werden soll)
  await assert.rejects(W.pruefen(new TextEncoder().encode('Synthetic placeholder')), /keine Word-Datei/);
  await assert.rejects(W.pruefen(zip({ 'word/styles.xml': '<x/>' })), /Haupttext fehlt/);
  const kaputt = zip(klein); kaputt[kaputt.length - 6] ^= 0xff;   // Verzeichnis-Offset falsch
  await assert.rejects(W.pruefen(kaputt), /beschädigt/);
  console.log('Word-Lücken: BerichtKit-Berichte mit/ohne Lücken, Word-Dateien (komprimiert, geteilt, Kopfzeile, Textfeld, Änderungen) – ok');
})().catch(e => { console.error(e); process.exit(1); });
