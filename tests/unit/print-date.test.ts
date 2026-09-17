import { describe, expect, it } from "vitest";
import {
  formatDay,
  isIsoDay,
  NO_DATE,
  parseDateChoice,
  printedDate,
  resolveDay,
  serializeDateChoice,
  toIsoDay,
} from "../../src/lib/print/date";

/** 17.09.2026, spaeter Abend -- die Stunde, in der UTC-Rechnen kippen wuerde. */
const abends = new Date(2026, 8, 17, 23, 30);

describe("parseDateChoice", () => {
  it("nimmt heute, morgen und einen festen Tag", () => {
    expect(parseDateChoice("heute")).toEqual({ kind: "today" });
    expect(parseDateChoice("morgen")).toEqual({ kind: "tomorrow" });
    expect(parseDateChoice("2026-09-17")).toEqual({ kind: "fixed", day: "2026-09-17" });
  });

  it("bedeutet bei Unsinn schlicht: kein Datum", () => {
    expect(parseDateChoice(null)).toEqual(NO_DATE);
    expect(parseDateChoice("")).toEqual(NO_DATE);
    expect(parseDateChoice("uebermorgen")).toEqual(NO_DATE);
    expect(parseDateChoice("17.09.2026")).toEqual(NO_DATE);
    expect(parseDateChoice("2026-02-31")).toEqual(NO_DATE);
  });

  it("ist zu serializeDateChoice rund", () => {
    for (const raw of ["heute", "morgen", "2026-09-17"]) {
      expect(serializeDateChoice(parseDateChoice(raw))).toBe(raw);
    }
    expect(serializeDateChoice(NO_DATE)).toBe("");
  });
});

describe("resolveDay", () => {
  it("loest heute und morgen in Ortszeit auf -- auch spaet abends", () => {
    expect(resolveDay({ kind: "today" }, abends)).toBe("2026-09-17");
    expect(resolveDay({ kind: "tomorrow" }, abends)).toBe("2026-09-18");
  });

  it("springt ueber Monats- und Jahresgrenzen", () => {
    expect(resolveDay({ kind: "tomorrow" }, new Date(2026, 11, 31, 8, 0))).toBe("2027-01-01");
  });

  it("gibt den festen Tag unveraendert zurueck", () => {
    expect(resolveDay({ kind: "fixed", day: "2026-01-02" }, abends)).toBe("2026-01-02");
  });

  it("liefert ohne Datum null", () => {
    expect(resolveDay(NO_DATE, abends)).toBeNull();
  });
});

describe("formatDay", () => {
  it("druckt kurz: 17.09.26", () => {
    expect(formatDay("2026-09-17")).toBe("17.09.26");
    expect(formatDay("2027-01-01")).toBe("01.01.27");
  });
});

describe("printedDate", () => {
  it("ist das, was im Streifenkopf steht", () => {
    expect(printedDate({ kind: "today" }, abends)).toBe("17.09.26");
    expect(printedDate({ kind: "tomorrow" }, abends)).toBe("18.09.26");
    expect(printedDate(NO_DATE, abends)).toBeNull();
  });
});

describe("toIsoDay / isIsoDay", () => {
  it("bleibt in Ortszeit", () => {
    expect(toIsoDay(abends)).toBe("2026-09-17");
    expect(toIsoDay(new Date(2026, 0, 5, 0, 15))).toBe("2026-01-05");
  });

  it("erkennt reale Tage", () => {
    expect(isIsoDay("2026-09-17")).toBe(true);
    expect(isIsoDay("2026-13-01")).toBe(false);
    expect(isIsoDay("2026-9-7")).toBe(false);
  });
});
