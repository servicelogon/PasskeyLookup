export type Theme = "light" | "dark";

const THEME_KEY = "nfs-theme";

export const SUN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>`;
export const MOON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

export function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

export function isDarkActive(): boolean {
  const stored = getStoredTheme();
  if (stored) return stored === "dark";
  return document.documentElement.dataset.theme !== "light";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

export function applyStoredThemeOnLoad(): void {
  const stored = getStoredTheme();
  document.documentElement.dataset.theme = stored ?? "dark";
}

function updateToggle(button: HTMLButtonElement): void {
  const light = document.documentElement.dataset.theme === "light";
  button.innerHTML = light ? MOON_ICON : SUN_ICON;
  button.setAttribute("aria-pressed", String(light));
  button.setAttribute("aria-label", `Switch to ${light ? "dark" : "light"} mode`);
  button.setAttribute("title", `Switch to ${light ? "dark" : "light"} mode`);
}

export function initSiteMenu(): void {
  const menu = document.querySelector<HTMLDetailsElement>(".site-menu");
  if (!menu) return;

  const summary = menu.querySelector("summary");
  menu.addEventListener("toggle", () => {
    summary?.setAttribute("aria-label", menu.open ? "Close navigation menu" : "Open navigation menu");
  });
  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target as Node)) menu.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      summary?.focus();
    }
  });
}

export function initThemeToggle(button: HTMLButtonElement, onChange: () => void): void {
  button.addEventListener("click", () => {
    applyTheme(isDarkActive() ? "light" : "dark");
    updateToggle(button);
    onChange();
  });

  updateToggle(button);
}

export function initChrome(themeToggle: HTMLButtonElement, onThemeChange: () => void): void {
  initThemeToggle(themeToggle, onThemeChange);
  initSiteMenu();
}

export function topbarHtml(active: "lookup" | "bulk"): string {
  const lookupCurrent = active === "lookup" ? ' aria-current="page"' : "";
  const bulkCurrent = active === "bulk" ? ' aria-current="page"' : "";
  const links = `<a href="./index.html"${lookupCurrent}>Lookup</a><a href="./bulk.html"${bulkCurrent}>Bulk</a>`;
  return `
    <a class="skip" href="#main">Skip to content</a>
    <header class="topbar">
      <a class="brand" href="./index.html">Passkey Lookup</a>
      <div class="header-actions">
        <nav class="desktop-nav" aria-label="Main navigation">${links}</nav>
        <button
          id="theme-toggle"
          class="theme-toggle"
          type="button"
          aria-label="Switch to light mode"
          title="Switch to light mode"
          aria-pressed="false"
        ></button>
        <details class="site-menu">
          <summary aria-label="Open navigation menu"><span class="hamburger" aria-hidden="true"></span></summary>
          <nav aria-label="Mobile navigation">${links}</nav>
        </details>
      </div>
    </header>
  `;
}

export function footerHtml(): string {
  return `
    <footer class="site-footer">
      <p>
        Data from the community
        <a href="https://github.com/passkeydeveloper/passkey-authenticator-aaguids" target="_blank" rel="noopener noreferrer">passkey-authenticator-aaguids</a>
        registry. For UI labeling only — not for security decisions.
        See <a href="https://web.dev/articles/webauthn-aaguid" target="_blank" rel="noopener noreferrer">web.dev</a>.
      </p>
    </footer>
  `;
}
