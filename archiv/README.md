# Spektron · Datenarchiv, Version 1.2

Eigene Seite unter `archiv/` (Projektzentrale › Weitere Apps › kleiner Link „Datenarchiv“). Chrome/Edge, gemeinsamer Archivordner aus `mosaik-suite/kv/archiv` wie Projektzentrale und BüroKit. Kein Server, keine externen Dienste, nichts verlässt den Archivordner.

## Neu in 1.2

- Oben ein sichtbarer Hinweis: Das Datenarchiv liest die Original-XML, nicht den in ResultKit übernommenen Stand (`_Ergebnisse.json`) – einzelne Projekte können deshalb abweichen; für Gutachten gilt ResultKit. Ausführlich unter „Was diese Seite tut – und was nicht“.

## Was gelesen wird

- Projektordner `JJ.Nummer …` im Archivordner.
- `_Projekt.json`: nur `nutzung`, `brandgut`, `schadenereignis` (als Hilfe beim Zuordnen) und `schadendatum` (Tage nach dem Brand).
- Je Probe aus der XML: Probenbezeichnung (`Description`), Probenbeschreibung (`SPLPT_NAME`, aus LabelKits „Probenbeschreibung“), Matrix, Probenahmetag (Berliner Kalendertag), je Wert Ergebnis, Einheit und BG.
- Unterordner „Laborergebnisse“ (und eine Ebene darunter): Eurofins-XML (`AnalyticalReport`). PDF-Berichte werden in Version 1 nur gezählt.

Unveränderte Projekte (gleiche Dateinamen, Größen, Änderungszeiten) kommen beim nächsten Öffnen aus dem Browser-Zwischenspeicher (IndexedDB `spektron-archiv`).

## Regeln der Auswertung (`auswertung.js`, geprüft in `tests/archiv.cjs`)

- **Keine erfundenen Zahlen:** keine Grenz- oder Orientierungswerte, keine Schwellen für Quotienten.
- **Unter BG / n. n.** sind keine Null. In Rangstatistiken zählen sie als kleinste Werte; fällt Median oder 90. Perzentil darauf, steht „< BG“. Kennzahlen erst ab 5 Werten.
- **Vorläufige Berichte** entfallen für Proben mit endgültigem Bericht; sonst gekennzeichnet und nicht in der Statistik. Derselbe Bericht mehrfach abgelegt → neueste Datei. Nachträge ergänzen Parameter.
- **Einheiten** werden nur vereinheitlicht geschrieben (µ, ², Leerzeichen), nie umgerechnet. µg/m², µg/100 cm² und mg/kg bleiben getrennte Gruppen.
- **PAK-Muster:** Anteil jedes der 16 EPA-PAK an der Summe der gemessenen Einzel-PAK je Probe. Vergleich nur innerhalb derselben Matrix (Median anderer Projekte, ab 5 Proben).
- **Quotienten** Flt/(Flt+Pyr), BaA/(BaA+Chr), IcdP/(IcdP+BghiP), Ant/(Ant+Phe) nach Yunker et al. (2002), Org. Geochem. 33, 489–515 – nur wenn beide Stoffe über BG, ohne Schwellen (für Sedimente/Luft hergeleitet; Übertragbarkeit auf Brandrückstände in Innenräumen offen).

## Rolle der Proben (ab 1.1)

Konvention, gelesen aus Probenbezeichnung und -beschreibung (Groß/klein egal), in dieser Reihenfolge:

| Rolle | erkannt an |
|---|---|
| Freimessung nach Sanierung | `F-` vor der alten ID (Handbuch), „Freimessung“, „Sanierungskontrolle“, „nach Sanierung“ |
| Referenz (unbelastet) | `REF` als eigenes Wort (Handbuch: Referenzkern), „Referenz“, „unbelastet“, „Nullprobe“, „Hintergrund“ |
| Verdachtsquelle | „Kleber“, „Teer“, „Bitumen“, „Dachpappe“, „Schwarzanstrich“ |
| Brandbereich | „Brandraum“, „Brandbereich“, „Brandherd“, „Brandstelle“, „Brandausbruch“ |

Nichts erkannt → ohne Rolle. „Betroffener Bereich“ und „bewusst keine Rolle“ gibt es nur als Korrektur. Korrekturen stehen in `_Spektron-Archiv.json` unter `projekte.<Ordner>.rollen.<Labornummer>` und gelten vor der Konvention. Freimessungen werden über die ID ohne `F-` der Probe davor zugeordnet (vorher/nachher für Σ16 EPA-PAK und BaP) und zählen im Vergleich standardmäßig nicht mit.

## PAK-Muster (ab 1.1)

Grundlage: Literaturbericht „PAH fingerprints in fire-damage assessment“ (Oktober 2026). Diagnostische Quotienten sind für Sedimente und Außenluft hergeleitet und für Brandrückstände nicht validiert; belastbar ist der Vergleich normierter Muster innerhalb eines Falls.

- Normiert nur über die Einzel-PAK, die in **allen** gewählten Proben derselben Matrix und Einheit über BG liegen. Werte unter BG werden nicht ersetzt. Unter 3 gemeinsamen Stoffen kein Vergleich.
- Ähnlichkeit je Probenpaar und zum Vergleichsmuster als Kosinus (1 = gleiches Muster), ohne Schwelle. Hohe Ähnlichkeit stützt nur; ein deutlicher Unterschied sagt mehr.
- Vergleichsmuster: Median anderer Projekte mit gleicher Matrix und Einheit (optional gleiches Brandgut / gleiche Nutzung), ohne Freimessungen, Referenzen und Verdachtsquellen, ab 5 Proben.
- Literaturquotienten eingeklappt, mit Herkunft der Herleitung.

## Was geschrieben wird

Nur `<Archiv>/_Spektron-Archiv.json`, und nur nach einer Auswahl unter „Zuordnen“:

```json
{ "format": "spektron-archiv", "version": 1, "projekte": { "<Ordnername>": { "nutzung": "Wohnen", "brandgut": "Küche/Lebensmittel", "rollen": { "<Labornummer>": "referenz" }, "geaendert": "…" } } }
```

Gilt nur, wo `_Projekt.json` keine Angabe hat; Projektdaten gehen immer vor. Vor jedem Schreiben frisch gelesen, nur dieses Projekt geändert, unbekannte Felder bleiben. Eine kaputte oder fremde Datei wird nie überschrieben. Schreibrecht wird erst bei der ersten Zuordnung erfragt.

## CSV-Export

Semikolon, Dezimalkomma, UTF-8 mit BOM (Excel). Spalten: Projekt (Nummer), Jahr, Nutzung, Brandgut, Probe (Labornummer), Rolle, Tage nach Brand, Matrix, Parameter, Einheit, Ergebnis (wie im Bericht), Wert, unter BG, BG, Prüfbericht, vorläufig. Keine Orte, keine Probenbeschreibungen.

## Prüfung

```sh
node tests/archiv.cjs
node tests/archiv-browser.cjs   # Chromium, synthetischer Archivordner im OPFS
```
