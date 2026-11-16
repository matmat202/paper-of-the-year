/* Pure logic for "The medical turn": story.json -> numbers for the prose and per-chapter
 * particle slots. No DOM, no GL, so node can test it (test/story.test.mjs).
 *
 * One particle is UNIT works A YEAR of one domain, averaged over one period, in the same
 * slot in every chapter: an annual rate, so the last period (shorter than a decade, because
 * the year of the fetch is left out) is drawn at the same scale as the decades. A layout is N slots of [x, y, colour, alpha] in plot space: x, y in 0..1, y up.
 * Every number the prose prints is computed from the counts, never from the dots. */

export const UNIT = 10;
// OpenAlex domain ids, in story.json's s/w arrays at index id - 1
export const LIFE = 1, SOCIAL = 2, PHYS = 3, HEALTH = 4;
export const NAMES = { 1: 'Life Sciences', 2: 'Social Sciences', 3: 'Physical Sciences', 4: 'Health Sciences' };
// bottom-up stack order: health on the baseline, physical on top, so both read as shares
export const STACK = [HEALTH, LIFE, SOCIAL, PHYS];

/* Periods: decades from 1950 (before it Stanford published under 200 works a year, too
 * few dots to show a mix); the last runs to the last FULL year (the year of the fetch is
 * partial, and a partial year would drag its period's mix). */
export function periods(D) {
  const last = Number(D.fetched.slice(0, 4)) - 1;
  return [
    ...[1950, 1960, 1970, 1980, 1990, 2000, 2010].map((y) => ({ lo: y, hi: y + 10, label: `${y}s`, short: `${y}s` })),
    { lo: 2020, hi: last + 1, label: `2020–${String(last).slice(2)}`, short: `2020–${String(last).slice(2)}` },
  ];
}

export const yearsOf = (D) => Object.keys(D.years).map(Number).filter((y) => y >= 1950 && y < Number(D.fetched.slice(0, 4)));
export const count = (D, y, who, dom) => D.years[y][who][dom - 1];
export const total = (D, y, who) => D.years[y][who].reduce((a, b) => a + b, 0);

/* Per period and side ('s' Stanford, 'w' world): domain counts and their sum. */
export function sums(D, who) {
  return periods(D).map((p) => {
    const c = [0, 0, 0, 0];
    for (let y = p.lo; y < p.hi; y++) if (D.years[y]) D.years[y][who].forEach((v, i) => { c[i] += v; });
    return { ...p, c, n: c.reduce((a, b) => a + b, 0), years: p.hi - p.lo };
  });
}
export const share = (b, dom) => (b.n ? b.c[dom - 1] / b.n : 0);
export const byLabel = (bins, label) => {
  const b = bins.find((x) => x.label === label || x.short === label);
  if (!b) throw new Error(`no period ${label}`);
  return b;
};
export const yearShare = (D, y, who, dom) => count(D, y, who, dom) / total(D, y, who);

/* The first year from which Health has out-published Physical at Stanford every year. */
export function overtake(D) {
  const ys = yearsOf(D).sort((a, b) => a - b);
  let from = null;
  for (const y of ys) {
    if (count(D, y, 's', HEALTH) > count(D, y, 's', PHYS)) from ??= y; else from = null;
  }
  return from;
}

/* The dots: per period, per domain, round(works a year / UNIT), in stack order. */
export function dots(D) {
  const out = [];
  sums(D, 's').forEach((b, bi) => {
    for (const dom of STACK) {
      const k = Math.round(b.c[dom - 1] / b.years / UNIT);
      for (let j = 0; j < k; j++) out.push({ bin: bi, dom });
    }
  });
  return out;
}

/* Colours are palette indices (story.js): 0 ink, 1 health, 2 physical, 3 social, 4 life, 5 grey. */
export const C = { ink: 0, [HEALTH]: 1, [PHYS]: 2, [SOCIAL]: 3, [LIFE]: 4, grey: 5 };
export const domColour = (d) => C[d.dom];

const mulberry = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* A free-floating field: the opening. */
export function field(ds) {
  const rnd = mulberry(7), slots = new Float32Array(ds.length * 4);
  ds.forEach((_, i) => slots.set([rnd(), rnd() * 0.9 + 0.05, C.ink, 0.8], i * 4));
  return { kind: 'field', slots };
}

/* Unit columns by period, stacked in STACK order from the baseline.
 *   stretch: each column fills the full height, so each colour reads as a share
 *   colour(d): palette entry
 * `per` dots per row is chosen so a cell is as square as it can be in a plot of aspect a
 * while the tallest column fits; `cell` is a cell's width as a plot fraction. */
export function columns(ds, K, a, { stretch = false, colour = domColour } = {}) {
  const colW = 1 / K, barW = colW * 0.78, top = 0.9;
  const groups = Array.from({ length: K }, () => []);
  ds.forEach((d, i) => groups[d.bin].push(i));
  for (const g of groups) g.sort((x, y) => STACK.indexOf(ds[x].dom) - STACK.indexOf(ds[y].dom) || x - y);
  const max = Math.max(...groups.map((g) => g.length));
  let per = 1, best = Infinity;
  for (let k = 1; k <= 60; k++) {
    const cw = (barW / k) * a, ch = top / Math.ceil(max / k);
    const off = Math.abs(Math.log(cw / ch));
    if (off < best) { best = off; per = k; }
  }
  const rowsMax = Math.ceil(max / per), dyCount = top / rowsMax;
  const slots = new Float32Array(ds.length * 4);
  groups.forEach((g, b) => {
    const rows = Math.ceil(g.length / per), dy = stretch ? top / rows : dyCount;
    const x0 = b * colW + (colW - barW) / 2;
    g.forEach((i, j) => {
      const r = Math.floor(j / per), c = j % per;
      slots.set([x0 + (c + 0.5) * (barW / per), (r + 0.5) * dy, colour(ds[i]), 1], i * 4);
    });
  });
  return { kind: 'columns', slots, per, cell: barW / per, counts: groups.map((g) => g.length), stretch };
}
