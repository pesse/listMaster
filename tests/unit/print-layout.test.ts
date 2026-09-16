import { describe, expect, it } from "vitest";
import {
  COLUMN_HEIGHT_MM,
  estimateStripHeightMm,
  fitsInColumn,
  parseColumns,
  parseStripIds,
  serializeStripIds,
} from "../../src/lib/print/layout";
import { createTemplate } from "../../src/lib/model/template";
import type { ChecklistTemplate } from "../../src/lib/model/types";

let counter = 0;
const item = (text: string) => ({ id: `i${counter++}`, text });

/** Nachbau der ersten echten Liste: 4 Abschnitte, 10 Punkte, erster ohne Titel. */
function noahTodo(): ChecklistTemplate {
  const t = createTemplate("Noah Todo");
  t.sections = [
    { id: "s0", title: "", items: [item("Blaettle-Sachen"), item("Schulsachen")] },
    { id: "s1", title: "Bad", items: [item("Kleider"), item("Klorollen in Muell")] },
    {
      id: "s2",
      title: "Zimmer",
      items: [item("Kleider"), item("Muell"), item("Geschirr"), item("Leere Dosen")],
    },
    { id: "s3", title: "Gang", items: [item("Geschirr"), item("Muell")] },
  ];
  return t;
}

describe("estimateStripHeightMm", () => {
  it("haelt eine kurze Alltagsliste weit unter einer Spaltenhoehe", () => {
    expect(estimateStripHeightMm(noahTodo())).toBeLessThan(COLUMN_HEIGHT_MM / 2);
    expect(fitsInColumn(noahTodo())).toBe(true);
  });

  it("waechst mit der Zahl der Punkte", () => {
    const small = createTemplate("klein");
    small.sections = [{ id: "s", title: "", items: [item("a")] }];
    const big = createTemplate("gross");
    big.sections = [{ id: "s", title: "", items: Array.from({ length: 20 }, () => item("x")) }];
    expect(estimateStripHeightMm(big)).toBeGreaterThan(estimateStripHeightMm(small));
  });

  it("erkennt eine Liste, die keine Spalte mehr am Stueck fuellt", () => {
    const huge = createTemplate("lang");
    huge.sections = [{ id: "s", title: "", items: Array.from({ length: 80 }, () => item("x")) }];
    expect(fitsInColumn(huge)).toBe(false);
  });
});

describe("parseStripIds", () => {
  it("erhaelt Wiederholungen -- derselbe Streifen mehrfach ist gewollt", () => {
    expect(parseStripIds("a,b,a")).toEqual(["a", "b", "a"]);
  });

  it("verkraftet leere und verrutschte Eingaben", () => {
    expect(parseStripIds(null)).toEqual([]);
    expect(parseStripIds("")).toEqual([]);
    expect(parseStripIds(" a , ,b ")).toEqual(["a", "b"]);
  });

  it("ist zu serializeStripIds rund", () => {
    const ids = ["a", "b", "a"];
    expect(parseStripIds(serializeStripIds(ids))).toEqual(ids);
  });
});

describe("parseColumns", () => {
  it("nimmt 1, 2 und 3", () => {
    expect(parseColumns("1")).toBe(1);
    expect(parseColumns("2")).toBe(2);
    expect(parseColumns("3")).toBe(3);
  });

  it("faellt bei Unsinn auf den Standard zurueck", () => {
    expect(parseColumns("0")).toBe(3);
    expect(parseColumns("7")).toBe(3);
    expect(parseColumns("abc")).toBe(3);
    expect(parseColumns(null)).toBe(3);
  });
});
