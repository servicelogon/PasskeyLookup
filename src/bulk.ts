import "./style.css";
import { escapeHtml, prefersReducedMotion, renderFrame } from "./chrome";
import { detectAaguidColumn, parseCsv, rowLooksLikeHeader, toCsv } from "./csv";
import { lookupAaguid, normalizeAaguid, ZERO_AAGUID } from "./lookup";
import { loadRegistry } from "./registry";
import type { AaguidRegistry } from "./types";

const PREVIEW_LIMIT = 100;
const MAX_BYTES = 20 * 1024 * 1024;

const EXAMPLE = [
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4",
  "fbfc3007-154e-4ecc-8c0b-6e020557d7bd",
  "bada5566a7aa401fbd9645619a55120d",
  "fa2b99dc-9e39-4257-8f92-4a30d23c4118",
  "00000000-0000-0000-0000-000000000000",
  "not-an-aaguid",
].join("\n");

type Outcome = "match" | "unknown" | "invalid";

interface ResolvedCsv {
  header: string[];
  rows: string[][];
  outcomes: Outcome[];
  column: number;
  hadHeader: boolean;
}

function isAaguidLike(value: string): boolean {
  return normalizeAaguid(value) !== null;
}

function resolveCsv(text: string, registry: AaguidRegistry, fallbackHeader: string): ResolvedCsv | null {
  const parsed = parseCsv(text.replace(/^﻿/, ""));
  if (parsed.length === 0) return null;

  const hadHeader = rowLooksLikeHeader(parsed[0], isAaguidLike);
  const dataRows = hadHeader ? parsed.slice(1) : parsed;
  if (dataRows.length === 0) return null;

  const column = detectAaguidColumn(dataRows, isAaguidLike);
  if (column === -1) return null;

  const width = Math.max(...parsed.map((row) => row.length));
  const header = hadHeader
    ? [...parsed[0], ...Array(Math.max(0, width - parsed[0].length)).fill("")]
    : Array.from({ length: width }, (_, i) => (i === column ? fallbackHeader : `Column ${i + 1}`));

  const outcomes: Outcome[] = [];
  const rows = dataRows.map((row) => {
    const padded = [...row, ...Array(Math.max(0, width - row.length)).fill("")];
    const normalized = normalizeAaguid(row[column] ?? "");
    let provider = "";
    if (!normalized) {
      outcomes.push("invalid");
    } else {
      const entry = lookupAaguid(registry, normalized);
      outcomes.push(entry ? "match" : "unknown");
      provider = entry?.name ?? (normalized === ZERO_AAGUID ? "Not disclosed (all zeros)" : "Unknown");
    }
    return [...padded, provider];
  });

  return { header: [...header, "Provider"], rows, outcomes, column, hadHeader };
}

/* ---------- Markup ---------- */

function pageHtml(): string {
  return `
    <div class="page-body">
      <div class="bulk-inputs">
        <section class="block bulk-block" aria-labelledby="upload-title">
          <h2 class="block-title" id="upload-title">Upload a CSV</h2>
          <p class="muted block-note">We find the column that holds AAGUIDs and add a Provider column next to it. Files are read in this browser and never uploaded.</p>
          <label class="dropzone" id="dropzone">
            <input id="csv-file" class="visually-hidden" type="file" accept=".csv,.txt,text/csv,text/plain" />
            <span class="upload-icon" aria-hidden="true"></span>
            <span class="dropzone-text"><span class="dropzone-lead">Choose a CSV</span><span class="dropzone-alt"> or drop it here</span></span>
            <span class="dropzone-file muted" id="file-name">Up to 20 MB</span>
          </label>
        </section>

        <section class="block bulk-block" aria-labelledby="paste-title">
          <h2 class="block-title" id="paste-title">Or paste a list</h2>
          <p class="muted block-note">One AAGUID per line, with or without hyphens.</p>
          <label class="visually-hidden" for="paste-input">AAGUIDs, one per line</label>
          <textarea id="paste-input" class="code-input" rows="6" wrap="off" spellcheck="false" autocapitalize="off" autocorrect="off"
            placeholder="ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4&#10;fa2b99dc9e3942578f924a30d23c4118"></textarea>
          <div class="actions">
            <button id="resolve-paste" class="btn" type="button">Resolve list<span class="arrow-icon" aria-hidden="true"></span></button>
            <button id="paste-example" class="btn quiet" type="button">Use an example</button>
          </div>
        </section>
      </div>

      <div id="bulk-status" role="status"></div>
      <section id="bulk-result" class="block results-block" aria-labelledby="results-title" hidden tabindex="-1"></section>
    </div>
  `;
}

function summaryHtml(result: ResolvedCsv): string {
  const count = (kind: Outcome) => result.outcomes.filter((o) => o === kind).length;
  const items: [Outcome, number, string][] = [
    ["match", count("match"), "matched"],
    ["unknown", count("unknown"), "not in the registry"],
    ["invalid", count("invalid"), "not an AAGUID"],
  ];
  return `<ul class="summary">${items
    .filter(([kind, n]) => n > 0 || kind === "match")
    .map(([kind, n, label]) => `<li class="badge ${kind}"><b>${n}</b> ${label}</li>`)
    .join("")}</ul>`;
}

// The preview leads with the answer: Provider, then the AAGUID it came from,
// then the file's other columns. The download keeps the file's own order.
function tableHtml(result: ResolvedCsv): string {
  const providerIndex = result.header.length - 1;
  const order = [
    providerIndex,
    result.column,
    ...result.header.map((_, i) => i).filter((i) => i !== providerIndex && i !== result.column),
  ];

  const head = order
    .map((i) => {
      const label = escapeHtml(result.header[i]) || `<span class="visually-hidden">Column ${i + 1}</span>`;
      return `<th scope="col"${i === providerIndex ? ' class="provider-col"' : ""}>${label}</th>`;
    })
    .join("");

  const body = result.rows
    .slice(0, PREVIEW_LIMIT)
    .map((row, r) => {
      const outcome = result.outcomes[r];
      const cells = order
        .map((i) => {
          const cell = row[i] ?? "";
          if (i === providerIndex) {
            const text = outcome === "invalid" ? "Not an AAGUID" : cell;
            return `<td class="provider-col ${outcome}">${escapeHtml(text)}</td>`;
          }
          return `<td${i === result.column ? ' class="mono"' : ""}>${escapeHtml(cell)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `
    <div class="table-scroll" tabindex="0" role="region" aria-label="Resolved rows" aria-describedby="table-hint">
      <table class="data-table">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="muted table-hint" id="table-hint" hidden>Swipe the table sideways to see every column.</p>
  `;
}

function resultHtml(result: ResolvedCsv, source: string): string {
  const total = result.rows.length;
  const more = total > PREVIEW_LIMIT
    ? `<p class="muted table-note">Showing the first ${PREVIEW_LIMIT} of ${total} rows. The download has all of them.</p>`
    : "";
  return `
    <div class="results-head">
      <div>
        <h2 class="block-title" id="results-title">Results <span class="count">${total} row${total === 1 ? "" : "s"}</span></h2>
        <p class="muted block-note">From ${escapeHtml(source)}.</p>
      </div>
      <div class="actions">
        <button id="download-csv" class="btn" type="button"><span class="download-icon" aria-hidden="true"></span>Download CSV</button>
        <button id="start-over" class="btn quiet" type="button">Start over</button>
      </div>
    </div>
    ${summaryHtml(result)}
    ${tableHtml(result)}
    ${more}
  `;
}

function downloadCsv(result: ResolvedCsv, name: string, writeHeader: boolean): void {
  const rows = writeHeader ? [result.header, ...result.rows] : result.rows;
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Behaviour ---------- */

function mount(main: HTMLElement, registry: AaguidRegistry): void {
  main.innerHTML = pageHtml();

  const fileInput = main.querySelector<HTMLInputElement>("#csv-file")!;
  const dropzone = main.querySelector<HTMLElement>("#dropzone")!;
  const fileName = main.querySelector<HTMLElement>("#file-name")!;
  const paste = main.querySelector<HTMLTextAreaElement>("#paste-input")!;
  const status = main.querySelector<HTMLElement>("#bulk-status")!;
  const output = main.querySelector<HTMLElement>("#bulk-result")!;

  // Only mention sideways scrolling when the table is actually wider than the page.
  function updateTableHint(): void {
    const scroller = output.querySelector<HTMLElement>(".table-scroll");
    const hint = output.querySelector<HTMLElement>(".table-hint");
    if (scroller && hint) hint.hidden = scroller.scrollWidth <= scroller.clientWidth + 1;
  }
  window.addEventListener("resize", updateTableHint);

  function reset(): void {
    status.innerHTML = "";
    output.hidden = true;
    output.innerHTML = "";
  }

  function fail(message: string): void {
    output.hidden = true;
    output.innerHTML = "";
    status.innerHTML = `<p class="error">${message}</p>`;
  }

  // A pasted list gets a synthesized header in the download; a headerless file
  // keeps its shape, so only the preview shows column labels.
  function show(text: string, source: string, downloadName: string, synthesizeHeader: boolean): void {
    const result = resolveCsv(text, registry, "AAGUID");
    if (!result) {
      fail("No column in this input looks like AAGUIDs. Each value should be 32 hex digits, with or without hyphens.");
      return;
    }
    status.innerHTML = "";
    output.innerHTML = resultHtml(result, source);
    output.hidden = false;
    updateTableHint();
    output.querySelector("#download-csv")!.addEventListener("click", () => downloadCsv(result, downloadName, result.hadHeader || synthesizeHeader));
    output.querySelector("#start-over")!.addEventListener("click", () => {
      reset();
      paste.value = "";
      fileInput.value = "";
      fileName.textContent = "Up to 20 MB";
      dropzone.classList.remove("has-file");
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      paste.focus({ preventScroll: true });
    });
    output.focus({ preventScroll: true });
    output.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }

  async function readFile(file: File): Promise<void> {
    fileName.textContent = file.name;
    dropzone.classList.add("has-file");
    if (file.size > MAX_BYTES) {
      fail(`${escapeHtml(file.name)} is larger than 20 MB. Split it and try again.`);
      return;
    }
    if (!/\.(csv|txt)$/i.test(file.name) && file.type && !/^text\//.test(file.type)) {
      fail(`${escapeHtml(file.name)} isn’t a CSV. Export the sheet as CSV first.`);
      return;
    }
    status.innerHTML = `<p class="muted">Reading ${escapeHtml(file.name)}…</p>`;
    try {
      const text = await file.text();
      show(text, file.name, file.name.replace(/\.(csv|txt)$/i, "") + "-resolved.csv", false);
    } catch {
      fail(`${escapeHtml(file.name)} couldn’t be read.`);
    } finally {
      // Choosing the same file again should run again.
      fileInput.value = "";
    }
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) void readFile(file);
  });

  // Drag and drop onto the drop zone. Dropping anywhere else on the page must
  // not navigate away to the file.
  let depth = 0;
  dropzone.addEventListener("dragenter", (event) => {
    event.preventDefault();
    depth += 1;
    dropzone.classList.add("is-over");
  });
  dropzone.addEventListener("dragleave", () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) dropzone.classList.remove("is-over");
  });
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  });
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    depth = 0;
    dropzone.classList.remove("is-over");
    const file = event.dataTransfer?.files?.[0];
    if (file) void readFile(file);
  });
  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => event.preventDefault());

  main.querySelector("#resolve-paste")!.addEventListener("click", () => {
    if (!paste.value.trim()) {
      fail("Paste at least one AAGUID first.");
      paste.focus();
      return;
    }
    show(paste.value, "the pasted list", "passkey-lookup-resolved.csv", true);
  });
  paste.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      main.querySelector<HTMLButtonElement>("#resolve-paste")!.click();
    }
  });
  main.querySelector("#paste-example")!.addEventListener("click", () => {
    paste.value = EXAMPLE;
    paste.focus();
  });
}

async function start(main: HTMLElement): Promise<void> {
  main.setAttribute("aria-busy", "true");
  main.innerHTML = `<p class="loading muted">Loading the AAGUID registry…</p>`;
  try {
    mount(main, await loadRegistry());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    main.innerHTML = `
      <div class="page-body">
        <p class="error">${escapeHtml(message)} Check your connection and try again.</p>
        <div class="actions"><button type="button" class="btn" data-retry>Try again</button></div>
      </div>
    `;
    main.querySelector("[data-retry]")?.addEventListener("click", () => start(main), { once: true });
  } finally {
    main.removeAttribute("aria-busy");
  }
}

const app = document.getElementById("app");
if (app) start(renderFrame(app, "bulk"));
