/* The scrolling story: each <section class="step"> names a layout in data-kind; as the
 * reader scrolls from one step to the next, every dot flies from the old layout to the
 * new one. Numbers in the prose are not typed in: a <b data-fact="..."> is filled from
 * story.json, so the text cannot drift from the chart. Modelled on stanford-roots/story. */
import { UNIT, HEALTH, PHYS, C, periods, yearsOf, count, total, sums, share, byLabel, overtake, dots, field, columns } from './layout.js';
import { createPoints } from './gl.js';

// 0 ink, 1 health (cardinal), 2 physical (slate blue), 3 social (gold), 4 life (green), 5 grey
const PAL = [[0.11, 0.1, 0.09], [0.55, 0.08, 0.08], [0.17, 0.33, 0.52], [0.72, 0.5, 0.05], [0.24, 0.47, 0.29], [0.76, 0.74, 0.7]];

const pct = (v) => `${Math.round(v * 100)}%`;
const fmt = (n) => n.toLocaleString('en-US');

/* "share:3:1960s" -> "52%". Unknown kinds throw: a typo must not render as blank. */
export function fact(D, spec) {
  const S = sums(D, 's'), W = sums(D, 'w');
  const [kind, ...a] = spec.split(':');
  const ys = yearsOf(D);
  const annual = (dom, lo, hi) => ys.filter((y) => y >= lo && y <= hi).map((y) => count(D, y, 's', dom));
  switch (kind) {
    case 'total': return fmt(ys.reduce((s, y) => s + total(D, y, 's'), 0));
    case 'unit': return fmt(UNIT);
    case 'first': return String(Math.min(...ys));
    case 'last': return String(Math.max(...ys));
    case 'yt': return fmt(total(D, +a[0], 's'));
    case 'yc': return fmt(count(D, +a[0], 's', +a[1]));
    case 'share': return pct(share(byLabel(S, a[1]), +a[0]));
    case 'wshare': return pct(share(byLabel(W, a[1]), +a[0]));
    case 'ratio': return `${(share(byLabel(S, a[1]), +a[0]) / share(byLabel(W, a[1]), +a[0])).toFixed(1)}×`;
    case 'pc': return fmt(byLabel(S, a[1]).c[+a[0] - 1]);
    case 'ymin': return fmt(Math.min(...annual(+a[0], +a[1], +a[2])));
    case 'ymax': return fmt(Math.max(...annual(+a[0], +a[1], +a[2])));
    case 'overtake': return String(overtake(D));
    case 'lastp': return periods(D).at(-1).label;
    default: throw new Error(`unknown fact ${spec}`);
  }
}

const only = (dom) => (d) => (d.dom === dom ? C[dom] : C.grey);

/* data-kind -> layout */
export function layoutFor(step, ds, K, aspect) {
  switch (step.dataset.kind) {
    case 'field': return field(ds);
    case 'counts': return columns(ds, K, aspect);
    case 'share': return columns(ds, K, aspect, { stretch: true });
    case 'health': case 'world': return columns(ds, K, aspect, { stretch: true, colour: only(HEALTH) });
    case 'phys-world': return columns(ds, K, aspect, { stretch: true, colour: only(PHYS) });
    case 'phys-counts': return columns(ds, K, aspect, { colour: only(PHYS) });
    default: throw new Error(`unknown layout ${step.dataset.kind}`);
  }
}

/* What the axis labels say on each kind of step: [value per period, css class, unit line,
 * world marker (fraction of the column height measured from the baseline) or null]. */
export function axisFor(kind, S, W, i) {
  const sh = (b, d) => share(b, d);
  switch (kind) {
    case 'counts': return [fmt(Math.round(S[i].n / S[i].years)), '', `one dot = ${UNIT} works a year · works a year, averaged over the period`, null];
    case 'share': return [pct(sh(S[i], PHYS)), 'phys', 'each column stretched to 100% · % = physical sciences', null];
    case 'health': return [pct(sh(S[i], HEALTH)), '', 'each column stretched to 100% · % = health sciences', null];
    case 'world': return [pct(sh(S[i], HEALTH)), '', '% = Stanford · black line = the world’s health share', sh(W[i], HEALTH)];
    case 'phys-world': return [pct(sh(S[i], PHYS)), 'phys', '% = Stanford · black line = the world’s physical share', 1 - sh(W[i], PHYS)];
    case 'phys-counts': return [fmt(Math.round(S[i].c[PHYS - 1] / S[i].years)), 'phys', `one dot = ${UNIT} works a year · physical-sciences works a year`, null];
    default: return null;
  }
}

async function main() {
  const D = await (await fetch('../data/story.json')).json();
  for (const el of document.querySelectorAll('[data-fact]')) el.textContent = fact(D, el.dataset.fact);
  const P = periods(D), S = sums(D, 's'), W = sums(D, 'w'), K = P.length;
  const ds = dots(D);

  const steps = [...document.querySelectorAll('.step')];
  const canvas = document.getElementById('gl');
  const plot = document.getElementById('plot');
  const axes = document.getElementById('axes');

  let layouts = [];
  const relayout = () => {
    const a = plot.clientWidth / Math.max(1, plot.clientHeight);
    layouts = steps.map((s) => layoutFor(s, ds, K, a));
    window.__story = { dots: ds.length, layouts: layouts.map((l) => ({ kind: l.kind, counts: l.counts })) };
  };
  relayout();

  const pts = createPoints(canvas, ds.length, PAL);
  if (!pts) { document.body.classList.add('nogl'); return; }
  const dpr = Math.min(2, devicePixelRatio || 1);
  let shown = -1;
  const resize = () => {
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
    relayout();
    shown = -1;
  };
  resize();
  addEventListener('resize', resize);

  // the step whose top has crossed mid-viewport is "from", and t runs 0 -> 1 as the next
  // step's top rises from the bottom to the middle
  const progress = () => {
    const line = innerHeight * 0.5;
    let i = 0;
    for (let k = 0; k < steps.length; k++) if (steps[k].getBoundingClientRect().top < line) i = k;
    const next = steps[i + 1];
    if (!next) return { i, t: 0 };
    const top = next.getBoundingClientRect().top;
    return { i, t: Math.min(1, Math.max(0, 1 - (top - line) / (innerHeight - line))) };
  };

  const drawAxes = (lay, step) => {
    const html = [];
    if (lay.kind === 'columns') {
      const narrow = plot.clientWidth < 600, kind = step.dataset.kind;
      let unit = '';
      P.forEach((b, i) => {
        const x = ((i + 0.5) / K) * 100;
        html.push(`<span class="tick" style="left:${x}%">${narrow ? b.short.replace(/^(\d\d)(\d\d)s$/, "'$2s").replace(/^20(\d\d)–/, "'$1–") : b.short}</span>`);
        const ax = axisFor(kind, S, W, i);
        if (!ax) return;
        const [v, cls, u, mark] = ax;
        unit = u;
        html.push(`<span class="val ${cls}" style="left:${x}%">${narrow && /,/.test(v) ? `${Math.round(Number(v.replace(/,/g, '')) / 1000)}k` : v}</span>`);
        if (mark != null) html.push(`<span class="mark" style="left:${(i / K + 0.11 / K) * 100}%;width:${(0.78 / K) * 100}%;bottom:${mark * 90}%"></span>`);
      });
      if (unit) html.push(`<span class="unit">${unit}</span>`);
    }
    axes.innerHTML = html.join('');
  };

  const t0 = performance.now();
  const frame = () => {
    const { i, t } = progress();
    const j = Math.min(i + 1, steps.length - 1);
    const A = layouts[i], Bl = layouts[j];
    pts.set(A.slots, Bl.slots);
    const cur = t > 0.5 ? j : i;
    if (cur !== shown) {
      shown = cur;
      drawAxes(layouts[cur], steps[cur]);
      document.body.dataset.step = cur;
    }
    axes.style.opacity = String(Math.abs(t - 0.5) * 2);
    const r = plot.getBoundingClientRect();
    const sz = (l) => (l.kind === 'columns' ? Math.max(2, l.cell * r.width * 0.86) : Math.max(3, r.width / 150));
    const size = sz(A) + (sz(Bl) - sz(A)) * t;
    pts.draw({ t, time: (performance.now() - t0) / 1000, size, rect: [r.left, r.top, r.width, r.height], dpr });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') main().catch((e) => {
  document.body.classList.add('failed');
  document.getElementById('err').textContent = String(e.message || e);
  console.error(e);
});
