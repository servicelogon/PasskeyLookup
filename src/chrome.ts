// The same chrome as newfrontiersecurity.net and the other Toolbox tools
// (CAP Evaluator, Entra Token Lab): logo, three links, a full-screen menu on
// phones, the tool intro with its section tabs, and the wireframe footer mark.

export const SITE = "https://newfrontiersecurity.net";
const SOURCE = "https://github.com/servicelogon/PasskeyLookup";

const NAV_LINKS: [string, string][] = [
  ["Blog", `${SITE}/`],
  ["Newsroom", `${SITE}/newsroom`],
  ["Toolbox", `${SITE}/tools`],
];

export type Section = "lookup" | "bulk";

const TABS: { id: Section; href: string; label: string }[] = [
  { id: "lookup", href: "./", label: "Lookup" },
  { id: "bulk", href: "./bulk.html", label: "Bulk upload" },
];

function navLinks(): string {
  return NAV_LINKS.map(
    ([name, href]) =>
      `<a href="${href}"${name === "Toolbox" ? ' aria-current="page"' : ""}>${name}</a>`,
  ).join("");
}

function headerHtml(): string {
  return `
    <a class="skip" href="#main">Skip to content</a>
    <header class="topbar shell">
      <a class="brand" href="${SITE}/" aria-label="New Frontier Security home">
        <img class="brand-logo" src="./new-frontier-security-logo.png" width="837" height="349" alt="New Frontier Security" />
      </a>
      <div class="header-actions">
        <nav class="desktop-nav" aria-label="Main navigation">${navLinks()}</nav>
        <div class="site-menu">
          <button type="button" class="menu-toggle" aria-expanded="false" aria-controls="mobile-nav" aria-label="Open navigation menu">
            <span class="hamburger" aria-hidden="true"></span>
          </button>
          <nav id="mobile-nav" aria-label="Mobile navigation" hidden>${navLinks()}</nav>
        </div>
      </div>
    </header>
  `;
}

function toolIntroHtml(active: Section): string {
  const tabs = TABS.map(
    (tab, index) => `
      <li>
        <a href="${tab.href}"${tab.id === active ? ' aria-current="page"' : ""}>
          <span class="tab-num" aria-hidden="true">0${index + 1}</span>${tab.label}
        </a>
      </li>`,
  ).join("");

  return `
    <section class="tool-intro shell" aria-labelledby="tool-title">
      <div class="tool-intro-row">
        <p class="kicker">Toolbox</p>
        <a class="text-btn" href="${SOURCE}" target="_blank" rel="noopener noreferrer">Source<span class="visually-hidden"> on GitHub (opens in a new tab)</span></a>
      </div>
      <h1 id="tool-title">Passkey AAGUID Lookup</h1>
      <p class="opening-line">
        Match an AAGUID to the passkey provider that made it, one at a time or a
        whole CSV at once. Everything runs in your browser.
      </p>
    </section>
    <nav class="tool-tabs" aria-label="Sections">
      <ol class="shell tool-tabs-track">${tabs}</ol>
    </nav>
  `;
}

function footerHtml(): string {
  return `
    <footer class="site-footer">
      <div class="footer-mark"><canvas class="footer-wire" width="180" height="180" aria-hidden="true"></canvas></div>
      <div class="footer-base">
        <div class="footer-base-inner">
          <div>
            <p class="footer-name">New Frontier Security</p>
            <p class="footer-note">Provider labels use community data; they aren’t a basis for security decisions.</p>
          </div>
          <nav class="footer-nav" aria-label="Footer">${navLinks()}</nav>
        </div>
      </div>
    </footer>
  `;
}

// Renders the page frame and returns the element the page content goes in.
export function renderFrame(app: HTMLElement, active: Section): HTMLElement {
  app.innerHTML = `
    ${headerHtml()}
    ${toolIntroHtml(active)}
    <main id="main" class="page shell" tabindex="-1"></main>
    ${footerHtml()}
  `;
  initMenu(app);
  initFooterWire(app.querySelector<HTMLCanvasElement>(".footer-wire"));
  return app.querySelector<HTMLElement>("#main")!;
}

function initMenu(root: HTMLElement): void {
  const menu = root.querySelector<HTMLElement>(".site-menu");
  const toggle = menu?.querySelector<HTMLButtonElement>(".menu-toggle");
  const nav = menu?.querySelector<HTMLElement>("#mobile-nav");
  if (!menu || !toggle || !nav) return;

  const wide = window.matchMedia("(min-width: 701px)");

  const setOpen = (open: boolean, restoreFocus = false) => {
    menu.classList.toggle("open", open);
    nav.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    document.documentElement.classList.toggle("nav-open", open);
    if (open) nav.querySelector<HTMLElement>("a")?.focus();
    else if (restoreFocus) toggle.focus();
  };

  toggle.addEventListener("click", () => setOpen(!menu.classList.contains("open")));
  nav.addEventListener("click", (event) => {
    if ((event.target as Element).closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (!menu.classList.contains("open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false, true);
      return;
    }
    // Keep Tab inside the open menu: its links and the close button.
    if (event.key === "Tab") {
      const stops = [...nav.querySelectorAll<HTMLElement>("a"), toggle];
      const index = stops.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? (index <= 0 ? stops.length : index) - 1
        : (index + 1) % stops.length;
      event.preventDefault();
      stops[next].focus();
    }
  });
  // Rotating a phone into a desktop width closes the menu.
  wide.addEventListener("change", () => {
    if (wide.matches) setOpen(false);
  });
  // Coming back through the back/forward cache must not show a stale open menu.
  window.addEventListener("pageshow", () => setOpen(false));
}

// A hairline icosahedron that turns slowly, ported from the NFS site. A still
// frame when motion is reduced, and nothing at all where canvas is missing.
function initFooterWire(canvas: HTMLCanvasElement | null): void {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;

  const phi = (1 + Math.sqrt(5)) / 2;
  const verts = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ].map(([x, y, z]) => {
    const l = Math.hypot(x, y, z);
    return [x / l, y / l, z / l];
  });
  const edges = [
    [0, 1], [0, 5], [0, 7], [0, 10], [0, 11], [1, 5], [1, 7], [1, 8], [1, 9], [2, 3],
    [2, 4], [2, 6], [2, 10], [2, 11], [3, 4], [3, 6], [3, 8], [3, 9], [4, 5], [4, 9],
    [4, 11], [5, 9], [5, 11], [6, 7], [6, 8], [6, 10], [7, 8], [7, 10], [8, 9], [10, 11],
  ];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const tilt = 0.62;
  let frame = 0;
  let running = false;

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 168;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = canvas.width;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const project = ([x, y, z]: number[], yaw: number) => {
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
    const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    return {
      x: x1,
      y: y * Math.cos(tilt) - z1 * Math.sin(tilt),
      z: y * Math.sin(tilt) + z1 * Math.cos(tilt),
    };
  };
  const draw = (yaw: number) => {
    const w = canvas.clientWidth || 168;
    const r = w * 0.36;
    ctx.clearRect(0, 0, w, w);
    ctx.lineWidth = 1;
    ctx.strokeStyle = getComputedStyle(canvas).color;
    const lines = edges
      .map(([a, b]) => {
        const s = project(verts[a], yaw);
        const e = project(verts[b], yaw);
        return { s, e, d: (s.z + e.z) / 2 };
      })
      .sort((p, q) => p.d - q.d);
    for (const line of lines) {
      ctx.globalAlpha = line.d < 0 ? 0.28 : 0.9;
      ctx.beginPath();
      ctx.moveTo(w / 2 + line.s.x * r, w / 2 - line.s.y * r);
      ctx.lineTo(w / 2 + line.e.x * r, w / 2 - line.e.y * r);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  const tick = (now: number) => {
    draw(now * 0.00018);
    frame = requestAnimationFrame(tick);
  };
  const start = () => {
    if (running || reduce.matches) return;
    running = true;
    frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
    draw(0.4);
  };

  size();
  draw(0.4);
  new ResizeObserver(() => {
    size();
    if (!running) draw(0.4);
  }).observe(canvas);
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(canvas);
  reduce.addEventListener("change", () => (reduce.matches ? stop() : start()));
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers, or a page served without a secure context.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
