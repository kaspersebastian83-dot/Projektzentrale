# Projektzentrale vereinfachen – UI-Abnahme

Basis: `main` `77fd419` vom 21.10.2026, einschließlich PR #27 und der aktualisierten FotoKit-Integrationsreferenz aus PR #28. Vor Beginn waren keine offenen PRs mit überschneidenden Änderungen vorhanden. Eigener Branch `ui/projektzentrale-vereinfachen`; keine Änderungen an anderen Apps.

## Nachbesserung: bestehende und neue Übergabe trennen (21.10.2026)

Auf PR #29, ausgehend von `6db7492`, ausschließlich den zustandsabhängigen Büro-Einstieg nachgebessert:

- Ohne offenen Auftrag öffnet „Übergabe vorbereiten“ nach vollständigem erfolgreichem Einlesen direkt das Formular. Erst der bewusste Übergabeklick erzeugt einen Auftrag.
- Bei offenen Aufträgen öffnet „Übergabe ansehen“ deren Details mit tatsächlichem Status, Word-Zuordnung, bestätigten Empfängern und Hinweis. Mehrere offene Aufträge werden vollständig angezeigt und beim Einstieg alle aufgeklappt. Ohne eigenen Entwurf erscheint kein Neuanlageformular. „Übergabe ändern“ lädt weiterhin über den bestehenden Ablauf den aktuellen Auftrag.
- Sind nur erledigte oder zurückgenommene Aufträge vorhanden, bleiben sie im Verlauf. „Neue Übergabe vorbereiten“ öffnet bewusst ein neues Formular, ohne einen früheren Auftrag wiederzuverwenden oder bereits einen neuen anzulegen.

Laufende Änderungen und eigene Entwürfe bleiben erhalten. Erscheinen fremde offene Aufträge, steht am Formular „Noch nicht übergebener Entwurf“; die vorhandene Doppelauftragssperre bleibt wirksam. Ein ungeklärter Versuch behält Kennung und Inhalt und bleibt am Projektkopf wiederholbar, auch wenn seine Datei bereits lesbar ist und die Details geschlossen sind. Ein laufendes oder fehlgeschlagenes Einlesen bietet keine leere Neuanlage an. Gemeinsames Datenformat, Speicherfunktionen, Statusregeln und Büroübersicht wurden nicht geändert.

Tatsächlich lokal ausgeführt und bestanden (Node 24.19.0, System-Chromium):

| Bestehende Prüfung | Ergebnis der Nachbesserung |
|---|---|
| `tests/projektansicht-browser.cjs` | Drei Einstiegssituationen einschließlich erledigtem und zurückgenommenem Verlauf; tatsächliche Word-Zuordnung ohne Neuanlageformular; zwei offene Aufträge auch in unabhängiger Sitzung; Lesefehler; Erhalt von Änderungsformular, Empfängereingaben, Cursor und lokalem Entwurf bei fremden Aufträgen; kein zweiter Auftrag. |
| Derselbe UI-/Retry-Test | Nach Schreibfehler unveränderten Versuch eingelesen, währenddessen identische Datei in der temporären Testablage lesbar gemacht, erneut aktualisiert und über den echten Knopf am Projektkopf bestätigt. Details dabei zugeklappt; identische Kennung/Inhalt, kein zusätzlicher Auftrag. Bestehende Fenster-/150%-Zoomprüfungen ebenfalls bestanden. |
| `tests/buero-browser.cjs` | Bestehender vollständiger Büroablauf einschließlich Retry nach Aktualisieren, abweichender Datei, zwei unabhängiger veralteter Änderungsformulare, Empfängererhalt, Teil-/Vollversand, Rückfragen und Konflikten bestanden. Nur der Einstieg des Tests berücksichtigt die nun direkt geöffneten Auftragsdetails. |
| `tests/buero.cjs`, `tests/sw.cjs` | Bestanden. |

Die bestehenden CI-Workflows mit Node, Chromium, WebKit und Spektron-Integration bleiben unverändert aktiv; Ergebnisse des aktuellen Nachbesserungsstands stehen in [PR #29](https://github.com/kaspersebastian83-dot/Projektzentrale/pull/29). Keine neue Testinfrastruktur oder Browsermatrix.

Ein einzelner aktueller Screenshot mit erfundenen Daten: [offener Auftrag mit sichtbarer Word-Zuordnung](offene-uebergabe-details.png). Die folgenden älteren Vorher-/Nachher-Paare dokumentieren die ursprüngliche Vereinfachung; sie wurden für diese Nachbesserung nicht erneuert. Weiterhin keine echte Windows-/RDP-/SMB-Abnahme. Büro liest gegen, erstellt PDF und versendet eigenständig; keine zusätzliche Sachverständigenfreigabe. Kein Merge und kein Deployment.

## Sichtbare Änderung

Projektkopf und kurze Objekt-/Auftraggeber-Zusammenfassung stehen über vier jederzeit nutzbaren Aufgaben. Der leere Projektkopf bietet „Arbeitszettel einlesen“ direkt an. Aufgabentitel stehen groß, App-Namen darunter. Keine Reihenfolgelinien, Dateifund-Erledigt-Haken oder automatische Hervorhebung eines nächsten Pflichtschritts. Die bestehenden Anlagen bleiben an ihren Aufgaben erreichbar.

Die Projektliste zeigt Nummer und Schadenort, erkennbare Auswahl und bei Bedarf ungeprüften/nicht lesbaren Bestand. Desktop-Aufteilung ungefähr ein Drittel Liste zu zwei Dritteln Ansicht. Die Projektzeilen sind echte Schaltflächen: Tab, Enter/Leertaste, sichtbarer Fokus, ohne verschachtelte Klickziele.

„Übergabe ans Büro“ zeigt zunächst den vorhandenen Stand. Empfänger, Dateien, Änderungen, technische Kennung und Verlauf sind aufklappbar. Ohne Auftrag führt „Übergabe vorbereiten“ direkt ins Formular. „Word-Datei auswählen“ ist der normale Einstieg; manuelle Pfadangabe bleibt als aufklappbarer Ersatzweg. Abgewählte Empfängergruppen behalten ihre Eingaben und zeigen zunächst nur die Auswahl.

Rückfragen, Konflikte, Lese-/Speicherfehler und ungeklärte Versuche erscheinen zusätzlich direkt am Projektkopf. Dort kann man Rückfragen beantworten, Eingaben aufrufen und denselben offenen Versuch wiederholen. Die jüngste Rücknahme nach Bearbeitungszeit bleibt sichtbar; ältere erledigte/zurückgenommene Aufträge stehen im Verlauf. Ordner und „Frühere Versandangaben“ folgen nachgeordnet. Bei digitalen Aufträgen sind historische Versandangaben weiterhin nur Ansicht; ohne digitalen Auftrag bleibt die zulässige bisherige Bearbeitung erhalten. Keine Migration und keine automatische Auftragserzeugung.

Die separate Büroübersicht, ihr Datenformat und ihre Bearbeitungsregeln sind unverändert. Ebenso Empfängervoreinstellungen, Retry-/Stale-Form-Schutz, Konflikterkennung, Teilversand, Dateierzeugung und Fragmentlinks. Änderungen an Speicherfunktionen beschränken sich auf die sichtbare Wiedergabe ihrer bisherigen Rückmeldungen. Keine neue Sachverständigenfreigabe.

## Tatsächlich lokal geprüft

Node 24.19.0, vorhandenes Playwright, System-Chromium. Es wurden ausschließlich erfundene Projektdaten und temporäre Testablagen verwendet.

| Prüfung | Ergebnis |
|---|---|
| `node tests/projektansicht-browser.cjs` | Bestanden: Maus-/Tastaturwahl, alle vier App-Einstiege und exakte Projektfragmente, Aufgaben vor Bürodetails, Klappen ohne Verlust von Empfängerentscheidungen/Eingaben, Cursorerhalt auch bei tatsächlich extern geänderten Projektdaten, historische Angaben mit/ohne digitalen Auftrag, sichtbare und bedienbare Rückfrage/Speicherfehler, direkt wiederholbarer ungeklärter Versuch trotz zugeklappter Übergabe. |
| Derselbe UI-Test, Fensterbeispiele | 1440×1000 Desktop und 1024×768 kleineres Bürofenster kontrolliert; kein horizontaler Dokumentüberlauf. |
| Derselbe UI-Test, echter Browserzoom | Temporäres Chromium-Profil, reguläre Browser-Einstellung 150%, verifiziert mit `devicePixelRatio=1.5`; Fenster 1024×768, CSS-Inhaltsbereich 683×454. Rückfrage samt Aktion vollständig im sichtbaren Bereich. Kein bloßes CSS-Scaling. |
| `node tests/buero-browser.cjs` | Bestanden: bestehender vollständiger Büroablauf, Retry nach Aktualisieren mit identischer UUID/Inhalt und Kollisionsschutz, veraltete Änderungsformulare mit zwei unabhängigen Zuständen, vollständige Empfänger, Teil-/Vollversand und parallele Rückmeldungen. Nur die Einstiege in neue Aufklappbereiche und das Warten auf den tatsächlichen Übernahmevermerk wurden angepasst. |
| `tests/anlage-browser.cjs chromium` | Bestanden. Die beiden bisherigen Erwartungen „Plan ✓“ und „nächster Schritt“ wurden an ehrliche Dateibestandsanzeige und jederzeit verfügbare Aufgaben angepasst; Datei-/Dokument-/Übergabeprüfungen bleiben bestehen. |
| `tests/arbeitszettel-browser.cjs chromium` | Bestanden. |
| `tests/wechsel-browser.cjs chromium` | Bestanden; ungespeicherte Eingaben bleiben beim gescheiterten Wechsel erhalten. |
| `tests/zuletzt-browser.cjs chromium` | Bestanden. |
| `docx.cjs`, `anlage.cjs`, `arbeitszettel.cjs`, `sw.cjs`, `buero.cjs` | Alle bestanden, einschließlich XML-Prüfung und 15 vorhandener Offline-Ressourcen. |
| `node --test tests/integration/provenance.test.mjs` | Beide Prüfungen bestanden. |
| JS-Syntax und `git diff --check` | Bestanden. |

Die bestehende CI mit Chromium, WebKit und Spektron-Integration bleibt aktiv. Der gezielte UI-Test ergänzt nur den bestehenden Chromium-Job; keine neue Browsermatrix. Screenshots aus normalen Testläufen landen im ignorierten `tests/projektansicht-results/`, nicht in Produktdateien.

## Vorher-/Nachher-Screenshots

Alle drei Paare zeigen dieselben erfundenen Projektdaten bei **1440×1000**. Für die geöffnete Übergabe wurde in beiden Ansichten der Übergabebereich in den sichtbaren Ausschnitt gescrollt. Zeitangaben stammen vom jeweiligen Testlauf.

| Zustand | Vorher, main 77fd419 | Nachher |
|---|---|---|
| Normale Projektansicht | [Bild](vorher-projekt.png) | [Bild](nachher-projekt.png) |
| Geöffnete Übergabe | [Bild](vorher-uebergabe.png) | [Bild](nachher-uebergabe.png) |
| Rückfrage sichtbar, Details zugeklappt | [Bild](vorher-rueckfrage.png) | [Bild](nachher-rueckfrage.png) |

Zusätzliche Sichtprüfungen: [kleineres Bürofenster](nachher-klein.png), [echter 150%-Browserzoom](nachher-browserzoom-150.png).

Reproduktion mit vorhandener Playwright-Installation:

```sh
BROWSER_EXECUTABLE=/usr/bin/chromium node tests/projektansicht-browser.cjs
# Explizite Erneuerung der dokumentierten Bilder:
UI_SCREENSHOTS_OUTPUT="$PWD/docs/projektansicht" BROWSER_EXECUTABLE=/usr/bin/chromium node tests/projektansicht-browser.cjs
# Vorher aus einem unveränderten main-Worktree, ohne Änderungen zu übernehmen:
PROJECT_UI_ROOT=/tmp/projektzentrale-ui-vorher UI_SCREENSHOTS_OUTPUT="$PWD/docs/projektansicht" BROWSER_EXECUTABLE=/usr/bin/chromium node tests/projektansicht-browser.cjs
```

## Grenzen

Fenstergrößen und Zoom sind Prüfbeispiele, keine ermittelten Benutzeranforderungen. Bei schmalem Inhalt stehen Liste und Projektansicht untereinander; umfangreiche Formulare bleiben scrollbar. Es wurde keine echte Windows-/RDP-/SMB-Abnahme durchgeführt. Die Mehrplatzgrenzen und der manuelle Netzlaufwerktest aus der [Büro-Dokumentation](../../buero/README.md) gelten unverändert. Keine Zusicherung für Hintergrundbenachrichtigungen oder profilübergreifende Sperren. Kein Merge und kein Deployment.
