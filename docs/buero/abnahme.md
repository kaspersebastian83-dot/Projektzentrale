# Büroübergabe V1 – Prüfung am 21.10.2026

Branch `feature/buero-uebergabe`, Basis `main` `936856cde3ebef26f5305111799eba21c7fe4f29`. Ausschließlich Repository Projektzentrale geändert. Kein Merge, Release oder Deployment.

Umgesetzt: bewusste Übergabe mit konkretem Word-Pfad und bestätigtem Empfängerstand, eigene Büroseite ohne Fach-App-Navigation, Gegenlesen, tatsächliche PDF-Zuordnung, Teil-/Vollversand mit Datum/Kürzel, optionale Rückfragen samt Anzeige/Antwort in der Zentrale, bewusste Korrekturen/Änderung/Rücknahme und sichtbare Paralleländerungen. Papiermappe bleibt; kein Freigabeschritt nach Gegenlesen.

Aufträge: `<Projekt>/_Buero/<UUID>/auftrag.json`. Einzelne Rückmeldungen: daneben `rueckmeldung-<UUID>.json`. [Format, Bedienung und Grenzen](../../buero/README.md).

## Gezielte Nachbesserung von PR #27

Ausgangspunkt ist der geprüfte Stand `e8938f89f16382fc8a45b32a52f2d6329d874394`; Korrekturen in `4d825b7` und `5d4f3bb` auf demselben Branch. Gemeinsames Dateiformat, Büroablauf, Runner und Playwright bleiben unverändert.

- **Erstübergabe nach Fehler und Aktualisieren:** Der bekannte offene Versuch bleibt über den tatsächlichen UI-Knopf wiederholbar. Die Übersicht warnt weiterhin vor der unvollständigen Datei. Die bestehende Prüfung der konkreten Zieldatei gilt unverändert: abweichende Inhalte werden nicht überschrieben. UUID und Nutzdaten bleiben gleich, es entsteht genau ein Auftrag. Der neue UI-Test reproduzierte vor der Korrektur den deaktivierten Knopf.
- **Veraltetes Änderungsformular:** Beim Öffnen wird der Ausgangsstand aus Inhalt und letzten Ereigniskennungen festgehalten. Speichern aus einem inzwischen veralteten Formular wird vor dem Anlegen einer Rückmeldung abgewiesen; Eingaben bleiben stehen. Aktualisieren allein übernimmt keinen neuen Ausgangsstand. Erst das bewusste erneute Öffnen lädt die aktuelle Fassung samt neuem Empfänger. Der bisherige Entwurf bleibt dabei zum Nachlesen und Kopieren erhalten; gewünschte Eingaben werden bewusst erneut übernommen.
- **WebKit:** Der Fehler in Job `119379765110` von Lauf `39645472892` wurde anhand des Logs als falscher CSS-Inhaltstyp bestätigt. Anlage-, Arbeitszettel- und Wechsel-Testserver liefern CSS als `text/css` und JavaScript mit JavaScript-Inhaltstyp aus. Keine Filterung von Fehlermeldungen und kein deaktivierter Test.

Tatsächlich erneut lokal ausgeführt:

| Prüfung | Ergebnis |
|---|---|
| `BROWSER_EXECUTABLE=/usr/bin/chromium node tests/buero-browser.cjs` | bestanden: leere Erstauftragsdatei → Schreibfehler → Aktualisieren → tatsächlicher Wiederholen-Knopf; gleicher Inhalt/UUID und genau ein Auftrag. Ein zusätzlich eingespielter abweichender Dateiinhalt bleibt beim Retry unverändert. |
| Derselbe Büro-Browsertest, Änderungsregression | bestanden: zwei unabhängige Browserkontexte A/B; B ergänzt Empfänger, A ändert Hinweis. A wird zurückgewiesen, Eingaben und B-Empfänger bleiben erhalten. Auch nach Aktualisieren weiterhin zurückgewiesen; nach bewusster Neuprüfung werden Hinweis und vollständiger Empfängerstand gespeichert. |
| `node tests/buero.cjs` | bestanden |
| `node tests/sw.cjs` | bestanden |
| `tests/anlage-browser.cjs chromium` | bestanden |
| `tests/arbeitszettel-browser.cjs chromium` | bestanden |
| `tests/wechsel-browser.cjs chromium` | bestanden |
| JS-Syntaxprüfungen und `git diff --check` | bestanden |

CI für den Korrekturstand `5d4f3bbc7bb2b2a1b224b1ce471909ebd1318f31` vollständig erfolgreich: [Automated tests #33](https://github.com/kaspersebastian83-dot/Projektzentrale/actions/runs/39647705176) mit Node-, Chromium- und WebKit-Job sowie [Spektron integration #10](https://github.com/kaspersebastian83-dot/Projektzentrale/actions/runs/39647705191). Der ursprünglich fehlerhafte WebKit-Anlagentest läuft jetzt erfolgreich ohne Fehlerfilter. Die vorhandene CI-Konfiguration wurde für diese Nachbesserung nicht geändert.

Die vorhandenen zwei Screenshots bleiben erhalten: Ihre gezeigten normalen Ansichten haben sich nicht geändert. Nur bei veralteten Änderungsformularen erscheint der zusätzliche Entwurf zum Nachlesen. Die nachfolgenden Ergebnisse dokumentieren die ursprüngliche V1-Abnahme; für diese Nachbesserung gelten die obigen gezielten Wiederholungen.

## Tatsächlich ausgeführt

Node `v24.19.0`, System-Chromium `154.0.8037.57`, bestehendes Playwright. Vorhandene Chromium-Tests liefen über einen temporären Launcher mit `executablePath=/usr/bin/chromium`; keine Änderung ihrer Produktfunktionen.

| Prüfung | Ergebnis |
|---|---|
| `node tests/docx.cjs` | bestanden, einschließlich Python-XML-Prüfung |
| `node tests/anlage.cjs` | bestanden |
| `node tests/arbeitszettel.cjs` | bestanden |
| `node tests/sw.cjs` | bestanden, 15 vorhandene Offline-Ressourcen |
| `node tests/buero.cjs` | bestanden: Ablauf, Empfängerstand, fehlende Angaben, Retry, Fehler, Revision/Korrekturen, konkurrierende Rückmeldungen |
| `node --test tests/integration/provenance.test.mjs` | beide Prüfungen bestanden |
| `tests/anlage-browser.cjs chromium` | bestanden |
| `tests/arbeitszettel-browser.cjs chromium` | bestanden |
| `tests/wechsel-browser.cjs chromium` | bestanden |
| `tests/zuletzt-browser.cjs chromium` | bestanden; lokales SpesenKit-Testziel und CSS/JS-MIME-Typen im Testserver ergänzt |
| `BROWSER_EXECUTABLE=/usr/bin/chromium node tests/buero-browser.cjs` | bestanden: produktiver UI-Ablauf, erhaltener Entwurf bei Schreibfehler, ausgewählte Word/PDF, vollständige Empfänger, Teil-/Vollversand, Rückfrage, zwei unabhängige Kontexte mit gemeinsamer temporärer Ablage, Konflikte, Retry nach unklarem Ereignisspeichern |
| `BROWSER_EXECUTABLE=/usr/bin/chromium node tests/integration/run.mjs --security` | Wiederholung vollständig bestanden: Grundablauf und A/B/C, beide Schreibrichtungen in B, 6 echte Bildoperationen in C, keine Browserfehler, Testarchiv gelöscht |
| `git diff --check` und JS-Syntaxprüfungen | bestanden |

Beim ersten lokalen Spektron-Integrationslauf trat ein Timeout in Sicherheitsfall B auf. Gegenprobe auf unverändertem `main` und anschließende Wiederholung des Feature-Stands bestanden ohne Änderung an diesem Test oder an anderen Apps. Der initiale Timeout wird als lokale Testinstabilität festgehalten. Erfolgreicher Lauf: ignoriertes Verzeichnis `tests/integration/results/1792604086649-5728/`; erste Diagnose: `tests/integration/results/1792603938892-4902/`. Bestehende CI samt WebKit und Integrationsworkflow bleibt aktiv. WebKit wurde lokal nicht ausgeführt.

Der Datentest wurde nach der abschließenden Verschärfung der Empfänger-ID-Validierung nochmals erfolgreich ausgeführt; gültige UI-UUIDs ändern sich dadurch nicht.

## Screenshots mit erfundenen Daten

[Übergabebereich](uebergabe.png) · [Büroübersicht mit Teilversand](uebersicht.png). Reproduzierbar durch den Büro-Browsertest unter `tests/buero-results/` (ignoriert).

## Noch manuell abzunehmen

Kein echter Windows-/RDP-/SMB-Test in der Cloud. Zwei unabhängige Windows-Profile, gemeinsames Testnetzlaufwerk, tatsächliche Word-Korrektur und PDF-Erstellung/Versand, Dateisperren, Verbindungsunterbrechung und Wiederholung desselben Versuchs prüfen. Danach parallele Übernahme/Korrektur sowie sichtbare Änderung/Rücknahme kontrollieren. [Kurzer Ablauf](../../buero/README.md#gezielte-abnahme).

Kürzel sind keine Benutzeranmeldung; keine profilübergreifende Sperrgarantie. Zwei unabhängig gestartete Erstübergaben können zwei sichtbare Aufträge erzeugen; derselbe unbestätigte Versuch verwendet beim Retry dieselbe Kennung. Externes Verschieben/Ersetzen von Dokumenten wird nicht gesperrt. Keine Benachrichtigung bei geschlossener App. Word, PDF-Erstellung und Versand bleiben außerhalb der App.
