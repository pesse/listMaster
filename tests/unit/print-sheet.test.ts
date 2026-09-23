import { describe, expect, it } from "vitest";
import {
  createStrip,
  hiddenItems,
  isHidden,
  parseStrips,
  serializeStrips,
  printHref,
  setDate,
  toggleHidden,
  visibleTemplate,
} from "../../src/lib/print/sheet";
import { NO_DATE } from "../../src/lib/print/date";
import { createTemplate } from "../../src/lib/model/template";
import type { ChecklistTemplate } from "../../src/lib/model/types";

function sample(): ChecklistTemplate {
  const t = createTemplate("Reise");
  t.sections = [
    { id: "s1", title: "Kulturbeutel", items: [{ id: "i1", text: "Zahnbuerste" }] },
    {
      id: "s2",
      title: "Technik",
      items: [
        { id: "i2", text: "Ladekabel" },
        { id: "i4", text: "Kopfhoerer" },
      ],
    },
    { id: "s3", title: "Papiere", items: [{ id: "i3", text: "Ausweis" }] },
  ];
  return t;
}

describe("parseStrips", () => {
  it("erhaelt Wiederholungen -- derselbe Streifen mehrfach ist gewollt", () => {
    expect(parseStrips("a,b,a").map((s) => s.templateId)).toEqual(["a", "b", "a"]);
  });

  it("liest die ausgeblendeten Abschnitte hinter dem Sternchen", () => {
    expect(parseStrips("a*s1*s3,b")).toEqual([
      { templateId: "a", date: NO_DATE, hidden: ["s1", "s3"] },
      { templateId: "b", date: NO_DATE, hidden: [] },
    ]);
  });

  it("liest das Datum hinter dem Punkt", () => {
    expect(parseStrips("a.heute*s1,b.2026-09-17,c")).toEqual([
      { templateId: "a", date: { kind: "today" }, hidden: ["s1"] },
      { templateId: "b", date: { kind: "fixed", day: "2026-09-17" }, hidden: [] },
      { templateId: "c", date: NO_DATE, hidden: [] },
    ]);
  });

  it("haelt Datum und Ausblendung am Streifen, nicht an der Vorlage", () => {
    const strips = parseStrips("a.morgen*s1,a");
    expect(strips[0]).toEqual({ templateId: "a", date: { kind: "tomorrow" }, hidden: ["s1"] });
    expect(strips[1]).toEqual({ templateId: "a", date: NO_DATE, hidden: [] });
  });

  it("verkraftet leere und verrutschte Eingaben", () => {
    expect(parseStrips(null)).toEqual([]);
    expect(parseStrips("")).toEqual([]);
    expect(parseStrips(" a , ,b ").map((s) => s.templateId)).toEqual(["a", "b"]);
    expect(parseStrips("a*")).toEqual([{ templateId: "a", date: NO_DATE, hidden: [] }]);
    expect(parseStrips("a.")).toEqual([{ templateId: "a", date: NO_DATE, hidden: [] }]);
    expect(parseStrips("a.uebermorgen")).toEqual([
      { templateId: "a", date: NO_DATE, hidden: [] },
    ]);
  });

  it("ist zu serializeStrips rund", () => {
    const raw = "a.heute*s1*s2,b,a.2026-09-17";
    expect(serializeStrips(parseStrips(raw))).toBe(raw);
  });

  it("laesst die Vorlagen-ID unberuehrt, wenn kein Datum gesetzt ist", () => {
    expect(serializeStrips([createStrip("a", NO_DATE)])).toBe("a");
  });
});

describe("createStrip", () => {
  it("traegt ohne Angabe das Datum von heute", () => {
    expect(createStrip("a").date).toEqual({ kind: "today" });
    expect(serializeStrips([createStrip("a")])).toBe("a.heute");
  });

  it("fuehrt von der Uebersicht auf einen Bogen fuer heute", () => {
    expect(printHref("a")).toBe("/print?ids=a.heute");
  });
});

describe("setDate", () => {
  it("setzt das Datum nur auf diesem Streifen", () => {
    const strip = createStrip("a", NO_DATE);
    const morgen = setDate(strip, { kind: "tomorrow" });
    expect(morgen.date).toEqual({ kind: "tomorrow" });
    expect(strip.date).toEqual(NO_DATE);
  });
});

describe("toggleHidden", () => {
  it("blendet aus und wieder ein", () => {
    const strip = createStrip("a");
    const ohneTechnik = toggleHidden(strip, "s2");
    expect(isHidden(ohneTechnik, "s2")).toBe(true);
    expect(isHidden(toggleHidden(ohneTechnik, "s2"), "s2")).toBe(false);
  });

  it("laesst den urspruenglichen Streifen unberuehrt", () => {
    const strip = createStrip("a");
    toggleHidden(strip, "s2");
    expect(strip.hidden).toEqual([]);
  });

  it("nimmt einzelne Punkte und haelt sie in der URL", () => {
    const strip = toggleHidden(createStrip("a"), "i2");
    expect(serializeStrips([strip])).toBe("a.heute*i2");
    expect(parseStrips("a.heute*i2")[0].hidden).toEqual(["i2"]);
  });
});

describe("visibleTemplate", () => {
  it("laesst die ausgeblendeten Abschnitte weg", () => {
    const visible = visibleTemplate(sample(), { templateId: "a", date: NO_DATE, hidden: ["s2"] });
    expect(visible.sections.map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  it("laesst einzeln entfernte Punkte weg", () => {
    const visible = visibleTemplate(sample(), { templateId: "a", date: NO_DATE, hidden: ["i2"] });
    expect(visible.sections.map((s) => s.items.map((i) => i.id))).toEqual([["i1"], ["i4"], ["i3"]]);
  });

  it("laesst einen Abschnitt weg, dessen Punkte alle entfernt sind", () => {
    const visible = visibleTemplate(sample(), { templateId: "a", date: NO_DATE, hidden: ["i1"] });
    expect(visible.sections.map((s) => s.id)).toEqual(["s2", "s3"]);
  });

  it("behaelt Abschnitte, die schon in der Vorlage leer sind", () => {
    const template = sample();
    template.sections.push({ id: "s4", title: "Leer", items: [] });
    const visible = visibleTemplate(template, { templateId: "a", date: NO_DATE, hidden: ["i1"] });
    expect(visible.sections.map((s) => s.id)).toEqual(["s2", "s3", "s4"]);
  });

  it("uebergeht IDs geloeschter Abschnitte", () => {
    const visible = visibleTemplate(sample(), { templateId: "a", date: NO_DATE, hidden: ["weg"] });
    expect(visible.sections).toHaveLength(3);
  });

  it("aendert die Vorlage selbst nicht", () => {
    const template = sample();
    visibleTemplate(template, { templateId: "a", date: NO_DATE, hidden: ["s1", "s2", "i3"] });
    expect(template.sections).toHaveLength(3);
    expect(template.sections[2].items).toHaveLength(1);
  });
});

describe("hiddenItems", () => {
  it("nennt die entfernten Punkte in Vorlagenreihenfolge", () => {
    const strip = { templateId: "a", date: NO_DATE, hidden: ["i3", "i2"] };
    expect(hiddenItems(sample(), strip).map((i) => i.id)).toEqual(["i2", "i3"]);
  });

  it("verschweigt Punkte eines ohnehin ausgeblendeten Abschnitts", () => {
    const strip = { templateId: "a", date: NO_DATE, hidden: ["s2", "i2"] };
    expect(hiddenItems(sample(), strip)).toEqual([]);
  });
});
