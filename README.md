# Projektzentrale

Alle Projektordner im Überblick – Status je Unterordner, gemeinsame Projektdaten und Absprung in die Projekt-Apps LabelKit, FotoKit (früher Bildumbenenner), PlanKit (früher Probenplan) und BelegKit (früher AufwandKit). Dazu ohne Projektbezug SpesenKit (früher Reisekosten Pro) für die monatliche Spesenabrechnung.

**App öffnen:** https://kaspersebastian83-dot.github.io/Projektzentrale/ · aktuelle Version **1.10.0** (Änderungen: Klick auf die Versionsnummer in der App)

## Neu in 1.10.0 · 21.10.2026

[Spektron · Büroübersicht](buero/README.md) ist direkt unter `buero/` erreichbar. Die Projektzentrale übergibt nach bewusstem Klick eine konkrete Word-Datei und vollständige Empfänger. Das Büro dokumentiert Gegenlesen, bewusst gewählte Versand-PDF, Rückfragen und Versand je Empfänger. Papiermappe bleibt; nach Korrektur keine weitere Sachverständigenfreigabe. Gemeinsame Ablage: `<Projekt>/_Buero/<Auftrags-UUID>/auftrag.json` und einzelne `rueckmeldung-<UUID>.json`. Datenformat, Konflikte, Fehlerbehandlung und manueller Netzlaufwerktest: [Büro-Dokumentation](buero/README.md).

## Neu in 1.9.4 · 20.10.2026

Projektzentrale und Spektron-Leiste übergeben Projekte jetzt über #projekt im Fragment. Sonderzeichen bleiben erhalten; alte ?projekt-Links funktionieren weiterhin und werden nach dem Laden bereinigt. Projektwechsel laden auch bereits geöffnete App-Fenster neu; eine Warnung vor ungesicherten Eingaben kann den Wechsel abbrechen.

## Die App-Suite „Spektron“

Die Büro-Apps heißen zusammen **Spektron** – sichtbar oben neben „Projektzentrale“, in der Kurzanleitung und links in der Leiste der Projekt-Apps (Arbeitsname war „Mosaik“; interne Kennungen wie `mosaik-suite`, `mosaik-projekt` und der Ordner `Mosaik Archivordner` bleiben unverändert). Alle laufen in Chrome oder Edge am Büro-Terminal (RDP, eigenes Windows-Profil je Person) und laden nichts hoch.

| App | Wofür | Adresse | Doku |
|---|---|---|---|
| Projektzentrale | Projekte, Projektdaten, Start der Apps, Anlagen PN 98 / Brandgeruch | `…/Projektzentrale/` | dieses README |
| ① LabelKit | Proben erfassen, Etiketten, Laborübergabe, PN 98, Feldbögen | `…/labelkit/` | [README](https://github.com/kaspersebastian83-dot/labelkit#readme) |
| ② FotoKit | Fotos beschreiben und umbenennen, Bilddokumentation, Ergebnistabelle | `…/Bildumbenenner/` | [README](https://github.com/kaspersebastian83-dot/Bildumbenenner#readme) |
| ③ PlanKit | Probenplan, Ergebniskarte, maßstäbliches PDF, Anlage Probenahme | `…/Probenplan/` | [README](https://github.com/kaspersebastian83-dot/Probenplan#readme) |
| ④ BelegKit | Zeiten, km, Spesen, Proben, Berichtsseiten für die Rechnung | `…/aufwandkit/` | [README](https://github.com/kaspersebastian83-dot/aufwandkit#readme) |
| SpesenKit | Monatliche Spesenabrechnung je Person (ohne Projektbezug) | `…/reisekosten-pro/` | [README](https://github.com/kaspersebastian83-dot/reisekosten-pro#readme) |

`…` steht für `https://kaspersebastian83-dot.github.io`.

## Datenschutz in einem Satz

Die App läuft vollständig im Browser auf dem eigenen Rechner. **Ordner, Dateien und Projektdaten werden nicht hochgeladen** – GitHub liefert nur den Programmcode der App aus. Eine strenge Content Security Policy (`index.html`, `<meta>`) sorgt zusätzlich dafür, dass die Seite weder fremden Code lädt noch Daten an andere Server senden kann (`connect-src 'self'`).

## Voraussetzungen

- **Google Chrome oder Microsoft Edge** (Ordnerzugriff).
- Einmal **„Archivordner wählen …“** → `C:\daten\Mosaik Archivordner`. Der Browser merkt sich die Auswahl; nach einem Neustart genügt ein Klick auf „Zugriff erlauben“.

## Was die App kann

- **„? Kurzanleitung“** (oder F1): wie Projektzentrale, LabelKit, FotoKit und PlanKit zusammenarbeiten – Einrichtung, Ablauf je Projekt mit Bild, Hinweise, Adressen; druckbar als PDF.

- Listet alle Projektordner (`26.0123 Köln`), neueste zuerst, mit Suche und Jahresfilter.
- **Projektansicht (ab 1.7), Schritt für Schritt:** Rechts stehen die Apps als nummerierte Karten in der Reihenfolge der Arbeit – ① LabelKit, ② FotoKit, ③ PlanKit, zum Schluss ④ BelegKit (abgesetzt). Farbe wie das App-Symbol; ✓ = erledigt (laut Ordnerstand), gefüllte Karte = nächster Schritt; jede App bleibt jederzeit anklickbar. Die Anlagen hängen an ihrem Schritt und erscheinen nur, wenn es etwas zu erstellen gibt. Projektdaten und Ordnerstand sind aufklappbare Karten (leere Projektdaten gestrichelt hervorgehoben); fehlende Unterordner erscheinen als Hinweis mit „Anlegen“.
- **Weitere Apps (ab 1.9):** Ganz unten im rechten Fenster (auch ohne gewähltes Projekt) öffnet „SpesenKit“ die monatliche Spesenabrechnung der Kollegen in einem eigenen Fenster. Kein Projektbezug, darum kein nummerierter Arbeitsschritt und kein `?projekt=` im Link (`../reisekosten-pro/` – die Webadresse trägt noch den früheren Namen „Reisekosten Pro“). SpesenKit speichert nicht im Archivordner, sondern in einem eigenen Ordner je Person (siehe unten).
- **Leiste in den Projekt-Apps (ab 1.7.1):** LabelKit, FotoKit, PlanKit und BelegKit zeigen oben dieselbe schmale Leiste – Projekt mit Wechsel zu den zuletzt geöffneten, die vier Arbeitsschritte mit Haken und „Weiter: …“ zum nächsten offenen Schritt. Die Projektzentrale führt dafür die Liste `zuletzt` im gemeinsamen Browser-Speicher; beim Start ist das zuletzt in einer App geöffnete Projekt vorgewählt.
- Zeigt je Projekt, was schon da ist: Fotos, Bilddokumentation, Probenplan, Probenerfassung (LabelKit `…_Daten.json`), Laborergebnisse.
- Legt fehlende Standard-Unterordner auf Wunsch an.
- **Projektdaten** (Objekt, Auftraggeber, Schaden-Nr., Auftragsdatum, Schadenereignis, Schadendatum, Ortstermin, Sachverständiger, Versicherungsnehmer, beteiligter Sachverständiger, Sanierung, Ansprechpartner, Notizen) in `_Projekt.json` im Projektordner – gemeinsam für alle Apps und Kollegen.
- **Arbeitszettel einlesen (ab 1.8):** „📄 Arbeitszettel einlesen …“ in den Projektdaten (oder das PDF auf die Karte ziehen) liest den Arbeitszettel des Büro-Systems. Gelesen wird je Kasten unter seiner Überschrift: RISKO → Objekt, VERSICHERUNG → Auftraggeber / Versicherung, VERSICHERUNGSNEHMER, SACHVERSTÄNDIGER → beteiligter Sachverständiger, SANIERUNG, Schadennummer, Schaden vom, Auftragsdatum, Termin → Ortstermin, Mitarbeiter → Sachverständiger („Sebastian Kasper“ → „Dr. S. Kasper“), Regulierer/Anrufer/ASP → Ansprechpartner, freier Text im Arbeitsauftrag → Notizen.
  - Vor dem Speichern zeigt ein Dialog jeden Wert. Leere Felder werden angehakt, ausgefüllte nur überschrieben, wenn man sie anhakt; gleiche Werte bleiben unberührt.
  - Steht auf dem Zettel eine andere Projektnummer als im Ordnernamen, ist nichts angehakt und „Übernehmen“ erst nach ausdrücklicher Bestätigung möglich. Hinweise bei unplausiblen Daten (Termin vor Auftragsdatum, Schaden nach Auftrag); kein Datum → Feld bleibt leer.
  - Ordner werden nicht angelegt oder verändert; geschrieben wird nur `_Projekt.json` (mit Dateiname und SHA-256 des Zettels unter `arbeitszettel`). Das PDF wird nur im Browser gelesen.
  - PDF-Bibliothek: pdf.js (Mozilla, Apache-2.0, Legacy-Build) in `vendor/pdfjs/`, wird erst beim ersten Einlesen geladen. Funktioniert in der Online-Version (nicht aus einer lokal geöffneten Datei).
- **Verteiler (ab 1.8):** Historische Karte unter den Projektdaten – Auftraggeber, Sachverständiger, Versicherungsnehmer, Sanierung: anhaken, wer das Gutachten bekommt, und nach dem Versand das Datum eintragen („heute“). Gespeichert als `verteiler` in `_Projekt.json`. Bei digitalen Büroaufträgen nur noch Ansicht; deren Versand wird ausschließlich in der Büroübersicht geführt.
- **„Fotos bearbeiten“** öffnet FotoKit direkt im Ordner `Fotos` des Projekts, mit vorausgefüllten Projektdaten.
- **„Plan bearbeiten“** öffnet PlanKit direkt im Ordner `Pläne`: automatisches Speichern als `Probenplan <Projekt>.probenplan`, Bilder ebenfalls dorthin, Laborberichte aus `Laborergebnisse`.
- **„Abrechnung → BelegKit“ (ab 1.6, bis 1.6.1 „AufwandKit“)** öffnet BelegKit im Projekt: Zeiten, km, Spesen je Kollege, Proben aus LabelKit, Berichtsseiten und Fotos mit den Positionsnummern der Rechnung.
- **„Proben erfassen“** öffnet LabelKit direkt im Ordner `Laboraufträge`: Speichern und Laborübergaben ohne Ordnerdialog, die neueste `…_Daten.json` wird geladen.
- **Anlagen zum Gutachten (ab 1.4):** „Anlage PN 98 / Brandgeruch erstellen (Word)“ baut aus der neuesten LabelKit-Projektdatei eine `.docx` mit den PN 98-Probenahmeprotokollen (je Protokoll eine Seite) und der Brandgeruch-Tabelle (Rohbewertungen je Person). Gedacht zum Einfügen in den Bericht mit Word „Einfügen › Objekt › Text aus Datei“: Arial, direkte Formatierung, keine Kopf-/Fußzeile, A4 mit den Rändern des Berichts.
  - Werte unverändert (keine Umrechnung, keine Bewertung), leere Felder bleiben leer; verdeckte Brandgeruch-Bewertungen (Blind-Modus) werden nicht übernommen.
  - Quellenvermerk am Ende: Projektdatei, Stand, LabelKit-Version, SHA-256.
  - **PN 98-Feldbögen (ab 1.5, LabelKit ab 4.27):** vor Ort auf Papier ausgefüllte und in LabelKit übertragene Bögen erscheinen als „Übertragung des Feldbogens …“ mit allen Proben, „[unleserlich]“-Vermerken, Erfassungs- und Prüfvermerk, Änderungen nach Abschluss und den Scans aus `Feldprotokolle`. Die Prüfsumme jedes Scans wird beim Erstellen nachgeprüft (bestätigt / weicht ab / fehlt); stimmige JPEG/PNG-Scans werden verkleinert angehängt, PDF-Scans mit Prüfsumme genannt. Hinweise vor dem Erstellen bei offener Erfassung, fehlender Zweitprüfung oder fehlendem Scan.
  - Ablage in `Mitteilungen` neben dem Bericht, Dateiname ERVV-tauglich und datiert (`26-0142_Anlage-4_PN98-Brandgeruch_2026-10-16.docx`), nie überschreibend; jede Anlage wird mit beiden Prüfsummen in `Mitteilungen/_Anlagen-Protokoll.txt` vermerkt.

## Vereinbarungen zwischen den Apps

| Was | Regel |
|---|---|
| Projektordner | `<JJ>.<Nummer> <Schadenort>`, z. B. `26.0123 Köln`. Projektnummer und Schadenort kommen immer aus dem Ordnernamen. |
| Unterordner | `Fotos`, `Pläne`, `Laboraufträge`, `Laborergebnisse`, `Mitteilungen`, `Emails`, `Rechnung Labore` |
| Wer schreibt wohin | FotoKit → `Fotos` (Bilder, `_Bildumbenenner.json`, Bilddokumentation-PDF/ZIP) · PlanKit → `Pläne` (`Probenplan <Projekt>.probenplan`, exportierte Bilder) und `Mitteilungen` (Anlage Probenahme) · LabelKit → `Laboraufträge` (und Scans in `Feldprotokolle`) · Projektzentrale → `_Projekt.json` und `Mitteilungen` (Anlagen, `_Anlagen-Protokoll.txt`) · BelegKit → `Abrechnung` (`Aufwand_<Kürzel>.json` je Person, `_Abrechnung.json`, Stände) und `_AufwandKit-Einstellungen.json` im Archivordner · SpesenKit → nicht ins Archiv, sondern in den eigenen Ordner `SpesenKit` je Person (`Daten/spesenkit.json`, `Spesen/<Jahr>/<Monat>/` mit PDF/ZIP der abgeschlossenen Abrechnungen, `Sicherungen/`) |
| `_Projekt.json` | `format: "mosaik-projekt"`, `version: 1`. Jede App liest frisch, ändert nur die eigenen geänderten Felder und behält unbekannte Felder. Nicht löschen oder umbenennen. |
| Gemeinsamer Browser-Speicher | IndexedDB `mosaik-suite` (v1), Store `kv`: `archiv` = Archivordner, `zuletzt` = zuletzt geöffnete Projekte (führt die Leiste), `spesenkit-ordner` = SpesenKit-Ordner der Person. Alle Apps unter `kaspersebastian83-dot.github.io` teilen ihn; da jede Person ein eigenes Windows-Profil hat, ist er persönlich. |
| Absprung | `../labelkit/?projekt=<Ordnername>` (LabelKit) · `../Bildumbenenner/?projekt=<Ordnername>` (FotoKit) · `../Probenplan/?projekt=<Ordnername>` (PlanKit, mit `&aktion=anlage` direkt zur Anlage) · `../aufwandkit/?projekt=<Ordnername>` (BelegKit) · `../reisekosten-pro/` (SpesenKit, ohne Projekt) |
| Offline-Speicher | Jede App verwaltet nur Caches mit eigenem Präfix (`projektzentrale:`, `bildumbenenner:`, `probenplan:`, `aufwandkit:`, `reisekosten-pro:`; LabelKit hat keinen Service Worker). |

Felder in `_Projekt.json`: `projektnummer`, `schadenort`, `objekt`, `auftraggeber`, `schadennummer`, `schadenereignis`, `schadendatum`, `ortstermin`, `auftragsdatum` (Daten `JJJJ-MM-TT`), `sachverstaendiger`, `versicherungsnehmer`, `sachverstaendigerBeteiligt`, `sanierung`, `kontakte`, `notizen`, `verteiler` (`{ versicherung|sachverstaendiger|versicherungsnehmer|sanierung: { an: true, versandt: "JJJJ-MM-TT" } }`), `arbeitszettel` (`{ datei, sha256, titel, eingelesen }`), `geaendert`, `geaendertMit`.

## Neue Version veröffentlichen

1. In `index.html` `APP_VERSION` erhöhen und `CHANGELOG` ergänzen.
2. Pull Request mergen; Release `vX.Y.Z` auf GitHub anlegen.
3. GitHub Pages veröffentlicht automatisch; geöffnete Apps melden „Update verfügbar“.

## Tests

Ohne Abhängigkeiten, mit Node.js aus dem Repository-Ordner:

```sh
node tests/docx.cjs     # Word-Schreiber: Paket, XML, Maskierung, Tabellen, Bilder
node tests/anlage.cjs   # Anlage PN 98 / Brandgeruch: Inhalte, Blind-Modus, Quellenvermerk, Dateinamen
node tests/arbeitszettel.cjs   # Arbeitszettel lesen: volle und knappe Zettel, Reihenfolge, kein Zettel, Datum
node tests/buero.cjs    # Übergabe, Empfängerstand, Retry, Fehler, parallele Rückmeldungen
node tests/sw.cjs       # Service Worker: alle Offline-Dateien vorhanden, pdf.js dabei
```

Browsertest des ganzen Ablaufs (Archiv → Projekt → Anlage → Datei, Prüfsummen, Protokoll), mit Playwright:

```sh
npm install --no-save playwright && npx playwright install chromium webkit
node tests/anlage-browser.cjs chromium
node tests/anlage-browser.cjs webkit
node tests/arbeitszettel-browser.cjs chromium   # PDF lesen, Dialog, Speichern, Verteiler
node tests/zuletzt-browser.cjs chromium         # zuletzt geöffnete Projekte, Vorwahl beim Start
node tests/wechsel-browser.cjs chromium         # Projektwechsel nach gescheitertem Speichern: nichts geht still verloren
```

Die Test-Arbeitszettel in `tests/fixtures/` sind frei erfunden (gleiche Form wie das Original, keine echten Daten).

GitHub führt alle Tests bei jedem Pull Request aus (`.github/workflows/tests.yml`). Wie die Datei in Word aussieht, bitte zusätzlich einmal praktisch prüfen.

## Dateien

- `index.html` – die komplette App
- `vendor/pdfjs/` – pdf.js (Apache-2.0, siehe `LICENSE` dort), nur zum Lesen der Arbeitszettel; wird bei Bedarf geladen
- `tests/` – automatische Prüfungen (Node, Browser)
- `sw.js` – Service Worker: offline nutzbar, immer neueste Version wenn online
- `manifest.webmanifest`, `icon*.{svg,png}` – Installation als App
