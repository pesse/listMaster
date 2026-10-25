<script lang="ts">
  import "../styles/app.css";
  import type { Update } from "@tauri-apps/plugin-updater";
  import { onMount } from "svelte";
  import { findUpdate, installUpdate } from "$lib/update";

  let { children } = $props();

  let update = $state<Update | null>(null);
  let progress = $state<number | null>(null);
  let failed = $state<string | null>(null);

  onMount(() => {
    // Beim Start nicht aufdringlich: ohne Netz bleibt es bei einer Konsolenzeile.
    findUpdate()
      .then((u) => (update = u))
      .catch((e) => console.warn("Update-Pruefung fehlgeschlagen:", e));
  });

  async function install() {
    if (!update) return;
    failed = null;
    progress = 0;
    try {
      await installUpdate(update, (f) => (progress = f));
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e);
      progress = null;
    }
  }
</script>

{#if update}
  <div class="update-banner no-print">
    {#if progress !== null}
      <span>Update auf {update.version} wird installiert … {Math.round(progress * 100)} %</span>
    {:else}
      <span>
        Version {update.version} ist verfuegbar.
        {#if update.body}<span class="muted">{update.body}</span>{/if}
        {#if failed}<span class="update-error">Fehlgeschlagen: {failed}</span>{/if}
      </span>
      <span class="spacer"></span>
      <button onclick={() => (update = null)}>Spaeter</button>
      <button class="primary" onclick={install}>Jetzt installieren</button>
    {/if}
  </div>
{/if}

{@render children()}

<style>
  .update-banner {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem 1.5rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .update-banner .spacer { flex: 1; }
  .update-banner .muted { margin-left: 0.5rem; white-space: pre-line; }
  .update-error { margin-left: 0.5rem; color: var(--danger); }
</style>
