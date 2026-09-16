import type { ChecklistTemplate, TemplateId, TemplateSummary } from "../model/types";

/**
 * Die einzige Schnittstelle, ueber die die App an Vorlagen kommt.
 *
 * Bewusst durchgehend async und auf Summary/Volltext getrennt: damit laesst
 * sich derselbe Vertrag spaeter von einem HTTP-Store gegen einen Server
 * erfuellen, ohne dass die UI davon etwas mitbekommt.
 */
export interface TemplateStore {
  list(): Promise<TemplateSummary[]>;
  load(id: TemplateId): Promise<ChecklistTemplate | null>;
  save(template: ChecklistTemplate): Promise<ChecklistTemplate>;
  remove(id: TemplateId): Promise<void>;
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }
}
