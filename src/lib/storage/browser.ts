import type { ChecklistTemplate, TemplateId, TemplateSummary } from "../model/types";
import { toSummary } from "../model/template";
import { deserialize, serialize } from "./json";
import type { TemplateStore } from "./types";

/**
 * localStorage-Store fuer `vite dev` im normalen Browser -- und zugleich
 * der Adapter, den eine spaetere PWA-Variante nutzen wuerde.
 */
const PREFIX = "listmaster:template:";

export function createBrowserStore(storage: Storage = localStorage): TemplateStore {
  const keyFor = (id: TemplateId) => `${PREFIX}${id}`;

  return {
    async list(): Promise<TemplateSummary[]> {
      const summaries: TemplateSummary[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key?.startsWith(PREFIX)) continue;
        try {
          summaries.push(toSummary(deserialize(storage.getItem(key) ?? "", key)));
        } catch (error) {
          console.error(`Vorlage ${key} uebersprungen:`, error);
        }
      }
      return summaries.sort((a, b) => a.name.localeCompare(b.name, "de"));
    },

    async load(id: TemplateId): Promise<ChecklistTemplate | null> {
      const text = storage.getItem(keyFor(id));
      return text === null ? null : deserialize(text, keyFor(id));
    },

    async save(template: ChecklistTemplate): Promise<ChecklistTemplate> {
      storage.setItem(keyFor(template.id), serialize(template));
      return template;
    },

    async remove(id: TemplateId): Promise<void> {
      storage.removeItem(keyFor(id));
    },
  };
}
