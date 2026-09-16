<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getStore } from "$lib/storage";
  import type { ChecklistTemplate } from "$lib/model/types";
  import "../../../styles/print.css";

  let template = $state<ChecklistTemplate | null>(null);
  let error = $state<string | null>(null);

  const printedOn = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  $effect(() => {
    const id = page.params.id;
    (async () => {
      try {
        const loaded = await getStore().load(id!);
        if (!loaded) {
          error = "Vorlage nicht gefunden.";
          return;
        }
        template = loaded;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    })();
  });
</script>

<div class="app no-print">
  <div class="toolbar">
    <button onclick={() => goto("/")}>← Uebersicht</button>
    <span class="spacer"></span>
    <button class="primary" onclick={() => window.print()} disabled={!template}>Drucken</button>
  </div>
  {#if error}<p class="error">{error}</p>{/if}
</div>

{#if template}
  <article class="sheet">
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

    <footer>
      <span>{template.name} · Rev. {template.revision}</span>
      <span>Gedruckt am {printedOn}</span>
    </footer>
  </article>
{/if}
