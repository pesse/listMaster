# ListMaster

Checklisten erstellen, als Vorlage speichern und ausdrucken -- als schmale
Streifen, mehrere nebeneinander auf einem A4-Bogen, zum Ausschneiden.

Windows-Desktop-App auf Basis von [Tauri 2](https://tauri.app) und
SvelteKit. Android ist als zweites Build-Target derselben Codebasis
vorgesehen.

## Funktionen

- **Vorlagen** anlegen, bearbeiten, duplizieren und loeschen -- gegliedert
  in Abschnitte.
- **Drucken als Streifen**: Ein Bogen traegt beliebig viele Streifen in
  1--3 Spalten, verschiedene Listen oder dieselbe mehrfach. Jeder Streifen
  hat einen Rahmen, der zugleich die Schnittlinie ist, und wird nie ueber
  Spalten oder Seiten umbrochen.
- **Je Streifen einstellbar**, ohne die Vorlage zu aendern:
  - Datum im Kopf -- `heute` (Standard), `morgen`, ein fester Tag oder keins.
    `heute`/`morgen` werden erst beim Drucken aufgeloest.
  - ganze Abschnitte ausblenden
  - einzelne Punkte in der Vorschau entfernen (✕ beim Ueberfahren)
- **Warnung**, wenn eine Liste zu lang fuer eine Spalte ist.
- **Bogen als Lesezeichen**: Die komplette Zusammenstellung steht in der
  URL und laesst sich jederzeit wieder aufrufen, z. B.
  `/print?ids=<vorlage>.heute*<abschnitt>,<vorlage>&cols=3`.

## Daten

Jede Vorlage ist eine eigene JSON-Datei unter

```
%APPDATA%\de.listmaster.desktop\templates\
```

Die Dateien werden beim Lesen validiert. Sie lassen sich also von Hand
bearbeiten oder kopieren; eine kaputte Datei wird uebersprungen, statt
die Uebersicht zu blockieren. Im Repository liegen keine Vorlagen.

## Entwicklung

Voraussetzungen: Node 22+, Rust 1.77+, WebView2 (auf Windows 11
vorinstalliert).

```bash
npm install
npm run tauri dev      # Desktop-App starten
npm run dev            # nur Frontend im Browser (Daten im localStorage), :1420
npm run verify         # Typcheck + Unit-Tests -- vor jedem Commit
```

Wer unter WSL editiert: die App trotzdem unter Windows starten
(`.\dev-windows.ps1`, schreibt zusaetzlich `tauri-dev.log`), und
`npm install` auch unter Windows ausfuehren -- die App nutzt die
Windows-`node_modules`.

### Druckbild ohne App pruefen

```bash
npm run print:preview -- 3 5 sheet.pdf heute   # Spalten, Streifen, Ziel, Datum
```

Rendert die echten Vorlagen aus `%APPDATA%` mit headless Chrome als PDF.
Ein anderes Verzeichnis laesst sich ueber `LISTMASTER_TEMPLATES` setzen.

### Aufbau

```
src/lib/model/      Datenmodell und Regeln -- ohne IO, Svelte oder DOM
src/lib/storage/    TemplateStore-Vertrag + Adapter (Tauri-Dateien, localStorage)
src/lib/print/      Bogen, Datum und Hoehenschaetzung fuer den Streifendruck
src/routes/         Oberflaeche
src/styles/         app.css (Bildschirm), print.css (Papier)
```

Die Oberflaeche spricht nur ueber `getStore()` mit der Ablage; ein
weiterer Adapter (etwa gegen einen Server) laesst sich einhaengen, ohne
eine Route anzufassen. Details zu den Designentscheidungen stehen in
[`CLAUDE.md`](CLAUDE.md).

## Build

```bash
npm run tauri build    # MSI/NSIS-Installer unter src-tauri/target/release/bundle/
```

## Ausblick

Vorgesehen, aber noch nicht gebaut:

- **Laeufe** -- eine Vorlage digital abhaken und den Stand speichern. Das
  Datenmodell ist darauf ausgelegt (stabile IDs, `revision`).
- **Server-Ablage** -- als dritter `TemplateStore`-Adapter.
- **Android** -- Tauri 2 baut dieselbe Codebasis als App.
