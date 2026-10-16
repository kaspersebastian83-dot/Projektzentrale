# Projektzentrale

Alle Projektordner im Überblick – Status je Unterordner, gemeinsame Projektdaten und Absprung in FotoKit (früher Bildumbenenner) und PlanKit (früher Probenplan).

**App öffnen:** https://kaspersebastian83-dot.github.io/Projektzentrale/

## Datenschutz in einem Satz

Die App läuft vollständig im Browser auf dem eigenen Rechner. **Ordner, Dateien und Projektdaten werden nicht hochgeladen** – GitHub liefert nur den Programmcode der App aus.

## Voraussetzungen

- **Google Chrome oder Microsoft Edge** (Ordnerzugriff).
- Einmal **„Archivordner wählen …“** → `C:\daten\Mosaik Archivordner`. Der Browser merkt sich die Auswahl; nach einem Neustart genügt ein Klick auf „Zugriff erlauben“.

## Was die App kann

- **„? Kurzanleitung“** (oder F1): wie Projektzentrale, LabelKit, FotoKit und PlanKit zusammenarbeiten – Einrichtung, Ablauf je Projekt mit Bild, Hinweise, Adressen; druckbar als PDF.

- Listet alle Projektordner (`26.0123 Köln`), neueste zuerst, mit Suche und Jahresfilter.
- Zeigt je Projekt, was schon da ist: Fotos, Bilddokumentation, Probenplan, Probenerfassung (LabelKit `…_Daten.json`), Laborergebnisse.
- Legt fehlende Standard-Unterordner auf Wunsch an.
- **Projektdaten** (Objekt, Auftraggeber, Schaden-Nr., Schadenereignis, Schadendatum, Ortstermin, Sachverständiger, Notizen) in `_Projekt.json` im Projektordner – gemeinsam für alle Apps und Kollegen.
- **„Fotos bearbeiten“** öffnet FotoKit direkt im Ordner `Fotos` des Projekts, mit vorausgefüllten Projektdaten.
- **„Plan bearbeiten“** öffnet PlanKit direkt im Ordner `Pläne`: automatisches Speichern als `Probenplan <Projekt>.probenplan`, Bilder ebenfalls dorthin, Laborberichte aus `Laborergebnisse`.
- **„Proben erfassen“** öffnet LabelKit direkt im Ordner `Laboraufträge`: Speichern und Laborübergaben ohne Ordnerdialog, die neueste `…_Daten.json` wird geladen.

## Vereinbarungen zwischen den Apps

| Was | Regel |
|---|---|
| Projektordner | `<JJ>.<Nummer> <Schadenort>`, z. B. `26.0123 Köln`. Projektnummer und Schadenort kommen immer aus dem Ordnernamen. |
| Unterordner | `Fotos`, `Pläne`, `Laboraufträge`, `Laborergebnisse`, `Mitteilungen`, `Emails`, `Rechnung Labore` |
| Wer schreibt wohin | FotoKit → `Fotos` (Bilder, `_Bildumbenenner.json`, Bilddokumentation-PDF/ZIP) · PlanKit → `Pläne` (`Probenplan <Projekt>.probenplan`, exportierte Bilder) · LabelKit → `Laboraufträge` |
| `_Projekt.json` | `format: "mosaik-projekt"`, `version: 1`. Jede App liest frisch, ändert nur die eigenen geänderten Felder und behält unbekannte Felder. Nicht löschen oder umbenennen. |
| Gemeinsamer Browser-Speicher | IndexedDB `mosaik-suite` (v1), Store `kv`, Schlüssel `archiv` = Archivordner. Alle Apps unter `kaspersebastian83-dot.github.io` teilen ihn. |
| Absprung | `../Bildumbenenner/?projekt=<Ordnername>` (FotoKit) · `../Probenplan/?projekt=<Ordnername>` (PlanKit) · `../labelkit/?projekt=<Ordnername>` (LabelKit) |
| Offline-Speicher | Jede App verwaltet nur Caches mit eigenem Präfix (`projektzentrale:`, `bildumbenenner:`, `probenplan:`). |

Felder in `_Projekt.json`: `projektnummer`, `schadenort`, `objekt`, `auftraggeber`, `schadennummer`, `schadenereignis`, `schadendatum`, `ortstermin` (Datum `JJJJ-MM-TT`), `sachverstaendiger`, `notizen`, `geaendert`, `geaendertMit`.

## Neue Version veröffentlichen

1. In `index.html` `APP_VERSION` erhöhen und `CHANGELOG` ergänzen.
2. Pull Request mergen; Release `vX.Y.Z` auf GitHub anlegen.
3. GitHub Pages veröffentlicht automatisch; geöffnete Apps melden „Update verfügbar“.

## Dateien

- `index.html` – die komplette App (eine Datei, keine externen Bibliotheken)
- `sw.js` – Service Worker: offline nutzbar, immer neueste Version wenn online
- `manifest.webmanifest`, `icon*.{svg,png}` – Installation als App
