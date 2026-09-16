import { describe, expect, it } from "vitest";
import {
  countItems,
  createTemplate,
  duplicateTemplate,
  moveInArray,
  prepareForSave,
} from "../../src/lib/model/template";
import type { ChecklistTemplate } from "../../src/lib/model/types";

function sample(): ChecklistTemplate {
  const t = createTemplate("Hausuebergabe");
  t.sections = [
    {
      id: "sec-1",
      title: "Kueche",
      items: [
        { id: "item-1", text: "Zaehlerstand notieren" },
        { id: "item-2", text: "Herd gereinigt" },
      ],
    },
    {
      id: "sec-2",
      title: "Bad",
      items: [{ id: "item-3", text: "Silikonfugen pruefen" }],
    },
  ];
  return t;
}

describe("countItems", () => {
  it("zaehlt ueber alle Abschnitte", () => {
    expect(countItems(sample())).toBe(3);
  });
});

describe("prepareForSave", () => {
  it("zaehlt die Revision hoch", () => {
    const saved = prepareForSave(sample());
    expect(saved.revision).toBe(1);
    expect(prepareForSave(saved).revision).toBe(2);
  });

  it("verwirft leere Punkte, die der Editor als Eingabeschlitz haelt", () => {
    const t = sample();
    t.sections[0].items.push({ id: "leer", text: "   " });
    expect(countItems(prepareForSave(t))).toBe(3);
  });

  it("verwirft leere Abschnitte, behaelt aber benannte ohne Punkte", () => {
    const t = sample();
    t.sections.push({ id: "sec-3", title: "", items: [] });
    t.sections.push({ id: "sec-4", title: "Keller", items: [] });
    const saved = prepareForSave(t);
    expect(saved.sections.map((s) => s.id)).toEqual(["sec-1", "sec-2", "sec-4"]);
  });

  it("verwirft eine leere Beschreibung, statt \"\" zu speichern", () => {
    const t = sample();
    t.description = "   ";
    expect(prepareForSave(t).description).toBeUndefined();
  });

  it("laesst die IDs bestehender Punkte unangetastet", () => {
    const saved = prepareForSave(sample());
    expect(saved.sections[0].items.map((i) => i.id)).toEqual(["item-1", "item-2"]);
  });
});

describe("duplicateTemplate", () => {
  it("vergibt fuer Vorlage, Abschnitte und Punkte neue IDs", () => {
    const original = sample();
    const copy = duplicateTemplate(original);

    expect(copy.id).not.toBe(original.id);
    expect(copy.sections.map((s) => s.id)).not.toEqual(original.sections.map((s) => s.id));

    const originalItemIds = original.sections.flatMap((s) => s.items.map((i) => i.id));
    const copyItemIds = copy.sections.flatMap((s) => s.items.map((i) => i.id));
    expect(copyItemIds.filter((id) => originalItemIds.includes(id))).toEqual([]);
  });

  it("uebernimmt Inhalte und setzt die Revision zurueck", () => {
    const copy = duplicateTemplate(sample());
    expect(copy.name).toBe("Hausuebergabe (Kopie)");
    expect(copy.revision).toBe(0);
    expect(copy.sections[0].items[0].text).toBe("Zaehlerstand notieren");
  });
});

describe("moveInArray", () => {
  it("verschiebt ein Element", () => {
    expect(moveInArray(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("gibt bei Indizes ausserhalb des Bereichs das Original zurueck", () => {
    const items = ["a", "b"];
    expect(moveInArray(items, 0, -1)).toBe(items);
    expect(moveInArray(items, 1, 5)).toBe(items);
  });
});
