import type { DocumentCodec, DocumentStore } from "./types";

/**
 * localStorage-Store fuer `vite dev` im normalen Browser -- und zugleich
 * der Adapter, den eine spaetere PWA-Variante nutzen wuerde.
 */

export function createBrowserStore<Doc extends { id: string; name: string }, Summary extends { name: string }>(
  codec: DocumentCodec<Doc, Summary>,
  storage: Storage = localStorage,
): DocumentStore<Doc, Summary> {
  const prefix = codec.keyPrefix;
  const keyFor = (id: string) => `${prefix}${id}`;

  return {
    async list(): Promise<Summary[]> {
      const summaries: Summary[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(prefix)) continue;
        try {
          summaries.push(codec.toSummary(codec.deserialize(storage.getItem(key) ?? "", key)));
        } catch (error) {
          console.error(`${codec.label} ${key} uebersprungen:`, error);
        }
      }
      return summaries.sort((a, b) => a.name.localeCompare(b.name, "de"));
    },

    async load(id: string): Promise<Doc | null> {
      const text = storage.getItem(keyFor(id));
      return text === null ? null : codec.deserialize(text, keyFor(id));
    },

    async save(doc: Doc): Promise<Doc> {
      storage.setItem(keyFor(doc.id), codec.serialize(doc));
      return doc;
    },

    async remove(id: string): Promise<void> {
      storage.removeItem(keyFor(id));
    },
  };
}
