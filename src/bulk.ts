import "./style.css";
import { detectAaguidColumn, parseCsv, rowLooksLikeHeader, toCsv } from "./csv";
import { resolveProviderName, normalizeAaguid } from "./lookup";
import { applyStoredThemeOnLoad, footerHtml, initChrome, topbarHtml } from "./theme";
import { loadRegistry } from "./registry";
import type { AaguidRegistry } from "./types";

applyStoredThemeOnLoad();

const PREVIEW_LIMIT = 50;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isAaguidLike(value: string): boolean {
  return normalizeAaguid(value) !== null;
}

interface ResolvedCsv {
  header: string[] | null;
  rows: string[][];
}

function resolveCsv(text: string, registry: AaguidRegistry): ResolvedCsv | null {
  const parsed = parseCsv(text);
  if (parsed.length === 0) return null;

  const hasHeader = rowLooksLikeHeader(parsed[0], isAaguidLike);
  const header = hasHeader ? parsed[0] : null;
  const dataRows = hasHeader ? parsed.slice(1) : parsed;
  if (dataRows.length === 0) return null;

  const column = detectAaguidColumn(dataRows, isAaguidLike);
  if (column === -1) return null;

  const rows = dataRows.map((row) => [...row, resolveProviderName(registry, row[column] ?? "")]);
  return { header: header ? [...header, "Provider"] : null, rows };
}

function previewTableHtml(result: ResolvedCsv): string {
  const headRow = result.header
    ? `<tr>${result.header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr>`
    : "";

  const bodyRows = result.rows
    .slice(0, PREVIEW_LIMIT)
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  const truncatedNote =
    result.rows.length > PREVIEW_LIMIT
      ? `<p class="bulk-note">Showing the first ${PREVIEW_LIMIT} of ${result.rows.length} rows. Download the CSV for the full result.</p>`
      : "";

  return `
    <div class="bulk-table-wrap">
      <table class="bulk-table">
        <thead>${headRow}</thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
    ${truncatedNote}
  `;
}

function downloadCsv(result: ResolvedCsv, downloadName: string): void {
  const rows = result.header ? [result.header, ...result.rows] : result.rows;
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = downloadName;
  link.click();

  URL.revokeObjectURL(url);
}

function renderShell(app: HTMLElement): void {
  app.innerHTML = `
    <div class="shell">
      ${topbarHtml("bulk")}
      <main id="main" tabindex="-1">
        <section class="page-intro">
          <div class="kicker">THE TOOLBOX <span>BULK LOOKUP</span></div>
          <h1>Serious security.<br /><em>Room to play.</em></h1>
          <div class="intro-bottom">
            <p>Upload a CSV or paste a list of AAGUIDs to get provider names back.</p>
          </div>
        </section>

        <div class="workspace">
          <div class="bulk-privacy-note">
            Your data is processed entirely in your browser. It is never uploaded, sent over the
            network, or stored anywhere.
          </div>

          <div class="bulk-upload">
            <label class="search-label" for="csv-file">CSV file</label>
            <input id="csv-file" type="file" accept=".csv,text/csv" />
          </div>

          <div class="bulk-divider">or</div>

          <div class="bulk-paste-wrap">
            <label class="search-label" for="paste-input">Paste AAGUIDs (one per line)</label>
            <textarea
              id="paste-input"
              class="paste-input"
              rows="6"
              placeholder="ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4&#10;fa2b99dc-9e39-4257-8f92-4a30d23c4118"
              spellcheck="false"
            ></textarea>
            <button id="resolve-paste" class="download-button" type="button">Resolve list</button>
          </div>

          <div id="bulk-status"></div>
          <div id="bulk-result"></div>
        </div>
      </main>
      ${footerHtml()}
    </div>
  `;
}

function mountApp(registry: AaguidRegistry): void {
  const app = document.getElementById("app");
  if (!app) return;

  renderShell(app);

  const fileInput = document.getElementById("csv-file") as HTMLInputElement;
  const pasteInput = document.getElementById("paste-input") as HTMLTextAreaElement;
  const resolvePasteButton = document.getElementById("resolve-paste") as HTMLButtonElement;
  const status = document.getElementById("bulk-status")!;
  const resultContainer = document.getElementById("bulk-result")!;
  const themeToggle = document.getElementById("theme-toggle") as HTMLButtonElement;

  initChrome(themeToggle, () => {});

  function runResolve(
    text: string,
    sourceLabel: string,
    downloadName: string,
    synthesizeHeader: boolean,
  ): void {
    resultContainer.innerHTML = "";

    const result = resolveCsv(text, registry);
    if (!result) {
      status.innerHTML = `<div class="warning-banner">Couldn't find a column that looks like AAGUIDs in this input. Make sure it contains UUID-formatted values.</div>`;
      return;
    }

    if (!result.header && synthesizeHeader) {
      result.header = ["AAGUID", "Provider"];
    }

    status.innerHTML = `<p class="bulk-note">Resolved ${result.rows.length} row${result.rows.length === 1 ? "" : "s"} from ${escapeHtml(sourceLabel)}.</p>`;
    resultContainer.innerHTML = `
      ${previewTableHtml(result)}
      <button id="download-csv" class="download-button" type="button">Download resolved CSV</button>
    `;

    document.getElementById("download-csv")!.addEventListener("click", () => {
      downloadCsv(result, downloadName);
    });
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    resultContainer.innerHTML = "";
    if (!file) {
      status.innerHTML = "";
      return;
    }

    status.innerHTML = `<p class="bulk-note">Processing ${escapeHtml(file.name)}…</p>`;

    const text = await file.text();
    runResolve(text, file.name, file.name.replace(/\.csv$/i, "") + "-resolved.csv", false);
  });

  resolvePasteButton.addEventListener("click", () => {
    const text = pasteInput.value;
    if (!text.trim()) {
      status.innerHTML = "";
      resultContainer.innerHTML = "";
      return;
    }

    runResolve(text, "pasted list", "passkey-lookup-resolved.csv", true);
  });
}

async function main(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) return;

  try {
    const registry = await loadRegistry();
    mountApp(registry);
  } catch (error) {
    app.innerHTML = `
      <div class="shell">
        ${topbarHtml("bulk")}
        <main id="main">
          <div class="warning-banner">
            Failed to load AAGUID data: ${escapeHtml(error instanceof Error ? error.message : String(error))}
          </div>
        </main>
      </div>
    `;
  }
}

main();
