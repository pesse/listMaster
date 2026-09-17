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

### Drucken: Streifen, keine Ganzseiten

Gedruckt wird nicht eine Vorlage pro Seite, sondern ein **Bogen mit
mehreren schmalen Streifen**, die nach dem Druck ausgeschnitten werden.
Jeder Streifen traegt eine eigene Vorlage -- verschiedene Listen oder
dieselbe mehrfach. Der Grund: die realen Listen sind kurz (die erste hatte
10 Punkte), eine A4-Seite pro Liste waere fast leer.

Die Route ist `/print?ids=a.heute*s2,b,a&cols=3`. Der Bogen steht
vollstaendig in der URL, damit er nachladbar und als Lesezeichen
wiederverwendbar ist; wiederholte IDs sind ein gewollter Fall, kein Fehler.
`src/lib/print/sheet.ts` liest und schreibt diese Folge:
`<Vorlage>.<Datum>*<Abschnitt>*…`, je Streifen.

**Datum und Ausblendung haengen am Streifen, nicht an der Vorlage und nicht
am Bogen.** Derselbe Einkaufszettel kann einmal fuer heute vollstaendig und
einmal fuer morgen ohne den Getraenke-Abschnitt auf demselben Bogen liegen.
Ein neu hinzugefuegter Streifen erbt das Datum des letzten -- ein Bogen ist
meist fuer einen Tag.

Hinter dem `*` stehen die **Abschnitte, die dieser Streifen nicht druckt** --
als stabile `SectionId`, nicht als Position, damit ein Lesezeichen das
Umsortieren der Vorlage ueberlebt. `visibleTemplate()` liefert die gedruckte
Fassung -- Rendern *und* Hoehenschaetzung arbeiten darauf, sonst warnte
`fitsInColumn` vor Zeilen, die gar nicht aufs Papier kommen.

Hinter dem `.` steht das **Datum** (`src/lib/print/date.ts`), rechts in der
Titelzeile, gedruckt als `17.09.26`. `heute` und `morgen` sind bewusst
**keine festen Tage**, sondern werden erst beim Rendern aufgeloest: ein
abgelegter Bogen druckt morgen das Datum von morgen. Ein fester Tag steht
als ISO-Tag (`a.2026-09-17`). Gerechnet wird durchgehend in Ortszeit --
`toISOString()` waere falsch, es macht aus dem 17. abends den 16.

`.` und `*` als Trenner, weil `URLSearchParams` sie unkodiert stehen laesst
(ein `!` stuende als `%21` in der Adresszeile) und weder UUIDs noch die
Datumswerte sie enthalten.

Den Umbruch macht CSS (`columns` auf `.strips`), nicht der Code. Jeder
Streifen ist nur so hoch wie sein Inhalt und fliesst in die Spalten.
Die zwei Regeln in `print.css`, auf die es ankommt:

- `break-inside: avoid` auf `.strip` -- ein Streifen wird nie ueber
  Spalten oder Seiten zerrissen, sonst waere er nicht am Stueck
  ausschneidbar.
- `border` auf `.strip` -- der Rahmen **ist** die Schnittlinie: einmal
  aussen herum schneiden. Er hat eine fruehere Loesung aus Spaltenlinie
  (`column-rule`) und gestrichelter Unterkante abgeloest, die schlechter
  zu schneiden war und unruhiger aussah.

`src/lib/print/layout.ts` haelt dieselben Masse in Millimetern, aber nur
zur Warnung: `fitsInColumn()` meldet, wenn eine Liste zu lang fuer eine
Spalte ist und der Umbruch sie zerreissen wuerde. Rahmen und Innenabstand
stecken als `FRAME_MM` mit drin. Diese Zahlen steuern den Druck nicht --
wer `print.css` aendert, muss sie mitziehen.

**Druckbild pruefen, nicht erraten.** Das Layout laesst sich aus WSL heraus
echt rendern, ohne die App zu starten:

```bash
npm run print:preview -- 3 5 /tmp/sheet.pdf heute   # Spalten, Streifen, Ziel, Datum
```

`scripts/print-preview.mjs` zieht die echten Vorlagen aus dem
AppData-Verzeichnis und rendert sie mit headless Chrome. Die PDF ist direkt
lesbar (Read-Tool). Markup und Stylesheet sind dieselben wie in der Route --
wer die Route aendert, zieht das Skript mit.

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
