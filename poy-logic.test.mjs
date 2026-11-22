// node site/poy-logic.test.mjs — the page's pure logic, plus the shipped data checked
// against what the page promises. Exit 1 on any failure.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as L from './poy-logic.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${extra}`); } };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

const w = (id, title, authors, extra = {}) => ({ id, title, authors, cites: 10, topic: 'Topic', field: 'Field', ...extra });
const years = [
  { year: 1976, count: 1, top: [w('A', 'New directions in cryptography', [['Whitfield Diffie', 1], ['Martin Hellman', 1]])],
    domains: { 3: [w('A', 'New directions in cryptography', [['Whitfield Diffie', 1], ['Martin Hellman', 1]])], 1: [] } },
  { year: 1979, count: 2346, domain_counts: { 2: 900, 3: 700 }, top: [w('B', 'Bootstrap Methods', [['Bradley Efron', 1]]), w('C', 'Metacognition', [['John Flavell', 1]])],
    domains: { 3: [w('B', 'Bootstrap Methods', [['Bradley Efron', 1]])], 2: [w('C', 'Metacognition', [['John Flavell', 1]])] } },
  { year: 1998, count: 1, top: [w('D', 'The anatomy of a large-scale hypertextual Web search engine', [['Sergey Brin', 1], ['Lawrence Page', 1]])],
    domains: {} },
];

// --- field filter & search ----------------------------------------------------------
eq('overall list', L.worksFor(years[1], '').map((x) => x.id), ['B', 'C']);
eq('domain list', L.worksFor(years[1], '2').map((x) => x.id), ['C']);
eq('missing domain is empty, not overall', L.worksFor(years[2], '4'), []);
eq('no query keeps every year', L.search(years, '', '').map((y) => y.year), [1976, 1979, 1998]);
eq('domain with no works drops the year', L.search(years, '3', '').map((y) => y.year), [1976, 1979]);
eq('title search', L.search(years, '', 'search engine').map((y) => y.year), [1998]);
eq('author search, accent- and case-blind', L.search(years, '', 'EFRÓN').map((y) => y.year), [1979]);
eq('every word must match', L.search(years, '', 'brin cryptography'), []);
eq('a year finds that year', L.search(years, '', '1998').map((y) => y.year), [1998]);
eq('a year keeps all its works', L.search(years, '', '1979')[0]?.works.map((x) => x.id), ['B', 'C']);
eq('a decade finds its years', L.search(years, '', '1970s').map((y) => y.year), [1976, 1979]);
eq('year and word both apply', L.search(years, '', '1979 flavell')[0]?.works.map((x) => x.id), ['C']);
eq('year with a word from another year', L.search(years, '', '1998 efron'), []);
eq('a number that is not the year still matches text', L.search(years, '', '1999'), []);
eq('search keeps only matching works', L.search(years, '', 'flavell')[0].works.map((x) => x.id), ['C']);
eq('search within a field', L.search(years, '2', 'bootstrap'), []);
eq('count is the whole year unfiltered', L.search(years, '', 'efron')[0].count, 2346);
eq('count is the field\'s pool when filtered', L.search(years, '3', 'efron')[0].count, 700);

// --- author line ----------------------------------------------------------------------
const many = w('E', 't', [['A1', 0], ['A2', 0], ['A3', 0], ['A4', 0], ['A5', 0], ['S6', 1], ['A7', 0]], { more: 10 });
const al = L.authorLine(many, 4);
eq('a Stanford author past the cut is pulled in', al.shown.map((a) => a.name), ['A1', 'A2', 'A3', 'A4', 'S6']);
ok('and flagged', al.shown[4].stanford && al.gap);
eq('hidden count includes names never shipped', al.hidden, 2 + 10);
const short = L.authorLine(w('F', 't', [['S1', 1], ['A2', 0]]), 4);
eq('short list shown whole', [short.shown.length, short.hidden, short.gap], [2, 0, false]);
ok('truncated flag passes through', L.authorLine(w('G', 't', [['A', 0]], { truncated: true })).truncated);
eq('truncated is a boolean either way, past the cut too', [L.authorLine(many, 4).truncated, L.authorLine({ ...many, truncated: 1 }, 4).truncated,
  L.authorLine(w('G', 't', [['A', 0]])).truncated], [false, true, false]);
eq('four names by default', L.authorLine(w('H', 't', [['A', 1], ['B', 0], ['C', 0], ['D', 0], ['E', 0]])).shown.length, 4);

// --- bar, urls, state -------------------------------------------------------------------
eq('bar of the max is 1', L.barFrac(46778, 46778), 1);
eq('bar of zero is 0', L.barFrac(0, 46778), 0);
ok('bar is log scale: 177 of 46,778 is visible', L.barFrac(177, 46778) > 0.4);
ok('bar is monotonic', L.barFrac(100, 1000) < L.barFrac(200, 1000));
// log10(cites + 1) / log10(max + 1): 9 of 99 is exactly half, 1 of 99 is log10(2)/2.
eq('a count above the max is a full bar', L.barFrac(500, 100), 1);
eq('bar values on the log scale', [L.barFrac(9, 99), +L.barFrac(1, 99).toFixed(6), L.barFrac(1, 1)], [0.5, +(Math.log10(2) / 2).toFixed(6), 1]);
// Compared with ===: eq() goes through JSON, which writes NaN as null.
eq('no bar for nonsense', [L.barFrac(5, 0), L.barFrac(-5, 100), L.barFrac(null, 100), L.barFrac(NaN, 100), L.barFrac(5, NaN)].map((x) => x === 0), [true, true, true, true, true]);
eq('doi preferred', L.workUrl({ id: 'W1', doi: 'https://doi.org/10.1/x' }), 'https://doi.org/10.1/x');
eq('openalex fallback', L.workUrl({ id: 'W1', doi: null }), 'https://openalex.org/W1');
eq('landing page when the DOI is dead', L.workUrl({ id: 'W1', doi: null, url: 'https://jmlr.org/x' }), 'https://jmlr.org/x');
eq('decade', [L.decadeOf(1979), L.decadeOf(1980), L.decadeOf(2025)], [1970, 1980, 2020]);
eq('state encodes', L.encodeState({ domain: '3', q: ' crypto ' }), '?f=3&q=crypto');
eq('empty state', L.encodeState({ domain: '', q: '' }), '');
eq('a field with no query', L.encodeState({ domain: '2' }), '?f=2');
eq('a query is cut at 80', L.decodeState('?q=' + 'x'.repeat(90)).q.length, 80);
eq('fold keeps a zero', L.fold(0), '0');
eq('state round-trips', L.decodeState(L.encodeState({ domain: '4', q: 'a b', newest: true })), { domain: '4', q: 'a b', newest: true });
eq('newest first is in the address', L.encodeState({ domain: '', q: '', newest: true }), '?o=new');
eq('oldest first is the default and leaves no trace', [L.encodeState({ domain: '2', newest: false }), L.decodeState('').newest, L.decodeState('?o=old').newest], ['?f=2', false, false]);

// --- order ------------------------------------------------------------------------------
{
  const rows = [{ year: 1931 }, { year: 2019 }, { year: 1957 }, { year: 2026 }, { year: 1900 }];
  eq('newest first sorts by year, descending', L.ordered(rows, true).map((r) => r.year), [2026, 2019, 1957, 1931, 1900]);
  eq('oldest first keeps the data order', L.ordered(rows, false).map((r) => r.year), [1931, 2019, 1957, 2026, 1900]);
  eq('ordering never flips the rows it was given', rows.map((r) => r.year), [1931, 2019, 1957, 2026, 1900]);
}
eq('bad field falls back', L.decodeState('?f=9').domain, '');

// --- the running year -------------------------------------------------------------------
ok('the fetch year is partial', L.isPartial(2026, '2026-11-12'));
ok('a later year is partial', L.isPartial(2027, '2026-11-12'));
ok('the year before is not', !L.isPartial(2025, '2026-11-12'));
ok('an early-January fetch leaves older years final', !L.isPartial(1950, '2026-01-01'));
eq('as-of date', L.asOf('2026-11-02'), '2 Nov 2026');
eq('as-of keeps an unparseable date', L.asOf('soon'), 'soon');
eq('as-of rejects month 13', L.asOf('2026-13-01'), '2026-13-01');

// --- the shipped data -------------------------------------------------------------------
const here = fileURLToPath(new URL('.', import.meta.url));
const D = JSON.parse(readFileSync(here + 'data/years.json', 'utf8'));
const YS = D.years || D;
// "of N" under a field is that field's pool: never smaller than what it shows, never 0.
eq('shipped: every field\'s pool holds what it shows', YS.flatMap((y) => Object.entries(y.domains).filter(([d, ws]) => ws.length && !(y.domain_counts[d] >= ws.length)).map(([d]) => `${y.year}/${d}`)), []);
const Y = new Map(D.years.map((y) => [y.year, y]));
// Through the fetch year: a pinned last year left 2026 off the page all of November 2026.
const lastYear = Number(D.fetched.slice(0, 4));
eq('every year 1900 through the fetch year', D.years.map((y) => y.year), Array.from({ length: lastYear - 1899 }, (_, i) => 1900 + i));
ok('the fetch date is a real ISO date', /^\d{4}-\d{2}-\d{2}$/.test(D.fetched) && L.asOf(D.fetched) !== D.fetched);
ok('every year has a paper', D.years.every((y) => y.top.length >= 1));
ok('top lists are sorted by citations', D.years.every((y) => y.top.every((x, i) => i === 0 || y.top[i - 1].cites >= x.cites)));
ok('domain lists are sorted by citations', D.years.every((y) => Object.values(y.domains).every((l) => l.every((x, i) => i === 0 || l[i - 1].cites >= x.cites))));
ok('every work has a title, id and link', D.years.every((y) => y.top.every((x) => x.title && /^W\d+$/.test(x.id) && L.workUrl(x))));
// The traps build.py exists to catch, pinned with the years they were found in:
const firstTitles = D.years.map((y) => y.top[0].title.toLowerCase());
ok('1971 is not the 1962 Learning-by-Doing reprint', !/learning by doing/i.test(Y.get(1971).top[0].title));
ok('2017 is not Festinger 1957', !/cognitive dissonance/i.test(Y.get(2017).top[0].title));
ok('1990 is not Hotelling 1929', !/stability in competition/i.test(Y.get(1990).top[0].title));
ok('2001 is not the 1991 Cover & Thomas book', !/elements of information theory/i.test(Y.get(2001).top[0].title));
// Re-dated by their citations (build.py cited_before_its_year), found 2026-11-14 in any list:
const anyList = (y) => [...Y.get(y).top, ...Object.values(Y.get(y).domains).flat()].map((x) => x.title);
ok('2026 does not list Flavell\'s 1987 metacognition chapter', !anyList(2026).some((t) => /development of metacognition/i.test(t)));
ok('2024 does not list Traugott\'s 2002 semantic change book', !anyList(2024).some((t) => /regularity in semantic change/i.test(t)));
ok('2013 does not list Kahneman & Tversky 1984', !anyList(2013).some((t) => /choices, values, and frames/i.test(t)));
ok('the citation rule dropped something', (D.dropped['redated (cited before its year)'] || []).length >= 1);
ok('1960 is not a book review', !/\. By [A-Z]/.test(Y.get(1960).top[0].title));
ok('1906 is not "A Correction"', !/^a correction/i.test(Y.get(1906).top[0].title));
ok('no title is a paper of the year twice', new Set(firstTitles).size === firstTitles.length);
ok('no title appears in two years of any list', (() => {
  const seen = new Map();
  for (const y of D.years) {
    const here2 = new Set([...y.top, ...Object.values(y.domains).flat()].map((x) => x.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()));
    for (const t of here2) { if (seen.has(t)) return false; seen.set(t, y.year); }
  }
  return true;
})());
// Every work names a Stanford author, unless OpenAlex itself cut the list at 100. build.py
// used to keep only the first 8 names, so SciPy 1.0 (Stanford's paper of 2020, its Stanford
// author 66th) and 103 others shipped with nobody from Stanford to bold.
const all = D.years.flatMap((y) => [...y.top, ...Object.values(y.domains).flat()]);
const noStanford = all.filter((x) => !x.authors.some((a) => a[1]));
eq('no Stanford author only where the list is truncated', noStanford.filter((x) => !x.truncated).map((x) => x.id), []);
ok('2020\'s SciPy names its Stanford author', Y.get(2020).top[0].authors.some((a) => a[1]));
ok('the shipped name count adds up', all.every((x) => x.more >= 0 && x.authors.length <= 9));
// --- per-year share links ----------------------------------------------------------
eq('year link, every field', L.yearLink(years, 1998, ''), '#y1998');
ok('a year link never carries the order', !/o=/.test(L.yearLink(years, 1979, '3')));
eq('year link keeps a field the year has', L.yearLink(years, 1979, '3'), '?f=3#y1979');
eq('year link drops a field the year lacks', L.yearLink(years, 1998, '3'), '#y1998');
eq('year link drops an empty field list', L.yearLink(years, 1976, '1'), '#y1976');
eq('year link of an unknown year has no field', L.yearLink(years, 2001, '3'), '#y2001');
eq('hash year', L.hashYear('#y1998'), 1998);
eq('hash that is not a year', [L.hashYear('#foot'), L.hashYear('#y19980'), L.hashYear(''), L.hashYear(undefined)], [null, null, null, null]);
// Every link the page would hand out lands on a drawn row in that field.
for (const d of L.DOMAIN_KEYS) {
  const bad = D.years.filter((y) => { const u = L.yearLink(D.years, y.year, d); const s = L.decodeState(u.split('#')[0]);
    return !L.search(D.years, s.domain, s.q).some((r) => r.year === L.hashYear('#' + u.split('#')[1])); }).map((y) => y.year);
  eq(`shipped: every year link lands on its row (field '${d}')`, bad, []);
}
// Positive controls: the famous ones are still there.
ok('1976 has Diffie-Hellman', Y.get(1976).top.some((x) => /new directions in cryptography/i.test(x.title)));
ok('1998 has the Brin-Page search engine paper', Y.get(1998).top.some((x) => /hypertextual web search engine/i.test(x.title)));
ok('1979 is the bootstrap', /bootstrap/i.test(Y.get(1979).top[0].title));
ok('the Physical Sciences list exists for 1957', (Y.get(1957).domains['3'] || []).length >= 1);
// A DOI doi.org does not have is a dead link (check_dois.py lists them; build.py drops them).
// 10.5555 is ACM's unregistered pseudo-prefix: it never resolves, list or no list.
const DEAD = new Set(JSON.parse(readFileSync(here + '../data/dead-dois.json', 'utf8')).dead);
const shippedDois = D.years.flatMap((y) => [...y.top, ...Object.values(y.domains).flat()]).map((x) => x.doi).filter(Boolean);
eq('shipped: no DOI doi.org says it lacks', [...new Set(shippedDois.filter((d) => DEAD.has(d) || /\/10\.5555\//.test(d)))], []);
const lda = D.years.flatMap((y) => y.top).filter((x) => /latent dirichlet/i.test(x.title));
ok('LDA (2003) links to the paper at jmlr.org, not a dead DOI', lda.length >= 1 && lda.every((x) => /^https:\/\/www\.jmlr\.org\//.test(L.workUrl(x))));

{
  const all = L.ordered(L.search(D.years, '', ''), true);
  eq('newest first opens on the fetch year and ends at 1900', [all[0].year, all.at(-1).year, all.length], [Number(D.fetched.slice(0, 4)), 1900, D.years.length]);
  ok('the shipped data stays oldest first after a newest-first draw', D.years.every((y, i) => !i || D.years[i - 1].year < y.year));
}

console.log(`${fail ? 'FAILED' : 'ok'}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
