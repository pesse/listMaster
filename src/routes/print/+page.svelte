<script lang="ts">
  import { untrack } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getSheetStore, getStore } from "$lib/storage";
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
  import {
    daysAhead,
    inDays,
    nextDay,
    NO_DATE,
    printedDate,
    toIsoDay,
    type DateChoice,
  } from "$lib/print/date";
  import {
    createSavedSheet,
    differsFrom,
    savedSheetHref,
    updateSavedSheet,
    type SavedSheet,
  } from "$lib/print/saved-sheet";
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
   *
   * `bogen=<id>` bindet die Vorschau an einen gespeicherten Bogen. Die URL
   * bleibt trotzdem die Quelle der Wahrheit -- der gespeicherte Stand dient
   * nur dem Vergleich ("ungespeichert") und dem Zurueckschreiben.
   */
  const strips = $derived(parseStrips(page.url.searchParams.get("ids")));
  const columns = $derived(parseColumns(page.url.searchParams.get("cols")));
  const sheetId = $derived(page.url.searchParams.get("bogen"));

  const DATE_BUTTONS = [
    { kind: "none", label: "ohne", title: "kein Datum drucken" },
    { kind: "today", label: "heute", title: "beim Drucken das Datum von heute" },
    { kind: "tomorrow", label: "morgen", title: "beim Drucken das Datum von morgen" },
    {
      kind: "later",
      label: "in … Tagen",
      title: "relativ zum Drucktag -- ein gespeicherter Wochenplan rueckt jede Woche mit",
    },
    { kind: "fixed", label: "Datum …", title: "festes Datum waehlen" },
  ] as const;

  let cache = $state<Record<TemplateId, ChecklistTemplate>>({});
  let summaries = $state<TemplateSummary[]>([]);
  let error = $state<string | null>(null);
  let pickerId = $state<TemplateId>("");
  /** Vorlagen, die es nicht mehr gibt -- ein gespeicherter Bogen kann sie noch nennen. */
  let missing = $state<Record<TemplateId, true>>({});

  let saved = $state<SavedSheet | null>(null);
  let sheetName = $state("");
  let saving = $state(false);
  const dirty = $derived(
    saved !== null && (sheetName.trim() !== saved.name || differsFrom(saved, strips, columns)),
  );

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
          if (cache[id] || missing[id]) continue;
          const loaded = await getStore().load(id);
          if (loaded) cache = { ...cache, [id]: loaded };
          else missing = { ...missing, [id]: true };
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

  $effect(() => {
    // Nur sheetId wird verfolgt: ein anderer Bogen wird geladen, ein
    // Wechsel der Streifen laesst den gespeicherten Stand in Ruhe.
    const id = sheetId;
    (async () => {
      if (!id) {
        saved = null;
        return;
      }
      if (untrack(() => saved?.id) === id) return;
      try {
        saved = await getSheetStore().load(id);
        sheetName = saved?.name ?? "";
        if (!saved) error = "Der gespeicherte Bogen existiert nicht mehr.";
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    })();
  });

  function apply(next: StripSpec[], cols: ColumnCount = columns) {
    const params = new URLSearchParams({ ids: serializeStrips(next), cols: String(cols) });
    if (sheetId) params.set("bogen", sheetId);
    goto(`/print?${params}`, { replaceState: true, keepFocus: true, noScroll: true });
  }

  /** Schreibt in den geladenen Bogen zurueck -- oder legt einen neuen an. */
  async function saveSheet(asNew = false) {
    const name = sheetName.trim();
    if (!name) return;
    saving = true;
    try {
      const next =
        saved && !asNew
          ? { ...updateSavedSheet(saved, strips, columns), name }
          : createSavedSheet(name, strips, columns);
      saved = await getSheetStore().save(next);
      if (saved.id !== sheetId) {
        await goto(savedSheetHref(saved), { replaceState: true, keepFocus: true, noScroll: true });
      }
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }

  function leave() {
    if (dirty && !confirm("Der Bogen hat ungespeicherte Aenderungen. Trotzdem verlassen?")) return;
    goto("/");
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

  /** Kopie direkt dahinter -- auf Wunsch fuer den Folgetag, so entsteht eine Woche. */
  function duplicateStrip(index: number, forNextDay = false) {
    const original = strips[index];
    const copy = {
      ...original,
      date: forNextDay ? nextDay(original.date) : original.date,
      hidden: [...original.hidden],
    };
    const next = [...strips];
    next.splice(index + 1, 0, copy);
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
    const current = strips[index].date;
    const date: DateChoice =
      kind === "today" || kind === "tomorrow"
        ? { kind }
        : kind === "later"
          ? inDays(Math.max(2, daysAhead(current) ?? 0))
          : kind === "fixed"
            ? { kind, day: toIsoDay(new Date()) }
            : NO_DATE;
    updateStrip(index, (strip) => setDate(strip, date));
  }

  function chooseDaysAhead(index: number, raw: string) {
    const days = Math.round(Number(raw));
    if (Number.isFinite(days) && days >= 0) updateStrip(index, (strip) => setDate(strip, inDays(days)));
  }

  function chooseDay(index: number, day: string) {
    if (day) updateStrip(index, (strip) => setDate(strip, { kind: "fixed", day }));
  }
</script>

<div class="app no-print">
  <div class="toolbar">
    <button onclick={leave}>← Uebersicht</button>
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

  <div class="card">
    <div class="toolbar" style="margin:0">
      <label for="sheet-name"><strong>Bogen</strong></label>
      <input
        id="sheet-name"
        bind:value={sheetName}
        placeholder="Name zum Speichern, z. B. Woche"
        style="flex:1"
      />
      {#if saved}
        <button class="primary" onclick={() => saveSheet()} disabled={!dirty || saving || !sheetName.trim()}>
          Speichern
        </button>
        <button onclick={() => saveSheet(true)} disabled={saving || !sheetName.trim()}>
          Als neuen Bogen
        </button>
      {:else}
        <button onclick={() => saveSheet()} disabled={saving || !sheetName.trim() || strips.length === 0}>
          Bogen speichern
        </button>
      {/if}
    </div>
    {#if dirty}<p class="muted" style="margin:0.4rem 0 0">Ungespeicherte Aenderungen.</p>{/if}
  </div>

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
            <span style="flex:1">
              {#if template}{template.name}
              {:else if missing[strip.templateId]}<span class="error">Vorlage fehlt</span>
              {:else}… wird geladen{/if}
            </span>

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
              {:else if strip.date.kind === "later"}
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={strip.date.days}
                  title="Tage nach dem Drucktag"
                  onchange={(e) => chooseDaysAhead(index, e.currentTarget.value)}
                  style="width:4rem"
                />
                <span class="muted" style="font-size:0.85rem">{date}</span>
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
            <button
              class="icon"
              title="noch einmal fuer den Folgetag"
              onclick={() => duplicateStrip(index, true)}
              disabled={strip.date.kind === "none"}>+1</button
            >
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
              <h2>
                {section.title}
                <button
                  class="drop no-print"
                  title="Abschnitt nur von diesem Streifen entfernen"
                  onclick={() => toggleOnStrip(index, section.id)}>✕</button
                >
              </h2>
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
