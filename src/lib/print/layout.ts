import type { ChecklistTemplate } from "../model/types";

/**
 * Streifen-Druck: die Streifen fliessen in Spalten ueber den A4-Bogen,
 * jeder nur so hoch wie sein Inhalt und in einem eigenen Rahmen.
 * Geschnitten wird einmal aussen um den Rahmen herum.
 *
 * Den Umbruch macht der Browser (CSS `columns`), nicht dieser Code. Die
 * Masse hier dienen allein der Warnung, wenn eine Liste zu lang fuer eine
 * einzelne Spalte ist -- dann reisst der Umbruch sie auseinander.
 */

const PAGE_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 10;
/** Nutzbare Hoehe einer Spalte auf A4. */
export const COLUMN_HEIGHT_MM = PAGE_HEIGHT_MM - 2 * PAGE_MARGIN_MM;

const TITLE_BLOCK_MM = 10;
const DESCRIPTION_MM = 4.5;
const SECTION_TITLE_MM = 6.5;
const SECTION_GAP_MM = 2.5;
const ITEM_MM = 5;
const NOTE_MM = 3.5;
/** Rahmen: Innenabstand oben und unten, Linienstaerke, Abstand zum naechsten. */
const FRAME_MM = 11.5;

/** Erlaubte Spaltenzahl pro Bogen. */
export const COLUMN_COUNTS = [1, 2, 3] as const;
export type ColumnCount = (typeof COLUMN_COUNTS)[number];
export const DEFAULT_COLUMNS: ColumnCount = 3;

export function isColumnCount(value: number): value is ColumnCount {
  return (COLUMN_COUNTS as readonly number[]).includes(value);
}

export function parseColumns(raw: string | null): ColumnCount {
  const value = Number(raw);
  return isColumnCount(value) ? value : DEFAULT_COLUMNS;
}

/**
 * Grobe Hoehenschaetzung eines Streifens. Umbrueche langer Punkttexte sind
 * nicht enthalten -- der Wert warnt nur, er steuert den Druck nicht.
 *
 * Erwartet die gedruckte Fassung (`visibleTemplate`): ausgeblendete
 * Abschnitte duerfen nicht mitzaehlen. Das Datum sitzt in der Titelzeile
 * und kostet keine zusaetzliche Hoehe.
 */
export function estimateStripHeightMm(template: ChecklistTemplate): number {
  let mm = TITLE_BLOCK_MM + FRAME_MM;
  if (template.description?.trim()) mm += DESCRIPTION_MM;

  for (const section of template.sections) {
    mm += SECTION_GAP_MM;
    if (section.title.trim()) mm += SECTION_TITLE_MM;
    for (const item of section.items) {
      mm += ITEM_MM;
      if (item.note?.trim()) mm += NOTE_MM;
    }
  }
  return mm;
}

/**
 * Passt der Streifen in eine Spalte? Wenn nicht, zerlegt der
 * Spaltenumbruch ihn -- eine Checkliste waere dann nicht mehr am Stueck
 * ausschneidbar.
 */
export function fitsInColumn(template: ChecklistTemplate): boolean {
  return estimateStripHeightMm(template) <= COLUMN_HEIGHT_MM;
}
