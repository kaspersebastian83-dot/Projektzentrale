# Projektzentrale

Alle Projektordner im Überblick – Status je Unterordner, gemeinsame Projektdaten und Absprung in die Projekt-Apps LabelKit, FotoKit (früher Bildumbenenner), PlanKit (früher Probenplan) und BelegKit (früher AufwandKit). Dazu ohne Projektbezug SpesenKit (früher Reisekosten Pro) für die monatliche Spesenabrechnung, GlasKit (Gebäude aus Glas, 3D-Ansicht der PlanKit-Pläne) und LexiKit (Themensuche in den fertigen Berichten).

**App öffnen:** https://kaspersebastian83-dot.github.io/Projektzentrale/ · aktuelle Version **1.54.0** (Änderungen: Klick auf die Versionsnummer in der App)

## Neu in 1.54.0 · 27.11.2026 – Mitteilungen als Ebene, Stufe A (Plan 4, Entscheidungen 1–12)

Plan `claude/projektzentrale-mitteilungen-plan.md` (Abschnitte 3, 4, 7) und `claude/spektron-mitteilungen-ebene-plan.md` (M1–M18), Spektron-Projekt.
- **`mitteilungen.js`** (neu, nur rechnen, Node-testbar): Liste der Mitteilungen aus Einträgen, Word-Dateinamen („n. Mitteilung ….docx“) und Büroaufgaben mit Zustand *in Arbeit · Entwurf · beim Büro · versandt am* (gerechnet, nie gespeichert; Büroaufgabe ↔ Mitteilung über die Nummer im Word-Pfad, Entscheidung 3); Kennung und `mitteilungZaehler` nach O13 (nie neu vergeben, sinkt nie, bleibt ohne Liste); Nummer = höchste aus Dateinamen und Einträgen + 1 (Entscheidung 6); Grenze (Übergabe → frühere Versandangaben → Dateizeit) und Vorwahl der Termine beim Anlegen (Abschnitt 3); Anlagen-Liste je Mitteilung (Vorschlag aus BerichtKit `berichte[].anlagenListe` zur Word-Datei, sonst aus dem Bezug: Bilddoku je Termin aus FotoKit `bilddokus[t]`, Prüfberichte und Plan „noch in keiner Mitteilung“; von Hand `anlagenDazu`/`anlagenWeg`; fest = Liste der Büroaufgabe); Nummern über `anlagen.js`.
- **`anlagen.js`** byte-gleich aus BerichtKit (Entscheidung 8), Vergleichstest `tests/anlagen-gleich.cjs` – die CI holt BerichtKit daneben.
- **`stufen.js`:** `kacheln(f, r, je)` – optionales drittes Argument ersetzt nur Text und gelbe Lücke der Kacheln Fotos, Labor, Plan, Bericht; das ✓ und der Zustand bleiben. Ohne `je` byte-gleich mit 1.53.1 (Test gegen das gespeicherte Ergebnis). `Stufen.berechnen` unverändert.
- **`_Projekt.json`:** `weitereMitteilungen: [{ id, nr, termine, auftraege: [], anlass?, angelegt, von, anlagenDazu?, anlagenWeg? }]` und `mitteilungZaehler` – nur ab der zweiten Mitteilung, immer im selben Patch, über `S.pjDirty → flushPJ → patchPJ` mit `otStand()` (gespeichert + unterwegs + offen). Beim Anlegen der 2. wird der Bezug beider aufgeschrieben (Entscheidung 1, 2). `auftraege` bleibt leer (Entscheidung 4). Ein Projekt mit einer Mitteilung bekommt kein Feld; die Datei bleibt nach dem Öffnen byte-gleich.
- **Oberfläche** (nur bei mehr als einer Mitteilung): Zeile `#mtZeile` zwischen `#azMeldung` und `#jetzt` – ein Reiter je Mitteilung mit Zustand, „+“, darunter „Bezug … · ändern / zuordnen …“, „Mitteilung entfernen“ (nur ohne Word-Datei und nie übergeben, Entscheidung 11). Wahl je Projekt im Browser (Entscheidung 10), Vorwahl: neueste nicht versandte. „Jetzt dran“ und Kacheltexte gelten für die gewählte Mitteilung (Fakten `mitteilung`, `buero`, `uebergabe`, `versand` aus ihr). Die Büro-Karte ist die Karte der Mitteilung: Anlagen-Liste (Nr · Art · Datei · Herkunft · „ändern …“ · „entfernen“, „+ Datei zuordnen“, „auch in der 1. Mitteilung“, Fehlendes gelb, Vergleich mit dem Bericht) statt der Vorhak-Liste; Word-Datei nur die der Mitteilung; versandte/übergebene nur zum Ansehen aus der Büroaufgabe.
- **Anlegen:** „+“ in der Zeile, „Mehr zum Projekt …“ › „Weitere Mitteilung beginnen …“ und – nur bei einer übergebenen Mitteilung mit Neuem danach – ein Angebot in „Jetzt dran“. Eine Rückfrage mit Haken je Ortstermin und Mitteilung. Bestand (≥ 2 Dateinamen ohne Eintrag, Entscheidung 12): Zeile aus den Dateinamen, geschrieben wird erst beim Zuordnen. Widerspruch (anderes Fenster) → nichts überschrieben, neu gelesen, Hinweis.
- **Übergabe:** Anlagen in Nummernfolge wie im Bericht – auch bei einer Mitteilung (Entscheidung 7; Oberfläche dort unverändert). Bei mehreren Mitteilungen nur mit Word-Datei.
- **Termin entfernen:** Rückfrage nennt die Mitteilung; ein Termin in einer übergebenen Mitteilung ist nicht entfernbar (O12-Ergänzung).
- **Link:** `&mitteilung=<Kennung>` in allen Links in die Apps, nur bei gezeigter Zeile; `sprungLesen` liest es. Projekte „Vor Spektron“ bleiben wie bisher.
- Tests: neu `tests/mitteilungen.cjs`, `tests/anlagen-gleich.cjs`, `tests/mitteilungen-browser.cjs` (Testprojekt `26.0999 Teststadt Ka`, zwei Fenster, angehaltenes Schreiben, eine Mitteilung byte-gleich, FotoKit daneben), `tests/stufen.cjs` erweitert. Angepasst: `uebergabe-browser.cjs` (Projekte mit zwei Mitteilungen zeigen jetzt die Zeile), `anlage-browser.cjs` (neuer Knopf). sw.js Cache v52.

## Neu in 1.53.1 · 26.11.2026 – Ortstermine: drei Befunde aus dem Codex-Review zu #92

- **Speichern läuft noch (P1):** `flushPJ` leert `S.pjDirty`, bevor geschrieben ist. Neu `S.pjUnterwegs` (Patches, die gerade geschrieben werden, je Projekt); `otStand()` = gespeicherter Stand + unterwegs + `S.pjDirty`. Damit bauen Anlegen, Ändern, Entfernen und der Zähler (`ortsterminZaehler`) immer auf dem Patch auf, der gerade geschrieben wird – vorher konnte eine zweite Änderung die Liste aus dem alten Stand bauen (Termin weg, Kennung doppelt, entfernter Termin wieder da). Jede Änderung der Liste schreibt den Zähler mit (`otListeSetzen`). Scheitert ein Schreiben, kommt ein Feld nur zurück in die offenen Eingaben, wenn weder eine offene Eingabe noch ein späterer Patch unterwegs es enthält („neuere Eingaben gewinnen“ – für die Liste je Termin, weil jede neuere Liste auf der älteren aufbaut). Gilt für alle Felder; bisher konnte ein gescheiterter Patch einen späteren überschreiben.
- **Entwurf je Projekt (P2):** `S.otEntwuerfe` (Map nach Projekt) statt eines Entwurfs; nur ein Entwurf desselben Projekts sperrt „+ Weiterer Ortstermin“. Beim Projektwechsel bleibt er beim alten Projekt – wie dort offene Eingaben, die der Wechsel nicht verwirft (ein Entwurf ohne Datum lässt sich nicht speichern).
- **Übergabe (P2):** Nach dem Speichern von `weitereOrtstermine` wird die Übergabe neu gezeichnet; ändert sich die Vorauswahl bei offenem Formular, steht darüber „Vorauswahl geändert: weiterer Ortstermin …“ (bzw. „nur noch ein Ortstermin …“), von Hand gesetzte Haken bleiben. Abgesendet werden genau die beim Klick angehakten Zeilen (nicht neu gerechnet).
- Tests in `tests/ortstermine-browser.cjs` (Schreiben künstlich verzögert bzw. einmal scheiternd; Entwurf in A, Wechsel zu B; Übergabe offen, Termin speichern, absenden). Jeder Teil ist ohne seine Korrektur rot. sw.js Cache v51.

## Neu in 1.53.0 · 26.11.2026 – Mehrere Ortstermine in einem Projekt (FotoKit-Ortstermine, Plan 4.1)

Plan `claude/fotokit-ortstermine-plan.md` Abschnitt 4.1, Entscheidungen O1, O9, O12 (`claude/fotokit-ortstermine-entscheidungen.md`, Spektron-Projekt).
- **`_Projekt.json`** (`format`/`version` unverändert): `ortstermin` bleibt allein Termin 1 – Feld, Pflichtangabe, Arbeitszettel (`azFelder`), `durchlauf.js` und alle Apps lesen es wie bisher. Neu nur, wenn es einen zweiten Termin gibt: `weitereOrtstermine: [{ id: "t2", datum, bezeichnung, wer }, …]`, optional `ortsterminBezeichnung`, `ortsterminWer` (Termin 1 = `t1`). Ein Projekt mit einem Termin bekommt kein neues Feld; wird der letzte weitere Termin entfernt, verschwindet `weitereOrtstermine` wieder.
- **Kennungen** (`ortstermine.js`, nur rechnen; Basti 26.11.2026: strikt „nie neu vergeben“): neues optionales Feld `ortsterminZaehler` (Zahl) = höchste je vergebene Termin-Nummer; nächste Kennung = Zähler + 1. Der Zähler wird im selben Patch wie `weitereOrtstermine` geschrieben (Widerspruchsprüfung für beide), sinkt nie und bleibt, wenn der letzte weitere Termin entfernt wird. Fehlt er (erster weiterer Termin, Bestand), wird aus allem gerechnet, was irgendwo steht (`weitereOrtstermine`, FotoKits `bilddokus`, `dokuGeaendertJe`, `ordnerTermine`, `bilder[].termin`, künftig `weitereMitteilungen[].termine`), und der Zähler dabei angelegt (auch beim Entfernen). Nur ohne Zähler braucht das Anlegen FotoKits Datei – ist sie dann nicht lesbar, wird kein Termin angelegt. Ein Projekt ohne zweiten Termin bekommt das Feld nie. Dieselbe Regel gilt für FotoKit 2.7.0 und später für `weitereMitteilungen`.
- **Oberfläche** (Karte „Schaden und Termine“): als ganze Zeile unter „Ortstermin · Sachverständiger“ der Link „+ Weiterer Ortstermin“ (`#otBlock`). Ab zwei Terminen je Zeile Datum · Bezeichnung (`<datalist>` Erstbegehung · Nachbeprobung · Freimessung) · Wer war da · „Entfernen“; Termin 1 zeigt das Datum aus „Ortstermin“ und bekommt Bezeichnung und „Wer war da“. Ein neuer Termin ist ein Entwurf, bis sein Datum eingetragen ist – erst dann wird gespeichert. Gespeichert wird wie jedes Feld (`S.pjDirty` → `flushPJ` → `patchPJ`); die Liste ist ein Feld, also meldet `ProjectStore.update` einen Widerspruch, wenn ein anderes Fenster sie inzwischen geändert hat, und überschreibt nichts. `flushPJ` trimmt nur noch Texte (die Liste je Eintrag über `Ortstermine.bereinigt`).
- **Entfernen** (O12) mit Rückfrage: nennt die Foto-Ordner und Fotos, die FotoKit diesem Termin zugeordnet hat (werden dort wieder gelb), und eine unter `bilddokus[<Kennung>]` gemerkte Bilddoku (bleibt liegen und gemerkt). FotoKits Datei wird nur gelesen. Die Sperre für Termine in versandten Mitteilungen kommt mit der Mitteilungen-Ebene.
- **Kopf:** „Ortstermine 12.08. · 20.08.2026“ (nach Datum, ohne leere; ein Termin wie bisher „Ortstermin 12.08.2026“).
- **Bestand „n Bilder“** zählt Bilder in Unterordnern von `Fotos/` mit (eine Ebene, ohne Ordner mit „_“ oder „.“ vorn).
- **Übergabe:** Gibt es `weitereOrtstermine`, sind PDFs in `Fotos/` nur noch vorgehakt, wenn BerichtKit sie zur gewählten Word-Datei in `berichte[].anlagen` nennt (Zusatz „Anlage laut BerichtKit“) – nicht mehr nach Ordner oder Namen „Bilddoku…“.
- Geprüft (nachgestellt, nicht im Repo): FotoKit 2.6.0 speichert das Deckblatt und lässt `weitereOrtstermine`, `ortsterminBezeichnung`, `ortsterminWer` stehen; LabelKit 5.4.0 schreibt `_Projekt.json` nie (Datei nach Öffnen und zweimal Speichern byte-gleich).
- Tests: neu `tests/ortstermine.cjs` (Node) und `tests/ortstermine-browser.cjs`. sw.js Cache v50 (mit `ortstermine.js`).

## Neu in 1.51.6 · 21.11.2026 – „Neu einlesen“ während die Durchlaufzeiten gelesen werden (Audit Lauf 5)

Gleiches Muster wie 1.51.5, im Dialog „Durchlaufzeiten“.
- Die Durchlaufzeiten lesen alle Projekte im Hintergrund weiter, auch wenn der Dialog schon zu ist. Verwarf „Neu einlesen“ (oder der Umzug) in der Zeit die Auswertung (`S.dl = null`) und scheiterte danach das Lesen eines Projekts (z. B. Datei gesperrt), warf die Projektzentrale „Cannot read properties of null (reading 'werte')“. Jetzt merkt sich jeder Leser die Auswertung, für die er liest; ist sie verworfen, trägt er nichts mehr ein – auch nicht in eine neu begonnene. Für Nutzer nur ein Fehler im Hintergrund.
- Ein erfolgreiches Lesen warf vorher nicht (die alte Auswertung war beim Aufruf schon festgelegt), schrieb aber in die verworfene – ohne Wirkung.
- **Test:** `tests/durchlauf-neu-browser.cjs` erzwingt die Reihenfolge mit denselben zwei Sperren wie `meilensteine-browser.cjs`, das Lesen scheitert mit „Datei gesperrt“ – auf 1.51.5 rot, mit dem Fix grün.

## Neu in 1.51.5 · 21.11.2026 – „Neu einlesen“ während der Projektstand gelesen wird (Audit Lauf 5)

Gefunden von der Spektron-Kette in ResultKit (resultkit#40, 1 von 5 Läufen rot).
- `meilensteineLaden` wartet auf `dlLesen`. Setzte „Neu einlesen“ (oder der Spektron-Umzug) in der Zeit `S.ms = null`, warf das zurückkommende Lesen „Cannot read properties of null (reading 'set')“. Jetzt wird ein Ergebnis zum verworfenen Stand nicht mehr eingetragen; das Neu-Einlesen liest den Stand selbst. Für Nutzer nur ein Fehler im Hintergrund, sonst keine Wirkung.
- **Test:** `tests/meilensteine-browser.cjs` erzwingt die Reihenfolge mit zwei Sperren im Browser-Dateisystem (Lesen der BelegKit-Datei, Lesen der Mitarbeiterliste) – auf 1.51.4 fünfmal von fünf rot, mit dem Fix grün.

## Neu in 1.51.4 · 21.11.2026 – Fokus in der Projektliste (Audit Lauf 5)

Plan `claude/spektron-audit-2026-11-5-gesamt-plan.md` (Spektron-Projekt), PR 3; braucht TeamKit 0.5.2 (teamkit#2, gemergt).
- **E5:** `renderList` merkt sich, was in der Liste den Fokus hatte (Projekt über `data-name`, sonst `id` wie `vorToggle`/`heuteLink`), und setzt ihn nach dem Neuzeichnen wieder. Der Hintergrund-Scan zeichnet die Liste 300 ms nach einem Gruppenwechsel neu (`updateRow`) – wer mit der Tastatur in der Liste stand, verlor seine Stelle; Enter ging ins Leere. Ursache der gelegentlich roten `projektansicht-browser.cjs:73`. Ebenso beim Auf-/Zuklappen von „Vor Spektron“ mit der Tastatur.
- **Tests:** `projektansicht-browser.cjs` zeichnet die Liste mit fokussiertem Projekt neu und prüft den Fokus (auf 1.51.3 rot). `team-browser.cjs` wartet nach dem Öffnen, bis TeamKit „öffnen“ verarbeitet hat (Fokus im Rahmen auf „Los geht’s“ bzw. dem Eingabefeld), bevor Esc/F1 in der PZ gedrückt werden (E6; TeamKit 0.5.2 holt den Fokus nicht mehr in den Rahmen, wenn man schon zurück ist).
- **E8:** Tooltip von „💬 Rückmeldung“ beginnt mit „Fehler oder Wunsch melden“ (Kachel und Text sonst unverändert – sie zeigen schon „💬 Rückmeldung“ mit ↗).

## Neu in 1.51.1 · 20.11.2026

- **Sperr-Meldung neutral** (Audit 2026-11 Lauf 1, A11): `project-store.js` meldet „Das Projekt ist gerade in einem anderen **Spektron**-Fenster belegt …“ (bisher „Projektzentrale-Fenster“) – die Sperre kann auch FotoKit halten. Damit ist `project-store.js` wieder byte-gleich mit FotoKit (FotoKit prüft das ab 2.5.0 in der CI). sw.js Cache v46.
- **CI auch bei Push auf main** (A20): `tests.yml` läuft zusätzlich bei `push` auf `main` – bisher nur bei Pull Requests; Versionen direkt auf main (1.46.0, 1.47.0, 1.51.0) liefen nie durch die Tests.

## Neu in 1.51.0 · 17.11.2026

- **TeamKit angebunden** (Block `TEAMKIT-ANBINDUNG`, `TEAMKIT_URL = '../teamkit/'`): Knopf „Team“ (`#btnTeam`) direkt nach der Kurzanleitung, bis 860 px nur Zeichen und Zahl. Sobald der Archivordner verbunden ist (`useArchive` → `teamStart`), lädt TeamKit unsichtbar in `#teamRahmen` (`?eingebettet=1`; Testschalter `?teamprobe=1` lädt TeamKit im Probe-Modus). Vorher öffnet „Team“ TeamKit in einem eigenen Fenster.
- **Stand am Knopf** aus TeamKits Meldung `stand`: gelbe Zahl = neue „Gilt jetzt“-Mitteilungen, Punkt = heute ist etwas los, gefüllt „Guten Morgen“ = Guten-Morgen-Seite fällig; ohne Zugriff nur „Team“ („braucht einmal deine Erlaubnis – klicken“). `aria-label` sagt alles in Worten.
- **Schlagzeile** `#teamZeile` (nicht `#banner`) unter dem Kopf nur für „Wichtig“: „📌 Titel – Name · Ansehen · Gesehen“; „Gesehen“ merkt die ID in `localStorage` `pz-team-gesehen`.
- **Öffnen/Schließen:** Klick auf „Team“ zeigt den Rahmen und schickt `oeffnen` (mit Nummer des offenen Projekts), noch ein Klick oder Esc schließt (`zu`); TeamKits „Zurück“/Esc schickt `schliessen`, der Fokus kehrt zu „Team“ zurück. Ein Dialog der Projektzentrale blendet den Rahmen vorher aus. Oberkante gemessen (Kopf, Schlagzeile, Banner), Ebene unter Kopf-Menü und Dialogen. Protokoll: TeamKit-README „Einbettung“. sw.js Cache v45.
- Tests: neu `tests/team-browser.cjs` (Projektzentrale und TeamKit nebeneinander ausgeliefert, TeamKit im Probe-Modus; CI holt `teamkit` daneben). `tests/spektron-start-test.cjs` gibt allen anderen Browsertests für `/teamkit/` eine leere Testseite, damit kein 404 in der Konsole steht.

## Neu in 1.50.0 · 13.11.2026

- **LexiKit** unter „⋯ Büro & Apps“ (`#goLexi`, `LEXIKIT_URL = '../lexikit/'`, Fenster `lexikit`), direkt nach dem Handbuch: eigene App (Repo `lexikit`), Themensuche in den fertigen Word-Mitteilungen aller Projekte. Ohne Projektbezug, kein `?projekt=`; LexiKit liest den Archivordner aus `mosaik-suite`/`kv`/`archiv` und schreibt nur in `_LexiKit` im Archivordner. Kein Schritt, kein Projektstand. sw.js Cache v44.
- Tests: `tests/zuletzt-browser.cjs` prüft den Knopf (mit und ohne gewähltes Projekt, nicht Teil der Projektseite).

## Neu in 1.49.0 · 13.11.2026

- **Fehlende Pflichtangaben unter der zugeklappten Karte „Projektdaten“** (`claude/projektzentrale-pflichtangaben-inline-plan.md`): Seit 1.48 füllt der Arbeitszettel fast alles; offen bleiben meist Nutzung und Schadendatum. `#pjPflicht` (nach `</details>` in `.pz-projektdaten`) zeigt bis `PJ_INLINE_MAX` = 3 fehlende Felder aus `PJ_PFLICHT` zum Ausfüllen – gleiche Beschriftung, gleiche Bedienelemente (`feld(k, 'pjq_')`), „nicht bekannt“ inklusive. Keine zweite Speicherlogik: Eingaben werden an das Formularfeld `pj_<k>` weitergegeben (`input`-Event bzw. Klick auf `pj_<k>_nb`), angezeigt wird dessen Wert. Auswahl und „nicht bekannt“ verschwinden sofort (Fokus weiter zum nächsten offenen Feld), Text und Datum beim Verlassen. Aufgeklappt per CSS ausgeblendet (`#pjBox[open] + .pz-pflicht`) – kein Feld doppelt. Mehr als 3: „Fehlt: …“ mit „Angaben öffnen“ (`daten-auf`). Nicht bei „Vor Spektron“ und nicht bei nur lesbaren Projektdaten.
- **Hinweis oben** (`#pflichtFehlt`): „Fehlt: Nutzung · Schadendatum“ (Kurznamen `pjKurz`), ab 4 wie bisher „n Pflichtangaben fehlen“. `stufeAktion('daten')` springt bei zugeklappter Karte ins erste Feld der Zeile, statt aufzuklappen; sonst wie bisher.
- **Arbeitszettel-Meldung** (`#azHand`, `azHandZeigen`): „… übernommen: 13 Felder · noch von Hand: Nutzung“, Klick springt wie der Hinweis; ohne Rest unverändert.
- In der Zeile Eingetipptes klappt die Karte beim Neuzeichnen nicht auf (`S.pjInline`); Fokus in der Zeile bleibt beim Neuzeichnen erhalten. sw.js Cache v43.
- Tests: neu `tests/pflicht-browser.cjs`; `heute-browser.cjs` und `projektansicht-browser.cjs` an den neuen Hinweistext angepasst.

## Neu in 1.48.0 · 13.11.2026

- **Fix: Sperre nie endlos** (`project-store.js` `locked()`): `navigator.locks.request('mosaik:projekt:'+name)` mit `AbortController`, nach `ProjectStore.WARTEN` = 20 s Fehler mit `belegt: true` und `ProjectStore.BELEGT` („Das Projekt ist gerade in einem anderen Projektzentrale-Fenster belegt – bitte das andere Fenster schließen und erneut versuchen.“) – wie `spektron-umzug.js`. `fn` läuft dann nicht, nichts wird geschrieben; `flushPJ` behält `S.pjDirty`. Ursache des Fehlers „Arbeitszettel einlesen tut nichts“: ein zweites Fenster hielt die Sperre, `patchPJ`/`flushPJ` warteten still. **FotoKit hat eine eigene Kopie von `project-store.js`** (Kopf: „byte-identical“) – dort fehlt die Änderung noch.
- **`arbeitszettelEinlesen` nie still:** sofort Banner „Lese Arbeitszettel …“, „Speichere Arbeitszettel …“; `S.sel !== p` und Drop ohne Datei mit Meldung; kein Dialog, solange offene Eingaben nicht gespeichert sind (Grund im Banner).
- **Automatisch beim ersten Öffnen** (`claude/projektzentrale-az-einklick-plan.md`, Punkte 1–4): `azSuchen(p)` findet `Arbeitszettel/AZ*/Revision */*.pdf` (Groß/klein egal, NFC; Dateiname beliebig), höchste Revision als Zahl. `azPruefen(p)` läuft nur aus `selectProject` (Klick, Link, zuletzt geöffnet), nie beim Hintergrund-Scan. Automatisch nur ohne Vermerk `arbeitszettel` in `_Projekt.json`, nicht „Vor Spektron“, Projektdaten lesbar, genau ein Zettel-Ordner und genau ein PDF in der höchsten Revision, Projektnummer auf dem Zettel = Ordner, alle Daten lesbar, keine Felder mit anderen Werten, keine offenen Eingaben. Geschrieben in `ProjectStore.update` (in der Sperre frisch gelesen; steht dann schon ein `arbeitszettel`, nichts tun), nur leere Felder, Arbeitsauftrag an die Notizen. Vermerk `arbeitszettel: {datei, pfad, revision, sha256, titel, eingelesen, automatisch}` (bei Auswahl von Hand ohne `pfad`/`revision`, außer es ist dieselbe Datei wie im Ordner).
- **Meldung über „Jetzt dran“** (`#azMeldung`, bleibt bis × oder „Ansehen“): übernommen (n Felder · Ansehen · Rückgängig) · nicht automatisch (Grund · „Arbeitszettel prüfen und übernehmen“ = bisheriger Dialog mit der gefundenen Datei, ohne eindeutige Datei „Datei wählen …“) · keiner gefunden (nur solange Pflichtangaben fehlen, nie bei „Vor Spektron“) · nicht lesbar. **Rückgängig** (`azZuruecknehmen`): Stand vorher aus der Sicherung `_Projekt_Sicherungen/vorher_…` für die übernommenen Felder (seitdem von anderen geänderte bleiben und werden genannt), dazu `arbeitszettel.abgelehnt: true` – kein erneutes Übernehmen beim nächsten Öffnen. **Notizen** (Plan Punkt 3, Basti 13.11.: Anhängen bleibt): Arbeitsauftrag wird angehängt, nicht wenn er schon drinsteht; die Zeile sagt „· Arbeitsauftrag an die Notizen angehängt“ (bzw. „in die Notizen eingetragen“, wenn sie leer waren); nach der Übernahme geänderte Notizen lässt „Rückgängig“ stehen und nennt sie.
- **Neue Revision / anderer Inhalt** (sha256 ≠ Vermerk): „Neuer Arbeitszettel (Revision 002) – Änderungen ansehen“ → Dialog nur mit Feldern, die sich ändern würden; vorhandene Werte nicht angehakt. Nie automatisch, auch nicht nach „Rückgängig“. Ist die neuere Ablage nicht eindeutig (z. B. zwei PDFs in „Revision 003“), steht der Grund mit „Datei wählen …“ da – gleiche oder ältere Revision wie gelesen: keine Meldung. Für „genau ein Zettel“ zählen alle `AZ…`-Ordner, auch solche ohne Revision (Codex-Review #82).
- `pjBauen(name, data, patch)` aus `patchPJ` herausgelöst; `null` im Patch entfernt ein Feld (bisher nur `zustaendig`/`spektron`). Knopf in den Projektdaten: „Andere Datei wählen …“. sw.js Cache v42.
- Tests: `tests/project-store.cjs` (Sperre belegt → nach 20 s Fehler, nichts geschrieben, danach normal), `tests/arbeitszettel-browser.cjs` (automatisch mit Revision 9 vs. 010, Ansehen, Rückgängig, nicht wieder, Revision 002 nur geänderte Felder, andere Nummer, zwei PDFs, zweites Fenster hält die Sperre → Meldung in ≤ 20 s und Eingabe bleibt, 26.0367 ohne `SPEKTRON_START`-Override). Neue erfundene Vorlage `tests/fixtures/arbeitszettel-voll-rev2.pdf` (Termin 16.10.2026, Schaden-Nr. XY2026-0001236).

## Neu in 1.47.0 · 12.11.2026

- **„GlasKit öffnen“** unter „Mehr zum Projekt …“ (`#glasProjekt`, `data-aktion="glaskit"` → `openApp(p, GLASKIT_URL, 'glaskit')`): öffnet `../glaskit/#projekt=<Ordnername>` im Fenster `glaskit` (GlasKit ab 1.1.0 liest den Archivordner aus `mosaik-suite`/`kv`/`archiv`, nur mit Leserecht). Immer sichtbar – ohne Plan sagt GlasKit das selbst und bietet PlanKit an. Der Knopf unter „⋯ Büro & Apps“ (`#goGlas`, ohne Projekt) bleibt. sw.js Cache v41.

## Neu in 1.46.0 · 12.11.2026

- **GlasKit** unter „⋯ Büro & Apps“ (`#goGlas`, `GLASKIT_URL = '../glaskit/'`, Fenster `glaskit`): eigene App (Repo `glaskit`), liest eine PlanKit-Datei nur lesend und zeigt sie als gläsernes 3D-Modell. Noch ohne `#projekt=` – der Projektordner wird in GlasKit gewählt.

## Neu in 1.43.0 · 10.11.2026

- **Neuer Ort gilt** (Audit K1, `claude/spektron-k1-plan.md`): `spektron-ordner.js` – liegen passende Einträge in `_Spektron`, gilt `_Spektron`, auch ohne `_Umzug.json` (`konflikt` bleibt gesetzt). Ausnahme: `_Umzug.json` → `laeuft[<bereich>]` (Umzug dieses Bereichs begonnen, nicht vermerkt) → früherer Ort, `unterbrochen: true`. Neu: `zweiOrte(dir, bereiche)` / `zweiOrteText(eintrag)` – die eine Zeile, die jede App zeigt.
- **Umzug** (`spektron-umzug.js`): setzt `laeuft` vor dem Kopieren eines Bereichs und entfernt es mit dem Vermerk oder der Rücknahme (nur dafür angelegtes `_Umzug.json` wird wieder entfernt). Neu `zweiOrtePruefen(dir)` – je Bereich `streu` / `unterbrochen` / `nachzuegler` / `leer`; `streu`-Bereiche werden nicht hereingeholt (Konflikt mit `streu: true`).
- **Projektansicht**: Hinweis „App-Dateien an zwei Orten“ mit beiden Dateien und Datum je Bereich und was zu tun ist; „Umzug erneut ausführen“ nur, wenn er helfen kann. **Vorschau** „Spektron-Ordner einrichten“: Tabelle „Schon an zwei Orten“.

## Neu in 1.42.0 · 01.11.2026

- **Projektseite mit Kacheln** (Spektron Schritt 2, `claude/spektron-einfache-oberflaeche-schritt2-plan.md`): „Jetzt dran“ (Knopf in der Farbe der Ziel-App), darunter sechs Kacheln wie das Kopfband der Apps (Leiste v3): Proben · Fotos · Labor · Plan · Bericht · Abrechnung (`KACHELN` in `index.html`, Symbole und Farben wie `mosaik-leiste.js`). `Stufen.kacheln(f, r)` (nur rechnen, `tests/stufen.cjs`): ✓ = Datei der App da – wie die Leiste: `probendaten` (LabelKit-Projektdatei), FotoKit-Datei, `_Ergebnisse.json`, Probenplan, Bericht `berichtDa` (mit `_BerichtKit.json` nur ein gespeicherter Bericht der gemerkten Art, dessen Datei in „Mitteilungen“ liegt; ohne die Datei jede Mitteilung), BelegKit-Stand; Text = genauer Stand (Labor, Abrechnung und der Bericht nach der Übergabe aus `berechnen`). Die Bericht-Kachel (Aktion `berichtkit`) öffnet BerichtKit wie das Kopfband: gemerkte Art mit `&art=…&auto=1`, sonst ohne `art` – sie merkt nie selbst. `berechnen` (Jetzt dran, Gruppen der Liste, Heute) unverändert.
- Darunter Kontextkarte Anlage PN 98 / Brandgeruch (nur wenn nötig), Karte „Danach: ans Büro übergeben“ (`data-stufe="buero"`, mit `#bueroPanel`) und „Projektdaten“ (`data-stufe="projekt"`, `#pjBox`); im Kopf „Projektdaten ändern“ (`#pjAendern`).
- **„Mehr zum Projekt …“** (`#projektMehr`): „Asbestbericht öffnen“ (`#goBericht`), „Brandbericht öffnen“ (`#goBrand`, Hervorhebung nach Berichtsart wie bisher), „Anlage Probenahme …“, „Vor Spektron“-Knöpfe, Ordner, frühere Versandangaben. Keine Stufennummern mehr. Menü oben „⋯ Büro & Apps“ (gleiche Inhalte, `#btnMehr`).

## Neu in 1.41.0 · 01.11.2026

- **„Jetzt dran“ in Stufe 4** (Gutachten) führt jetzt zum Bericht: ohne Probenplan „Probenplan zeichnen →“, mit Plan „Brandbericht schreiben →“ bzw. „Asbestbericht schreiben →“ – welcher, steht in BerichtKit gemerkt (ab BerichtKit 1.15.0), sonst nach den LabelKit-Proben; ist noch nichts gelesen, öffnet „Bericht schreiben →“ BerichtKit, das selbst wählt. Nach dem gespeicherten Bericht wie bisher „Ans Büro übergeben“. Die Spektron-Leiste der Apps (v2) zeigt den Bericht mit Berichtsart und nach dem Speichern „Weiter: Ans Büro übergeben →“. Regel: `stufen.js` (`berichtsart`, neu `artGemerkt` wie BerichtKit `bericht-vorgaben.js`), Fakt `berichtsart` aus `faktenAusDetail`.

## Neu in 1.40.0 · 01.11.2026

- **Knopf „Brandbericht“** in Stufe 4 (Gutachten) neben „Asbestbericht“: `../berichtkit/#projekt=<Ordnername>&art=brand` (BerichtKit ab 1.14.0 öffnet den Brandbericht direkt). „Asbestbericht“ übergibt jetzt ausdrücklich `&art=asbest` (`berichtLink()`, `openBerichtKit()`).
- **Vorschlag nach den Proben** (`Stufen.berichtsart(lk)`, nur rechnen, getestet in `tests/stufen.cjs`): Aus der neuesten LabelKit-Projektdatei (dieselbe, die `anlStatus` für die Anlage PN 98 / Brandgeruch liest) – Chlorid- (auch Chlorid-Bohrmehl unter „Sonstige“ wie BerichtKit `istBohrmehl`), PAK- oder Brandgeruch-Proben → Brandbericht, nur Asbestproben → Asbestbericht, sonst keiner; stornierte Proben zählen nicht. Bewusst die neueste Projektdatei (wie die Anlage PN 98), nicht wie BerichtKit zuerst die in ResultKit genannte (`_Ergebnisse.json → auftrag.quelle`) – liegt eine alte Kopie daneben, kann der Vorschlag abweichen; er ist nur eine Hervorhebung. Der passende Knopf bekommt die Klasse `vorschlag` (Rahmen in der BerichtKit-Farbe, fett) und im Tooltip „Passt zu den LabelKit-Proben (…)“. Beide Knöpfe bleiben immer da; „Jetzt dran“ bleibt unverändert.
- Stufe 4 und „Ans Büro übergeben“: unverändert – der Brandbericht heißt wie der Asbestbericht `<n>._Mitteilung_<Nr>.docx` (`Stufen.MITTEILUNG`), `_BerichtKit.json → berichte[]` trägt zusätzlich `art: 'brand'` (wird nicht gebraucht). Die Anlage Brandgeruch daneben (`…_Brandgeruch_….docx`) wird nie als Gutachten vorgewählt (`word-wahl.js`). Browsertest `uebergabe-browser.cjs` mit einem Brandbericht (Lücken aus 5.1/6./8.) ergänzt.

## Neu in 1.39.0 · 30.10.2026

- **Richtige Word-Datei vorgewählt** (`word-wahl.js`, nur rechnen, getestet in `tests/word-wahl.cjs`): In „Ans Büro übergeben“ war bisher die neueste .docx in „Mitteilungen“ vorgewählt – oft eine Anlage. Jetzt in dieser Reihenfolge: (1) die Datei aus dem Link (`uebergabe=`) oder selbst gewählt, (2) der neueste Eintrag in `_BerichtKit.json → berichte[]`, dessen Datei noch da ist, (3) die neueste Datei nach `Stufen.MITTEILUNG`, (4) sonst keine: „– bitte die Mitteilung wählen –“ mit Hinweis, Übergeben erst nach der Wahl. Innerhalb von (2)/(3) geht eine Datei vor, die noch keine Büroaufgabe nennt (sonst stünde nach dem Versand der 1. Mitteilung wieder diese statt der 2. da).
- **Anlagen nie vorgewählt:** Anlage ist jede Datei mit Zeile im `_Anlagen-Protokoll.txt` (Bereich `anlagenProtokoll`, zusätzlich `Mitteilungen/`) und jede mit PlanKit-Muster (`_Probenahme_`, `_Raumbuch_`, `_Wandansichten_` + Datum) oder PN-98-Muster (`_PN98`, `_Brandgeruch`). In der Auswahl stehen Datum, Uhrzeit und ggf. „· Anlage“ hinter jeder Datei.
- **Kein natives `confirm` mehr bei einem zweiten Gutachten:** Im Formular steht über dem Knopf „Beim Büro ist schon ein Gutachten offen (Datei, Datum) – das wird eine weitere Übergabe (z. B. Nachtrag)“; ein Klick reicht. Nur wenn seit dem letzten Lesen eines dazugekommen ist, erscheint der Hinweis zuerst und man klickt noch einmal.

## Neu in 1.38.0 · 30.10.2026

- **Sprung aus BerichtKit zur Übergabe:** `#projekt=<Ordnername>&uebergabe=Mitteilungen%2F<Datei>` öffnet das Projekt, klappt „Gutachten ans Büro übergeben“ auf und wählt genau diese Word-Datei (Ordner- und Dateiname ohne Rücksicht auf Groß-/Kleinschreibung; fehlt sie, Hinweis und Auswahl wie bisher). Das Fragment wirkt einmal und wird danach aus der Adresse entfernt. `#projekt=` allein öffnet nur das Projekt.
- **Prüfberichte aus BerichtKit als Anlagen:** `_BerichtKit.json` (Bereich `berichtkit`) → neuester Eintrag in `berichte[]` zur gewählten Word-Datei → dessen `anlagen` (`Laborergebnisse/<Prüfbericht>.pdf`) sind angehakt, mit Vermerk „Prüfbericht laut BerichtKit“. Wechselt man die Word-Datei, ziehen die Vorschläge nach; selbst gesetzte Haken bleiben.
- **Lücken-Prüfung vor dem Übergeben** (`word-luecken.js`, ohne Bibliothek, entpackt mit `DecompressionStream('deflate-raw')`): sucht in Haupttext, Kopf-/Fußzeilen und Noten der .docx gelb hervorgehobenen Text und Platzhalter in eckigen Klammern mit Großbuchstaben am Anfang (`[KI-Wert]`, `[Foto fehlt: …]`; nicht `[mg/kg]`, `[1]`). Gefunden → Rückfrage mit Liste; nicht lesbar → Rückfrage. Keine Sperre: Ausgefüllte Stellen, deren gelbe Markierung stehen blieb, werden mit gemeldet.
- **Stufe 4 „Gutachten“:** neueste `n. Mitteilung….docx` in „Mitteilungen“ (gleiches Muster wie die Spektron-Leiste), die noch nicht beim Büro ist → „Mitteilung vom … erstellt – ans Büro übergeben“, Aktion „Ans Büro übergeben“. Beim Büro heißt: eine Büroaufgabe nennt die Datei, oder eine Übergabe/ein Versand liegt am Tag der Datei oder später. Gilt auch für eine 2. Mitteilung nach dem Versand der ersten.

## Neu in 1.37.0 · 30.10.2026

- **Neues Feld „Versicherer“** (`versicherer` in `_Projekt.json`) unter „Auftraggeber“. Der Arbeitszettel trägt die Spalte VERSICHERUNG in beide Felder ein. Ändert man den Auftraggeber später (Makler, VN), bleibt der Versicherer stehen. BerichtKit nimmt ihn fürs Deckblatt, statt ihn aus dem Auftraggeber abzuleiten. Bestehende Projekte: Feld leer, Verhalten wie bisher.

## Neu in 1.36.1 · 30.10.2026

- Anlage PN 98 / Brandgeruch: Der Hinweis „Die Projektdatei trägt die Projektnummer …“ vergleicht nur noch die Nummer (`26.0512`). Steht in LabelKit der ganze Ordnername als Projektnummer („26.0512 Stegerwaldstraße Leverkusen“), kommt kein Fehlalarm mehr.

## Neu in 1.36.0 · 30.10.2026

- **BerichtKit in Spektron:** Knopf „Asbestbericht“ in Stufe 4 (Gutachten) öffnet BerichtKit mit dem Projekt (`../berichtkit/#projekt=<Ordnername>`). BerichtKit erstellt den Asbest-Untersuchungsbericht als Word-Datei in `Mitteilungen`.
- `spektron-ordner.js`: neuer Bereich `berichtkit` (`_Spektron/BerichtKit/_BerichtKit.json`, Vor Spektron `Mitteilungen/`) – byte-gleich in allen Apps; der Umzug nimmt ihn mit.

## Neu in 1.31.0 · 28.10.2026

- **„Ans Büro“ mit Anlagen und Abrechnung:** Anlagen zum Anhaken (Mitteilungen, PDFs in Fotos, Pläne, PDFs in Laborergebnisse; Dateien mit „Anlage“/„Bilddokumentation“ im Namen und PDFs in Fotos vorgeschlagen) plus Freitext für weitere Anlagen. Darunter, ob es einen BelegKit-Stand gibt – sonst Knopf zu BelegKit („Stand speichern“). Gespeichert als `anlagen` in der Aufgabe.
- **Rechnung beim Büro:** Das Büro hakt in BüroKit 1.1 nach dem Versand „Rechnung“ ab (nach dem neuesten BelegKit-Stand). Stufe 6 „Abrechnung“ wartet nach dem Versand auf das Büro und ist fertig, sobald „Rechnung“ abgehakt ist; ohne Stand bist du dran. Frühere Übergaben (ohne Rechnungsschritt) wie bisher. „erledigt“ bleibt „versandt“ – Durchlaufzeiten und Auslastung unverändert.
- `buero-aufgaben.js` byte-gleich mit BüroKit 1.1.0.

## Neu in 1.30.3 · 27.10.2026

- Stufe Labor: Ging das Gutachten ans Büro, während das Labor nur einen Zwischenstand hatte, stand fälschlich „Keine Prüfberichte im Ordner – übersprungen“. Jetzt der eigene Stand mit „– nicht abgeschlossen“. Aufgefallen beim Integrationstest „Spektron-Kette“.

## Neu in 1.30.2 · 27.10.2026

- Datenarchiv 1.2: sichtbarer Hinweis, dass es die Original-XML auswertet und nicht den in ResultKit übernommenen Stand; für Gutachten gilt ResultKit.

## Neu in 1.30.1 · 27.10.2026

- Frühere Büroübergaben (bis 1.27) mit mehreren neuen Fassungen werden in zeitlicher Reihenfolge gelesen; vorher konnte eine ältere Word-Datei als aktuelle erscheinen. `buero-aufgaben.js` byte-gleich mit BüroKit 1.0.1 – CI vergleicht jetzt wirklich mit BüroKit (holt es daneben) statt den Vergleich zu überspringen.

## Neu in 1.30.0 · 27.10.2026

**Spektron-Start: frisch anfangen, ohne die Altlasten.** Ab Projekt **26.0560** arbeitet das Büro mit Spektron (gilt für alle, steht als `SPEKTRON_START` in `index.html`).

- Ältere Projekte stehen links unten **zugeklappt unter „Vor Spektron“** – ohne „Jetzt dran“, nicht in „Heute für dich“, nicht in der Auslastung. Die Suche und die Jahresfilter finden sie weiter (die Gruppe klappt dann auf).
- **Kommt von selbst zurück:** Arbeitet eine Spektron-App in einem älteren Projekt – Laborauftrag aus LabelKit, in ResultKit übernommene Ergebnisse, Übergabe ans Büro, Abrechnung aus BelegKit –, gilt es wieder als normales Projekt.
- **Von Hand:** in der Projektansicht „In Spektron übernehmen“ (Merkmal `spektron: true` in `_Projekt.json`); rückgängig über „zurück zu „Vor Spektron““ im Projektkopf.
- **„Heute für dich“** zeigt den Fortschritt des Büros seit dem Start („14 Projekte, 9 abgeschlossen“ mit Balken).
- In die alten Projektordner wird nichts geschrieben, solange niemand ein Projekt übernimmt. Die Durchlaufzeiten zählen wie bisher.

## Neu in 1.29.0 · 27.10.2026

**Neu gestaltet: ein klarer Ablauf statt vieler Karten.**

- **Im Projekt:** oben **„Jetzt dran“** – ein Satz und genau ein (blauer) Knopf. Darunter die **sechs Stufen** in Arbeitsreihenfolge: Projekt anlegen · Ortstermin: Proben & Fotos · Labor · Gutachten · Ans Büro → Versand · Abrechnung. Jede Stufe zeigt Zustand (✓ fertig, aktuell, wartet auf Labor/Büro, später, übersprungen) und einen Satz, dazu die Knöpfe ihrer App. Karten und Zeitleiste „Projektstand“ sind darin aufgegangen (gleiche Daten wie die Durchlaufzeiten). Projektdaten bleiben zugeklappt; fehlende Pflichtangaben stehen oben und in Stufe 1.
- **Liste in Gruppen:** „Braucht dich“ · „Läuft – Labor oder Büro sind dran“ · „Abgeschlossen“ · „Ältere Projekte“ (vor dem Vorjahr, ohne Stand), je Projekt mit kurzem Stand („Labor · Ergebnisse da“, „Rückfrage vom Büro“, „Beim Büro“ …).
- **Startseite „Heute für dich“** (mit gewähltem Kürzel): die eigenen Projekte, deren nächster Schritt bei dir liegt, darunter was bei Labor oder Büro liegt.
- **Kopfzeile aufgeräumt:** Archivordner als Status oben rechts (Klick wechselt), ⟳ neu einlesen, **„⋯ Mehr“** mit Mitarbeiter, Auslastung, Durchlaufzeiten, Handbuch, BüroKit, SpesenKit, Rückmeldung, Datenarchiv. „Ich bin“, Suche, „Meine“ und Jahre über der Liste.
- Die Regeln stehen in `stufen.js` (nur rechnen, getestet in `tests/stufen.cjs`); Oberfläche in `tests/heute-browser.cjs`. Speicher, Dateien und gemeinsame Module unverändert.

## Neu in 1.28.0 · 27.10.2026

**„Ans Büro“ statt „Übergabe ans Büro“ – das Büro arbeitet in [BüroKit](https://kaspersebastian83-dot.github.io/buerokit/).** Die frühere Büroübergabe mit Entwurf, Änderungen und Retry war zu umständlich. Jetzt:

- **Sachverständiger, ein Schritt:** In der Karte „Ans Büro“ „Gutachten ans Büro übergeben“ aufklappen. Vorgeschlagen sind die neueste Word-Datei aus „Mitteilungen“ und die Empfänger aus den Projektdaten (Auftraggeber und beteiligter Sachverständiger angehakt, wenn eingetragen; Anschriften änderbar). Optional „Fällig bis“ und ein Hinweis. „Ans Büro übergeben“ legt die Aufgabe an – dafür muss oben „Ich bin …“ gewählt sein. Ist schon ein Gutachten beim Büro offen, fragt die Projektzentrale vorher nach.
- **Büro:** arbeitet in BüroKit (unter „Weitere Apps“) – Tagesliste mit Gegenlesen, PDF und Versand je Empfänger, dazu eigene Büroaufgaben.
- **Projektzentrale zeigt nur den Stand:** „Gutachten beim Büro · übergeben 27.10. von Ben · noch offen: Gegenlesen · PDF · Versand 1/2“, Fälligkeit, wer es bearbeitet; erledigte Gutachten klein darunter, eigene Büroaufgaben als kurze Liste. **Rückfragen** des Büros stehen oben am Projekt und werden dort mit „Antworten“ beantwortet. Neu gelesen wird beim Zurückkehren ins Fenster.
- **Gespeichert** je Projekt in `_Buero/aufgaben/<id>.json` (eine Aufgabe) und `_Buero/vermerke/<id>.json` (ein Haken oder eine Antwort); jede Datei wird einmal geschrieben und nie geändert. Das Datenmodul `buero-aufgaben.js` ist mit BüroKit byte-gleich (geprüft in `tests/buero-aufgaben-gleich.cjs`, wenn BüroKit daneben liegt).
- **Frühere Übergaben** (`_Buero/<Auftrags-UUID>/`, bis 1.27) werden weiter gelesen und wie Aufgaben gezeigt. Die alte Büroübersicht unter `buero/` leitet zu BüroKit weiter.
- Durchlaufzeiten, Auslastung und Projektstand lesen die Gutachten beim Büro aus denselben Dateien.

## Neu in 1.17.0 · 24.10.2026

**„📈 Durchlaufzeiten“** (rechts unten unter „Weitere Apps“): Wie lange dauert ein Projekt? Für die Projekte des laufenden und vorigen Jahres, in Kalendertagen, als Median je Abschnitt mit dem längsten Projekt, dazu Laborzeiten je Labor und eine Liste aller Projekte (Klick öffnet das Projekt). Nichts muss eingegeben werden – die Daten stammen aus dem, was bei der Arbeit ohnehin entsteht:

| Schritt | Quelle |
|---|---|
| Ortstermin | `ortstermin` in `_Projekt.json` |
| Laborauftrag | erste `…_Laborübergabe.xls` in „Laboraufträge“ (Datum aus dem Dateinamen) |
| Prüfbericht | erste XML/PDF in „Laborergebnisse“ nach dem Laborauftrag (Datum der Ablage); Eurofins wird an der XML erkannt |
| Übergabe ans Büro | erstes nicht zurückgezogenes Gutachten beim Büro (ab 1.28 „Ans Büro“ / BüroKit; frühere Übergaben zählen mit) |
| Versand | spätestes Versanddatum des ersten erledigten Gutachtens in BüroKit; ältere Projekte: „Frühere Versandangaben“ |

Fehlt ein Datum, fällt nur dieser Abschnitt für das Projekt heraus; eine unplausible Reihenfolge wird genannt und nicht gezählt. Nur lesen, keine neue Datei. Die Rechnung steht in `durchlauf.js` (getestet in `tests/durchlauf.cjs`).

## Neu in 1.14.0 · 23.10.2026

**„📊 Auslastung“** zeigt je zuständiger Person, wie viele Projekte offen sind und wo sie stehen:

| Spalte | bedeutet |
|---|---|
| In Bearbeitung | noch kein Gutachten beim Büro offen (auch: zurückgezogen) |
| Beim Büro | Gutachten beim Büro offen: Gegenlesen, PDF, Versand |
| Rückfrage | das Büro wartet auf eine Antwort |

- Offen ist ein Projekt, bis ein Gutachten beim Büro „Erledigt“ ist. Gezählt werden Projekte des laufenden und des vorigen Jahres (z. B. 25.xxxx und 26.xxxx).
- Zuständig: die in der Projektzentrale gewählte Person, sonst das Kürzel im Ordnernamen; sonst „Ohne erkannte Person“. Aktive Personen stehen auch mit 0 in der Tabelle, inaktive nur mit offenen Projekten.
- Eine Zahl anklicken zeigt die Projekte, ein Klick darauf öffnet das Projekt. Die Zahlen ergänzen sich, solange die Projekte noch eingelesen werden.
- Nur lesen, keine neue Datei. Dafür liest die Projektzentrale zusätzlich die Büroaufgaben (`_Buero`) der Projekte im Zeitraum.

## Neu in 1.13.0 · 23.10.2026

**Büroübersicht mit zuständiger Person** (seit 1.28 ersetzt durch BüroKit). Jede Übergabe zeigt unter dem Schadenort die zuständige Person: die in der Projektzentrale gewählte („in der Projektzentrale gewählt“), sonst die Person zum Kürzel am Ende des Ordnernamens. Der Schadenort steht ohne Kürzel, auch bei Übergaben, die vor 1.12 angelegt wurden (abgeleitet aus dem gespeicherten Ordnernamen; die Übergabedateien bleiben unverändert).

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

Spektron · Büroübersicht unter `buero/` (seit 1.28 ersetzt durch BüroKit; `buero/` leitet weiter). Die Projektzentrale übergibt nach bewusstem Klick eine konkrete Word-Datei und vollständige Empfänger. Das Büro dokumentiert Gegenlesen, bewusst gewählte Versand-PDF, Rückfragen und Versand je Empfänger. Papiermappe bleibt; nach Korrektur keine weitere Sachverständigenfreigabe. Gemeinsame Ablage: `<Projekt>/_Buero/<Auftrags-UUID>/auftrag.json` und einzelne `rueckmeldung-<UUID>.json`. Abnahme von damals: [docs/buero](docs/buero/abnahme.md).

[Spektron · Datenarchiv](archiv/README.md) (ab 1.22) ist direkt unter `archiv/` erreichbar, in der Projektzentrale über den kleinen Link „Datenarchiv“ unter „Weitere Apps“. Liest die Eurofins-XML aus „Laborergebnisse“ aller Projektordner sowie Nutzung/Brandgut aus `_Projekt.json`: Übersicht, Vergleich je Parameter, PAK-Muster, CSV-Export. Schreibt nur `<Archiv>/_Spektron-Archiv.json` (eigene Zuordnungen für Projekte ohne Angabe), nie Projektdateien.

## Neu in 1.9.4 · 20.10.2026

Projektzentrale und Spektron-Leiste übergeben Projekte jetzt über #projekt im Fragment. Sonderzeichen bleiben erhalten; alte ?projekt-Links funktionieren weiterhin und werden nach dem Laden bereinigt. Projektwechsel laden auch bereits geöffnete App-Fenster neu; eine Warnung vor ungesicherten Eingaben kann den Wechsel abbrechen.

## Die App-Suite „Spektron“

Die Büro-Apps heißen zusammen **Spektron** – sichtbar oben neben „Projektzentrale“, in der Kurzanleitung und links in der Leiste der Projekt-Apps (Arbeitsname war „Mosaik“; interne Kennungen wie `mosaik-suite`, `mosaik-projekt` und der Ordner `Mosaik Archivordner` bleiben unverändert). Alle laufen in Chrome oder Edge am Büro-Terminal (RDP, eigenes Windows-Profil je Person) und laden nichts hoch.

| App | Wofür | Adresse | Doku |
|---|---|---|---|
| Projektzentrale | Projekte, Projektdaten, Start der Apps, Anlagen PN 98 / Brandgeruch | `…/Projektzentrale/` | dieses README |
| ① LabelKit | Proben erfassen, Etiketten, Laborübergabe, PN 98, Feldbögen | `…/labelkit/` | [README](https://github.com/kaspersebastian83-dot/labelkit#readme) |
| ② FotoKit | Fotos beschreiben und umbenennen, Bilddokumentation, Ergebnistabelle | `…/Bildumbenenner/` | [README](https://github.com/kaspersebastian83-dot/Bildumbenenner#readme) |
| ③ ResultKit | Laborergebnisse: Laborauftrag gegen Prüfberichte, Import, „Ergebnisse übernehmen“ (`Laborergebnisse/_Ergebnisse.json`) | `…/resultkit/` | [README](https://github.com/kaspersebastian83-dot/resultkit#readme) |
| ④ PlanKit | Probenplan, Ergebniskarte, maßstäbliches PDF, Anlage Probenahme | `…/Probenplan/` | [README](https://github.com/kaspersebastian83-dot/Probenplan#readme) |
| BerichtKit | Asbest- oder Brandbericht (Mitteilung) als Word-Datei aus Projektdaten, Proben, Ergebnissen und Fotos | `…/berichtkit/` | [README](https://github.com/kaspersebastian83-dot/berichtkit#readme) |
| ⑤ BelegKit | Zeiten, km, Spesen, Proben, Berichtsseiten für die Rechnung | `…/aufwandkit/` | [README](https://github.com/kaspersebastian83-dot/aufwandkit#readme) |
| SpesenKit | Monatliche Spesenabrechnung je Person (ohne Projektbezug) | `…/reisekosten-pro/` | [README](https://github.com/kaspersebastian83-dot/reisekosten-pro#readme) |
| AidKit | Handbuch: Abläufe Schritt für Schritt, gemeinsame Regeln (ohne Projektbezug) | `…/aidkit/` | [README](https://github.com/kaspersebastian83-dot/aidkit#readme) |

`…` steht für `https://kaspersebastian83-dot.github.io`.

## Datenschutz in einem Satz

Die App läuft vollständig im Browser auf dem eigenen Rechner. **Ordner, Dateien und Projektdaten werden nicht hochgeladen** – GitHub liefert nur den Programmcode der App aus. Eine strenge Content Security Policy (`index.html`, `<meta>`) sorgt zusätzlich dafür, dass die Seite weder fremden Code lädt noch Daten an andere Server senden kann (`connect-src 'self'`).

## Voraussetzungen

- **Google Chrome oder Microsoft Edge** (Ordnerzugriff).
- Einmal **„Archivordner wählen …“** → `C:\daten\Mosaik Archivordner`. Der Browser merkt sich die Auswahl; nach einem Neustart genügt ein Klick auf „Zugriff erlauben“.

## Was die App kann

- **„? Kurzanleitung“** (oder F1): wie Projektzentrale, LabelKit, FotoKit und PlanKit zusammenarbeiten – Einrichtung, Ablauf je Projekt mit Bild, Hinweise, Adressen; druckbar als PDF.

- Listet alle Projektordner (`26.0123 Köln`), neueste zuerst, mit Suche und Jahresfilter.
- **Projektansicht (ab 1.11):** Projektnummer, Ort, Objekt und Auftraggeber stehen über fünf jederzeit verfügbaren Aufgaben: „Proben & Laborauftrag“, „Fotos & Dokumentation“, „Laborergebnisse prüfen“ (ResultKit, ab 1.26), „Probenplan bearbeiten“ und „Zeiten & Abrechnung“. Dezente App-Farben bleiben; Dateibestand bedeutet keine fachliche Fertigstellung. Anlagen sind weiterhin an ihrer Aufgabe erreichbar. Darunter „Ans Büro“ (ab 1.28: Stand beim Büro, Gutachten übergeben), Ordner und frühere Versandangaben. Rückfragen des Büros und Speicherfehler stehen am Projektkopf.
- **Weitere Apps (ab 1.9, Handbuch ab 1.18):** Ganz unten im rechten Fenster (auch ohne gewähltes Projekt) öffnet „Handbuch (AidKit)“ die Abläufe und Regeln der Suite; „BüroKit“ (ab 1.28, `../buerokit/`) die Tagesliste des Büros; „SpesenKit“ öffnet die monatliche Spesenabrechnung der Kollegen in einem eigenen Fenster. Kein Projektbezug, darum kein nummerierter Arbeitsschritt und kein `?projekt=` im Link (`../reisekosten-pro/` – die Webadresse trägt noch den früheren Namen „Reisekosten Pro“). SpesenKit speichert nicht im Archivordner, sondern in einem eigenen Ordner je Person (siehe unten). „💬 Rückmeldung“ (ab 1.25) öffnet das Rückmeldeformular (`../rueckmeldung/`) mit `?app=projektzentrale&version=…` und, wenn ein Projekt gewählt ist, `&projekt=<Nummer>` (nur die Nummer, kein Ort).
- **Leiste in den Projekt-Apps (ab 1.7.1):** LabelKit, FotoKit, ResultKit, PlanKit und BelegKit zeigen oben dieselbe schmale Leiste – Projekt mit Wechsel zu den zuletzt geöffneten, die fünf Arbeitsschritte mit Haken und „Weiter: …“ zum nächsten offenen Schritt. Die Projektzentrale führt dafür die Liste `zuletzt` im gemeinsamen Browser-Speicher; beim Start ist das zuletzt in einer App geöffnete Projekt vorgewählt.
- Zeigt je Projekt, was schon da ist: Fotos, Bilddokumentation, Probenplan, Probenerfassung (LabelKit `…_Daten.json`), Laborergebnisse.
- Legt fehlende Standard-Unterordner auf Wunsch an.
- **Projektdaten** (Objekt, Nutzung, Brandgut, Auftraggeber, Schaden-Nr., Auftragsdatum, Schadenereignis, Schadendatum, Ortstermin, Sachverständiger, Versicherungsnehmer, beteiligter Sachverständiger, Sanierung, Ansprechpartner, Notizen) in `_Projekt.json` im Projektordner – gemeinsam für alle Apps und Kollegen.
- **Arbeitszettel einlesen (ab 1.8):** „📄 Arbeitszettel einlesen …“ in den Projektdaten (oder das PDF auf die Karte ziehen) liest den Arbeitszettel des Büro-Systems. Gelesen wird je Kasten unter seiner Überschrift: RISKO → Objekt, VERSICHERUNG → Auftraggeber / Versicherung, VERSICHERUNGSNEHMER, SACHVERSTÄNDIGER → beteiligter Sachverständiger, SANIERUNG, Schadennummer, Schaden vom, Auftragsdatum, Termin → Ortstermin, Mitarbeiter → Sachverständiger („Sebastian Kasper“ → „Dr. S. Kasper“), Regulierer/Anrufer/ASP → Ansprechpartner, freier Text im Arbeitsauftrag → Notizen.
  - Vor dem Speichern zeigt ein Dialog jeden Wert. Leere Felder werden angehakt, ausgefüllte nur überschrieben, wenn man sie anhakt; gleiche Werte bleiben unberührt.
  - Steht auf dem Zettel eine andere Projektnummer als im Ordnernamen, ist nichts angehakt und „Übernehmen“ erst nach ausdrücklicher Bestätigung möglich. Hinweise bei unplausiblen Daten (Termin vor Auftragsdatum, Schaden nach Auftrag); kein Datum → Feld bleibt leer.
  - Ordner werden nicht angelegt oder verändert; geschrieben wird nur `_Projekt.json` (mit Dateiname und SHA-256 des Zettels unter `arbeitszettel`). Das PDF wird nur im Browser gelesen.
  - PDF-Bibliothek: pdf.js (Mozilla, Apache-2.0, Legacy-Build) in `vendor/pdfjs/`, wird erst beim ersten Einlesen geladen. Funktioniert in der Online-Version (nicht aus einer lokal geöffneten Datei).
- **Frühere Versandangaben (ab 1.8 als „Verteiler“):** Nachgeordnete historische Karte – Auftraggeber, Sachverständiger, Versicherungsnehmer, Sanierung: anhaken, wer das Gutachten bekommt, und nach dem Versand das Datum eintragen („heute“). Gespeichert als `verteiler` in `_Projekt.json`. Ist ein Gutachten beim Büro (auch ein früheres), nur noch Ansicht; der Versand wird dann in BüroKit dokumentiert.
- **„Fotos bearbeiten“** öffnet FotoKit direkt im Ordner `Fotos` des Projekts, mit vorausgefüllten Projektdaten.
- **„Plan bearbeiten“** öffnet PlanKit direkt im Ordner `Pläne`: automatisches Speichern als `Probenplan <Projekt>.probenplan`, Bilder ebenfalls dorthin, geprüfte Laborergebnisse aus ResultKit (`Laborergebnisse/_Ergebnisse.json`).
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
| Wer schreibt wohin | FotoKit → `Fotos` (Bilder, `_Bildumbenenner.json`, Bilddokumentation-PDF/ZIP) · PlanKit → `Pläne` (`Probenplan <Projekt>.probenplan`, exportierte Bilder) und `Mitteilungen` (Anlage Probenahme) · LabelKit → `Laboraufträge` (und Scans in `Feldprotokolle`) · ResultKit → `Laborergebnisse` (importierte Prüfberichte, `_Ergebnisse.json`) · BerichtKit → `Mitteilungen` (Word-Bericht) und `_Spektron/BerichtKit` (Angaben zum Bericht) · Projektzentrale → `_Projekt.json` und `Mitteilungen` (Anlagen, `_Anlagen-Protokoll.txt`) · BelegKit → `Abrechnung` (`Aufwand_<Kürzel>.json` je Person, `_Abrechnung.json`, Stände) und `_AufwandKit-Einstellungen.json` im Archivordner · SpesenKit → nicht ins Archiv, sondern in den eigenen Ordner `SpesenKit` je Person (`Daten/spesenkit.json`, `Spesen/<Jahr>/<Monat>/` mit PDF/ZIP der abgeschlossenen Abrechnungen, `Sicherungen/`) |
| `_Projekt.json` | `format: "mosaik-projekt"`, `version: 1`. Jede App liest frisch, ändert nur die eigenen geänderten Felder und behält unbekannte Felder. Nicht löschen oder umbenennen. |
| `_Spektron` | Alles, was ohne App nicht nutzbar ist, liegt in `<Projekt>/_Spektron/` (je App ein Unterordner; Fotos, PDF, Word, Excel und CSV bleiben in den Büro-Ordnern). Gilt für Projekte ab 26.0560 und von Hand übernommene; „Vor Spektron“ nie. Regel und Bereiche stehen in `spektron-ordner.js` (Vorlage hier, byte-gleich in LabelKit, FotoKit, ResultKit, PlanKit, BerichtKit, BelegKit, BüroKit; CI vergleicht). `SpektronOrdner.ort(projekt, bereich)` sagt, wo ein Bereich liegt – neuer Ort, sobald dort etwas liegt, `_Spektron` existiert oder das Projekt neu ist; sonst der frühere. Der Umzug (`spektron-umzug.js`, nur Projektzentrale, „⋯ Mehr › Spektron-Ordner einrichten“) kopiert, prüft, vermerkt in `_Spektron/_Umzug.json`, löscht dann; Protokoll `<Archiv>/_Spektron-Umzug.log`. |
| Gemeinsamer Browser-Speicher | IndexedDB `mosaik-suite` (v1), Store `kv`: `archiv` = Archivordner, `zuletzt` = zuletzt geöffnete Projekte (führt die Leiste), `spesenkit-ordner` = SpesenKit-Ordner der Person. Alle Apps unter `kaspersebastian83-dot.github.io` teilen ihn; da jede Person ein eigenes Windows-Profil hat, ist er persönlich. |
| Absprung | `../labelkit/?projekt=<Ordnername>` (LabelKit) · `../Bildumbenenner/?projekt=<Ordnername>` (FotoKit) · `../Probenplan/?projekt=<Ordnername>` (PlanKit, mit `&aktion=anlage` direkt zur Anlage) · `../berichtkit/#projekt=<Ordnername>&art=asbest|brand` (BerichtKit: „Asbestbericht“ / „Brandbericht“) · `../aufwandkit/?projekt=<Ordnername>` (BelegKit) · `../reisekosten-pro/` (SpesenKit, ohne Projekt) |
| Offline-Speicher | Jede App verwaltet nur Caches mit eigenem Präfix (`projektzentrale:`, `bildumbenenner:`, `probenplan:`, `aufwandkit:`, `reisekosten-pro:`; LabelKit hat keinen Service Worker). |

Felder in `_Projekt.json`: `projektnummer`, `schadenort`, `objekt`, `nutzung` (`Wohnen` | `Büro` | `Öffentlich` | `Gesundheit & Labor` | `Gewerbe/Industrie` | `Landwirtschaft`; PlanKit: Gewerbe/Industrie und Landwirtschaft → VdS-Referenz Industrie, sonst Wohn-/Büroräume), `brandgut` (optional), `auftraggeber`, `versicherer` (ab 1.37), `schadennummer`, `schadenereignis`, `schadendatum`, `ortstermin`, `auftragsdatum` (Daten `JJJJ-MM-TT`), `sachverstaendiger`, `versicherungsnehmer`, `sachverstaendigerBeteiligt`, `sanierung`, `kontakte`, `notizen`, `zustaendig` (`{ kuerzel, gesetzt: "manuell", am, von }`, fehlt = wie Ordnername), `verteiler` (`{ versicherung|sachverstaendiger|versicherungsnehmer|sanierung: { an: true, versandt: "JJJJ-MM-TT" } }`), `arbeitszettel` (`{ datei, sha256, titel, eingelesen }`), `geaendert`, `geaendertMit`.

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
node tests/buero-aufgaben-gleich.cjs   # buero-aufgaben.js byte-gleich mit BüroKit (wenn ../buerokit da ist)
node tests/sw.cjs       # Service Worker: alle Offline-Dateien vorhanden, pdf.js dabei
node tests/ordnername.cjs   # Ordnername von hinten lesen: Ort, Kürzel, Hinweise, ohne Mitarbeiterliste
node tests/durchlauf.cjs    # Durchlaufzeiten: Daten, fehlende/unplausible Angaben, Median, Labore
```

Browsertest des ganzen Ablaufs (Archiv → Projekt → Anlage → Datei, Prüfsummen, Protokoll), mit Playwright:

```sh
npm install --no-save playwright && npx playwright install chromium webkit
node tests/anlage-browser.cjs chromium
node tests/anlage-browser.cjs webkit
node tests/projektansicht-browser.cjs           # kompakte Ansicht, „Ans Büro“, Rückfragen, Tastatur, Fenstergrößen, nativer Zoom
node tests/auslastung-browser.cjs chromium      # Auslastung je Person: in Bearbeitung, beim Büro, Rückfrage
node tests/arbeitszettel-browser.cjs chromium   # PDF lesen, Dialog, Speichern, Verteiler
node tests/zuletzt-browser.cjs chromium         # zuletzt geöffnete Projekte, Vorwahl beim Start
node tests/zustaendig-browser.cjs chromium      # Mitarbeiterliste, Zuständig, Meine Projekte, unlesbare Liste, Konflikt
node tests/wechsel-browser.cjs chromium         # Projektwechsel nach gescheitertem Speichern: nichts geht still verloren
node tests/team-browser.cjs chromium            # TeamKit im Rahmen (braucht ../teamkit): Knopf, Schlagzeile, Öffnen/Schließen, Esc, Fokus
```

Die Test-Arbeitszettel in `tests/fixtures/` sind frei erfunden (gleiche Form wie das Original, keine echten Daten).

GitHub führt alle Tests bei jedem Pull Request aus (`.github/workflows/tests.yml`, Chromium). Es gibt nur diesen einen Test-Workflow; zusätzliche Kompatibilitäts- und Integrations-Workflows wurden am 23.10.2026 entfernt. Wie die Datei in Word aussieht, bitte zusätzlich einmal praktisch prüfen.

## Dateien

- `index.html` – die komplette App
- `durchlauf.js` – Rechnung der Durchlaufzeiten (ohne Oberfläche, mit Node testbar)
- `buero-aufgaben.js` – Büroaufgaben je Projekt (`_Buero`), byte-gleich mit BüroKit
- `buero/` – nur noch Weiterleitung zu BüroKit
- `vendor/pdfjs/` – pdf.js (Apache-2.0, siehe `LICENSE` dort), nur zum Lesen der Arbeitszettel; wird bei Bedarf geladen
- `tests/` – automatische Prüfungen (Node, Browser)
- `sw.js` – Service Worker: offline nutzbar, immer neueste Version wenn online
- `manifest.webmanifest`, `icon*.{svg,png}` – Installation als App
