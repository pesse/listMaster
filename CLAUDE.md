# ListMaster

Checklisten erstellen, als Vorlage speichern und ausdrucken.
Desktop-App (Windows) auf Basis von Tauri 2; Android ist als spaeteres
zweites Build-Target vorgesehen, nicht als eigene Codebasis.

## Stack

- **SvelteKit im SPA-Modus** (`adapter-static`, `fallback: index.html`,
  `ssr = false`) + TypeScript + Vite
- **Tauri 2** als Desktop-Huelle, WebView2 unter Windows
- **Persistenz: JSON-Dateien**, eine pro Vorlage, unter
  `%APPDATA%/de.listmaster.desktop/templates/`
- **zod** fuer die Validierung beim Lesen
- **Vitest** fuer die Domaenenlogik

## Architektur

```
src/lib/model/      reine Daten -- kein IO, kein Svelte, kein DOM
src/lib/storage/    TemplateStore-Vertrag + austauschbare Adapter
src/routes/         UI; kennt nur getStore() und das Modell
src/styles/         app.css (Bildschirm), print.css (Papier)
```

### Die zwei Regeln, die das Design tragen

**1. Persistenz laeuft ausschliesslich ueber `TemplateStore`.**
Die UI importiert nie einen Adapter direkt, sondern nur `getStore()` aus
`src/lib/storage/index.ts`. Der Vertrag ist durchgehend `async` und trennt
`list()` (Summaries) von `load()` (Volltext) -- genau deshalb laesst er sich
spaeter von einem HTTP-Store gegen einen Server erfuellen, ohne dass eine
einzige Route angefasst werden muss. Es gibt bereits zwei Adapter:

- `tauri-fs.ts` -- JSON-Dateien, der Produktivfall
- `browser.ts` -- localStorage, fuer `npm run dev` im normalen Browser und
  zugleich der Adapter, den eine PWA-Variante nutzen wuerde

Ein Server-Adapter kommt als dritte Datei daneben und wird in `index.ts`
eingehaengt.

**2. IDs sind stabil und werden nie neu vergeben.**
`TemplateId`, `SectionId` und `ItemId` ueberleben Umbenennen, Umsortieren und
Textaenderungen. Zusammen mit `revision` (zaehlt bei jedem Speichern hoch)
ist damit der spaetere Ausbau auf *Laeufe* -- gespeicherte, abgehakte
Instanzen einer Vorlage -- ohne Schemabruch moeglich: ein Lauf referenziert
`ItemId` + `revision`. Beim Duplizieren einer Vorlage muessen deshalb
**alle** IDs neu vergeben werden (`duplicateTemplate`), sonst sind Laeufe
nicht mehr eindeutig zuzuordnen.

### Drucken

`/print/[id]` rendert einen A4-Bogen und ruft `window.print()` auf -- das
oeffnet den echten Windows-Druckdialog inklusive "Als PDF speichern".
Bedienelemente tragen `.no-print`. In `print.css` sind die zwei Regeln
wichtig, die den Unterschied machen: `break-inside: avoid` auf `li` (ein
Punkt wird nie ueber den Seitenumbruch zerrissen) und `break-after: avoid`
auf `h2` (eine Abschnittsueberschrift steht nie allein am Seitenende).

## Umgebung: Windows startet die App, WSL editiert sie

| Aufgabe | Befehl | Wo |
|---|---|---|
| Gate vor jedem Commit | `npm run verify` | WSL |
| Typcheck | `npm run check` | WSL |
| Unit-Tests (ohne Browser, ohne Tauri) | `npm run test` | WSL |
| Nur Frontend, localStorage-Store | `npm run dev` -> `:1420` | WSL |
| Vollstaendige App | `.\dev-windows.ps1` | Windows PowerShell |
| Laufende App beobachten | `tail -f /mnt/c/dev/privat/listMaster/tauri-dev.log` | WSL |
| Pakete installieren | `npm install` | Windows PowerShell |
| Windows-Installer bauen | `npm run tauri build` | Windows PowerShell |

**Die App nie in WSL starten** -- WSL hat keinen GPU-Zugriff, das Rendering
kriecht. `dev-windows.ps1` leitet die Ausgabe zusaetzlich in `tauri-dev.log`;
ueber dieses Log ist die laufende App aus WSL beobachtbar.

**`npm install` muss auch unter Windows laufen** -- die App nutzt die
Windows-`node_modules`. Ein Install in WSL aktualisiert nur `package.json` /
`package-lock.json`; der Nutzer wiederholt ihn in PowerShell, was waehrend
des laufenden Dev-Servers funktioniert, weil Vite das Paket aufnimmt. **Nie
verlangen, den Dev-Server nur fuer eine Installation zu stoppen.**

Auch `cargo` gehoert nach Windows: ein `cargo check` in WSL pruefte das
Linux-Target gegen webkit2gtk und sagt ueber den Windows-Build nichts aus.
Aenderungen unter `src-tauri/` brauchen einen vollen Rust-Neubau, Hot-Reload
deckt nur die Svelte-Seite ab.

## Konventionen

- Domaenenlogik bleibt frei von Svelte und Tauri, damit sie ohne Browser
  testbar ist. Neue Regeln gehoeren nach `src/lib/model/`, nicht in eine
  Komponente.
- Beim Lesen wird immer validiert (`deserialize`), nie gecastet: Dateien
  koennen von Hand bearbeitet, importiert oder spaeter vom Server geliefert
  werden.
- Eine kaputte Datei darf nie die gesamte Uebersicht blockieren --
  `list()` ueberspringt sie mit Log-Eintrag.
- UI-Texte sind deutsch.
