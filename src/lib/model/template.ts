import {
  SCHEMA_VERSION,
  type ChecklistItem,
  type ChecklistSection,
  type ChecklistTemplate,
  type TemplateSummary,
} from "./types";

/**
 * Reine Datenfunktionen -- kein IO, kein Svelte, kein DOM.
 * Damit ist das Modell ohne Tauri und ohne Browser testbar.
 */

export function newId(): string {
  return crypto.randomUUID();
}

export function createItem(text = ""): ChecklistItem {
  return { id: newId(), text };
}

export function createSection(title = ""): ChecklistSection {
  return { id: newId(), title, items: [createItem()] };
}

export function createTemplate(name = "Neue Checkliste"): ChecklistTemplate {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    name,
    revision: 0,
    sections: [createSection()],
    createdAt: now,
    updatedAt: now,
  };
}

export function countItems(template: ChecklistTemplate): number {
  return template.sections.reduce((sum, s) => sum + s.items.length, 0);
}

export function toSummary(template: ChecklistTemplate): TemplateSummary {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    itemCount: countItems(template),
    updatedAt: template.updatedAt,
  };
}

/**
 * Erzeugt die zu speichernde Fassung: Revision hochzaehlen, Zeitstempel
 * setzen und leere Punkte verwerfen. Der Editor haelt waehrend des
 * Tippens leere Zeilen als Eingabeschlitze -- die gehoeren nicht in die Datei.
 */
export function prepareForSave(
  template: ChecklistTemplate,
  now = new Date(),
): ChecklistTemplate {
  const description = template.description?.trim();
  return {
    ...template,
    revision: template.revision + 1,
    updatedAt: now.toISOString(),
    // Der Editor bindet ein leeres Feld als "" -- das gehoert nicht in die Datei.
    description: description === "" ? undefined : description,
    sections: template.sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.text.trim() !== ""),
      }))
      .filter(
        (section) => section.items.length > 0 || section.title.trim() !== "",
      ),
  };
}

/**
 * Kopie einer Vorlage mit durchgehend neuen IDs. Wichtig: ohne
 * Neuvergabe wuerden zwei Vorlagen dieselben ItemIds tragen und ein
 * spaeterer Lauf koennte nicht mehr eindeutig zugeordnet werden.
 */
export function duplicateTemplate(
  template: ChecklistTemplate,
  name = `${template.name} (Kopie)`,
): ChecklistTemplate {
  const now = new Date().toISOString();
  return {
    ...template,
    id: newId(),
    name,
    revision: 0,
    createdAt: now,
    updatedAt: now,
    sections: template.sections.map((section) => ({
      ...section,
      id: newId(),
      items: section.items.map((item) => ({ ...item, id: newId() })),
    })),
  };
}

export function moveInArray<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const copy = [...items];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}
