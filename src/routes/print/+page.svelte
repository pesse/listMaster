<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getStore } from "$lib/storage";
  import {
    COLUMN_COUNTS,
    fitsInColumn,
    parseColumns,
    type ColumnCount,
  } from "$lib/print/layout";
  import {
    createStrip,
    hiddenItems,
    isHidden,
    parseStrips,
    serializeStrips,
    setDate,
    toggleHidden,
    visibleTemplate,
    type StripSpec,
  } from "$lib/print/sheet";
  import { NO_DATE, printedDate, toIsoDay, type DateChoice } from "$lib/print/date";
  import { moveInArray } from "$lib/model/template";
  import type {
    ChecklistTemplate,
    ItemId,
    SectionId,
    TemplateId,
    TemplateSummary,
  } from "$lib/model/types";
  import "../../styles/print.css";

  /**
   * Der Bogen steht vollstaendig in der URL (`?ids=a.heute*s1,b,a&cols=3`),
   * damit er nachladbar und als Lesezeichen wiederverwendbar ist. IDs duerfen
   * sich wiederholen -- dieselbe Liste mehrfach auf einem Bogen ist gewollt,
   * und jedes Vorkommen traegt sein eigenes Datum und blendet eigene
   * Abschnitte aus.
   */
  const strips = $derived(parseStrips(page.url.searchParams.get("ids")));
  const columns = $derived(parseColumns(page.url.searchParams.get("cols")));

  const DATE_BUTTONS = [
    { kind: "none", label: "ohne", title: "kein Datum drucken" },
    { kind: "today", label: "heute", title: "beim Drucken das Datum von heute" },
    { kind: "tomorrow", label: "morgen", title: "beim Drucken das Datum von morgen" },
    { kind: "fixed", label: "Datum …", title: "festes Datum waehlen" },
  ] as const;

  let cache = $state<Record<TemplateId, ChecklistTemplate>>({});
  let summaries = $state<TemplateSummary[]>([]);
  let error = $state<string | null>(null);
  let pickerId = $state<TemplateId>("");

  /**
   * Die Streifen, wie sie wirklich aufs Papier kommen: ohne ausgeblendete
   * Abschnitte und Punkte und mit aufgeloestem Datum ("heute"/"morgen"
   * werden erst hier zu einem Tag -- siehe print/date.ts). `index` zeigt
   * zurueck auf den Streifen, damit die Vorschau ihn aendern kann.
   */
  const printable = $derived(
    strips.flatMap((strip, index) => {
      const template = cache[strip.templateId];
      return template
        ? [{ index, template: visibleTemplate(template, strip), date: printedDate(strip.date) }]
        : [];
    }),
  );
  const tooLong = $derived([
    ...new Set(printable.filter((e) => !fitsInColumn(e.template)).map((e) => e.template.name)),
  ]);

  $effect(() => {
    // Nur strips wird verfolgt; das Nachladen laeuft danach ungetrackt.
    const ids = strips.map((strip) => strip.templateId);
    (async () => {
      try {
        for (const id of new Set(ids)) {
          if (cache[id]) continue;
          const loaded = await getStore().load(id);
          if (loaded) cache = { ...cache, [id]: loaded };
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    })();
  });

  $effect(() => {
    (async () => {
      try {
        summaries = await getStore().list();
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    })();
  });

  function apply(next: StripSpec[], cols: ColumnCount = columns) {
    const params = new URLSearchParams({ ids: serializeStrips(next), cols: String(cols) });
    goto(`/print?${params}`, { replaceState: true, keepFocus: true, noScroll: true });
  }

  /**
   * Ein neuer Streifen erbt das Datum des letzten -- ein Bogen ist meist fuer
   * einen Tag. Der erste traegt "heute".
   */
  function addStrip() {
    if (!pickerId) return;
    const last = strips.at(-1);
    apply([...strips, last ? createStrip(pickerId, last.date) : createStrip(pickerId)]);
  }

  function duplicateStrip(index: number) {
    const next = [...strips];
    next.splice(index + 1, 0, { ...strips[index], hidden: [...strips[index].hidden] });
    apply(next);
  }

  function removeStrip(index: number) {
    apply(strips.filter((_, i) => i !== index));
  }

  function moveStrip(index: number, delta: number) {
    apply(moveInArray(strips, index, index + delta));
  }

  function updateStrip(index: number, change: (strip: StripSpec) => StripSpec) {
    apply(strips.map((strip, i) => (i === index ? change(strip) : strip)));
  }

  /**
   * Ein Abschnitt oder Punkt verschwindet nur von diesem einen Streifen --
   * die Vorlage bleibt unberuehrt.
   */
  function toggleOnStrip(index: number, id: SectionId | ItemId) {
    updateStrip(index, (strip) => toggleHidden(strip, id));
  }

  function chooseDateKind(index: number, kind: string) {
    const date: DateChoice =
      kind === "today" || kind === "tomorrow"
        ? { kind }
        : kind === "fixed"
          ? { kind, day: toIsoDay(new Date()) }
          : NO_DATE;
    updateStrip(index, (strip) => setDate(strip, date));
  }

  function chooseDay(index: number, day: string) {
    if (day) updateStrip(index, (strip) => setDate(strip, { kind: "fixed", day }));
  }
</script>

<div class="app no-print">
  <div class="toolbar">
    <button onclick={() => goto("/")}>← Uebersicht</button>
    <span class="spacer"></span>
    <label class="muted" for="cols">Spalten</label>
    <select
      id="cols"
      value={columns}
      onchange={(e) => apply(strips, Number(e.currentTarget.value) as ColumnCount)}
    >
      {#each COLUMN_COUNTS as count (count)}
        <option value={count}>{count}</option>
      {/each}
    </select>
    <button class="primary" onclick={() => window.print()} disabled={printable.length === 0}>
      Drucken
    </button>
  </div>

  {#if error}<p class="error">{error}</p>{/if}

  {#if tooLong.length > 0}
    <p class="error">
      Zu lang fuer eine Spalte: {tooLong.join(", ")}. Der Streifen wird beim Druck umbrochen und
      laesst sich nicht mehr am Stueck ausschneiden — weniger Spalten waehlen, Abschnitte ausblenden
      oder die Liste teilen.
    </p>
  {/if}

  <div class="card">
    <div class="toolbar" style="margin-bottom:0.5rem">
      <strong>Streifen auf dem Bogen</strong>
      <span class="spacer"></span>
      <select bind:value={pickerId}>
        <option value="">Vorlage waehlen …</option>
        {#each summaries as summary (summary.id)}
          <option value={summary.id}>{summary.name}</option>
        {/each}
      </select>
      <button onclick={addStrip} disabled={!pickerId}>+ Streifen</button>
    </div>

    {#if strips.length === 0}
      <p class="muted">Noch kein Streifen gewaehlt.</p>
    {:else}
      {#each strips as strip, index (`${strip.templateId}-${index}`)}
        {@const template = cache[strip.templateId]}
        {@const date = printedDate(strip.date)}
        <div class="strip-row">
          <div class="toolbar" style="margin-bottom:0; gap:0.25rem">
            <span class="muted">{index + 1}.</span>
            <span style="flex:1">{template?.name ?? "… wird geladen"}</span>

            <span class="chip-group" title="Datum im Kopf dieses Streifens">
              {#each DATE_BUTTONS as button (button.kind)}
                <button
                  class="chip"
                  class:on={strip.date.kind === button.kind}
                  title={button.title}
                  onclick={() => chooseDateKind(index, button.kind)}
                >
                  {button.label}
                </button>
              {/each}
              {#if strip.date.kind === "fixed"}
                <input
                  type="date"
                  value={strip.date.day}
                  onchange={(e) => chooseDay(index, e.currentTarget.value)}
                  style="width:auto"
                />
              {:else if date}
                <span class="muted" style="font-size:0.85rem">{date}</span>
              {/if}
            </span>

            <button class="icon" title="nach oben" onclick={() => moveStrip(index, -1)} disabled={index === 0}>↑</button>
            <button
              class="icon"
              title="nach unten"
              onclick={() => moveStrip(index, 1)}
              disabled={index === strips.length - 1}>↓</button
            >
            <button class="icon" title="noch einmal" onclick={() => duplicateStrip(index)}>⧉</button>
            <button class="icon danger" title="entfernen" onclick={() => removeStrip(index)}>✕</button>
          </div>

          {#if template && template.sections.length > 1}
            <div class="chips">
              {#each template.sections as section (section.id)}
                <button
                  class="chip"
                  class:off={isHidden(strip, section.id)}
                  title={isHidden(strip, section.id) ? "wieder drucken" : "auf diesem Streifen ausblenden"}
                  onclick={() => toggleOnStrip(index, section.id)}
                >
                  {isHidden(strip, section.id) ? "☐" : "☑"}
                  {section.title.trim() || "ohne Titel"}
                </button>
              {/each}
            </div>
          {/if}

          {#if template}
            {@const removed = hiddenItems(template, strip)}
            {#if removed.length > 0}
              <div class="chips">
                <span class="muted" style="font-size:0.85rem">entfernt:</span>
                {#each removed as item (item.id)}
                  <button
                    class="chip off"
                    title="wieder drucken"
                    onclick={() => toggleOnStrip(index, item.id)}
                  >
                    ↺ {item.text.trim() || "ohne Text"}
                  </button>
                {/each}
              </div>
            {/if}
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<div class="sheet">
  <div class="strips" style="--columns: {columns}">
    {#each printable as { index, template, date } (`${template.id}-${index}`)}
      <article class="strip">
        <header class="head">
          <h1>{template.name}</h1>
          {#if date}<span class="date">{date}</span>{/if}
        </header>
        {#if template.description}
          <p class="subtitle">{template.description}</p>
        {/if}

        {#each template.sections as section (section.id)}
          <section>
            {#if section.title.trim()}
              <h2>{section.title}</h2>
            {/if}
            <ul>
              {#each section.items as item (item.id)}
                <li>
                  <span class="box"></span>
                  <span>
                    {item.text}
                    {#if item.note}<span class="note">{item.note}</span>{/if}
                  </span>
                  <button
                    class="drop no-print"
                    title="nur von diesem Streifen entfernen"
                    onclick={() => toggleOnStrip(index, item.id)}>✕</button
                  >
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      </article>
    {/each}
  </div>
</div>
