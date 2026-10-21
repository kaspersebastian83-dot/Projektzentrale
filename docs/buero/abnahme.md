# Büroübergabe V1 – Prüfung am 21.10.2026

Branch `feature/buero-uebergabe`, Basis `main` `936856cde3ebef26f5305111799eba21c7fe4f29`. Ausschließlich Repository Projektzentrale geändert. Kein Merge, Release oder Deployment.

Umgesetzt: bewusste Übergabe mit konkretem Word-Pfad und bestätigtem Empfängerstand, eigene Büroseite ohne Fach-App-Navigation, Gegenlesen, tatsächliche PDF-Zuordnung, Teil-/Vollversand mit Datum/Kürzel, optionale Rückfragen samt Anzeige/Antwort in der Zentrale, bewusste Korrekturen/Änderung/Rücknahme und sichtbare Paralleländerungen. Papiermappe bleibt; kein Freigabeschritt nach Gegenlesen.

Aufträge: `<Projekt>/_Buero/<UUID>/auftrag.json`. Einzelne Rückmeldungen: daneben `rueckmeldung-<UUID>.json`. [Format, Bedienung und Grenzen](../../buero/README.md).

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
