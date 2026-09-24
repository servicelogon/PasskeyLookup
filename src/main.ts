import "./style.css";
import { filterEntries, listEntries, lookupAaguid, normalizeAaguid, pickIcon } from "./lookup";
import { PROVIDER_INFO } from "./providerInfo";
import { applyStoredThemeOnLoad, footerHtml, initChrome, isDarkActive, topbarHtml } from "./theme";
import { loadMeta, loadRegistry } from "./registry";
import type { AaguidEntry, AaguidMeta, AaguidRegistry } from "./types";
import type { RegistryRow } from "./lookup";

applyStoredThemeOnLoad();

const DEFAULT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`;
const CLOSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
const COPY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const CHECK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function iconHtml(entry: AaguidEntry | null): string {
  const src = entry ? pickIcon(entry, isDarkActive()) : undefined;
  return src ? `<img src="${src}" alt="" />` : DEFAULT_ICON;
}

function resultCardHtml(aaguid: string, entry: AaguidEntry | null): string {
  const name = entry?.name ?? "Unknown provider";
  const cardClass = entry ? "result-card" : "result-card unknown";
  const info = entry ? PROVIDER_INFO[entry.name] : undefined;

  return `
    <div class="${cardClass}">
      <button type="button" class="result-close" id="result-close" aria-label="Back to list">${CLOSE_ICON}</button>
      <div class="result-icon">${iconHtml(entry)}</div>
      <div class="result-body">
        <p class="result-name">${escapeHtml(name)}</p>
        <p class="result-aaguid">
          ${escapeHtml(aaguid)}
          <button type="button" class="result-copy" id="result-copy" data-aaguid="${escapeHtml(aaguid)}" aria-label="Copy AAGUID">${COPY_ICON}</button>
        </p>
        ${info?.description ? `<p class="result-description">${escapeHtml(info.description)}</p>` : ""}
        ${
          info?.docsUrl
            ? `<a class="result-docs-link" href="${escapeHtml(info.docsUrl)}" target="_blank" rel="noopener noreferrer">View documentation →</a>`
            : ""
        }
      </div>
    </div>
  `;
}

function browseItemHtml(row: RegistryRow): string {
  return `
    <li class="browse-item" data-aaguid="${escapeHtml(row.aaguid)}" tabindex="0">
      <div class="browse-icon">${iconHtml(row.entry)}</div>
      <div class="browse-body">
        <div class="browse-name">${escapeHtml(row.entry.name)}</div>
        <div class="browse-aaguid">${escapeHtml(row.aaguid)}</div>
      </div>
    </li>
  `;
}

function freshnessHtml(meta: AaguidMeta | null, entryCount: number): string {
  if (!meta) return "";
  const date = new Date(meta.updatedAt);
  const formatted = Number.isNaN(date.getTime())
    ? meta.updatedAt
    : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  return `<p class="freshness">Data last updated ${escapeHtml(formatted)} · ${entryCount} providers</p>`;
}

function renderShell(app: HTMLElement, entryCount: number, meta: AaguidMeta | null): void {
  app.innerHTML = `
    <div class="shell">
      ${topbarHtml("lookup")}
      <main id="main" tabindex="-1">
        <section class="page-intro">
          <div class="kicker">02 / IDENTIFY <span>LOOKUP UTILITY</span></div>
          <h1>Passkey<br /><em>AAGUID Lookup</em></h1>
          <div class="intro-bottom">
            <p>A long identifier, a quick answer. Match an AAGUID to its passkey provider, or browse the directory.</p>
            ${freshnessHtml(meta, entryCount)}
          </div>
        </section>

        <div class="workspace">
          ${
            entryCount === 0
              ? `<div class="warning-banner">The AAGUID registry is empty. Run <code>npm run update-data</code> to refresh it.</div>`
              : ""
          }

          <div class="search-wrap">
            <label class="search-label" for="aaguid-search">AAGUID</label>
            <input
              id="aaguid-search"
              class="search-input"
              type="text"
              placeholder="ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4"
              spellcheck="false"
              autocomplete="off"
            />
          </div>

          <section class="result-section" aria-live="polite">
            <h2>Result</h2>
            <div id="result-container">
              <p class="result-empty">Enter an AAGUID above to look up its provider.</p>
            </div>
          </section>

          <section class="browse-section">
            <h2>All providers (${entryCount})</h2>
            <ul id="browse-list" class="browse-list"></ul>
          </section>
        </div>
      </main>
      ${footerHtml()}
    </div>
  `;
}

function mountApp(registry: AaguidRegistry, meta: AaguidMeta | null): void {
  const app = document.getElementById("app");
  if (!app) return;

  const rows = listEntries(registry);
  renderShell(app, rows.length, meta);

  const searchInput = document.getElementById("aaguid-search") as HTMLInputElement;
  const resultContainer = document.getElementById("result-container")!;
  const browseList = document.getElementById("browse-list")!;
  const themeToggle = document.getElementById("theme-toggle") as HTMLButtonElement;

  function render(): void {
    const query = searchInput.value;
    const trimmed = query.trim();

    if (!trimmed) {
      resultContainer.innerHTML = `<p class="result-empty">Enter an AAGUID above to look up its provider.</p>`;
    } else {
      const normalized = normalizeAaguid(trimmed);
      if (!normalized) {
        resultContainer.innerHTML = `<p class="result-empty">Invalid AAGUID format. Use a UUID or 32 hex characters.</p>`;
      } else {
        const entry = lookupAaguid(registry, normalized);
        resultContainer.innerHTML = resultCardHtml(normalized, entry);
      }
    }

    const filtered = filterEntries(rows, query);
    browseList.innerHTML = filtered.length
      ? filtered.map(browseItemHtml).join("")
      : `<li class="browse-empty">No providers match your search.</li>`;
  }

  function selectAaguid(aaguid: string): void {
    searchInput.value = aaguid;
    render();
    searchInput.focus();
  }

  initChrome(themeToggle, render);

  searchInput.addEventListener("input", render);

  resultContainer.addEventListener("click", (event) => {
    const target = event.target as Element;

    const copyButton = target.closest<HTMLButtonElement>("#result-copy");
    if (copyButton) {
      const value = copyButton.dataset.aaguid ?? "";
      navigator.clipboard.writeText(value).then(() => {
        copyButton.innerHTML = CHECK_ICON;
        copyButton.setAttribute("aria-label", "Copied");
        setTimeout(() => {
          copyButton.innerHTML = COPY_ICON;
          copyButton.setAttribute("aria-label", "Copy AAGUID");
        }, 1500);
      });
      return;
    }

    if (!target.closest("#result-close")) return;
    searchInput.value = "";
    render();
  });

  browseList.addEventListener("click", (event) => {
    const item = (event.target as Element).closest<HTMLElement>(".browse-item");
    const aaguid = item?.dataset.aaguid;
    if (aaguid) selectAaguid(aaguid);
  });

  browseList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = (event.target as Element).closest<HTMLElement>(".browse-item");
    const aaguid = item?.dataset.aaguid;
    if (!aaguid) return;
    event.preventDefault();
    selectAaguid(aaguid);
  });

  render();
}

async function main(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) return;

  try {
    const [registry, meta] = await Promise.all([loadRegistry(), loadMeta()]);
    mountApp(registry, meta);
  } catch (error) {
    app.innerHTML = `
      <div class="shell">
        ${topbarHtml("lookup")}
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
