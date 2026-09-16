import { checklistTemplateSchema, SCHEMA_VERSION, type ChecklistTemplate } from "../model/types";
import { StorageError } from "./types";

/**
 * Serialisierung und Validierung -- geteilt von allen Stores.
 * Dateien koennen von Hand bearbeitet, per Import eingespielt oder
 * spaeter von einem Server geliefert werden; deshalb wird beim Lesen
 * immer validiert statt blind gecastet.
 */

export function serialize(template: ChecklistTemplate): string {
  return JSON.stringify(template, null, 2) + "\n";
}

/** Hebt aeltere Schema-Versionen auf den aktuellen Stand. */
function migrate(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const data = raw as Record<string, unknown>;
  // Version 1 ist der Anfang -- Dateien ohne Feld stammen aus der Fruehphase.
  if (data.schemaVersion === undefined) {
    return { ...data, schemaVersion: SCHEMA_VERSION };
  }
  return data;
}

export function deserialize(text: string, source = "<unbekannt>"): ChecklistTemplate {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    throw new StorageError(`${source}: enthaelt kein gueltiges JSON`, cause);
  }

  const result = checklistTemplateSchema.safeParse(migrate(raw));
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new StorageError(`${source}: keine gueltige Checklisten-Vorlage (${details})`);
  }
  return result.data;
}

/**
 * Dateiname aus dem Vorlagennamen -- lesbar im Dateisystem und spaeter
 * in einem Git-Repo oder Sync-Ordner. Die ID bleibt als Suffix erhalten,
 * damit Umbenennen nicht zu Kollisionen fuehrt.
 */
export function fileNameFor(template: ChecklistTemplate): string {
  const slug = template.name
    .toLowerCase()
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${slug || "checkliste"}.${template.id}.json`;
}
