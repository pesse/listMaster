import {
  BaseDirectory,
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove as removeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { fileNameFor } from "./json";
import { StorageError, type DocumentCodec, type DocumentStore } from "./types";

/**
 * Dokumente als einzelne JSON-Dateien unter
 * %APPDATA%/<bundle-id>/<folder>/ -- `templates/` fuer Vorlagen,
 * `sheets/` fuer gespeicherte Druckboegen.
 *
 * Eine Datei pro Dokument (statt einer grossen Sammeldatei), weil das
 * spaeteren Server-Sync, Import/Export und Versionierung pro Dokument
 * erlaubt, ohne dass gleichzeitige Aenderungen sich gegenseitig
 * ueberschreiben.
 */
const BASE = BaseDirectory.AppData;

export function createTauriFsStore<Doc extends { id: string; name: string }, Summary extends { name: string }>(
  codec: DocumentCodec<Doc, Summary>,
): DocumentStore<Doc, Summary> {
  const DIR = codec.folder;

  async function ensureDir(): Promise<void> {
    if (!(await exists(DIR, { baseDir: BASE }))) {
      await mkdir(DIR, { baseDir: BASE, recursive: true });
    }
  }

  /**
   * Der Dateiname enthaelt den Slug des Namens, der sich beim Umbenennen
   * aendert -- gesucht wird deshalb ueber das ID-Suffix, nicht ueber den
   * vollen Namen.
   */
  async function findFile(id: string): Promise<string | null> {
    await ensureDir();
    const entries = await readDir(DIR, { baseDir: BASE });
    const match = entries.find((e) => e.isFile && e.name.endsWith(`.${id}.json`));
    return match ? `${DIR}/${match.name}` : null;
  }

  return {
    async list(): Promise<Summary[]> {
      await ensureDir();
      const entries = await readDir(DIR, { baseDir: BASE });
      const summaries: Summary[] = [];
      for (const entry of entries) {
        if (!entry.isFile || !entry.name.endsWith(".json")) continue;
        try {
          const text = await readTextFile(`${DIR}/${entry.name}`, { baseDir: BASE });
          summaries.push(codec.toSummary(codec.deserialize(text, entry.name)));
        } catch (error) {
          // Eine kaputte Datei darf nicht die ganze Uebersicht blockieren.
          console.error(`${codec.label} ${entry.name} uebersprungen:`, error);
        }
      }
      return summaries.sort((a, b) => a.name.localeCompare(b.name, "de"));
    },

    async load(id: string): Promise<Doc | null> {
      const path = await findFile(id);
      if (!path) return null;
      const text = await readTextFile(path, { baseDir: BASE });
      return codec.deserialize(text, path);
    },

    async save(doc: Doc): Promise<Doc> {
      await ensureDir();
      const target = `${DIR}/${fileNameFor(doc)}`;
      const previous = await findFile(doc.id);
      try {
        await writeTextFile(target, codec.serialize(doc), { baseDir: BASE });
      } catch (cause) {
        throw new StorageError(`${codec.label} "${doc.name}" konnte nicht gespeichert werden`, cause);
      }
      // Beim Umbenennen wandert der Inhalt in eine neue Datei -- die alte
      // muss weg, sonst existiert das Dokument doppelt.
      if (previous && previous !== target) {
        await removeFile(previous, { baseDir: BASE });
      }
      return doc;
    },

    async remove(id: string): Promise<void> {
      const path = await findFile(id);
      if (path) await removeFile(path, { baseDir: BASE });
    },
  };
}
