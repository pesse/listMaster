# ListMaster

Checklisten erstellen, als Vorlage speichern und ausdrucken.

Windows-Desktop-App (Tauri 2 + SvelteKit). Vorlagen liegen als einzelne
JSON-Dateien unter `%APPDATA%/de.listmaster.desktop/templates/`.

## Entwicklung

Voraussetzungen: Node 22+, Rust 1.77+, unter Windows zusaetzlich WebView2
(auf Windows 11 vorinstalliert).

```bash
npm install
npm run tauri dev      # Desktop-App starten
npm run dev            # nur Frontend im Browser (Daten im localStorage)
npm run verify         # Typcheck + Tests
```

## Build

```bash
npm run tauri build    # erzeugt MSI/NSIS-Installer unter src-tauri/target/release/bundle/
```

## Status

Erste Fassung: Vorlagen anlegen, bearbeiten, loeschen und als schmale
Streifen drucken -- mehrere nebeneinander auf einem A4-Bogen, zum
Ausschneiden.

Vorgesehen, aber noch nicht gebaut:

- **Laeufe** -- eine Vorlage digital abhaken und den Stand speichern. Das
  Datenmodell ist bereits darauf ausgelegt (stabile IDs, `revision`).
- **Server-Ablage** -- der `TemplateStore`-Vertrag ist so geschnitten, dass
  ein HTTP-Adapter die Dateien ersetzen kann.
- **Android** -- Tauri 2 kann dieselbe Codebasis als App bauen.
