/* Spektron – offene Lücken in einer Word-Datei (.docx) finden. Nur lesen, keine Bibliothek: Entpacken mit dem im
   Browser (Edge/Chrome) und in Node eingebauten DecompressionStream('deflate-raw').
   Als Lücke zählt
     · gelb hervorgehobener Text (Texthervorhebung „Gelb“ – so markiert BerichtKit fehlende Angaben) und
     · eine Lückenmarke in eckigen Klammern, die mit einem Großbuchstaben beginnt: „[KI-Wert]“, „[Versicherer]“,
       „[Foto fehlt: …]“. Einheiten und Verweise wie „[mg/kg]“, „[µg/cm²]“ oder „[1]“ zählen nicht.
   Gelesen werden Haupttext, Kopf- und Fußzeilen, Fuß- und Endnoten. Gelöschter Text (Änderungen nachverfolgen) zählt nicht.
   Wer eine Lücke in Word ausfüllt und die gelbe Markierung stehen lässt, bekommt sie weiter gemeldet – darum fragt die
   Projektzentrale nur nach und sperrt nicht. */
(function(root){
  'use strict';
  const TEILE = /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/;
  const MARKE = /\[([A-ZÄÖÜ][^\[\]\n]{0,78})\]/g;
  const MAX_TEXT = 60;

  const u16 = (b, i) => b[i] | (b[i + 1] << 8);
  const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

  async function inflate(daten){
    if (typeof DecompressionStream === 'undefined') throw new Error('Dieser Browser kann Word-Dateien nicht entpacken');
    const strom = new Blob([daten]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(strom).arrayBuffer());
  }

  /** Die Textteile einer .docx (ZIP) entpacken: { 'word/document.xml': '<…>', … }. Liest über das Zentralverzeichnis
      (Größen stehen dort auch, wenn der lokale Kopf sie nicht hat). */
  async function textteile(bytes){
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let ende = -1;
    for (let i = b.length - 22; i >= 0 && i >= b.length - 22 - 0xffff; i--) if (u32(b, i) === 0x06054b50){ ende = i; break; }
    if (ende < 0) throw new Error('keine Word-Datei (.docx) – ZIP-Verzeichnis fehlt');
    const anzahl = u16(b, ende + 10), start = u32(b, ende + 16);
    if (anzahl === 0xffff || start === 0xffffffff) throw new Error('ZIP64 wird nicht unterstützt');
    const dec = new TextDecoder(), teile = {};
    let p = start;
    for (let n = 0; n < anzahl; n++){
      if (p + 46 > b.length || u32(b, p) !== 0x02014b50) throw new Error('ZIP-Verzeichnis beschädigt');
      const flags = u16(b, p + 8), methode = u16(b, p + 10), groesse = u32(b, p + 20);
      const nl = u16(b, p + 28), el = u16(b, p + 30), kl = u16(b, p + 32), lokal = u32(b, p + 42);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + el + kl;
      if (!TEILE.test(name)) continue;
      if (flags & 1) throw new Error('Word-Datei ist verschlüsselt');
      if (lokal + 30 > b.length || u32(b, lokal) !== 0x04034b50) throw new Error('ZIP-Eintrag beschädigt: ' + name);
      const von = lokal + 30 + u16(b, lokal + 26) + u16(b, lokal + 28), roh = b.subarray(von, von + groesse);
      if (roh.length !== groesse) throw new Error('Word-Datei unvollständig');
      const daten = methode === 0 ? roh : methode === 8 ? await inflate(roh) : null;
      if (!daten) throw new Error('unbekannte Kompression in ' + name);
      teile[name] = dec.decode(daten);
    }
    if (!teile['word/document.xml']) throw new Error('keine Word-Datei (.docx) – Haupttext fehlt');
    return teile;
  }

  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const entschluesseln = s => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()]);
  const kuerzen = s => s.length > MAX_TEXT ? s.slice(0, MAX_TEXT - 1).trimEnd() + '…' : s;

  /** Lücken in einem XML-Teil. Läuft einmal über die Tags: Absätze und Textläufe (auch verschachtelt, z. B. Textfelder),
      Hervorhebung gilt für den Lauf, in dessen Eigenschaften sie steht. Nebeneinanderliegende gelbe Läufe eines Absatzes
      sind eine Lücke (Word teilt Text oft in mehrere Läufe). */
  function inXml(xml){
    const funde = [];
    const absaetze = [], laeufe = [];
    const TAG = /<w:p(?=[\s>\/])[^>]*?(\/)?>|<\/w:p>|<w:r(?=[\s>\/])[^>]*?(\/)?>|<\/w:r>|<w:highlight\b[^>]*\bw:val="([^"]*)"[^>]*>|<w:t(?=[\s>])[^>]*>([^<]*)<\/w:t>|<w:(?:tab|br|cr)\b[^>]*\/>/g;
    const gelbAbschliessen = a => { const t = a.gelb.replace(/\s+/g, ' ').trim(); if (t) a.gelbe.push(t); a.gelb = ''; };
    let m;
    while ((m = TAG.exec(xml))){
      const tag = m[0];
      if (tag.startsWith('<w:p') && !tag.startsWith('<w:pPr')){ if (!m[1]) absaetze.push({ text: '', gelb: '', gelbe: [] }); continue; }
      if (tag === '</w:p>'){
        const a = absaetze.pop(); if (!a) continue;
        gelbAbschliessen(a);
        funde.push(...a.gelbe);
        for (const k of a.text.matchAll(MARKE)){ const t = k[0].replace(/\s+/g, ' '); if (!a.gelbe.some(g => g.includes(t))) funde.push(t); }   // gelbe Marke nur einmal
        continue;
      }
      if (tag.startsWith('<w:r') && !tag.startsWith('<w:rPr')){ if (!m[2]) laeufe.push({ gelb: false }); continue; }
      if (tag === '</w:r>'){ laeufe.pop(); continue; }
      if (tag.startsWith('<w:highlight')){ if (laeufe.length) laeufe[laeufe.length - 1].gelb = m[3] === 'yellow'; continue; }   // im Absatz-Kopf (Absatzmarke) ohne Lauf: kein Text
      const a = absaetze[absaetze.length - 1]; if (!a) continue;
      const text = m[4] !== undefined ? entschluesseln(m[4]) : ' ';
      a.text += text;
      const lauf = laeufe[laeufe.length - 1];
      if (lauf && lauf.gelb) a.gelb += text;
      else if (m[4] !== undefined && text.trim()) gelbAbschliessen(a);   // ungefärbter Text trennt zwei gelbe Stellen
    }
    return funde;
  }

  /** Lücken in einer .docx: { luecken: [{ text, anzahl }] } – je Text einmal, in der Reihenfolge des ersten Vorkommens
      (Haupttext zuerst, dann Kopf-/Fußzeilen, Noten). */
  async function pruefen(bytes){
    const teile = await textteile(bytes);
    const reihe = Object.keys(teile).sort((a, b) => (a !== 'word/document.xml') - (b !== 'word/document.xml') || a.localeCompare(b, 'en', { numeric: true }));
    const zaehler = new Map();
    for (const n of reihe) for (const t of inXml(teile[n])){ const k = kuerzen(t); zaehler.set(k, (zaehler.get(k) || 0) + 1); }
    return { luecken: [...zaehler].map(([text, anzahl]) => ({ text, anzahl })) };
  }

  const api = Object.freeze({ pruefen, textteile, inXml });
  root.WordLuecken = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
