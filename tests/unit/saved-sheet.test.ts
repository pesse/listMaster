import { describe, expect, it } from "vitest";
import { createStrip, type StripSpec } from "../../src/lib/print/sheet";
import {
  createSavedSheet,
  differsFrom,
  savedSheetHref,
  toSheetSummary,
  updateSavedSheet,
} from "../../src/lib/print/saved-sheet";
import { deserializeSheet, fileNameFor, serializeSheet } from "../../src/lib/storage/json";
import { StorageError } from "../../src/lib/storage/types";

const woche: StripSpec[] = [
  createStrip("a"),
  createStrip("a", { kind: "tomorrow" }),
  { templateId: "a", date: { kind: "later", days: 2 }, hidden: ["s1", "i7"] },
  createStrip("b", { kind: "none" }),
  createStrip("b", { kind: "fixed", day: "2026-09-17" }),
];

describe("gespeicherter Bogen", () => {
  it("ist ueber die Datei verlustfrei", () => {
    const sheet = createSavedSheet("Woche", woche, 2);
    expect(deserializeSheet(serializeSheet(sheet))).toEqual(sheet);
  });

  it("speichert die Datumswahl lesbar wie in der URL, nicht den aufgeloesten Tag", () => {
    const stored = JSON.parse(serializeSheet(createSavedSheet("Woche", woche, 3)));
    expect(stored.strips.map((s: { date: string }) => s.date)).toEqual([
      "heute",
      "morgen",
      "in2",
      "",
      "2026-09-17",
    ]);
  });

  it("kopiert die Streifen, statt sie mit der Vorschau zu teilen", () => {
    const strips = [createStrip("a")];
    const sheet = createSavedSheet("x", strips, 3);
    strips[0].hidden.push("s1");
    expect(sheet.strips[0].hidden).toEqual([]);
  });

  it("behaelt beim Aktualisieren ID und Anlagedatum", () => {
    const sheet = createSavedSheet("Woche", woche, 3, new Date(2026, 0, 1));
    const next = updateSavedSheet(sheet, woche.slice(0, 2), 2, new Date(2026, 0, 8));
    expect(next.id).toBe(sheet.id);
    expect(next.createdAt).toBe(sheet.createdAt);
    expect(next.updatedAt).not.toBe(sheet.updatedAt);
    expect(next.strips).toHaveLength(2);
    expect(next.columns).toBe(2);
  });

  it("erkennt Abweichungen der Vorschau", () => {
    const sheet = createSavedSheet("Woche", woche, 3);
    expect(differsFrom(sheet, woche, 3)).toBe(false);
    expect(differsFrom(sheet, woche, 2)).toBe(true);
    expect(differsFrom(sheet, woche.slice(1), 3)).toBe(true);
    expect(differsFrom(sheet, [...woche.slice(0, 4), createStrip("b")], 3)).toBe(true);
  });

  it("oeffnet sich unter einer Adresse, die ihn wieder bindet", () => {
    const sheet = createSavedSheet("Woche", woche.slice(0, 2), 2);
    const params = new URL(savedSheetHref(sheet), "http://x").searchParams;
    expect(params.get("bogen")).toBe(sheet.id);
    expect(params.get("ids")).toBe("a.heute,a.morgen");
    expect(params.get("cols")).toBe("2");
  });

  it("faellt bei leerem Namen auf einen Standard zurueck", () => {
    expect(createSavedSheet("  ", [], 3).name).toBe("Bogen");
  });

  it("fasst sich fuer die Uebersicht zusammen", () => {
    const sheet = createSavedSheet("Woche", woche, 3);
    expect(toSheetSummary(sheet)).toMatchObject({ id: sheet.id, name: "Woche", stripCount: 5 });
  });

  it("bekommt einen lesbaren Dateinamen mit ID", () => {
    const sheet = createSavedSheet("Woche Noah", [], 3);
    expect(fileNameFor(sheet)).toBe(`woche-noah.${sheet.id}.json`);
  });
});

describe("deserializeSheet", () => {
  it("lehnt Kaputtes mit Quellenangabe ab", () => {
    expect(() => deserializeSheet("{nope", "w.json")).toThrow(StorageError);
    expect(() => deserializeSheet(JSON.stringify({ schemaVersion: 1, id: "x" }), "w.json")).toThrow(
      /w\.json: kein gueltiger Druckbogen/,
    );
  });

  it("verzeiht von Hand verrutschte Werte: unbekanntes Datum, falsche Spaltenzahl", () => {
    const sheet = createSavedSheet("Woche", [createStrip("a")], 3);
    const stored = JSON.parse(serializeSheet(sheet));
    stored.columns = 9;
    stored.strips[0].date = "uebermorgen";
    const read = deserializeSheet(JSON.stringify(stored));
    expect(read.columns).toBe(3);
    expect(read.strips[0].date).toEqual({ kind: "none" });
  });
});
