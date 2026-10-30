/* Spektron – welche Word-Datei in „Mitteilungen“ ist das Gutachten? Nur rechnen, keine Dateizugriffe.
   In „Mitteilungen“ liegen neben der Mitteilung auch Anlagen, die meist erst danach entstehen (PlanKit: Anlage
   Probenahme, Raumbuch, Wandansichten; Projektzentrale: Anlage PN 98 / Brandgeruch). Die neueste Datei ist darum oft
   eine Anlage. Vorwahl für „Ans Büro übergeben“, in dieser Reihenfolge:
     1. ausdrücklich gewählt (Link aus BerichtKit oder von Hand) – entscheidet die Projektzentrale selbst
     2. die zuletzt in BerichtKit gespeicherte Datei (`_BerichtKit.json → berichte[]`, neuestes `am`), die noch da ist
     3. die neueste Datei, die nach einer Mitteilung heißt (wie `Stufen.MITTEILUNG`)
     4. sonst keine – dann muss jemand wählen
   Eine Anlage wird nie vorgewählt. Anlage ist jede Datei mit Zeile im `_Anlagen-Protokoll.txt` und jede, die nach dem
   Muster von PlanKit oder der Anlage PN 98 heißt. Innerhalb von 2–3 geht eine Datei vor, die noch keine Büroaufgabe
   nennt – sonst stünde nach dem Versand der 1. Mitteilung wieder diese statt der neuen 2. Mitteilung da. */
(function(root){
  'use strict';
  /** Gleich wie `Stufen.MITTEILUNG` (Test vergleicht beide). */
  const MITTEILUNG = /^\d+[._\s]*Mitteilung(?![a-zäöüß]).*\.docx$/i;
  /** Anlagen nach Dateiname: PlanKit `<Nr>_<Titel>_Probenahme_<Datum>.docx`, `<Nr>_Raumbuch_<Datum>.docx`,
      `<Nr>_Wandansichten_<Datum>.docx`; Projektzentrale `<Nr>_<Titel>_PN98[-Brandgeruch]_<Datum>.docx`, `…_Brandgeruch_…`. */
  const ANLAGE_NAME = [/_(?:Probenahme|Raumbuch|Wandansichten)_\d/i, /_(?:PN98|Brandgeruch)(?=[-_.])/i];

  const key = s => String(s || '').normalize('NFC').toLowerCase();
  const base = s => String(s || '').split(/[\\/]/).pop();

  /** Dateinamen aus einem `_Anlagen-Protokoll.txt` (je Zeile „Zeit | Datei | SHA-256 | …“) als Set kleingeschrieben. */
  function protokollDateien(text){
    const s = new Set();
    for (const zeile of String(text || '').split(/\r?\n/)){
      const t = zeile.split(' | ');
      if (t.length >= 3 && t[1].trim()) s.add(key(base(t[1].trim())));
    }
    return s;
  }
  /** Ist die Datei eine Anlage? `protokoll` = Set aus protokollDateien (darf fehlen). */
  function istAnlage(name, protokoll){
    const n = base(name);
    return !!(protokoll && protokoll.has(key(n))) || ANLAGE_NAME.some(r => r.test(n));
  }
  /** Vorwahl aus `liste` = [{ name, rel, t }] (t = Änderungszeit in ms).
      o.berichte = Einträge aus `_BerichtKit.json` ([{ datei, am }]), o.protokoll = Set (protokollDateien),
      o.uebergeben = Set der Dateinamen, die schon eine Büroaufgabe nennt (kleingeschrieben, ohne Ordner).
      → { rel, quelle: 'berichtkit' | 'mitteilung' | '' } */
  function vorwahl(liste, o = {}){
    const dateien = (liste || []).filter(w => w && w.name && !istAnlage(w.name, o.protokoll));
    const kandidaten = [];
    const bk = (o.berichte || []).filter(b => b && typeof b.datei === 'string')
      .slice().sort((a, b) => String(b.am || '').localeCompare(String(a.am || '')));
    for (const b of bk){ const w = dateien.find(x => key(x.name) === key(base(b.datei))); if (w) kandidaten.push([w, 'berichtkit']); }
    dateien.filter(w => MITTEILUNG.test(w.name))
      .sort((a, b) => (b.t || 0) - (a.t || 0) || b.name.localeCompare(a.name, 'de', { numeric: true }))
      .forEach(w => kandidaten.push([w, 'mitteilung']));
    const neu = kandidaten.find(([w]) => !(o.uebergeben && o.uebergeben.has(key(w.name)))) || kandidaten[0];
    return neu ? { rel: neu[0].rel, quelle: neu[1] } : { rel: '', quelle: '' };
  }

  const api = Object.freeze({ vorwahl, istAnlage, protokollDateien, MITTEILUNG, key });
  root.WordWahl = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
