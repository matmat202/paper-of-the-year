/* Pure logic for Paper of the Year: picking the list for a field, search, author lines,
 * the citation bar, URL state. No DOM; tested by site/poy-logic.test.mjs. */

export const DOMAIN_KEYS = ['', '1', '2', '3', '4']; // '' = every field

// The works shown for a year under a field filter: overall top, or that domain's top.
export function worksFor(year, domain) {
  return domain ? (year.domains[domain] || []) : year.top;
}

export const fold = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

// "1998" is that year and "1990s" that decade: the first thing people type into this box
// is a birth year, and no title holds one.
const yearWord = (x, year) => (/^\d{4}$/.test(x) && +x === year) || (/^\d{3}0s$/.test(x) && +x.slice(0, 4) === decadeOf(year));

/* Years whose shown works match a query (every word, in title, authors, topic or
 * field, or the year itself). Each kept year carries only its matching works, in their
 * original order. */
export function search(years, domain, q) {
  const words = fold(q).split(/\s+/).filter(Boolean);
  const out = [];
  for (const y of years) {
    const ws = worksFor(y, domain).filter((w) => {
      if (!words.length) return true;
      const hay = fold(`${w.title} ${w.authors.map((a) => a[0]).join(' ')} ${w.topic || ''} ${w.field || ''}`);
      return words.every((x) => yearWord(x, y.year) || hay.includes(x));
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
  return w.doi || w.url || `https://openalex.org/${w.id}`;
}

// The year the counts were fetched in is still running: its list is a leader, not a result.
export const isPartial = (year, fetched) => year >= Number(String(fetched || '').slice(0, 4));

// "12 Nov 2026" from the extract's ISO date; the date as given if it does not parse.
export function asOf(fetched) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fetched || '');
  if (!m) return String(fetched || '');
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1];
  return mon ? `${+m[3]} ${mon} ${m[1]}` : String(fetched);
}

export const decadeOf = (y) => Math.floor(y / 10) * 10;

// ?f=3&q=cryptography&o=new — unknown values fall back.
export function encodeState({ domain, q, newest }) {
  const p = new URLSearchParams();
  if (domain) p.set('f', domain);
  if (q && q.trim()) p.set('q', q.trim());
  if (newest) p.set('o', 'new');
  const s = p.toString();
  return s ? `?${s}` : '';
}
export function decodeState(search) {
  const p = new URLSearchParams(search || '');
  const f = p.get('f') || '';
  return { domain: DOMAIN_KEYS.includes(f) ? f : '', q: (p.get('q') || '').slice(0, 80), newest: p.get('o') === 'new' };
}

// The list opens at 1900; "newest first" puts the years people know at the top instead of
// ~20,000 px down a phone. A copy, so the data's own order is never flipped under search.
export const ordered = (rows, newest) => (newest ? [...rows].sort((a, b) => b.year - a.year) : rows);

/* The link to one year's entry, for sharing: "?f=3#y1998" when that year has works in the
 * chosen field, "#y1998" otherwise. Never the search: a friend opening the link must land
 * on the year, and a query they did not type could hide it. */
export function yearLink(years, year, domain) {
  const y = years.find((r) => r.year === year);
  const f = domain && y && worksFor(y, domain).length ? domain : '';
  return `${encodeState({ domain: f, q: '' })}#y${year}`;
}

// "#y1998" -> 1998; anything else -> null.
export const hashYear = (hash) => { const m = /^#y(\d{4})$/.exec(hash || ''); return m ? +m[1] : null; };
