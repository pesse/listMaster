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
 *
 * `extra` sind Zeilen, die nur auf *diesem* Streifen dazukommen -- die
 * Basisliste plus ein paar einmalige Zusaetze fuer einen Tag. Sie stehen als
 * Klartext in der URL und kommen nie in die Vorlage.
 */
export interface StripSpec {
  templateId: TemplateId;
  date: DateChoice;
  hidden: (SectionId | ItemId)[];
  extra: string[];
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
/**
 * Eine Zusatzzeile steht wie eine verborgene ID hinter einem `*`, aber mit
 * `_` davor -- UUIDs beginnen nie damit, und `_` bleibt in der URL unkodiert.
 * Im Text selbst werden nur die Trenner `,` und `*` (und `%`) maskiert.
 */
const EXTRA = "_";

function escapeExtra(text: string): string {
  return text.replace(/[%,*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function unescapeExtra(raw: string): string {
  return raw.replace(/%(25|2C|2A)/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Die Zusatzzeilen erscheinen als eigener Abschnitt am Ende des Streifens.
 * Seine ID und die seiner Punkte sind synthetisch und nur in der Vorschau
 * gueltig -- `removeFromStrip` erkennt sie am Praefix.
 */
export const EXTRA_SECTION_ID = "zusatz";
const EXTRA_ITEM_PREFIX = `${EXTRA_SECTION_ID}:`;

/** Ohne Angabe traegt ein neuer Streifen das Datum von heute. */
export function createStrip(
  templateId: TemplateId,
  date: DateChoice = { kind: "today" },
): StripSpec {
  return { templateId, date, hidden: [], extra: [] };
}

export function parseStrips(raw: string | null): StripSpec[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => {
      const [head, ...rest] = part.split(HIDDEN).map((piece) => piece.trim());
      const cut = head.indexOf(DATE);
      return {
        templateId: cut === -1 ? head : head.slice(0, cut),
        date: parseDateChoice(cut === -1 ? null : head.slice(cut + 1)),
        hidden: rest.filter((id) => id !== "" && !id.startsWith(EXTRA)),
        extra: rest
          .filter((piece) => piece.startsWith(EXTRA))
          .map((piece) => unescapeExtra(piece.slice(EXTRA.length)).trim())
          .filter((text) => text !== ""),
      };
    })
    .filter((strip) => strip.templateId !== "");
}

export function serializeStrips(strips: StripSpec[]): string {
  return strips
    .map((strip) => {
      const datum = serializeDateChoice(strip.date);
      const head = datum ? `${strip.templateId}${DATE}${datum}` : strip.templateId;
      const extra = strip.extra.map((text) => EXTRA + escapeExtra(text));
      return [head, ...strip.hidden, ...extra].join(HIDDEN);
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

/** Haengt eine einmalige Zeile an -- nur an diesen Streifen, nie an die Vorlage. */
export function addExtra(strip: StripSpec, text: string): StripSpec {
  const line = text.trim();
  return line ? { ...strip, extra: [...strip.extra, line] } : strip;
}

/**
 * Das ✕ in der Vorschau: eine Zusatzzeile wird geloescht (sie existiert nur
 * hier), der Zusatz-Abschnitt nimmt alle mit, alles andere wird ausgeblendet.
 */
export function removeFromStrip(strip: StripSpec, id: SectionId | ItemId): StripSpec {
  if (id === EXTRA_SECTION_ID) return { ...strip, extra: [] };
  if (id.startsWith(EXTRA_ITEM_PREFIX)) {
    const index = Number(id.slice(EXTRA_ITEM_PREFIX.length));
    return { ...strip, extra: strip.extra.filter((_, i) => i !== index) };
  }
  return toggleHidden(strip, id);
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
 *
 * Zusatzzeilen kommen als eigener Abschnitt ans Ende. Hat der letzte
 * Abschnitt davor eine Ueberschrift, bekommen sie ihre eigene -- sonst
 * stuende das Brot unter "Getraenke".
 */
export function visibleTemplate(
  template: ChecklistTemplate,
  strip: StripSpec,
): ChecklistTemplate {
  if (strip.hidden.length === 0 && strip.extra.length === 0) return template;
  const sections = template.sections.flatMap((section) => {
    if (isHidden(strip, section.id)) return [];
    const items = section.items.filter((item) => !isHidden(strip, item.id));
    return items.length > 0 || section.items.length === 0 ? [{ ...section, items }] : [];
  });
  if (strip.extra.length > 0) {
    sections.push({
      id: EXTRA_SECTION_ID,
      title: sections.at(-1)?.title.trim() ? "Zusaetzlich" : "",
      items: strip.extra.map((text, i) => ({ id: `${EXTRA_ITEM_PREFIX}${i}`, text })),
    });
  }
  return { ...template, sections };
}
