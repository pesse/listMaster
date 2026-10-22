import type { ChecklistTemplate, TemplateSummary } from "../model/types";
import type { SavedSheet, SheetSummary } from "../print/saved-sheet";

/**
 * Die einzige Art, wie die App an gespeicherte Dokumente kommt -- Vorlagen
 * wie Druckboegen.
 *
 * Bewusst durchgehend async und auf Summary/Volltext getrennt: damit laesst
 * sich derselbe Vertrag spaeter von einem HTTP-Store gegen einen Server
 * erfuellen, ohne dass die UI davon etwas mitbekommt.
 */
export interface DocumentStore<Doc, Summary> {
  list(): Promise<Summary[]>;
  load(id: string): Promise<Doc | null>;
  save(doc: Doc): Promise<Doc>;
  remove(id: string): Promise<void>;
}

export type TemplateStore = DocumentStore<ChecklistTemplate, TemplateSummary>;
export type SheetStore = DocumentStore<SavedSheet, SheetSummary>;

/**
 * Was ein Adapter ueber eine Dokumentsorte wissen muss. Die Adapter selbst
 * kennen nur Text, Schluessel und Dateinamen -- Schema und Validierung
 * kommen von hier.
 */
export interface DocumentCodec<Doc extends { id: string; name: string }, Summary extends { name: string }> {
  /** Unterverzeichnis im AppData-Ordner, z. B. `templates`. */
  folder: string;
  /** Schluesselpraefix im localStorage, z. B. `listmaster:template:`. */
  keyPrefix: string;
  /** Fuer Meldungen: `Vorlage`, `Bogen`. */
  label: string;
  serialize(doc: Doc): string;
  /** Validiert -- wirft `StorageError` bei kaputtem Inhalt. */
  deserialize(text: string, source: string): Doc;
  toSummary(doc: Doc): Summary;
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
