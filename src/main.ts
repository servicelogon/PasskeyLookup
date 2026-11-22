import "./style.css";
import { copyText, escapeHtml, prefersReducedMotion, renderFrame } from "./chrome";
import {
  filterGroups,
  groupEntries,
  hexProgress,
  listEntries,
  lookupAaguid,
  normalizeAaguid,
  ZERO_AAGUID,
  type ProviderGroup,
} from "./lookup";
import { PROVIDER_INFO } from "./providerInfo";
import { HARDWARE_AAGUIDS, loadMeta, loadRegistry } from "./registry";
import type { AaguidEntry, AaguidMeta, AaguidRegistry } from "./types";

const REGISTRY_URL = "https://github.com/passkeydeveloper/passkey-authenticator-aaguids";
const YUBICO_URL = "https://support.yubico.com/s/article/YubiKey-hardware-FIDO2-AAGUIDs";
const WEBDEV_URL = "https://web.dev/articles/webauthn-aaguid";
const MDS_URL = "https://fidoalliance.org/metadata/";

const EXAMPLES: [string, string][] = [
  ["Google", "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4"],
  ["Apple", "fbfc3007-154e-4ecc-8c0b-6e020557d7bd"],
  ["1Password", "bada5566-a7aa-401f-bd96-45619a55120d"],
  ["YubiKey", "fa2b99dc-9e39-4257-8f92-4a30d23c4118"],
];

// Line icons, drawn at 1.5px like the rest of the NFS system.
const PASSKEY_GLYPH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="4"/><path d="M10.8 10.8 20 20m-3-3 2-2m-4.5-.5 2-2"/></svg>`;
const HARDWARE_GLYPH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="15" rx="2"/><circle cx="12" cy="9" r="2.5"/><path d="M9 17.5V21h6v-3.5"/></svg>`;
const SEARCH_GLYPH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>`;

interface State {
  registry: AaguidRegistry;
  groups: ProviderGroup[];
  groupByAaguid: Map<string, ProviderGroup>;
}

function isHardware(aaguid: string): boolean {
  return HARDWARE_AAGUIDS.has(aaguid);
}

function iconHtml(entry: AaguidEntry | null, aaguid: string, large = false): string {
  const size = large ? " lg" : "";
  // The site is dark-only, so prefer the icon drawn for dark backgrounds.
  const src = entry?.icon_dark ?? entry?.icon_light;
  if (src) return `<span class="provider-icon${size}"><img src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async" /></span>`;
  return `<span class="provider-icon glyph${size}">${isHardware(aaguid) ? HARDWARE_GLYPH : PASSKEY_GLYPH}</span>`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/* ---------- Static layout ---------- */

function pageHtml(state: State, meta: AaguidMeta | null): string {
  const total = state.groupByAaguid.size;
  const hardware = [...state.groupByAaguid.keys()].filter(isHardware).length;
  const updated = meta ? `Community registry updated ${escapeHtml(formatDate(meta.updatedAt))}. ` : "";
  const empty = total === 0
    ? `<p class="error">The AAGUID registry is empty. Run <code>npm run update-data</code> to refresh it.</p>`
    : "";

  return `
    <div class="page-body">
      ${empty}
      <div class="lookup-layout">
        <section class="lookup-pane" aria-labelledby="lookup-title">
          <h2 class="block-title" id="lookup-title"><label for="aaguid-input">Look up an AAGUID</label></h2>
          <div class="search-field lookup-field">
            ${PASSKEY_GLYPH}
            <input id="aaguid-input" class="search mono" type="text" inputmode="text"
              placeholder="Paste an AAGUID" aria-describedby="lookup-hint"
              autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="80" />
            <button type="button" class="field-clear" id="lookup-clear" aria-label="Clear the AAGUID" hidden><span class="close-icon" aria-hidden="true"></span></button>
          </div>
          <p class="field-hint" id="lookup-hint"></p>
          <div id="result" class="result-slot" aria-live="polite"></div>
        </section>

        <section class="directory" id="directory" aria-labelledby="directory-title">
          <div class="directory-head">
            <h2 class="block-title" id="directory-title">Directory <span class="count">${plural(state.groups.length, "provider")}</span></h2>
            <p class="muted">${updated}${plural(total, "AAGUID")} in all, including ${hardware} from Yubico’s hardware key table.</p>
          </div>
          <div class="search-field filter-field">
            ${SEARCH_GLYPH}
            <label class="visually-hidden" for="directory-filter">Filter the directory</label>
            <input id="directory-filter" class="search" type="search" placeholder="Filter by name or AAGUID"
              autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-controls="provider-list" />
          </div>
          <p class="filter-status" id="filter-status" role="status"></p>
          <ul class="provider-list" id="provider-list"></ul>
        </section>
      </div>

      <aside class="aside-note" aria-labelledby="about-data">
        ${PASSKEY_GLYPH}
        <h2 id="about-data">About the data</h2>
        <p>
          Software providers come from the community
          <a class="inline-link" href="${REGISTRY_URL}" target="_blank" rel="noopener noreferrer">passkey-authenticator-aaguids</a>
          registry; hardware keys come from
          <a class="inline-link" href="${YUBICO_URL}" target="_blank" rel="noopener noreferrer">Yubico’s AAGUID table</a>.
          An AAGUID is self-reported by the authenticator, so use it to label passkeys, not to trust them.
          <a class="inline-link" href="${WEBDEV_URL}" target="_blank" rel="noopener noreferrer">web.dev explains why</a>.
        </p>
      </aside>
    </div>
  `;
}

/* ---------- Result panel ---------- */

function introHtml(): string {
  const examples = EXAMPLES.map(
    ([name, aaguid]) => `<button type="button" class="text-btn example" data-aaguid="${aaguid}" aria-label="Look up ${escapeHtml(name)}, ${aaguid}">${escapeHtml(name)}</button>`,
  ).join("");
  return `
    <div class="result-intro">
      <p>
        Every passkey records the AAGUID of the authenticator that created it: one
        128-bit ID shared by every copy of that provider. Identity providers list it
        with each registered passkey; in Microsoft Entra it’s in a user’s
        authentication method details.
      </p>
      <div class="examples">
        <span class="examples-label">Try</span>
        ${examples}
      </div>
    </div>
  `;
}

function factsHtml(aaguid: string, group: ProviderGroup | undefined): string {
  const hardware = isHardware(aaguid);
  const rows: [string, string][] = [
    ["AAGUID", `<span class="mono">${escapeHtml(aaguid)}</span>`],
  ];
  if (group) {
    rows.push(["Type", hardware ? "Hardware security key" : "Passkey provider"]);
    rows.push(["Source", hardware ? "Yubico AAGUID table" : "Community registry"]);
    if (group.aaguids.length > 1) {
      rows.push(["Listed AAGUIDs", `1 of ${group.aaguids.length} for ${hardware ? "this key family" : "this provider"}`]);
    }
  }
  return `<dl class="facts">${rows.map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`).join("")}</dl>`;
}

function actionsHtml(aaguid: string, docsUrl?: string): string {
  const docs = docsUrl
    ? `<a class="btn secondary" href="${escapeHtml(docsUrl)}" target="_blank" rel="noopener noreferrer">Provider docs<span class="arrow-icon" aria-hidden="true"></span><span class="visually-hidden"> (opens in a new tab)</span></a>`
    : "";
  return `
    <div class="actions">
      <button type="button" class="btn" data-copy="${aaguid}"><span class="copy-label">Copy AAGUID</span></button>
      ${docs}
      <button type="button" class="btn quiet back-to-list" data-back hidden><span class="arrow-icon arrow-up" aria-hidden="true"></span>Back to the list</button>
    </div>
  `;
}

function resultHtml(aaguid: string, entry: AaguidEntry | null, group: ProviderGroup | undefined): string {
  if (entry) {
    const info = PROVIDER_INFO[entry.name];
    return `
      <article class="result" data-state="match" aria-labelledby="result-name">
        <div class="result-head">
          ${iconHtml(entry, aaguid, true)}
          <div class="result-title">
            <p class="result-kicker">Match</p>
            <h3 id="result-name">${escapeHtml(entry.name)}</h3>
          </div>
        </div>
        ${info?.description ? `<p class="result-text">${escapeHtml(info.description)}</p>` : ""}
        ${factsHtml(aaguid, group)}
        ${actionsHtml(aaguid, info?.docsUrl)}
      </article>
    `;
  }

  if (aaguid === ZERO_AAGUID) {
    return `
      <article class="result" data-state="zero" aria-labelledby="result-name">
        <p class="result-kicker">All zeros</p>
        <h3 id="result-name">The authenticator didn’t say</h3>
        <p class="result-text">
          An all-zero AAGUID identifies no provider. Some authenticators always send
          zeros, and some browsers blank it out when the site doesn’t ask for attestation.
        </p>
        ${factsHtml(aaguid, undefined)}
        ${actionsHtml(aaguid)}
      </article>
    `;
  }

  return `
    <article class="result" data-state="unknown" aria-labelledby="result-name">
      <p class="result-kicker">No match</p>
      <h3 id="result-name">Not in the registry</h3>
      <p class="result-text">
        This is a well-formed AAGUID, but neither the community registry nor Yubico’s
        table lists it. Hardware keys from other vendors are usually in the
        <a class="inline-link" href="${MDS_URL}" target="_blank" rel="noopener noreferrer">FIDO Metadata Service</a>.
      </p>
      ${factsHtml(aaguid, undefined)}
      ${actionsHtml(aaguid)}
    </article>
  `;
}

/* ---------- Directory ---------- */

// Long AAGUID lists (YubiKey families ship up to six) show the first few and
// fold the rest behind a toggle, so the directory stays scannable.
const VISIBLE_AAGUIDS = 2;

function providerRowHtml(group: ProviderGroup, expand: boolean): string {
  const first = group.aaguids[0];
  const kind = isHardware(first) ? "Hardware key" : "Passkey provider";
  const meta = group.aaguids.length > 1 ? `${kind} · ${group.aaguids.length} AAGUIDs` : kind;
  const folds = group.aaguids.length > VISIBLE_AAGUIDS + 1;
  const buttons = group.aaguids
    .map((aaguid, i) => {
      const extra = folds && i >= VISIBLE_AAGUIDS ? ' class="extra"' : "";
      return `<li${extra}><button type="button" class="aaguid-btn" data-aaguid="${aaguid}" aria-label="Look up ${escapeHtml(group.name)}, ${aaguid}">${aaguid}</button></li>`;
    })
    .join("");
  const hidden = group.aaguids.length - VISIBLE_AAGUIDS;
  const toggle = folds
    ? `<li class="more"><button type="button" class="more-btn" aria-expanded="${expand}" data-more="${hidden}">${expand ? "Show fewer" : `Show ${hidden} more`}</button></li>`
    : "";
  return `
    <li class="provider-row${folds && expand ? " is-expanded" : ""}" data-name="${escapeHtml(group.name)}">
      ${iconHtml(group.entry, first)}
      <div class="provider-main">
        <h3 class="provider-name">${escapeHtml(group.name)}</h3>
        <p class="provider-meta">${meta}</p>
      </div>
      <ul class="aaguid-list">${buttons}${toggle}</ul>
    </li>
  `;
}

function setExpanded(row: Element, open: boolean): void {
  const button = row.querySelector<HTMLButtonElement>(".more-btn");
  if (!button) return;
  row.classList.toggle("is-expanded", open);
  button.setAttribute("aria-expanded", String(open));
  button.textContent = open ? "Show fewer" : `Show ${button.dataset.more} more`;
}

/* ---------- Behaviour ---------- */

function mount(main: HTMLElement, registry: AaguidRegistry, meta: AaguidMeta | null): void {
  const rows = listEntries(registry);
  const groups = groupEntries(rows);
  const groupByAaguid = new Map<string, ProviderGroup>();
  for (const group of groups) for (const aaguid of group.aaguids) groupByAaguid.set(aaguid, group);
  const state: State = { registry, groups, groupByAaguid };

  main.innerHTML = pageHtml(state, meta);

  const input = main.querySelector<HTMLInputElement>("#aaguid-input")!;
  const clear = main.querySelector<HTMLButtonElement>("#lookup-clear")!;
  const hint = main.querySelector<HTMLElement>("#lookup-hint")!;
  const result = main.querySelector<HTMLElement>("#result")!;
  const filter = main.querySelector<HTMLInputElement>("#directory-filter")!;
  const filterStatus = main.querySelector<HTMLElement>("#filter-status")!;
  const list = main.querySelector<HTMLElement>("#provider-list")!;

  let shownKey: string | null = null;
  let cameFrom: HTMLElement | null = null;

  function setHint(html: string): void {
    hint.innerHTML = html;
  }

  function markSelected(aaguid: string | null): void {
    list.querySelectorAll(".is-selected").forEach((el) => el.classList.remove("is-selected"));
    list.querySelectorAll("[aria-current]").forEach((el) => el.removeAttribute("aria-current"));
    if (!aaguid) return;
    const button = list.querySelector<HTMLElement>(`.aaguid-btn[data-aaguid="${aaguid}"]`);
    button?.setAttribute("aria-current", "true");
    const row = button?.closest(".provider-row");
    row?.classList.add("is-selected");
    if (row && button?.closest(".extra")) setExpanded(row, true);
  }

  function syncUrl(aaguid: string | null): void {
    const url = new URL(window.location.href);
    if (aaguid) url.searchParams.set("aaguid", aaguid);
    else url.searchParams.delete("aaguid");
    history.replaceState(null, "", url);
  }

  function renderLookup(): void {
    const raw = input.value;
    const trimmed = raw.trim();
    clear.hidden = raw === "";
    const normalized = normalizeAaguid(trimmed);

    if (normalized) {
      setHint("");
      if (shownKey !== normalized) {
        shownKey = normalized;
        result.innerHTML = resultHtml(normalized, lookupAaguid(state.registry, normalized), state.groupByAaguid.get(normalized));
        result.querySelector<HTMLElement>("[data-back]")!.hidden = cameFrom === null;
      }
      markSelected(normalized);
      syncUrl(normalized);
      return;
    }

    cameFrom = null;
    markSelected(null);
    syncUrl(null);

    if (!trimmed) {
      setHint("With or without hyphens; braces are fine too.");
    } else {
      const digits = hexProgress(trimmed);
      if (digits === null) {
        setHint(
          `That isn’t an AAGUID. <button type="button" class="inline-btn" data-filter-for="${escapeHtml(trimmed)}">Find “${escapeHtml(trimmed)}” in the directory</button>`,
        );
      } else if (digits < 32) {
        setHint(`<span class="mono">${digits}</span> of 32 hex digits.`);
      } else {
        setHint(`That’s <span class="mono">${digits}</span> hex digits. An AAGUID has exactly 32.`);
      }
    }

    if (shownKey !== "intro") {
      shownKey = "intro";
      result.innerHTML = introHtml();
    }
  }

  function renderDirectory(): void {
    const query = filter.value;
    const matches = filterGroups(state.groups, query);
    // Unfold a row when the filter matches by AAGUID, so the hit is visible.
    const hex = query.trim().toLowerCase().replace(/-/g, "");
    const byHex = /^[0-9a-f]+$/.test(hex);
    list.innerHTML = matches
      .map((group) =>
        providerRowHtml(
          group,
          byHex && !group.name.toLowerCase().includes(query.trim().toLowerCase()),
        ),
      )
      .join("");
    if (!query.trim()) {
      filterStatus.textContent = "";
      filterStatus.hidden = true;
    } else if (matches.length === 0) {
      filterStatus.hidden = false;
      filterStatus.innerHTML = `No provider matches “${escapeHtml(query.trim())}”. <button type="button" class="inline-btn" data-clear-filter>Clear the filter</button>`;
    } else {
      filterStatus.hidden = false;
      filterStatus.innerHTML = `Showing ${matches.length} of ${state.groups.length}. <button type="button" class="inline-btn" data-clear-filter>Clear the filter</button>`;
    }
    markSelected(normalizeAaguid(input.value.trim()));
  }

  // Bring the result into view when the lookup pane is not already on screen
  // (on phones it sits above the directory; on desktop it's sticky).
  function revealResult(): void {
    const panel = result.querySelector<HTMLElement>(".result") ?? result;
    const rect = panel.getBoundingClientRect();
    const visible = rect.top >= 0 && rect.top < window.innerHeight * 0.6;
    if (!visible) {
      input.closest(".lookup-pane")!.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    }
  }

  function lookUp(aaguid: string, from: HTMLElement | null): void {
    cameFrom = from;
    input.value = aaguid;
    shownKey = null;
    renderLookup();
    revealResult();
  }

  input.addEventListener("input", () => {
    cameFrom = null;
    renderLookup();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && input.value) {
      event.preventDefault();
      input.value = "";
      renderLookup();
    }
  });
  clear.addEventListener("click", () => {
    input.value = "";
    renderLookup();
    input.focus();
  });

  hint.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLElement>("[data-filter-for]");
    if (!button) return;
    filter.value = button.dataset.filterFor ?? "";
    input.value = "";
    renderLookup();
    renderDirectory();
    filter.focus({ preventScroll: true });
    main.querySelector("#directory")!.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  });

  result.addEventListener("click", async (event) => {
    const target = event.target as Element;

    const example = target.closest<HTMLElement>(".example");
    if (example?.dataset.aaguid) {
      lookUp(example.dataset.aaguid, null);
      return;
    }

    const copy = target.closest<HTMLButtonElement>("[data-copy]");
    if (copy) {
      const label = copy.querySelector<HTMLElement>(".copy-label")!;
      const ok = await copyText(copy.dataset.copy ?? "");
      label.textContent = ok ? "Copied" : "Copy failed";
      copy.classList.toggle("is-done", ok);
      window.setTimeout(() => {
        label.textContent = "Copy AAGUID";
        copy.classList.remove("is-done");
      }, 1600);
      return;
    }

    if (target.closest("[data-back]") && cameFrom?.isConnected) {
      const back = cameFrom;
      back.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
      back.focus({ preventScroll: true });
    }
  });

  filter.addEventListener("input", renderDirectory);
  filter.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && filter.value) {
      event.preventDefault();
      filter.value = "";
      renderDirectory();
    }
  });
  filterStatus.addEventListener("click", (event) => {
    if (!(event.target as Element).closest("[data-clear-filter]")) return;
    filter.value = "";
    renderDirectory();
    filter.focus();
  });

  list.addEventListener("click", (event) => {
    const more = (event.target as Element).closest<HTMLButtonElement>(".more-btn");
    if (more) {
      const row = more.closest(".provider-row")!;
      setExpanded(row, !row.classList.contains("is-expanded"));
      return;
    }
    const button = (event.target as Element).closest<HTMLButtonElement>(".aaguid-btn");
    if (button?.dataset.aaguid) lookUp(button.dataset.aaguid, button);
  });

  const initial = new URLSearchParams(window.location.search).get("aaguid");
  if (initial) input.value = initial;
  renderLookup();
  renderDirectory();
}

function failureHtml(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `
    <div class="page-body">
      <p class="error">${escapeHtml(message)} Check your connection and try again.</p>
      <div class="actions"><button type="button" class="btn" data-retry>Try again</button></div>
    </div>
  `;
}

async function start(main: HTMLElement): Promise<void> {
  main.setAttribute("aria-busy", "true");
  main.innerHTML = `<p class="loading muted">Loading the AAGUID registry…</p>`;
  try {
    const [registry, meta] = await Promise.all([loadRegistry(), loadMeta()]);
    mount(main, registry, meta);
  } catch (error) {
    main.innerHTML = failureHtml(error);
    main.querySelector("[data-retry]")?.addEventListener("click", () => start(main), { once: true });
  } finally {
    main.removeAttribute("aria-busy");
  }
}

const app = document.getElementById("app");
if (app) start(renderFrame(app, "lookup"));
