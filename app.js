import { search, emptyHint, authorLine, barFrac, fmt, workUrl, decadeOf, isPartial, asOf, encodeState, decodeState, yearLink, hashYear, ordered } from './poy-logic.js';

const $ = (id) => document.getElementById(id);
let D = null;
let MAX = 1;
const state = { domain: '', q: '', newest: false };

function workEl(w, big) {
  const frag = document.createDocumentFragment();
  const a = document.createElement('a');
  a.className = 't'; a.href = workUrl(w); a.target = '_blank'; a.rel = 'noopener';
  a.textContent = w.title;
  frag.append(a);
  const au = document.createElement('div');
  au.className = 'au';
  const line = authorLine(w, big ? 5 : 3);
  line.shown.forEach((p, i) => {
    if (i) au.append(i === line.shown.length - 1 && line.gap ? ' … ' : ', ');
    if (p.stanford) { const b = document.createElement('b'); b.textContent = p.name; au.append(b); }
    else au.append(p.name);
  });
  if (line.hidden > 0) au.append(` + ${fmt(line.hidden)}${line.truncated ? '+' : ''} more`);
  if (!line.shown.some((p) => p.stanford)) au.append(line.truncated ? ' (Stanford authors past the first 100 listed)' : ' (Stanford authors further down the list)');
  frag.append(au);
  const meta = document.createElement('div');
  meta.className = 'meta';
  const track = document.createElement('span'); track.className = 'track';
  const fill = document.createElement('span'); fill.className = 'fill';
  fill.style.width = `${(barFrac(w.cites, MAX) * 100).toFixed(1)}%`;
  track.append(fill);
  const c = document.createElement('span'); c.className = 'c'; c.textContent = `${fmt(w.cites)} citations`;
  const f = document.createElement('span'); f.textContent = [w.field, { book: 'book', 'conference-paper': 'conference paper' }[w.type]].filter(Boolean).join(' · ');
  meta.append(track, c, f);
  frag.append(meta);
  return frag;
}

function draw() {
  const rows = ordered(search(D.years, state.domain, state.q), state.newest);
  const ol = $('years');
  ol.replaceChildren();
  const label = state.domain ? D.domains[state.domain] : 'every field';
  $('status').textContent = state.q
    ? `${rows.length} ${rows.length === 1 ? 'year has' : 'years have'} a match for “${state.q}” in ${label}.`
    : `${rows.length} years, ${label}.`;
  if (state.newest && rows.length > 1) $('status').textContent = $('status').textContent.replace(/\.$/, ', newest first.');
  $('status').textContent += ` Citations as of ${asOf(D.fetched)}.`;
  if (!rows.length) {
    const li = document.createElement('li'); li.className = 'empty';
    const hint = emptyHint(D.years, state.domain, state.q, D.domains);
    li.append(hint.text);
    if (hint.action) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'wider'; b.textContent = hint.action.label;
      b.addEventListener('click', () => { state.domain = hint.action.domain; sync(); draw(); });
      li.append(' ', b);
    }
    ol.append(li);
  }
  for (const r of rows) {
    const li = document.createElement('li');
    li.id = `y${r.year}`;
    const y = document.createElement('div'); y.className = 'yr';
    const yl = document.createElement('a'); yl.href = yearLink(D.years, r.year, state.domain); yl.textContent = r.year;
    yl.title = `Link to ${r.year}`;
    y.append(yl);
    const sm = document.createElement('small');
    sm.textContent = isPartial(r.year, D.fetched) ? `so far, of ${fmt(r.count)}` : `of ${fmt(r.count)}`;
    sm.title = `${fmt(r.count)} Stanford works that year in OpenAlex${state.domain ? `, ${D.domains[state.domain]}` : ''}`;
    y.append(sm);
    const sh = document.createElement('button'); sh.type = 'button'; sh.className = 'share'; sh.textContent = 'Share';
    sh.setAttribute('aria-label', `Share ${r.year}`);
    sh.addEventListener('click', () => share(r, sh));
    y.append(sh);
    const body = document.createElement('div');
    body.append(workEl(r.works[0], true));
    if (r.works.length > 1) {
      const det = document.createElement('details'); det.className = 'ru';
      const s = document.createElement('summary'); s.textContent = `Runners-up (${r.works.length - 1})`;
      const list = document.createElement('ol'); list.start = 2;
      for (const w of r.works.slice(1)) { const it = document.createElement('li'); it.append(workEl(w, false)); list.append(it); }
      det.append(s, list); body.append(det);
    }
    li.append(y, body);
    ol.append(li);
  }
  mark();
  const jump = $('jump');
  const decades = [...new Set(rows.map((r) => decadeOf(r.year)))];
  jump.replaceChildren(new Option('Decade', ''), ...decades.map((d) => new Option(`${d}s`, String(d))));
}

// The row a #y1998 link points at is outlined; :target is not used because the rows are
// drawn after the fragment is read.
function mark() {
  const y = hashYear(location.hash);
  for (const li of document.querySelectorAll('#years > li.hit')) li.classList.remove('hit');
  if (y) document.getElementById(`y${y}`)?.classList.add('hit');
}

async function share(r, btn) {
  const url = new URL(yearLink(D.years, r.year, state.domain), location.href).href;
  const title = `${r.year}: ${r.works[0].title}`;
  if (navigator.share) {
    try { await navigator.share({ title: `Paper of the Year · ${title}`, url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); btn.textContent = 'Copied'; }
  catch { prompt('Copy this link', url); return; }
  setTimeout(() => { btn.textContent = 'Share'; }, 1600);
}

// keepHash on the first call only: replacing the address drops #y1998, which is how a
// shared link was losing its year before the page could scroll to it.
function sync(keepHash = false) {
  history.replaceState(null, '', location.pathname + encodeState(state) + (keepHash ? location.hash : ''));
  for (const b of document.querySelectorAll('#fields button')) b.setAttribute('aria-pressed', String(b.dataset.d === state.domain));
  if ($('q').value !== state.q) $('q').value = state.q;
  $('order').setAttribute('aria-pressed', String(state.newest));
}

async function main() {
  try { D = await (await fetch('data/years.json')).json(); }
  catch { $('status').textContent = 'Could not load the data. Try reloading.'; return; }
  MAX = Math.max(...D.years.flatMap((y) => [...y.top, ...Object.values(y.domains).flat()].map((w) => w.cites)));
  $('redated').textContent = Object.values(D.redated).join('; ');
  $('autodated').textContent = (D.dropped['redated (cited before its year)'] || []).map(([y, , t]) => `${t}, under ${y}`).join('; ') || 'none this fetch';
  const ul = $('fields');
  for (const [d, name] of [['', 'Every field'], ...Object.entries(D.domains)]) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.d = d; b.textContent = name;
    b.addEventListener('click', () => { state.domain = d; sync(); draw(); });
    li.append(b); ul.append(li);
  }
  Object.assign(state, decodeState(location.search));
  sync(true); draw();
  let t;
  $('q').addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = $('q').value.slice(0, 80); sync(); draw(); }, 150);
  });
  // Flipping the order deep in the list would leave the reader at a random year: start over
  // at the top of the list, under the sticky bar.
  $('order').addEventListener('click', () => {
    state.newest = !state.newest; sync(); draw();
    if (window.scrollY > $('years').offsetTop) $('years').firstElementChild?.scrollIntoView({ block: 'start' });
  });
  $('jump').addEventListener('change', (e) => {
    const d = e.target.value;
    if (!d) return;
    const first = [...document.querySelectorAll('#years > li[id]')].find((li) => decadeOf(+li.id.slice(1)) === +d);
    if (first) first.scrollIntoView({ block: 'start' });
    e.target.value = '';
  });
  const bar = document.querySelector('.bar-top');
  const barH = () => document.documentElement.style.setProperty('--bar-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
  barH(); new ResizeObserver(barH).observe(bar);
  const go = () => { const y = hashYear(location.hash); mark(); if (y) document.getElementById(`y${y}`)?.scrollIntoView({ block: 'start' }); };
  window.addEventListener('hashchange', go);
  go();
}

main();
