# Spektron Integrationstest 1.0

Ein eigenständiger Node-/Playwright-Test im Repository Projektzentrale. Keine Änderungen an den produktiven Apps oder Datenformaten durch den Testaufbau. Der tatsächlich geprüfte Projektzentrale-Checkout und die fünf festgeschriebenen weiteren Anwendungen werden unter **einem Loopback-Ursprung** und ihren bestehenden Pfaden bereitgestellt. Kein Zugriff auf GitHub Pages oder echte Projektordner während des Browserlaufs.

## Ausführen

Node 24, Git, npm, pnpm 10 und vorhandenes Playwright (wie bei den bisherigen Browsertests) verwenden:

```sh
node tests/integration/prepare.mjs
PLAYWRIGHT_MODULE=/absoluter/pfad/zu/playwright node tests/integration/run.mjs
```

`prepare.mjs` lädt die in `stand.json` festgelegten main-Snapshots der fünf weiteren Anwendungen und baut PlanKit/SpesenKit mit ihren vorhandenen Lockfiles. Die Projektzentrale wird direkt aus dem aktuellen Checkout bereitgestellt, damit auch Produktänderungen eines PRs integriert geprüft werden. In GitHub Actions kann dies der von GitHub erzeugte Probe-Merge-Commit sein. Es führt keine Deployments aus. Mit `--refresh-main` werden bewusst neue Referenzstände aufgenommen; die Änderungen an `stand.json` gehören ins Review. Der Browserlauf selbst braucht keinen externen Dienst.

Alternativ `SPEKTRON_SOURCES` auf einen Ordner setzen, der die fünf anderen Repository-Kopien direkt enthält. PlanKit und SpesenKit benötigen dort zuvor ihren unveränderten Produktionsbuild in `dist/`. Optional `BROWSER_EXECUTABLE` setzen, z. B. auf ein installiertes Microsoft Edge. Der Runner verweigert bei der Projektzentrale uncommittete Änderungen getrackter Produktdateien gegenüber `HEAD`; bei den fünf weiteren Anwendungen verweigert er Abweichungen vom Manifest. `applicationSha` bezeichnet den tatsächlich geprüften Produktstand, `checkoutSha` den Repository-Checkout und `referenceSha` den Referenzstand aus `stand.json`. Bei der Projektzentrale ist `referenceSha` nur die historische Referenz; `applicationSha` entspricht dem aktuellen Checkout. Tests, Workflows, README und `.gitignore` bleiben von der Produktdateiprüfung ausgenommen.

`node --test tests/integration/provenance.test.mjs` prüft mit temporären synthetischen Git-Repositories, dass ein committeter Produkt-PR der Projektzentrale akzeptiert und korrekt protokolliert wird, uncommittete Produktänderungen dagegen abgewiesen werden und die fünf weiteren Anwendungen weiterhin an ihre Referenzstände gebunden sind. Dieser Regressionstest läuft auch im CI-Workflow vor der Vorbereitung.

## Tatsächlich geprüft

- Zentrale speichert gemeinsame Projektdaten und öffnet echte Zielfenster.
- Drei Proben entstehen ausschließlich durch UI-Eingaben in LabelKit; die produktive Speicherfunktion schreibt die echte JSON-Datei.
- FotoKit beschreibt vier künstliche JPEGs, sortiert eines aus und benennt/verschiebt mit seinen produktiven Funktionen. Metadaten und Bildbytes werden unabhängig gelesen.
- PlanKit liest genau die Datei aus diesem LabelKit-Lauf, platziert die drei Proben, speichert und öffnet erneut.
- BelegKit konsumiert dieselben tatsächlichen Produzentendateien. Mengen, Teilbeträge, Quellenprüfsummen und der gespeicherte JSON-/CSV-Stand werden geprüft.
- SpesenKit wird tatsächlich ohne Projektparameter geöffnet. Ein Monatsabschluss ist nicht Teil dieser Version; es gibt keine angenommene Übertragung zwischen BelegKit und SpesenKit.

Keine gespeicherte Suite-Projektdatei wird von Fixtures ersetzt. `fixtures.mjs` enthält nur Rohbilder/Grundriss, fiktive Eingaben, eine unabhängige Rechnung und einen synthetischen zweiseitigen Bericht als Eingabe aus dem außerhalb der Suite liegenden Gutachtenprozess.

## Unabhängige Rechnung

| Position | Menge × Preis | Soll |
|---|---|---:|
| SV Ortstermin | 1 h × 100 EUR | 100,00 EUR |
| Fahrt | 10 km × 0,50 EUR | 5,00 EUR |
| PAK | 1 × 10 EUR | 10,00 EUR |
| Chlorid | 1 × 20 EUR | 20,00 EUR |
| Asbest | 1 × 30 EUR | 30,00 EUR |
| Bericht | 0,5 h × 80 EUR | 40,00 EUR |
| Nebenposition | 2 Seiten × 1 EUR + 3 Fotos × 0,50 EUR + 0 EUR fix | 3,50 EUR |
| **Netto** | unabhängiges Soll in Cent | **208,50 EUR** |

## Isolation und Nachweise

Frischer, nicht persistenter Browserkontext; ausschließlich privates Browserdateisystem (OPFS). Ersetzt werden Dateiauswahl und Zugriffsberechtigungen. Die App-Schreibfunktionen und erzeugten Formate bleiben echt. Ein zweites Kontrollprojekt darf sich nicht verändern. HTTP-Anfragen außerhalb des lokalen Ursprungs werden blockiert.

Nach Erfolg **und** Fehler werden das Testarchiv gelöscht, der Browserkontext/Browser geschlossen und der HTTP-Server beendet. `result.json` enthält den Löschungsnachweis. Diagnosen unter `results/<Lauf>/` bleiben absichtlich erhalten (nur synthetische Inhalte); `.gitignore` schließt sie aus. Die heruntergeladenen Source-/Build-Kopien bleiben für reproduzierbare Wiederholungen im ignorierten `tests/.integration-work/`; sie sind keine Projektarchive.

Der CI-Workflow lädt ausschließlich das Ergebnisverzeichnis als Artefakt hoch und besitzt keine Schreib-/Pages-Rechte.

## Grenzen

Chromium mit OPFS ist kein Nachweis für NTFS, SMB, Dateisperren, getrennte Windows-Profile, zwei Terminalserver, RDP-Trennung, physische Stromunterbrechung oder Word-Darstellung. Diese Eigenschaften müssen am Windows-/RDP-Testarbeitsplatz abgenommen werden. WebKit wird hier nicht ausgeführt; reduzierte WebKit-Dateiprüfungen werden nicht als voller Erfolg ausgegeben. Die bestehenden appinternen Chromium-/WebKit-Suites bleiben zusätzlich erforderlich.

Die drei Sicherheitsfälle Projektwechsel, parallele gemeinsame Felder und Speicherfehler nach Umbenennung gehören in den getrennten zweiten PR. Keine automatische Produktkorrektur bei einem gefundenen Fehler: Reproduktion sichern, betroffenes Repository und Ursache dokumentieren, separaten Bugfix vorschlagen.
