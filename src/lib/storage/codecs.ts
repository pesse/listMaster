import { toSummary } from "../model/template";
import type { ChecklistTemplate, TemplateSummary } from "../model/types";
import { toSheetSummary, type SavedSheet, type SheetSummary } from "../print/saved-sheet";
import { deserialize, deserializeSheet, serialize, serializeSheet } from "./json";
import type { DocumentCodec } from "./types";

export const templateCodec: DocumentCodec<ChecklistTemplate, TemplateSummary> = {
  folder: "templates",
  keyPrefix: "listmaster:template:",
  label: "Vorlage",
  serialize,
  deserialize,
  toSummary,
};

export const sheetCodec: DocumentCodec<SavedSheet, SheetSummary> = {
  folder: "sheets",
  keyPrefix: "listmaster:sheet:",
  label: "Bogen",
  serialize: serializeSheet,
  deserialize: deserializeSheet,
  toSummary: toSheetSummary,
};
