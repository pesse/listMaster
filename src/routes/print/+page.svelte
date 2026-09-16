<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getStore } from "$lib/storage";
  import {
    COLUMN_COUNTS,
    fitsInColumn,
    parseColumns,
    parseStripIds,
    serializeStripIds,
    type ColumnCount,
  } from "$lib/print/layout";
  import { moveInArray } from "$lib/model/template";
  import type { ChecklistTemplate, TemplateId, TemplateSummary } from "$lib/model/types";
  import "../../styles/print.css";

  /**
   * Der Bogen steht vollstaendig in der URL (`?ids=a,b,a&cols=3`), damit er
   * nachladbar und als Lesezeichen wiederverwendbar ist. IDs duerfen sich
   * wiederholen -- dieselbe Liste mehrfach auf einem Bogen ist gewollt.
   */
  const stripIds = $derived(parseStripIds(page.url.searchParams.get("ids")));
  const columns = $derived(parseColumns(page.url.searchParams.get("cols")));

  let cache = $state<Record<TemplateId, ChecklistTemplate>>({});
  let summaries = $state<TemplateSummary[]>([]);
  let error = $state<string | null>(null);
  let pickerId = $state<TemplateId>("");

  const strips = $derived(
    stripIds.map((id) => cache[id]).filter((t): t is ChecklistTemplate => Boolean(t)),
  );
  const tooLong = $derived([...new Set(strips.filter((t) => !fitsInColumn(t)).map((t) => t.name))]);

  $effect(() => {
    // Nur stripIds wird verfolgt; das Nachladen laeuft danach ungetrackt.
    const ids = stripIds;
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

  function apply(ids: TemplateId[], cols: ColumnCount = columns) {
    const params = new URLSearchParams({ ids: serializeStripIds(ids), cols: String(cols) });
    goto(`/print?${params}`, { replaceState: true, keepFocus: true, noScroll: true });
  }

  function addStrip() {
    if (!pickerId) return;
    apply([...stripIds, pickerId]);
  }

  function duplicateStrip(index: number) {
    const ids = [...stripIds];
    ids.splice(index + 1, 0, ids[index]);
    apply(ids);
  }

  function removeStrip(index: number) {
    apply(stripIds.filter((_, i) => i !== index));
  }

  function moveStrip(index: number, delta: number) {
    apply(moveInArray(stripIds, index, index + delta));
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
      onchange={(e) => apply(stripIds, Number(e.currentTarget.value) as ColumnCount)}
    >
      {#each COLUMN_COUNTS as count (count)}
        <option value={count}>{count}</option>
      {/each}
    </select>
    <button class="primary" onclick={() => window.print()} disabled={strips.length === 0}>
      Drucken
    </button>
  </div>

  {#if error}<p class="error">{error}</p>{/if}

  {#if tooLong.length > 0}
    <p class="error">
      Zu lang fuer eine Spalte: {tooLong.join(", ")}. Der Streifen wird beim Druck umbrochen und
      laesst sich nicht mehr am Stueck ausschneiden — weniger Spalten waehlen oder die Liste teilen.
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

    {#if stripIds.length === 0}
      <p class="muted">Noch kein Streifen gewaehlt.</p>
    {:else}
      {#each stripIds as id, index (`${id}-${index}`)}
        <div class="toolbar" style="margin-bottom:0.15rem; gap:0.25rem">
          <span class="muted">{index + 1}.</span>
          <span style="flex:1">{cache[id]?.name ?? "… wird geladen"}</span>
          <button class="icon" title="nach oben" onclick={() => moveStrip(index, -1)} disabled={index === 0}>↑</button>
          <button
            class="icon"
            title="nach unten"
            onclick={() => moveStrip(index, 1)}
            disabled={index === stripIds.length - 1}>↓</button
          >
          <button class="icon" title="noch einmal" onclick={() => duplicateStrip(index)}>⧉</button>
          <button class="icon danger" title="entfernen" onclick={() => removeStrip(index)}>✕</button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<div class="sheet">
  <div class="strips" style="--columns: {columns}">
    {#each strips as template, index (`${template.id}-${index}`)}
      <article class="strip">
        <h1>{template.name}</h1>
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
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      </article>
    {/each}
  </div>
</div>
