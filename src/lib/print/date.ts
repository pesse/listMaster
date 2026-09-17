/**
 * Datum im Streifenkopf.
 *
 * Die Wahl steht -- wie der ganze Bogen -- in der URL (`&datum=heute`).
 * Deshalb sind "heute" und "morgen" bewusst *keine* festen Tage, sondern
 * werden erst beim Rendern aufgeloest: ein als Lesezeichen abgelegter
 * Bogen druckt morgen das Datum von morgen, nicht das von heute.
 *
 * Gerechnet wird durchgehend in Ortszeit. `toISOString()` waere hier
 * falsch -- es verschiebt in UTC und macht aus dem 17. abends den 16.
 */

/** ISO-Tag `YYYY-MM-DD` -- ohne Uhrzeit, ohne Zeitzone. */
export type IsoDay = string;

export type DateChoice =
  | { kind: "none" }
  | { kind: "today" }
  | { kind: "tomorrow" }
  | { kind: "fixed"; day: IsoDay };

export const NO_DATE: DateChoice = { kind: "none" };

const TODAY = "heute";
const TOMORROW = "morgen";
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toIsoDay(date: Date): IsoDay {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Ist das ein realer Tag? `2026-02-31` ist es nicht. */
export function isIsoDay(value: string): value is IsoDay {
  const match = ISO_DAY.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return toIsoDay(date) === value;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Unbekannte oder verrutschte Werte bedeuten "kein Datum" -- nie ein Fehler. */
export function parseDateChoice(raw: string | null): DateChoice {
  if (!raw) return NO_DATE;
  const value = raw.trim().toLowerCase();
  if (value === TODAY) return { kind: "today" };
  if (value === TOMORROW) return { kind: "tomorrow" };
  return isIsoDay(value) ? { kind: "fixed", day: value } : NO_DATE;
}

/** Leerer String = der Parameter gehoert nicht in die URL. */
export function serializeDateChoice(choice: DateChoice): string {
  switch (choice.kind) {
    case "today":
      return TODAY;
    case "tomorrow":
      return TOMORROW;
    case "fixed":
      return choice.day;
    default:
      return "";
  }
}

/** Welcher Tag wird gedruckt? `null`, wenn kein Datum gewuenscht ist. */
export function resolveDay(choice: DateChoice, now = new Date()): IsoDay | null {
  switch (choice.kind) {
    case "today":
      return toIsoDay(now);
    case "tomorrow":
      return toIsoDay(addDays(now, 1));
    case "fixed":
      return choice.day;
    default:
      return null;
  }
}

/** Papierformat: kurz und ohne fuehrende Null-Ueberraschungen -- `17.09.26`. */
export function formatDay(day: IsoDay): string {
  const match = ISO_DAY.exec(day);
  if (!match) return day;
  const [, year, month, dayOfMonth] = match;
  return `${dayOfMonth}.${month}.${year.slice(2)}`;
}

/** Was im Streifenkopf steht -- `null`, wenn dort kein Datum steht. */
export function printedDate(choice: DateChoice, now = new Date()): string | null {
  const day = resolveDay(choice, now);
  return day === null ? null : formatDay(day);
}
