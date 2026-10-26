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

// --- bar, urls, state -------------------------------------------------------------------
eq('bar of the max is 1', L.barFrac(46778, 46778), 1);
eq('bar of zero is 0', L.barFrac(0, 46778), 0);
ok('bar is log scale: 177 of 46,778 is visible', L.barFrac(177, 46778) > 0.4);
ok('bar is monotonic', L.barFrac(100, 1000) < L.barFrac(200, 1000));
eq('doi preferred', L.workUrl({ id: 'W1', doi: 'https://doi.org/10.1/x' }), 'https://doi.org/10.1/x');
eq('openalex fallback', L.workUrl({ id: 'W1', doi: null }), 'https://openalex.org/W1');
eq('decade', [L.decadeOf(1979), L.decadeOf(1980), L.decadeOf(2025)], [1970, 1980, 2020]);
eq('state encodes', L.encodeState({ domain: '3', q: ' crypto ' }), '?f=3&q=crypto');
eq('empty state', L.encodeState({ domain: '', q: '' }), '');
eq('state round-trips', L.decodeState(L.encodeState({ domain: '4', q: 'a b' })), { domain: '4', q: 'a b' });
eq('bad field falls back', L.decodeState('?f=9').domain, '');

// --- the shipped data -------------------------------------------------------------------
const here = fileURLToPath(new URL('.', import.meta.url));
const D = JSON.parse(readFileSync(here + 'data/years.json', 'utf8'));
const Y = new Map(D.years.map((y) => [y.year, y]));
eq('every year 1900-2025', D.years.map((y) => y.year), Array.from({ length: 126 }, (_, i) => 1900 + i));
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
// Positive controls: the famous ones are still there.
ok('1976 has Diffie-Hellman', Y.get(1976).top.some((x) => /new directions in cryptography/i.test(x.title)));
ok('1998 has the Brin-Page search engine paper', Y.get(1998).top.some((x) => /hypertextual web search engine/i.test(x.title)));
ok('1979 is the bootstrap', /bootstrap/i.test(Y.get(1979).top[0].title));
ok('the Physical Sciences list exists for 1957', (Y.get(1957).domains['3'] || []).length >= 1);

console.log(`${fail ? 'FAILED' : 'ok'}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
