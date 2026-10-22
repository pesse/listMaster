import { z } from "zod";
import { newId } from "../model/template";
import { parseDateChoice, serializeDateChoice } from "./date";
import { DEFAULT_COLUMNS, isColumnCount, type ColumnCount } from "./layout";
import { serializeStrips, type StripSpec } from "./sheet";

/**
 * Ein gespeicherter Bogen: dieselbe Streifenfolge, die sonst nur in der URL
 * steht, unter einem Namen abgelegt -- etwa der Wochenplan, der jede Woche
 * wieder gedruckt und nur noch angepasst wird.
 *
 * Gespeichert wird die *Wahl* des Datums, nicht der aufgeloeste Tag: ein
 * Streifen fuer "in 3 Tagen" druckt naechste Woche den Tag der naechsten
 * Woche. Vorlagen stehen als `TemplateId` drin, nicht als Kopie -- aendert
 * sich eine Vorlage, druckt der Bogen die neue Fassung. Eine geloeschte
 * Vorlage laesst ihren Streifen leer zurueck, statt den Bogen unlesbar zu
 * machen.
 */
export type SheetId = string;

export const SHEET_SCHEMA_VERSION = 1;

/** Datum und Spalten stehen in der Datei so wie in der URL -- lesbar und von Hand editierbar. */
const storedStripSchema = z.object({
  templateId: z.string().min(1),
  date: z.string().transform((raw) => parseDateChoice(raw)),
  hidden: z.array(z.string()),
});

export const savedSheetSchema = z.object({
  schemaVersion: z.literal(SHEET_SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string(),
  columns: z
    .number()
    .int()
    .transform((n): ColumnCount => (isColumnCount(n) ? n : DEFAULT_COLUMNS)),
  strips: z.array(storedStripSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SavedSheet = z.infer<typeof savedSheetSchema>;

/** Was die Uebersicht braucht -- ohne die Streifen selbst. */
export interface SheetSummary {
  id: SheetId;
  name: string;
  stripCount: number;
  updatedAt: string;
}

export function createSavedSheet(
  name: string,
  strips: StripSpec[],
  columns: ColumnCount,
  now = new Date(),
): SavedSheet {
  return {
    schemaVersion: SHEET_SCHEMA_VERSION,
    id: newId(),
    name: name.trim() || "Bogen",
    columns,
    strips: copyStrips(strips),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/** Neuer Stand eines vorhandenen Bogens -- ID und Anlagedatum bleiben. */
export function updateSavedSheet(
  sheet: SavedSheet,
  strips: StripSpec[],
  columns: ColumnCount,
  now = new Date(),
): SavedSheet {
  return { ...sheet, columns, strips: copyStrips(strips), updatedAt: now.toISOString() };
}

export function toSheetSummary(sheet: SavedSheet): SheetSummary {
  return {
    id: sheet.id,
    name: sheet.name,
    stripCount: sheet.strips.length,
    updatedAt: sheet.updatedAt,
  };
}

/** Weicht der Bogen in der Vorschau vom gespeicherten Stand ab? */
export function differsFrom(sheet: SavedSheet, strips: StripSpec[], columns: ColumnCount): boolean {
  return sheet.columns !== columns || serializeStrips(sheet.strips) !== serializeStrips(strips);
}

/** Adresse, unter der die Vorschau diesen Bogen oeffnet und weiter an ihn gebunden bleibt. */
export function savedSheetHref(sheet: SavedSheet): string {
  const params = new URLSearchParams({
    bogen: sheet.id,
    ids: serializeStrips(sheet.strips),
    cols: String(sheet.columns),
  });
  return `/print?${params}`;
}

/** Die Dateiform: Datum zurueck in seine Textgestalt (`heute`, `in3`, `2026-09-17`). */
export function toStoredSheet(sheet: SavedSheet): unknown {
  return {
    ...sheet,
    strips: sheet.strips.map((strip) => ({ ...strip, date: serializeDateChoice(strip.date) })),
  };
}

function copyStrips(strips: StripSpec[]): StripSpec[] {
  return strips.map((strip) => ({ ...strip, hidden: [...strip.hidden] }));
}
