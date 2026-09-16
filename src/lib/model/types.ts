import { z } from "zod";

/**
 * Schema-Version der auf Platte/Server liegenden JSON-Dateien.
 * Wird bei jeder inkompatiblen Aenderung erhoeht; `migrate()` in json.ts
 * hebt aeltere Dateien auf den aktuellen Stand.
 */
export const SCHEMA_VERSION = 1;

/**
 * IDs sind stabil und ueberleben Umbenennungen, Umsortierungen und
 * Textaenderungen. Ein spaeterer Lauf (abgehakte Instanz) referenziert
 * Punkte ueber ItemId + Template-Revision -- deshalb duerfen sie beim
 * Bearbeiten niemals neu vergeben werden.
 */
export type TemplateId = string;
export type SectionId = string;
export type ItemId = string;

export const checklistItemSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  /** Optionaler Zusatzhinweis, im Druck kleiner unter dem Punkt. */
  note: z.string().optional(),
});

export const checklistSectionSchema = z.object({
  id: z.string().min(1),
  /** Leerer Titel = unbenannter Abschnitt, druckt ohne Zwischenueberschrift. */
  title: z.string(),
  items: z.array(checklistItemSchema),
});

export const checklistTemplateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string(),
  description: z.string().optional(),
  /**
   * Zaehlt bei jedem Speichern hoch. Ein Lauf haelt die Revision fest,
   * unter der er erstellt wurde, damit spaetere Vorlagenaenderungen
   * bereits gedruckte/abgehakte Listen nicht ruecklaufend veraendern.
   */
  revision: z.number().int().nonnegative(),
  sections: z.array(checklistSectionSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ChecklistItem = z.infer<typeof checklistItemSchema>;
export type ChecklistSection = z.infer<typeof checklistSectionSchema>;
export type ChecklistTemplate = z.infer<typeof checklistTemplateSchema>;

/**
 * Was die Vorlagenliste braucht -- bewusst ohne `sections`, damit ein
 * spaeterer HTTP-Store die Uebersicht laden kann, ohne alle Vorlagen
 * vollstaendig zu uebertragen.
 */
export interface TemplateSummary {
  id: TemplateId;
  name: string;
  description?: string;
  itemCount: number;
  updatedAt: string;
}
