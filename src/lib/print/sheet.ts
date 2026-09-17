import type { ChecklistTemplate, SectionId, TemplateId } from "../model/types";
import { NO_DATE, parseDateChoice, serializeDateChoice, type DateChoice } from "./date";

/**
 * Was auf dem Bogen steht: die Folge der Streifen, jeder mit seiner
 * Vorlage, seinem Datum und den Abschnitten, die auf *diesem* Streifen
 * nicht gedruckt werden sollen.
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
 * Verborgene Abschnitte stehen als stabile `SectionId` in der URL, nicht
 * als Position. Damit ueberlebt ein Lesezeichen das Umsortieren der
 * Vorlage; wird ein Abschnitt geloescht, laeuft seine ID einfach ins Leere.
 */
export interface StripSpec {
  templateId: TemplateId;
  date: DateChoice;
  hidden: SectionId[];
}

/**
 * Trennzeichen der Streifen-Angabe: `<Vorlage>.<Datum>*<Abschnitt>*…`
 *
 * `.` und `*` ueberleben `URLSearchParams` unkodiert -- ein `!` oder `~`
 * stuende als `%21`/`%7E` in der Adresszeile und machte das Lesezeichen
 * unleserlich. Als Trenner taugen sie, weil UUIDs nur Hex und `-`
 * enthalten und die Datumswerte (`heute`, `morgen`, `2026-09-17`) weder
 * Punkt noch Sternchen kennen.
 */
const DATE = ".";
const HIDDEN = "*";

export function createStrip(templateId: TemplateId, date: DateChoice = NO_DATE): StripSpec {
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

export function isHidden(strip: StripSpec, sectionId: SectionId): boolean {
  return strip.hidden.includes(sectionId);
}

export function toggleSection(strip: StripSpec, sectionId: SectionId): StripSpec {
  return {
    ...strip,
    hidden: isHidden(strip, sectionId)
      ? strip.hidden.filter((id) => id !== sectionId)
      : [...strip.hidden, sectionId],
  };
}

/**
 * Die Fassung, die wirklich auf das Papier kommt. Rendern und
 * Hoehenschaetzung arbeiten beide hierauf -- sonst warnte `fitsInColumn`
 * vor einer Laenge, die gar nicht gedruckt wird.
 */
export function visibleTemplate(
  template: ChecklistTemplate,
  strip: StripSpec,
): ChecklistTemplate {
  if (strip.hidden.length === 0) return template;
  return {
    ...template,
    sections: template.sections.filter((section) => !isHidden(strip, section.id)),
  };
}
