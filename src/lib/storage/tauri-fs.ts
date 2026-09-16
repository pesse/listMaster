import {
  BaseDirectory,
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove as removeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { ChecklistTemplate, TemplateId, TemplateSummary } from "../model/types";
import { toSummary } from "../model/template";
import { deserialize, fileNameFor, serialize } from "./json";
import { StorageError, type TemplateStore } from "./types";

/**
 * Vorlagen als einzelne JSON-Dateien unter
 * %APPDATA%/<bundle-id>/templates/.
 *
 * Eine Datei pro Vorlage (statt einer grossen Sammeldatei), weil das
 * spaeteren Server-Sync, Import/Export und Versionierung pro Vorlage
 * erlaubt, ohne dass gleichzeitige Aenderungen sich gegenseitig
 * ueberschreiben.
 */
const DIR = "templates";
const BASE = BaseDirectory.AppData;

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
async function findFile(id: TemplateId): Promise<string | null> {
  await ensureDir();
  const entries = await readDir(DIR, { baseDir: BASE });
  const match = entries.find((e) => e.isFile && e.name.endsWith(`.${id}.json`));
  return match ? `${DIR}/${match.name}` : null;
}

export function createTauriFsStore(): TemplateStore {
  return {
    async list(): Promise<TemplateSummary[]> {
      await ensureDir();
      const entries = await readDir(DIR, { baseDir: BASE });
      const summaries: TemplateSummary[] = [];
      for (const entry of entries) {
        if (!entry.isFile || !entry.name.endsWith(".json")) continue;
        try {
          const text = await readTextFile(`${DIR}/${entry.name}`, { baseDir: BASE });
          summaries.push(toSummary(deserialize(text, entry.name)));
        } catch (error) {
          // Eine kaputte Datei darf nicht die ganze Uebersicht blockieren.
          console.error(`Vorlage ${entry.name} uebersprungen:`, error);
        }
      }
      return summaries.sort((a, b) => a.name.localeCompare(b.name, "de"));
    },

    async load(id: TemplateId): Promise<ChecklistTemplate | null> {
      const path = await findFile(id);
      if (!path) return null;
      const text = await readTextFile(path, { baseDir: BASE });
      return deserialize(text, path);
    },

    async save(template: ChecklistTemplate): Promise<ChecklistTemplate> {
      await ensureDir();
      const target = `${DIR}/${fileNameFor(template)}`;
      const previous = await findFile(template.id);
      try {
        await writeTextFile(target, serialize(template), { baseDir: BASE });
      } catch (cause) {
        throw new StorageError(`Vorlage "${template.name}" konnte nicht gespeichert werden`, cause);
      }
      // Beim Umbenennen wandert der Inhalt in eine neue Datei -- die alte
      // muss weg, sonst existiert die Vorlage doppelt.
      if (previous && previous !== target) {
        await removeFile(previous, { baseDir: BASE });
      }
      return template;
    },

    async remove(id: TemplateId): Promise<void> {
      const path = await findFile(id);
      if (path) await removeFile(path, { baseDir: BASE });
    },
  };
}
