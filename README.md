# Projektzentrale

Alle Projektordner im Überblick – Status je Unterordner, gemeinsame Projektdaten und Absprung in die Projekt-Apps LabelKit, FotoKit (früher Bildumbenenner), PlanKit (früher Probenplan) und BelegKit (früher AufwandKit). Dazu ohne Projektbezug SpesenKit (früher Reisekosten Pro) für die monatliche Spesenabrechnung.

**App öffnen:** https://kaspersebastian83-dot.github.io/Projektzentrale/ · aktuelle Version **1.15.1** (Änderungen: Klick auf die Versionsnummer in der App)

## Neu in 1.15.0 · 23.10.2026

**🏆 Bestenliste** (`bestenliste/`, in der Projektzentrale unter „Weitere Apps“): eigene Seite für alle, auch als Bildschirm im Büro. Rangliste für Monat, Jahr und Gesamt mit Podest, „Neueste Erfolge“, Abzeichen je Person und Projekte je Jahr. Nur lesen; aktualisiert sich alle 10 Minuten. Neue Erfolge seit dem letzten Besuch gibt es mit Konfetti.

| Punkte | wofür | wer |
|---|---|---|
| 10 | Projekt abgeschlossen (Büroübergabe „Erledigt“) | zuständige Person |
| 1 je Probe, max. 20 | Proben in der LabelKit-Projektdatei | zuständige Person, beim Abschluss |
| 2 | Bilddokumentations-PDF in „Fotos“ | zuständige Person, beim Abschluss |
| 2 | Probenplan in „Pläne“ | zuständige Person, beim Abschluss |
| 3 / 1 / 1 | Gegenlesen / PDF zugeordnet / Versand (einmal je Übergabe) | Kürzel aus der Büroübersicht |
| 2 | Rückfrage innerhalb von 2 Werktagen beantwortet | zuständige Person |

Abzeichen: Meilensteine (1, 10, 25, 50, 100 Abschlüsse), 👑 Probenkönig/in (meiste Proben im Monat), ⚡ schnellster Abschluss des Jahres, 🔥 Serie (≥ 3 Wochen in Folge mit Abschluss), 🛟 Rückfrage-Retter/in, 🔍 Adlerauge (Gegenlesen). Kürzel aus der Büroübersicht werden über Ordner- oder App-Kürzel der Mitarbeiterliste zugeordnet; was nicht passt, steht als „nicht zugeordnet“ unter der Rangliste. Ältere Projekte ohne Büroübergabe zählen nur in „Projekte je Jahr“. Die Rechnung steht in `bestenliste/punkte.js` (getestet in `tests/bestenliste.cjs`).

## Neu in 1.14.0 · 23.10.2026

**„📊 Auslastung“** zeigt je zuständiger Person, wie viele Projekte offen sind und wo sie stehen:

| Spalte | bedeutet |
|---|---|
| In Bearbeitung | noch keine offene Büroübergabe (auch: Übergabe zurückgenommen) |
| Beim Büro | Übergabe offen: Gegenlesen, PDF, Versand |
| Rückfrage | das Büro wartet auf eine Antwort |

- Offen ist ein Projekt, bis eine Büroübergabe „Erledigt“ ist. Gezählt werden Projekte des laufenden und des vorigen Jahres (z. B. 25.xxxx und 26.xxxx).
- Zuständig: die in der Projektzentrale gewählte Person, sonst das Kürzel im Ordnernamen; sonst „Ohne erkannte Person“. Aktive Personen stehen auch mit 0 in der Tabelle, inaktive nur mit offenen Projekten.
- Eine Zahl anklicken zeigt die Projekte, ein Klick darauf öffnet das Projekt. Die Zahlen ergänzen sich, solange die Projekte noch eingelesen werden.
- Nur lesen, keine neue Datei. Dafür liest die Projektzentrale zusätzlich die Büroübergaben (`_Buero`) der Projekte im Zeitraum.

## Neu in 1.13.0 · 23.10.2026

**Büroübersicht mit zuständiger Person.** Jede Übergabe zeigt unter dem Schadenort die zuständige Person: die in der Projektzentrale gewählte („in der Projektzentrale gewählt“), sonst die Person zum Kürzel am Ende des Ordnernamens. Der Schadenort steht ohne Kürzel, auch bei Übergaben, die vor 1.12 angelegt wurden (abgeleitet aus dem gespeicherten Ordnernamen; die Übergabedateien bleiben unverändert).

- Filter **„Zuständig“**: Alle · Meine Übergaben (Person aus „Ich bin …“ der Projektzentrale, gleicher Browser) · eine Person · ohne erkannte Person. Die Auswahl wird je Browser gemerkt. Die Suche findet auch Namen und Kürzel.
- Gelesen werden zusätzlich nur `_Spektron-Mitarbeiter.json` und `_Projekt.json` der Projekte mit Übergaben. Fehlt die Mitarbeiterliste, sieht die Büroübersicht aus wie bisher.

## Neu in 1.12.0 · 23.10.2026

**Zuständige Person aus dem Projektordner.** Projektordner heißen `<JJ.Nummer> <Ort> <Kürzel>`, z. B. `26.0123 Musterstraße Köln Nad`. Die Projektzentrale liest den Namen von hinten: Ein Kürzel aus der Mitarbeiterliste am Ende wird erkannt (bis zu drei Wörter, ohne Groß-/Kleinschreibung, Leerzeichen und Punkte – „Dr. Ka“ = „Dr.Ka“), alles davor ist der Ort, mit oder ohne Straße. Kein Treffer → Ort bleibt der ganze Rest, mit Hinweis.

- **„👥 Mitarbeiter“** pflegt die Liste in `<Archivordner>/_Spektron-Mitarbeiter.json` (Ordnerkürzel, Name, App-Kürzel für LabelKit/BelegKit, aktiv). Namen stehen nur dort, nicht im Programmcode. Ohne Liste wird nichts abgetrennt (wie bisher). Eine unlesbare Datei wird nie überschrieben; hat ein anderer Rechner die Liste inzwischen geändert, wird nicht gespeichert.
- **„Zuständig“** im Projektkopf: vorausgewählt ist die Person aus dem Ordnernamen. Eine andere Auswahl wird als `zustaendig` in `_Projekt.json` gespeichert, der Ordner bleibt unverändert; „wie Ordnername“ entfernt sie wieder. Weicht die Auswahl ab, steht „Ordnername: …“ daneben. Ist das Feld „Sachverständiger“ leer, wird der Name nur als Vorschlag angezeigt.
- **„Ich bin …“ und „Meine Projekte“** filtern die Liste (je Windows-Profil gemerkt, beim Start nicht vorausgewählt). Die Liste zeigt das Kürzel hinter dem Ort.
- Der Schadenort in `_Projekt.json` wird beim nächsten Speichern ohne Kürzel geschrieben. Kennung bleibt überall der volle Ordnername (Links, „zuletzt“, Büroübergaben).
- Anzeige in den Projekt-Apps und der Büroübersicht folgte in 1.13.0 bzw. den App-Versionen vom 23.10.2026.

## Neu in 1.11.0 · 21.10.2026

Die Projektansicht zeigt zuerst Projektkopf und vier jederzeit verfügbare Aufgaben. Die Büroübergabe ist kompakt; Empfänger, Datei, Änderungen und frühere Aufträge stehen in aufklappbaren Details. Rückfragen, Fehler und ungeklärte Speicherversuche bleiben am Projektkopf sichtbar. Ordner und frühere Versandangaben sind nachgeordnet. Dateifunde bedeuten keine fachliche Fertigstellung. Die Projektliste lässt sich auch per Tab und Enter/Leertaste bedienen. Datenformate, Dateierzeugung, Fragmentlinks und Büro-Sicherheitsregeln bleiben erhalten.

[UI-Abnahme und Vorher-/Nachher-Bilder](docs/projektansicht/README.md).

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
- **Projektansicht (ab 1.11):** Projektnummer, Ort, Objekt und Auftraggeber stehen über vier jederzeit verfügbaren Aufgaben: „Proben & Laborauftrag“, „Fotos & Dokumentation“, „Probenplan bearbeiten“ und „Zeiten & Abrechnung“. Dezente App-Farben bleiben; Dateibestand bedeutet keine fachliche Fertigstellung. Anlagen sind weiterhin an ihrer Aufgabe erreichbar. Büroübergabe, Ordner und frühere Versandangaben folgen als aufklappbare Bereiche. Rückfragen, Konflikte, Speicherfehler und offene Versuche bleiben am Projektkopf sichtbar.
- **Weitere Apps (ab 1.9):** Ganz unten im rechten Fenster (auch ohne gewähltes Projekt) öffnet „Büroübersicht“ die separate Büroarbeit; „SpesenKit“ öffnet die monatliche Spesenabrechnung der Kollegen in einem eigenen Fenster. Kein Projektbezug, darum kein nummerierter Arbeitsschritt und kein `?projekt=` im Link (`../reisekosten-pro/` – die Webadresse trägt noch den früheren Namen „Reisekosten Pro“). SpesenKit speichert nicht im Archivordner, sondern in einem eigenen Ordner je Person (siehe unten).
- **Leiste in den Projekt-Apps (ab 1.7.1):** LabelKit, FotoKit, PlanKit und BelegKit zeigen oben dieselbe schmale Leiste – Projekt mit Wechsel zu den zuletzt geöffneten, die vier Arbeitsschritte mit Haken und „Weiter: …“ zum nächsten offenen Schritt. Die Projektzentrale führt dafür die Liste `zuletzt` im gemeinsamen Browser-Speicher; beim Start ist das zuletzt in einer App geöffnete Projekt vorgewählt.
- Zeigt je Projekt, was schon da ist: Fotos, Bilddokumentation, Probenplan, Probenerfassung (LabelKit `…_Daten.json`), Laborergebnisse.
- Legt fehlende Standard-Unterordner auf Wunsch an.
- **Projektdaten** (Objekt, Auftraggeber, Schaden-Nr., Auftragsdatum, Schadenereignis, Schadendatum, Ortstermin, Sachverständiger, Versicherungsnehmer, beteiligter Sachverständiger, Sanierung, Ansprechpartner, Notizen) in `_Projekt.json` im Projektordner – gemeinsam für alle Apps und Kollegen.
- **Arbeitszettel einlesen (ab 1.8):** „📄 Arbeitszettel einlesen …“ in den Projektdaten (oder das PDF auf die Karte ziehen) liest den Arbeitszettel des Büro-Systems. Gelesen wird je Kasten unter seiner Überschrift: RISKO → Objekt, VERSICHERUNG → Auftraggeber / Versicherung, VERSICHERUNGSNEHMER, SACHVERSTÄNDIGER → beteiligter Sachverständiger, SANIERUNG, Schadennummer, Schaden vom, Auftragsdatum, Termin → Ortstermin, Mitarbeiter → Sachverständiger („Sebastian Kasper“ → „Dr. S. Kasper“), Regulierer/Anrufer/ASP → Ansprechpartner, freier Text im Arbeitsauftrag → Notizen.
  - Vor dem Speichern zeigt ein Dialog jeden Wert. Leere Felder werden angehakt, ausgefüllte nur überschrieben, wenn man sie anhakt; gleiche Werte bleiben unberührt.
  - Steht auf dem Zettel eine andere Projektnummer als im Ordnernamen, ist nichts angehakt und „Übernehmen“ erst nach ausdrücklicher Bestätigung möglich. Hinweise bei unplausiblen Daten (Termin vor Auftragsdatum, Schaden nach Auftrag); kein Datum → Feld bleibt leer.
  - Ordner werden nicht angelegt oder verändert; geschrieben wird nur `_Projekt.json` (mit Dateiname und SHA-256 des Zettels unter `arbeitszettel`). Das PDF wird nur im Browser gelesen.
  - PDF-Bibliothek: pdf.js (Mozilla, Apache-2.0, Legacy-Build) in `vendor/pdfjs/`, wird erst beim ersten Einlesen geladen. Funktioniert in der Online-Version (nicht aus einer lokal geöffneten Datei).
- **Frühere Versandangaben (ab 1.8 als „Verteiler“):** Nachgeordnete historische Karte – Auftraggeber, Sachverständiger, Versicherungsnehmer, Sanierung: anhaken, wer das Gutachten bekommt, und nach dem Versand das Datum eintragen („heute“). Gespeichert als `verteiler` in `_Projekt.json`. Bei digitalen Büroaufträgen nur noch Ansicht; deren Versand wird ausschließlich in der Büroübersicht geführt.
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
| Projektordner | `<JJ>.<Nummer> <Schadenort> <Kürzel>`, z. B. `26.0123 Köln Nad`. Projektnummer, Schadenort und Kürzel kommen immer aus dem Ordnernamen (gelesen mit der Mitarbeiterliste). |
| Mitarbeiterliste | `<Archivordner>/_Spektron-Mitarbeiter.json`, `format: "spektron-mitarbeiter"`, `version: 1`, `personen: [{ ordnerKuerzel, appKuerzel, name, aktiv }]`. Nur die Projektzentrale schreibt sie. |
| Unterordner | `Fotos`, `Pläne`, `Laboraufträge`, `Laborergebnisse`, `Mitteilungen`, `Emails`, `Rechnung Labore` |
| Wer schreibt wohin | FotoKit → `Fotos` (Bilder, `_Bildumbenenner.json`, Bilddokumentation-PDF/ZIP) · PlanKit → `Pläne` (`Probenplan <Projekt>.probenplan`, exportierte Bilder) und `Mitteilungen` (Anlage Probenahme) · LabelKit → `Laboraufträge` (und Scans in `Feldprotokolle`) · Projektzentrale → `_Projekt.json` und `Mitteilungen` (Anlagen, `_Anlagen-Protokoll.txt`) · BelegKit → `Abrechnung` (`Aufwand_<Kürzel>.json` je Person, `_Abrechnung.json`, Stände) und `_AufwandKit-Einstellungen.json` im Archivordner · SpesenKit → nicht ins Archiv, sondern in den eigenen Ordner `SpesenKit` je Person (`Daten/spesenkit.json`, `Spesen/<Jahr>/<Monat>/` mit PDF/ZIP der abgeschlossenen Abrechnungen, `Sicherungen/`) |
| `_Projekt.json` | `format: "mosaik-projekt"`, `version: 1`. Jede App liest frisch, ändert nur die eigenen geänderten Felder und behält unbekannte Felder. Nicht löschen oder umbenennen. |
| Gemeinsamer Browser-Speicher | IndexedDB `mosaik-suite` (v1), Store `kv`: `archiv` = Archivordner, `zuletzt` = zuletzt geöffnete Projekte (führt die Leiste), `spesenkit-ordner` = SpesenKit-Ordner der Person. Alle Apps unter `kaspersebastian83-dot.github.io` teilen ihn; da jede Person ein eigenes Windows-Profil hat, ist er persönlich. |
| Absprung | `../labelkit/?projekt=<Ordnername>` (LabelKit) · `../Bildumbenenner/?projekt=<Ordnername>` (FotoKit) · `../Probenplan/?projekt=<Ordnername>` (PlanKit, mit `&aktion=anlage` direkt zur Anlage) · `../aufwandkit/?projekt=<Ordnername>` (BelegKit) · `../reisekosten-pro/` (SpesenKit, ohne Projekt) |
| Offline-Speicher | Jede App verwaltet nur Caches mit eigenem Präfix (`projektzentrale:`, `bildumbenenner:`, `probenplan:`, `aufwandkit:`, `reisekosten-pro:`; LabelKit hat keinen Service Worker). |

Felder in `_Projekt.json`: `projektnummer`, `schadenort`, `objekt`, `auftraggeber`, `schadennummer`, `schadenereignis`, `schadendatum`, `ortstermin`, `auftragsdatum` (Daten `JJJJ-MM-TT`), `sachverstaendiger`, `versicherungsnehmer`, `sachverstaendigerBeteiligt`, `sanierung`, `kontakte`, `notizen`, `zustaendig` (`{ kuerzel, gesetzt: "manuell", am, von }`, fehlt = wie Ordnername), `verteiler` (`{ versicherung|sachverstaendiger|versicherungsnehmer|sanierung: { an: true, versandt: "JJJJ-MM-TT" } }`), `arbeitszettel` (`{ datei, sha256, titel, eingelesen }`), `geaendert`, `geaendertMit`.

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
node tests/ordnername.cjs   # Ordnername von hinten lesen: Ort, Kürzel, Hinweise, ohne Mitarbeiterliste
```

Browsertest des ganzen Ablaufs (Archiv → Projekt → Anlage → Datei, Prüfsummen, Protokoll), mit Playwright:

```sh
npm install --no-save playwright && npx playwright install chromium webkit
node tests/anlage-browser.cjs chromium
node tests/anlage-browser.cjs webkit
node tests/projektansicht-browser.cjs           # kompakte Ansicht, Tastatur, Hinweise, Fenstergrößen, nativer Zoom
node tests/arbeitszettel-browser.cjs chromium   # PDF lesen, Dialog, Speichern, Verteiler
node tests/zuletzt-browser.cjs chromium         # zuletzt geöffnete Projekte, Vorwahl beim Start
node tests/zustaendig-browser.cjs chromium      # Mitarbeiterliste, Zuständig, Meine Projekte, unlesbare Liste, Konflikt
node tests/wechsel-browser.cjs chromium         # Projektwechsel nach gescheitertem Speichern: nichts geht still verloren
```

Die Test-Arbeitszettel in `tests/fixtures/` sind frei erfunden (gleiche Form wie das Original, keine echten Daten).

GitHub führt alle Tests bei jedem Pull Request aus (`.github/workflows/tests.yml`, Chromium). Es gibt nur diesen einen Test-Workflow; zusätzliche Kompatibilitäts- und Integrations-Workflows wurden am 23.10.2026 entfernt. Wie die Datei in Word aussieht, bitte zusätzlich einmal praktisch prüfen.

## Dateien

- `index.html` – die komplette App
- `vendor/pdfjs/` – pdf.js (Apache-2.0, siehe `LICENSE` dort), nur zum Lesen der Arbeitszettel; wird bei Bedarf geladen
- `tests/` – automatische Prüfungen (Node, Browser)
- `sw.js` – Service Worker: offline nutzbar, immer neueste Version wenn online
- `manifest.webmanifest`, `icon*.{svg,png}` – Installation als App
