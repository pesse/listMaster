<script lang="ts">
  import { goto } from "$app/navigation";
  import { getStore } from "$lib/storage";
  import type { TemplateSummary } from "$lib/model/types";

  let summaries = $state<TemplateSummary[]>([]);
  let error = $state<string | null>(null);
  let loading = $state(true);

  async function refresh() {
    loading = true;
    try {
      summaries = await getStore().list();
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function deleteTemplate(summary: TemplateSummary) {
    if (!confirm(`Vorlage "${summary.name}" wirklich loeschen?`)) return;
    try {
      await getStore().remove(summary.id);
      await refresh();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  $effect(() => {
    refresh();
  });
</script>

<div class="app">
  <div class="toolbar">
    <h1 style="margin:0; font-size:1.4rem">Checklisten-Vorlagen</h1>
    <span class="spacer"></span>
    <button class="primary" onclick={() => goto("/editor/new")}>Neue Vorlage</button>
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if loading}
    <p class="muted">Lade …</p>
  {:else if summaries.length === 0}
    <div class="empty">
      <p>Noch keine Vorlage vorhanden.</p>
      <button class="primary" onclick={() => goto("/editor/new")}>Erste Vorlage anlegen</button>
    </div>
  {:else}
    {#each summaries as summary (summary.id)}
      <div class="card">
        <div class="toolbar" style="margin:0">
          <div>
            <strong>{summary.name}</strong>
            <div class="muted" style="font-size:0.85rem">
              {summary.itemCount}
              {summary.itemCount === 1 ? "Punkt" : "Punkte"}
              {#if summary.description}&nbsp;· {summary.description}{/if}
            </div>
          </div>
          <span class="spacer"></span>
          <button onclick={() => goto(`/print/${summary.id}`)}>Drucken</button>
          <button onclick={() => goto(`/editor/${summary.id}`)}>Bearbeiten</button>
          <button class="danger" onclick={() => deleteTemplate(summary)}>Loeschen</button>
        </div>
      </div>
    {/each}
  {/if}
</div>
