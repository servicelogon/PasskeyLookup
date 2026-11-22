// The footer mark: a hairline wireframe that turns slowly, drawn the same way
// as the icosahedron on newfrontiersecurity.net (1px strokes, back edges faint,
// one slow turn). On this tool the solid is a low-poly key that turns about its
// own shaft, as if in a lock. A still frame when motion is reduced, and nothing
// at all where canvas is missing.

type Vec = [number, number, number];

interface Wire {
  verts: Vec[];
  edges: [number, number][];
}

// Builds the key standing upright (bow up, tip down, teeth to +x), then
// recentres and scales it to fit the unit sphere like the icosahedron.
function buildKey(): Wire {
  const verts: Vec[] = [];
  const edges: [number, number][] = [];
  const v = (x: number, y: number, z: number) => verts.push([x, y, z]) - 1;
  const e = (a: number, b: number) => edges.push([a, b]);

  const T = 0.07; // half thickness of the blank
  const W = 0.055; // half width of the shaft

  // Bow: an octagonal ring with an octagonal hole, front and back faces.
  const cy = 0.52;
  const R = 0.34;
  const r = 0.15;
  const N = 8;
  const ring = (radius: number) => {
    const front: number[] = [];
    const back: number[] = [];
    for (let k = 0; k < N; k++) {
      const a = -Math.PI / 2 + (k * 2 * Math.PI) / N;
      const x = radius * Math.cos(a);
      const y = cy + radius * Math.sin(a);
      front.push(v(x, y, T));
      back.push(v(x, y, -T));
    }
    for (let k = 0; k < N; k++) {
      e(front[k], front[(k + 1) % N]);
      e(back[k], back[(k + 1) % N]);
      e(front[k], back[k]);
    }
  };
  ring(R);
  ring(r);

  // Shaft: four long edges from where they meet the bow's lower facets,
  // down to a pointed tip.
  const top = cy - R + W * Math.tan(Math.PI / N); // on the bottom facets of the bow
  const base = -0.78;
  const tip = v(0, -0.9, 0);
  for (const [sx, sz] of [[-W, T], [W, T], [W, -T], [-W, -T]] as const) {
    const a = v(sx, top, sz);
    const b = v(sx, base, sz);
    e(a, b);
    e(b, tip);
  }

  // A box: the shoulder under the bow and the two teeth of the bit.
  const box = (x0: number, x1: number, y0: number, y1: number) => {
    const c = [
      v(x0, y0, T), v(x1, y0, T), v(x1, y1, T), v(x0, y1, T),
      v(x0, y0, -T), v(x1, y0, -T), v(x1, y1, -T), v(x0, y1, -T),
    ];
    for (let k = 0; k < 4; k++) {
      e(c[k], c[(k + 1) % 4]);
      e(c[k + 4], c[((k + 1) % 4) + 4]);
      e(c[k], c[k + 4]);
    }
  };
  box(-0.12, 0.12, 0.07, 0.13);
  box(W, 0.22, -0.52, -0.38);
  box(W, 0.16, -0.74, -0.6);

  // Centre on the origin and fit inside the unit sphere.
  const ys = verts.map((p) => p[1]);
  const mid = (Math.max(...ys) + Math.min(...ys)) / 2;
  const reach = Math.max(...verts.map(([x, y, z]) => Math.hypot(x, y - mid, z)));
  return { verts: verts.map(([x, y, z]) => [x / reach, (y - mid) / reach, z / reach]), edges };
}

const KEY = buildKey();
// Lean the top of the key toward the viewer, then tilt it onto the diagonal
// with the bow at upper left, the way a key icon is usually drawn.
const LEAN = 0.32;
const ROLL = 0.62;
const SPEED = 0.00018; // radians per millisecond, as on the NFS site
const STILL = 0.4;

export function initFooterWire(canvas: HTMLCanvasElement | null): void {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const [cl, sl, cr, sr] = [Math.cos(LEAN), Math.sin(LEAN), Math.cos(ROLL), Math.sin(ROLL)];
  let frame = 0;
  let running = false;

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 168;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = canvas.width;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  // Turn about the shaft, lean toward the viewer, then roll onto the diagonal.
  const project = ([x, y, z]: Vec, yaw: number) => {
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
    const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const y2 = y * cl - z1 * sl;
    const z2 = y * sl + z1 * cl;
    return { x: x1 * cr - y2 * sr, y: x1 * sr + y2 * cr, z: z2 };
  };
  const draw = (yaw: number) => {
    const w = canvas.clientWidth || 168;
    const r = w * 0.44;
    ctx.clearRect(0, 0, w, w);
    ctx.lineWidth = 1;
    ctx.strokeStyle = getComputedStyle(canvas).color;
    const lines = KEY.edges
      .map(([a, b]) => {
        const s = project(KEY.verts[a], yaw);
        const e = project(KEY.verts[b], yaw);
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
    draw(now * SPEED);
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
    draw(STILL);
  };

  size();
  draw(STILL);
  new ResizeObserver(() => {
    size();
    if (!running) draw(STILL);
  }).observe(canvas);
  new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop())).observe(canvas);
  reduce.addEventListener("change", () => (reduce.matches ? stop() : start()));
}
