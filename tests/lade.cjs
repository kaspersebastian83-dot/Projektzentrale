// Lädt die bibliotheksfreien Teile der Projektzentrale (DOCX, ANLAGE) aus index.html in eine Node-Sandbox.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
module.exports = function lade(){
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const teil = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); if (i < 0 || j < i) throw new Error(a + ' nicht gefunden'); return html.slice(i, j); };
  const code = teil('/* DOCX-START */', '/* DOCX-ENDE */') + teil('/* ANLAGE-START */', '/* ANLAGE-ENDE */') + '\nthis.DOCX = DOCX; this.ANLAGE = ANLAGE;';
  const ctx = { TextEncoder, TextDecoder };
  vm.runInNewContext(code, ctx);
  return { DOCX: ctx.DOCX, ANLAGE: ctx.ANLAGE, html };
};
/** Minimaler ZIP-Leser (nur „stored“): {name → Uint8Array}, prüft CRC und Zentralverzeichnis. */
module.exports.unzip = function unzip(u8, crc32){
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), files = {}, dec = new TextDecoder();
  let p = 0;
  while (dv.getUint32(p, true) === 0x04034b50){
    const method = dv.getUint16(p + 8, true), crc = dv.getUint32(p + 14, true), size = dv.getUint32(p + 18, true), n = dv.getUint16(p + 26, true), e = dv.getUint16(p + 28, true);
    if (method !== 0) throw new Error('nur stored erwartet');
    const name = dec.decode(u8.subarray(p + 30, p + 30 + n)), data = u8.subarray(p + 30 + n + e, p + 30 + n + e + size);
    if (crc32(data) !== crc) throw new Error('CRC falsch: ' + name);
    files[name] = data; p += 30 + n + e + size;
  }
  const endPos = u8.length - 22;
  if (dv.getUint32(endPos, true) !== 0x06054b50) throw new Error('Ende des Zentralverzeichnisses fehlt');
  if (dv.getUint16(endPos + 10, true) !== Object.keys(files).length) throw new Error('Anzahl im Zentralverzeichnis falsch');
  if (dv.getUint32(endPos + 16, true) !== p) throw new Error('Zentralverzeichnis-Offset falsch');
  return files;
};
