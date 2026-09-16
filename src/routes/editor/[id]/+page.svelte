<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { getStore } from "$lib/storage";
  import {
    createItem,
    createSection,
    createTemplate,
    moveInArray,
    prepareForSave,
  } from "$lib/model/template";
  import type { ChecklistTemplate } from "$lib/model/types";

  let template = $state<ChecklistTemplate | null>(null);
  let error = $state<string | null>(null);
  let dirty = $state(false);
  let saving = $state(false);

  $effect(() => {
    const id = page.params.id;
    (async () => {
      try {
        if (id === "new") {
          template = createTemplate();
        } else {
          const loaded = await getStore().load(id!);
          if (!loaded) {
            error = "Vorlage nicht gefunden.";
            return;
          }
          template = loaded;
        }
        dirty = false;
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    })();
  });

  function touch() {
    dirty = true;
  }

  async function save(): Promise<ChecklistTemplate | null> {
    if (!template) return null;
    saving = true;
    try {
      const saved = await getStore().save(prepareForSave(template));
      template = saved;
      dirty = false;
      error = null;
      return saved;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      return null;
    } finally {
      saving = false;
    }
  }

  async function saveAndPrint() {
    const saved = await save();
    if (saved) goto(`/print/${saved.id}`);
  }

  function addSection() {
    template!.sections.push(createSection());
    touch();
  }

  function removeSection(index: number) {
    template!.sections.splice(index, 1);
    touch();
  }

  function moveSection(index: number, delta: number) {
    template!.sections = moveInArray(template!.sections, index, index + delta);
    touch();
  }

  function addItem(sectionIndex: number) {
    template!.sections[sectionIndex].items.push(createItem());
    touch();
  }

  function removeItem(sectionIndex: number, itemIndex: number) {
    template!.sections[sectionIndex].items.splice(itemIndex, 1);
    touch();
  }

  function moveItem(sectionIndex: number, itemIndex: number, delta: number) {
    const section = template!.sections[sectionIndex];
    section.items = moveInArray(section.items, itemIndex, itemIndex + delta);
    touch();
  }

  /**
   * Enter am Ende eines Punktes legt den naechsten an -- eine Checkliste
   * tippt man am Stueck, ohne zur Maus zu greifen.
   */
  function onItemKeydown(event: KeyboardEvent, sectionIndex: number, itemIndex: number) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const section = template!.sections[sectionIndex];
    section.items.splice(itemIndex + 1, 0, createItem());
    touch();
    queueMicrotask(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>(
        `[data-section="${sectionIndex}"] input[data-item]`,
      );
      inputs[itemIndex + 1]?.focus();
    });
  }
</script>

<div class="app">
  <div class="toolbar">
    <button onclick={() => goto("/")}>← Uebersicht</button>
    <span class="spacer"></span>
    {#if dirty}<span class="muted">Nicht gespeichert</span>{/if}
    <button onclick={saveAndPrint} disabled={saving || !template}>Speichern &amp; drucken</button>
    <button class="primary" onclick={save} disabled={saving || !dirty}>Speichern</button>
  </div>

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if template}
    <div class="card">
      <input
        bind:value={template.name}
        oninput={touch}
        placeholder="Name der Checkliste"
        style="font-size:1.3rem; font-weight:600"
      />
      <input
        bind:value={template.description}
        oninput={touch}
        placeholder="Beschreibung (optional)"
        class="muted"
      />
    </div>

    {#each template.sections as section, sectionIndex (section.id)}
      <div class="card" data-section={sectionIndex}>
        <div class="toolbar" style="margin-bottom:0.5rem">
          <input
            bind:value={section.title}
            oninput={touch}
            placeholder="Abschnitt (optional)"
            style="font-weight:600; text-transform:uppercase; letter-spacing:0.04em"
          />
          <button
            class="icon"
            title="Abschnitt nach oben"
            onclick={() => moveSection(sectionIndex, -1)}
            disabled={sectionIndex === 0}>↑</button
          >
          <button
            class="icon"
            title="Abschnitt nach unten"
            onclick={() => moveSection(sectionIndex, 1)}
            disabled={sectionIndex === template.sections.length - 1}>↓</button
          >
          <button class="icon danger" title="Abschnitt loeschen" onclick={() => removeSection(sectionIndex)}>✕</button>
        </div>

        {#each section.items as item, itemIndex (item.id)}
          <div class="toolbar" style="margin-bottom:0.15rem; gap:0.25rem">
            <span class="muted">☐</span>
            <input
              data-item
              bind:value={item.text}
              oninput={touch}
              onkeydown={(e) => onItemKeydown(e, sectionIndex, itemIndex)}
              placeholder="Punkt …"
            />
            <button
              class="icon"
              title="nach oben"
              onclick={() => moveItem(sectionIndex, itemIndex, -1)}
              disabled={itemIndex === 0}>↑</button
            >
            <button
              class="icon"
              title="nach unten"
              onclick={() => moveItem(sectionIndex, itemIndex, 1)}
              disabled={itemIndex === section.items.length - 1}>↓</button
            >
            <button class="icon danger" title="Punkt loeschen" onclick={() => removeItem(sectionIndex, itemIndex)}>✕</button>
          </div>
        {/each}

        <button class="icon" onclick={() => addItem(sectionIndex)}>+ Punkt</button>
      </div>
    {/each}

    <button onclick={addSection}>+ Abschnitt</button>
  {:else if !error}
    <p class="muted">Lade …</p>
  {/if}
</div>
