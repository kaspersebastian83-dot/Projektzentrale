# Spektron · Büroübersicht, Version 1

Einstieg direkt unter `buero/index.html` bzw. `…/Projektzentrale/buero/`, auch als Lesezeichen. In der Projektzentrale unter „Weitere Apps“. Chrome/Edge, bestehender gemeinsamer Archivordner, IndexedDB `mosaik-suite/kv/archiv` nur als persönliche Ordnerreferenz. Keine neue Benutzerverwaltung, kein Server, keine externen Dienste.

## Ablauf

1. Sachverständiger übergibt die Papiermappe. In der Projektzentrale „Übergabe ans Büro“ aufklappen, konkrete Word-Datei im Projektordner wählen (alternativ relativen Pfad eingeben; Existenz wird geprüft). Empfänger mit vollständigen Angaben bestätigen, Kürzel und optionalen Hinweis ergänzen. Nur „Zur Büroprüfung übergeben“ erzeugt einen Auftrag.
2. Auftraggeber und empfangende Sachverständige sind nur bei noch nicht festgelegtem Verteiler vorausgewählt. Ein gespeicherter Verteiler wird übernommen, auch bei bewusster Abwahl. Vorschlag für empfangende Sachverständige ist `sachverstaendigerBeteiligt`, nicht der interne Bearbeiter. Kommas bleiben erhalten; „Weiterer Empfänger“ erzeugt einen separaten bestätigbaren Eintrag. E-Mail ist nicht erforderlich.
3. Büro öffnet die eigene Büroübersicht, übernimmt mit Kürzel und bearbeitet das **Original** in Word außerhalb der App. Pfad und Dateiname sind sichtbar, markierbar und kopierbar. Die App startet Word nicht und lädt keine Bearbeitungskopie herunter. „Gegengelesen“ dokumentiert den Abschluss; es gibt **keine weitere Sachverständigenfreigabe**.
4. PDF außerhalb der App erstellen, tatsächlich erstellte Datei bewusst auswählen und mit „PDF erstellt“ zuordnen. Versand außerhalb der App; ausgewählte oder alle offenen Empfänger mit Datum und Kürzel bestätigen. Teilversand lässt andere Empfänger offen. Erst Gegenlesen + PDF + Versand aller Empfänger führen zu „Erledigt“ (sofern keine offene Rückfrage oder ungeprüfte Paralleländerung besteht).
5. Rückfragen sind optional und in der Projektzentrale sichtbar. Dort kann die Rückfrage beantwortet werden; das Büro kann sie mit Klärungsvermerk schließen. Eine Statuskorrektur erfordert eine Begründung und betrifft nur den gewählten Schritt bzw. Empfänger. Andere Versandvermerke bleiben erhalten.

Älteste offene Übergaben stehen zuerst, ohne Jahresfilter. Zurückgenommene Übergaben erscheinen zusätzlich als sichtbarer Hinweis in der offenen Übersicht; „Alle“ zeigt auch erledigte und zurückgenommene Aufträge. „Übergabe ändern“ verändert eine offene Übergabe durch einen neuen, sichtbaren Eintrag. Gegenlesen/PDF werden dabei wieder offen; bereits dokumentierter Versand bleibt erhalten. Bereits versandte Empfänger können auf diesem Weg nicht entfernt oder umbenannt werden. Bei Bedarf bewusst zurücknehmen oder einen späteren Ergänzungsauftrag erstellen. Erledigte Übergaben werden nicht geändert; eine spätere Ergänzung erhält einen neuen Auftrag.

## Gemeinsame Ablage und Format

Pro Projekt, ohne zentrale Gesamtdatei:

```text
<Archiv>/<JJ.Nummer Ort>/_Buero/<Auftrags-UUID>/
  auftrag.json
  rueckmeldung-<Ereignis-UUID>.json
  rueckmeldung-<weitere Ereignis-UUID>.json
```

Alle JSON-Dateien: `format: "spektron-buero"`, `version: 1`. Aufträge und Rückmeldungen sind nach erfolgreichem Schreiben unveränderlich. Unbekannte bestehende Projektdateien/-felder werden durch diesen Ablauf gar nicht geschrieben. Word-/PDF-Inhalte werden nicht gespeichert.

`auftrag.json` enthält `id`, `created` (ISO-Zeitpunkt) und `content`:

- `project: { name, nr, ort }` aus dem Projektordnernamen;
- `word`: relativer Dateipfad mit `/`;
- `who`, `note`, `instruction`;
- `recipients: [{ id, group, label, details }]`: vollständiger, bestätigter Empfängerstand. `group` verwendet weiterhin `versicherung`, `sachverstaendiger`, `versicherungsnehmer`, `sanierung`. Die sichtbare Bezeichnung ist „Auftraggeber“.

Eine Rückmeldung enthält `id`, `orderId`, `at` (ISO), `actor` (Kürzel), `parents` (alle beobachteten letzten Ereignisse), `type` und `payload`:

| type | payload | Wirkung |
|---|---|---|
| `claim` | `{}` | übernommen / bearbeitendes Kürzel |
| `proof` | `{}` | gegengelesen |
| `pdf` | `{ path }` | bewusst zugeordnete Versand-PDF |
| `send` | `{ ids, date, pdf }` | Versand je Empfänger; PDF-Pfad zum Versandzeitpunkt bleibt nachvollziehbar |
| `question` | `{ text }` | optionale Rückfrage |
| `answer` | `{ text }` | Rückfrage geklärt, Antwort bleibt im Verlauf |
| `correct` | `{ step, recipient?, reason }` | `proof`, `pdf` oder genau einen `send`-Vermerk wieder offen |
| `revise` | `{ content }` | neue offene Übergabefassung; Original und frühere Fassung bleiben im Verlauf |
| `withdraw` | `{ text }` | begründete Rücknahme; Verlauf und Versandvermerke bleiben erhalten |
| `resolve` | `{ text }` | nach expliziter Prüfung aller parallelen Rückmeldungen angezeigten Stand bestätigen |

Der aktuelle Stand wird aus Auftrag und Ereignissen in kausaler Reihenfolge abgeleitet; Uhrzeit/UUID dienen nur der stabilen Anzeige unabhängiger Zweige. Versanddaten des digitalen Auftrags stammen ausschließlich aus diesen Ereignissen. Der alte `verteiler` in `_Projekt.json` wird erhalten und bei digitalen Aufträgen nur noch historisch angezeigt; es gibt dort keine zweite pflegbare Versandliste.

## Speicherung, Aktualisierung und Grenzen

- F5-Projektbindung: Beim Laden und vor jedem Schreiben müssen Projektnummer und vollständiger Projektordnername des ursprünglichen Auftrags sowie aller Änderungen mit dem tatsächlich geöffneten Ordner übereinstimmen. Kopierte Fremdaufträge werden mit „Projektzuordnung blockiert“ abgewiesen; es wird kein anderer Schreibordner aus dem Auftragsinhalt abgeleitet. Die Büroübersicht bindet Speicherversuche an den tatsächlichen Ordner. Beim Retry nach erneutem Öffnen wird das Archiv vollständig geprüft und der Auftrag eindeutig einem geprüften Ordnerhandle zugeordnet. Vorhandene ältere Speicherversuche bleiben nach dieser Prüfung wiederholbar. Ein bekannter Ordnerhandle darf beim Archivwechsel nicht stillschweigend ersetzt werden. Der neue Speicherversuch enthält außerdem den ursprünglichen Auftrag, damit ein Austausch beim Retry erkannt wird. Eine leere Rückmeldedatei wird ausschließlich für die genaue Kennung des eigenen Speicherversuchs erneut geschrieben. Widersprüchliche oder fehlende Zuordnungen bleiben blockiert, ohne Dateien zu verschieben oder automatisch zu reparieren.
- Jede Änderung erhält vor dem Schreiben eine eigene UUID. Dateiname **und Inhalt** eines unbestätigten Versuchs bleiben im `sessionStorage` des betreffenden Tabs erhalten. Erst Schließen des Schreibstroms und identisches Rücklesen gelten als Erfolg. Retry prüft dieselbe Datei und legt kein zweites Ereignis an. Eine beim fehlgeschlagenen ersten Schreiben leer angelegte Datei kann derselbe Versuch erneut schreiben. Beschädigte/nichtleere oder abweichende Dateien werden nicht ersetzt.
- Ein offener Auftrag verhindert versehentliche zusätzliche Übergaben aus demselben Projekt. Das ist eine Vorprüfung, **keine profilübergreifende Sperre**. Zwei vollständig unabhängige, gleichzeitig neu erzeugte Übergaben können als zwei Aufträge sichtbar werden. Solche Doppelaufträge müssen bewusst zurückgenommen werden. Derselbe Übergabeversuch behält dagegen seine Kennung, auch bei Retry nach unklarem Ergebnis.
- Alle Rückmeldungen werden ergänzend in verschiedenen Dateien geschrieben. Bei konkurrierenden Bearbeitungen mit demselben Ausgangsstand bleiben mehrere letzte Ereignisse erhalten: Hinweis „Parallele Rückmeldungen“, kein „Erledigt“ und keine normalen Folgeaktionen, bevor das Büro Verlauf und angezeigten Stand bewusst geprüft hat. Der Prüfvermerk bestätigt alle beobachteten Zweige. Währenddessen neu eintreffende Zweige lösen erneut einen Konflikt aus. Es gibt keine automatische semantische Konfliktlösung und keine Transaktion über mehrere Netzlaufwerkdateien.
- „Zuletzt aktualisiert“ zeigt nur den letzten vollständig erfolgreichen Lesevorgang. Beim Öffnen, Fokus, Rückkehr in den sichtbaren Tab sowie alle 30 Sekunden im sichtbaren Tab werden ausschließlich Archivordnernamen und die kleinen `_Buero`-Dateien gelesen. Kein periodisches Durchsuchen von Fotos, Laborberichten oder Dokumentinhalten. Manueller Knopf „Aktualisieren“.
- Fehlender Zugriff, ungültige/unbekannte Formate, fehlende Elternereignisse oder unvollständige Dateien führen zum Hinweis **„Übersicht möglicherweise unvollständig/veraltet“**. Die Büroübersicht behält bekannte Einträge, sperrt Änderungen und behauptet keine leere aktuelle Liste.
- Ordnerzugriff wird je Windows-/Browserprofil erneut erteilt. Programmcache/Service Worker sind kein Nachweis einer erreichbaren gemeinsamen Ablage. Root-Seite und Büroseite haben getrennte HTML-Cacheziele. Keine Hintergrundbenachrichtigung bei geschlossener App. Keine Projektdaten in URLs.
- Kürzel sind keine authentifizierten Identitäten. UUIDs, Dateizugriff und Rücklesen ersetzen weder NTFS-/SMB-Garantien noch Datensicherung. Ein dauerhaftes Schließen des Tabs verliert dessen lokalen unbestätigten Versuch; bei unklarem Ergebnis zunächst Ablage/Übersicht prüfen. Dateinamen/Pfade sind bewusst bestätigt, keine Inhalts- oder Fassungssperre: gewöhnliche Word-Korrekturen sind erlaubt. Wird ein Dokument extern verschoben oder ersetzt, muss das Büro den Pfad/Fassungsstand vor Versand prüfen.

## Gezielte Abnahme

```sh
node tests/buero.cjs
node tests/buero-browser.cjs
# Optional vorhandener Systembrowser:
BROWSER_EXECUTABLE=/usr/bin/chromium node tests/buero-browser.cjs
```

`buero.cjs`: echte temporäre Dateiverzeichnisse, Empfängerdefaults/bestehende Auswahl, vollständige Namen, gezählte Retry-Aufträge, unveränderter Empfängerstand, Fehler beim Schreiben/Rücklesen/Listen, Teil-/Vollversand, Korrekturen ohne Verlust anderer Versandinformationen, konkurrierende Rückmeldungen und bewusste Auflösung.

Der eingebundene Test `buero-f5.cjs` prüft den vollständigen kopierten B-Auftrag in A, getrennte Nummern-/Namensabweichungen, widersprüchliche historische Änderungen und alte/neue wiederhergestellte Speicherversuche. Dateibaumvergleiche sichern ab, dass blockierte Vorgänge weder in A noch in B Dateien anlegen oder verändern. Der Büro-Browsertest prüft denselben Kopierfall über beide Oberflächen und den echten Retry-Handler sowie Wiederherstellung nach Schreibfehler und erneutem Laden ohne doppelte Rückmeldung.

`buero-browser.cjs`: produktive UI/Schreiblogik in Chromium. Zwei **unabhängige Browserkontexte** mit einer gemeinsamen echten temporären Node-Testablage; nur Dateiauswahl und File-System-Access-Handles werden über eine Testbrücke ersetzt. Übergabe, konkretes Word, vollständige/separate Empfänger, Schreibfehler mit erhaltenen Eingaben, PDF-Auswahl, Teil-/Vollversand, optionale Rückfrage samt Rückmeldung in der Projektzentrale, Konflikte und Retry nach unklarem Ereignisspeichern. Keine echte Windows-/SMB-Prüfung und keine zwei Tabs als deren Ersatz. Netzwerk auf lokalen Testserver begrenzt. Testablage wird im `finally` gelöscht. Screenshots ausschließlich mit erfundenen Daten unter `tests/buero-results/` (ignoriert).

Die bestehenden Node-/Chromium-/WebKit- und Spektron-Integrationstests bleiben in CI aktiv; der Bürotest wird dem bestehenden Chromium-Job hinzugefügt. Für den alten SpesenKit-Linktest gibt es nun ein lokales HTML-Testziel; er setzt keine fremde laufende App voraus.

**Kurzer manueller Büro-/Netzlaufwerktest vor Freigabe:** Zwei getrennte Windows-/RDP-Profile am echten gemeinsamen Testlaufwerk verwenden. Mit fiktivem Projekt und Papiermappe Word übergeben, Original in Word korrigieren, ohne weitere Freigabe PDF erzeugen/zuordnen, Teil- und Restversand dokumentieren. In beiden Profilen gleichzeitig übernehmen sowie widersprüchlich korrigieren; beide Rückmeldungen und Konflikthinweis müssen nach Aktualisierung sichtbar sein. Netzverbindung/Schreibrecht unterbrechen, Eingaben/Fehlerhinweis prüfen, wieder verbinden und denselben Versuch wiederholen. Danach offene Übergabe ändern/zurücknehmen und im anderen Profil sehen; erledigten Auftrag erhalten und Ergänzungsauftrag getrennt erzeugen. Word-/PDF-Dateisperren, RDP-Trennung, Browserneustart und Netzlaufwerkcache ausdrücklich mitprüfen. Dieser Test wurde in der Cloud nicht durchgeführt.
