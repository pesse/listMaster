import { describe, expect, it } from "vitest";
import { deserialize, fileNameFor, serialize } from "../../src/lib/storage/json";
import { createTemplate } from "../../src/lib/model/template";
import { StorageError } from "../../src/lib/storage/types";

describe("serialize/deserialize", () => {
  it("ist verlustfrei", () => {
    const t = createTemplate("Reise-Packliste");
    expect(deserialize(serialize(t))).toEqual(t);
  });

  it("lehnt kaputtes JSON mit Quellenangabe ab", () => {
    expect(() => deserialize("{nope", "a.json")).toThrow(StorageError);
    expect(() => deserialize("{nope", "a.json")).toThrow(/a\.json/);
  });

  it("lehnt strukturell falsche Dateien ab", () => {
    const broken = JSON.stringify({ schemaVersion: 1, id: "x", name: "y" });
    expect(() => deserialize(broken, "b.json")).toThrow(/keine gueltige Checklisten-Vorlage/);
  });

  it("ergaenzt die Schema-Version bei Dateien aus der Fruehphase", () => {
    const t = createTemplate("Alt");
    const { schemaVersion, ...withoutVersion } = t;
    expect(deserialize(JSON.stringify(withoutVersion)).schemaVersion).toBe(1);
  });
});

describe("fileNameFor", () => {
  it("baut einen lesbaren Slug mit ID-Suffix", () => {
    const t = createTemplate("Hausübergabe Groß & Klein");
    expect(fileNameFor(t)).toBe(`hausuebergabe-gross-klein.${t.id}.json`);
  });

  it("faellt auf einen Standardnamen zurueck, wenn nichts uebrig bleibt", () => {
    const t = createTemplate("!!!");
    expect(fileNameFor(t)).toBe(`checkliste.${t.id}.json`);
  });
});
