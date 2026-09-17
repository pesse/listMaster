/**
 * Rendert das Streifen-Druckbild als PDF, ohne die App zu starten.
 *
 *   node scripts/print-preview.mjs [Spalten] [Streifen] [Ziel.pdf] [Datum]
 *
 * Datum ist `heute`, `morgen`, ein ISO-Tag (`2026-09-17`) oder leer und gilt
 * hier fuer alle Streifen -- in der App haengt es an jedem Streifen einzeln.
 *
 * Quelle sind die echten Vorlagen aus dem AppData-Verzeichnis, damit das
 * Bild zeigt, was der Drucker wirklich ausgibt -- inklusive Spaltenlinie
 * und Schnittkanten. Markup und Stylesheet sind dieselben wie in
 * `src/routes/print/+page.svelte`; wer dort etwas aendert, zieht es hier mit.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * %APPDATA% der App. Unter Windows steht es in der Umgebung; aus WSL heraus
 * fragt das Skript Windows danach -- ohne festen Benutzernamen im Pfad.
 */
function appData() {
  if (process.env.APPDATA) return process.env.APPDATA;
  // Voller Pfad: WSL haengt die Windows-Pfade nicht immer an $PATH an.
  const cmd = "/mnt/c/Windows/System32/cmd.exe";
  const opts = { encoding: "utf8", cwd: "/mnt/c" };
  const win = execFileSync(cmd, ["/d", "/c", "echo %APPDATA%"], opts).trim();
  return execFileSync("wslpath", ["-u", win], opts).trim();
}

const TEMPLATE_DIR =
  process.env.LISTMASTER_TEMPLATES ?? join(appData(), "de.listmaster.desktop", "templates");

const [columns = "3", count = "5", out = "print-preview.pdf", datum = ""] = process.argv.slice(2);

/**
 * Kleiner Nachbau von `src/lib/print/date.ts` -- das Skript laeuft ohne
 * Bundler und kann das TypeScript-Modul nicht importieren.
 */
function printDate(choice) {
  const day = new Date();
  if (choice === "heute" || choice === "morgen") {
    if (choice === "morgen") day.setDate(day.getDate() + 1);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(choice)) {
    const [y, m, d] = choice.split("-").map(Number);
    day.setFullYear(y, m - 1, d);
  } else {
    return null;
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(day.getDate())}.${pad(day.getMonth() + 1)}.${String(day.getFullYear()).slice(2)}`;
}

const dateLabel = printDate(datum.trim().toLowerCase());

const templates = readdirSync(TEMPLATE_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(TEMPLATE_DIR, f), "utf8")));

if (templates.length === 0) {
  console.error(`Keine Vorlagen in ${TEMPLATE_DIR}`);
  process.exit(1);
}

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const strip = (t) => `
  <article class="strip">
    <header class="head">
      <h1>${esc(t.name)}</h1>
      ${dateLabel ? `<span class="date">${dateLabel}</span>` : ""}
    </header>
    ${t.description ? `<p class="subtitle">${esc(t.description)}</p>` : ""}
    ${t.sections
      .map(
        (s) => `<section>
      ${s.title.trim() ? `<h2>${esc(s.title)}</h2>` : ""}
      <ul>${s.items
        .map(
          (i) =>
            `<li><span class="box"></span><span>${esc(i.text)}${
              i.note ? `<span class="note">${esc(i.note)}</span>` : ""
            }</span></li>`,
        )
        .join("")}</ul>
    </section>`,
      )
      .join("")}
  </article>`;

const strips = Array.from({ length: Number(count) }, (_, n) => templates[n % templates.length]);
const css = readFileSync("src/styles/print.css", "utf8");

const html = join(mkdtempSync(join(tmpdir(), "listmaster-print-")), "sheet.html");
writeFileSync(
  html,
  `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="sheet"><div class="strips" style="--columns: ${columns}">
${strips.map(strip).join("\n")}
</div></div></body></html>`,
);

execFileSync(
  process.env.CHROME ?? "google-chrome",
  ["--headless", "--disable-gpu", "--no-sandbox", "--no-pdf-header-footer", `--print-to-pdf=${out}`, html],
  { stdio: ["ignore", "ignore", "ignore"] },
);

console.log(
  `${strips.length} Streifen, ${columns} Spalten${dateLabel ? `, Datum ${dateLabel}` : ""} -> ${out}`,
);
