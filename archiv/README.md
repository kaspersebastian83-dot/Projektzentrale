# Spektron · Datenarchiv, Version 1

Eigene Seite unter `archiv/` (Projektzentrale › Weitere Apps › kleiner Link „Datenarchiv“). Chrome/Edge, gemeinsamer Archivordner aus `mosaik-suite/kv/archiv` wie Projektzentrale und Büroübersicht. Kein Server, keine externen Dienste, nichts verlässt den Archivordner.

## Was gelesen wird

- Projektordner `JJ.Nummer …` im Archivordner.
- `_Projekt.json`: nur `nutzung`, `brandgut`, `schadenereignis` (Letzteres nur als Hilfe beim Zuordnen).
- Unterordner „Laborergebnisse“ (und eine Ebene darunter): Eurofins-XML (`AnalyticalReport`). PDF-Berichte werden in Version 1 nur gezählt.

Unveränderte Projekte (gleiche Dateinamen, Größen, Änderungszeiten) kommen beim nächsten Öffnen aus dem Browser-Zwischenspeicher (IndexedDB `spektron-archiv`).

## Regeln der Auswertung (`auswertung.js`, geprüft in `tests/archiv.cjs`)

- **Keine erfundenen Zahlen:** keine Grenz- oder Orientierungswerte, keine Schwellen für Quotienten.
- **Unter BG / n. n.** sind keine Null. In Rangstatistiken zählen sie als kleinste Werte; fällt Median oder 90. Perzentil darauf, steht „< BG“. Kennzahlen erst ab 5 Werten.
- **Vorläufige Berichte** entfallen für Proben mit endgültigem Bericht; sonst gekennzeichnet und nicht in der Statistik. Derselbe Bericht mehrfach abgelegt → neueste Datei. Nachträge ergänzen Parameter.
- **Einheiten** werden nur vereinheitlicht geschrieben (µ, ², Leerzeichen), nie umgerechnet. µg/m², µg/100 cm² und mg/kg bleiben getrennte Gruppen.
- **PAK-Muster:** Anteil jedes der 16 EPA-PAK an der Summe der gemessenen Einzel-PAK je Probe. Vergleich nur innerhalb derselben Matrix (Median anderer Projekte, ab 5 Proben).
- **Quotienten** Flt/(Flt+Pyr), BaA/(BaA+Chr), IcdP/(IcdP+BghiP), Ant/(Ant+Phe) nach Yunker et al. (2002), Org. Geochem. 33, 489–515 – nur wenn beide Stoffe über BG, ohne Schwellen (für Sedimente/Luft hergeleitet; Übertragbarkeit auf Brandrückstände in Innenräumen offen).

## Was geschrieben wird

Nur `<Archiv>/_Spektron-Archiv.json`, und nur nach einer Auswahl unter „Zuordnen“:

```json
{ "format": "spektron-archiv", "version": 1, "projekte": { "<Ordnername>": { "nutzung": "Wohnen", "brandgut": "Küche/Lebensmittel", "geaendert": "…" } } }
```

Gilt nur, wo `_Projekt.json` keine Angabe hat; Projektdaten gehen immer vor. Vor jedem Schreiben frisch gelesen, nur dieses Projekt geändert, unbekannte Felder bleiben. Eine kaputte oder fremde Datei wird nie überschrieben. Schreibrecht wird erst bei der ersten Zuordnung erfragt.

## CSV-Export

Semikolon, Dezimalkomma, UTF-8 mit BOM (Excel). Spalten: Projekt (Nummer), Jahr, Nutzung, Brandgut, Probe (Labornummer), Matrix, Parameter, Einheit, Ergebnis (wie im Bericht), Wert, unter BG, Prüfbericht, vorläufig. Keine Orte, keine Probenbeschreibungen.

## Prüfung

```sh
node tests/archiv.cjs
node tests/archiv-browser.cjs   # Chromium, synthetischer Archivordner im OPFS
```
