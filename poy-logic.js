/* Pure logic for Paper of the Year: picking the list for a field, search, author lines,
 * the citation bar, URL state. No DOM; tested by site/poy-logic.test.mjs. */

export const DOMAIN_KEYS = ['', '1', '2', '3', '4']; // '' = every field

// The works shown for a year under a field filter: overall top, or that domain's top.
export function worksFor(year, domain) {
  return domain ? (year.domains[domain] || []) : year.top;
}

export const fold = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

/* Years whose shown works match a query (every word, in title, authors, topic or
 * field). Each kept year carries only its matching works, in their original order. */
export function search(years, domain, q) {
  const words = fold(q).split(/\s+/).filter(Boolean);
  const out = [];
  for (const y of years) {
    const ws = worksFor(y, domain).filter((w) => {
      if (!words.length) return true;
      const hay = fold(`${w.title} ${w.authors.map((a) => a[0]).join(' ')} ${w.topic || ''} ${w.field || ''}`);
      return words.every((x) => hay.includes(x));
    });
    // "of N" is the pool the list was drawn from: that field's works when one is chosen.
    const count = domain ? (y.domain_counts || {})[domain] ?? null : y.count;
    if (ws.length) out.push({ year: y.year, count, works: ws });
  }
  return out;
}

/* "Ann Lee, Bo Chen + 3 more": up to `max` names, Stanford authors flagged for bolding.
 * Returns [{name, stanford}] plus the hidden count; a truncated OpenAlex list says so. */
export function authorLine(w, max = 4) {
  const shown = w.authors.slice(0, max).map(([name, s]) => ({ name, stanford: !!s }));
  const hidden = w.authors.length - shown.length + (w.more || 0);
  // A Stanford author past the cut is the reason the paper is here; never hide all of them.
  if (!shown.some((a) => a.stanford)) {
    const s = w.authors.slice(max).find((a) => a[1]);
    if (s) return { shown: [...shown, { name: s[0], stanford: true }], hidden: hidden - 1, truncated: !!w.truncated, gap: true };
  }
  return { shown, hidden, truncated: !!w.truncated, gap: false };
}

// Citation bar width in [0, 1], log scale: Bandura's 46,778 next to Hotelling's 177
// would make every pre-war bar invisible on a linear scale.
export function barFrac(cites, max) {
  if (!(cites > 0) || !(max > 0)) return 0;
  return Math.min(1, Math.log10(cites + 1) / Math.log10(max + 1));
}

export const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'));

export function workUrl(w) {
  return w.doi || `https://openalex.org/${w.id}`;
}

export const decadeOf = (y) => Math.floor(y / 10) * 10;

// ?f=3&q=cryptography — unknown values fall back.
export function encodeState({ domain, q }) {
  const p = new URLSearchParams();
  if (domain) p.set('f', domain);
  if (q && q.trim()) p.set('q', q.trim());
  const s = p.toString();
  return s ? `?${s}` : '';
}
export function decodeState(search) {
  const p = new URLSearchParams(search || '');
  const f = p.get('f') || '';
  return { domain: DOMAIN_KEYS.includes(f) ? f : '', q: (p.get('q') || '').slice(0, 80) };
}
