import { createBrowserStore } from "./browser";
import { sheetCodec, templateCodec } from "./codecs";
import { createTauriFsStore } from "./tauri-fs";
import type { SheetStore, TemplateStore } from "./types";

export type { SheetStore, TemplateStore } from "./types";
export { StorageError } from "./types";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let store: TemplateStore | null = null;
let sheetStore: SheetStore | null = null;

/**
 * Einziger Einstiegspunkt der UI in die Persistenz der Vorlagen. Ein
 * spaeterer HTTP-Store wird hier eingehaengt -- Routen und Komponenten
 * bleiben unveraendert, weil sie nur `TemplateStore` kennen.
 */
export function getStore(): TemplateStore {
  if (!store) {
    store = isTauri() ? createTauriFsStore(templateCodec) : createBrowserStore(templateCodec);
  }
  return store;
}

/** Dasselbe fuer gespeicherte Druckboegen. */
export function getSheetStore(): SheetStore {
  if (!sheetStore) {
    sheetStore = isTauri() ? createTauriFsStore(sheetCodec) : createBrowserStore(sheetCodec);
  }
  return sheetStore;
}

/** Fuer Tests: Stores durch Doppelgaenger ersetzen. */
export function setStore(replacement: TemplateStore | null): void {
  store = replacement;
}

export function setSheetStore(replacement: SheetStore | null): void {
  sheetStore = replacement;
}
