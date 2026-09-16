import { createBrowserStore } from "./browser";
import { createTauriFsStore } from "./tauri-fs";
import type { TemplateStore } from "./types";

export type { TemplateStore } from "./types";
export { StorageError } from "./types";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let store: TemplateStore | null = null;

/**
 * Einziger Einstiegspunkt der UI in die Persistenz. Ein spaeterer
 * HTTP-Store wird hier eingehaengt -- Routen und Komponenten bleiben
 * unveraendert, weil sie nur `TemplateStore` kennen.
 */
export function getStore(): TemplateStore {
  if (!store) {
    store = isTauri() ? createTauriFsStore() : createBrowserStore();
  }
  return store;
}

/** Fuer Tests: Store durch einen Doppelgaenger ersetzen. */
export function setStore(replacement: TemplateStore | null): void {
  store = replacement;
}
