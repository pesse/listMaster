import type {
  ChecklistItem,
  ChecklistTemplate,
  ItemId,
  SectionId,
  TemplateId,
} from "../model/types";
import { parseDateChoice, serializeDateChoice, type DateChoice } from "./date";

/**
 * Was auf dem Bogen steht: die Folge der Streifen, jeder mit seiner
 * Vorlage, seinem Datum und den Abschnitten, die auf *diesem* Streifen
 * nicht gedruckt werden sollen -- ganze Abschnitte wie einzelne Punkte.
 *
 * Alles davon steht in der URL (`?ids=a.heute*s1,b,a`), damit ein Bogen
 * nachladbar und als Lesezeichen wiederverwendbar ist. Zwei Folgen daraus:
 *
 * - IDs duerfen sich wiederholen -- dieselbe Liste mehrfach auf einem
 *   Bogen ist ein gewollter Fall, kein Fehler.
 * - Datum und Ausblendung haengen am Streifen, nicht an der Vorlage:
 *   derselbe Einkaufszettel kann einmal fuer heute vollstaendig und
 *   einmal fuer morgen ohne den Getraenke-Abschnitt auf demselben Bogen
 *   liegen.
 *
 * Verborgenes steht als stabile `SectionId` bzw. `ItemId` in der URL, nicht
 * als Position. Damit ueberlebt ein Lesezeichen das Umsortieren der
 * Vorlage; wird ein Abschnitt oder Punkt geloescht, laeuft seine ID einfach
 * ins Leere. Beide Sorten teilen sich eine Liste: die IDs sind UUIDs und
 * damit ueber Abschnitte und Punkte hinweg eindeutig.
 */
export interface StripSpec {
  templateId: TemplateId;
  date: DateChoice;
  hidden: (SectionId | ItemId)[];
}

/**
 * Trennzeichen der Streifen-Angabe: `<Vorlage>.<Datum>*<Abschnitt|Punkt>*…`
 *
 * `.` und `*` ueberleben `URLSearchParams` unkodiert -- ein `!` oder `~`
 * stuende als `%21`/`%7E` in der Adresszeile und machte das Lesezeichen
 * unleserlich. Als Trenner taugen sie, weil UUIDs nur Hex und `-`
 * enthalten und die Datumswerte (`heute`, `morgen`, `2026-09-17`) weder
 * Punkt noch Sternchen kennen.
 */
const DATE = ".";
const HIDDEN = "*";

/** Ohne Angabe traegt ein neuer Streifen das Datum von heute. */
export function createStrip(
  templateId: TemplateId,
  date: DateChoice = { kind: "today" },
): StripSpec {
  return { templateId, date, hidden: [] };
}

export function parseStrips(raw: string | null): StripSpec[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => {
      const [head, ...hidden] = part.split(HIDDEN).map((piece) => piece.trim());
      const cut = head.indexOf(DATE);
      return {
        templateId: cut === -1 ? head : head.slice(0, cut),
        date: parseDateChoice(cut === -1 ? null : head.slice(cut + 1)),
        hidden: hidden.filter((id) => id !== ""),
      };
    })
    .filter((strip) => strip.templateId !== "");
}

export function serializeStrips(strips: StripSpec[]): string {
  return strips
    .map((strip) => {
      const datum = serializeDateChoice(strip.date);
      const head = datum ? `${strip.templateId}${DATE}${datum}` : strip.templateId;
      return [head, ...strip.hidden].join(HIDDEN);
    })
    .join(",");
}

export function setDate(strip: StripSpec, date: DateChoice): StripSpec {
  return { ...strip, date };
}

/** Adresse fuer einen Bogen mit genau diesem einen Streifen. */
export function printHref(templateId: TemplateId): string {
  return `/print?${new URLSearchParams({ ids: serializeStrips([createStrip(templateId)]) })}`;
}

export function isHidden(strip: StripSpec, id: SectionId | ItemId): boolean {
  return strip.hidden.includes(id);
}

/** Blendet einen Abschnitt oder einen einzelnen Punkt aus -- nur auf diesem Streifen. */
export function toggleHidden(strip: StripSpec, id: SectionId | ItemId): StripSpec {
  return {
    ...strip,
    hidden: isHidden(strip, id) ? strip.hidden.filter((h) => h !== id) : [...strip.hidden, id],
  };
}

/** Die einzeln weggenommenen Punkte, in Vorlagenreihenfolge -- zum Zurueckholen. */
export function hiddenItems(template: ChecklistTemplate, strip: StripSpec): ChecklistItem[] {
  return template.sections
    .filter((section) => !isHidden(strip, section.id))
    .flatMap((section) => section.items.filter((item) => isHidden(strip, item.id)));
}

/**
 * Die Fassung, die wirklich auf das Papier kommt. Rendern und
 * Hoehenschaetzung arbeiten beide hierauf -- sonst warnte `fitsInColumn`
 * vor einer Laenge, die gar nicht gedruckt wird.
 *
 * Ein Abschnitt, dessen Punkte alle weggenommen wurden, faellt mit weg --
 * sonst stuende eine leere Zwischenueberschrift auf dem Streifen.
 */
export function visibleTemplate(
  template: ChecklistTemplate,
  strip: StripSpec,
): ChecklistTemplate {
  if (strip.hidden.length === 0) return template;
  return {
    ...template,
    sections: template.sections.flatMap((section) => {
      if (isHidden(strip, section.id)) return [];
      const items = section.items.filter((item) => !isHidden(strip, item.id));
      return items.length > 0 || section.items.length === 0 ? [{ ...section, items }] : [];
    }),
  };
}
