import { search, authorLine, barFrac, fmt, workUrl, decadeOf, encodeState, decodeState } from './poy-logic.js';

const $ = (id) => document.getElementById(id);
let D = null;
let MAX = 1;
const state = { domain: '', q: '' };

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
  if (!line.shown.some((p) => p.stanford)) au.append(' (Stanford authors further down the list)');
  frag.append(au);
  const meta = document.createElement('div');
  meta.className = 'meta';
  const track = document.createElement('span'); track.className = 'track';
  const fill = document.createElement('span'); fill.className = 'fill';
  fill.style.width = `${(barFrac(w.cites, MAX) * 100).toFixed(1)}%`;
  track.append(fill);
  const c = document.createElement('span'); c.className = 'c'; c.textContent = `${fmt(w.cites)} citations`;
  const f = document.createElement('span'); f.textContent = [w.field, w.type === 'book' ? 'book' : null].filter(Boolean).join(' · ');
  meta.append(track, c, f);
  frag.append(meta);
  return frag;
}

function draw() {
  const rows = search(D.years, state.domain, state.q);
  const ol = $('years');
  ol.replaceChildren();
  const label = state.domain ? D.domains[state.domain] : 'every field';
  $('status').textContent = state.q
    ? `${rows.length} ${rows.length === 1 ? 'year has' : 'years have'} a match for “${state.q}” in ${label}.`
    : `${rows.length} years, ${label}.`;
  if (!rows.length) {
    const li = document.createElement('li'); li.className = 'empty';
    li.textContent = 'Nothing matches. Try fewer words, or every field.';
    ol.append(li);
  }
  for (const r of rows) {
    const li = document.createElement('li');
    li.id = `y${r.year}`;
    const y = document.createElement('div'); y.className = 'yr'; y.textContent = r.year;
    const sm = document.createElement('small'); sm.textContent = `of ${fmt(r.count)}`;
    sm.title = `${fmt(r.count)} Stanford works that year in OpenAlex${state.domain ? `, ${D.domains[state.domain]}` : ''}`;
    y.append(sm);
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
  const jump = $('jump');
  const decades = [...new Set(rows.map((r) => decadeOf(r.year)))];
  jump.replaceChildren(new Option('Decade', ''), ...decades.map((d) => new Option(`${d}s`, String(d))));
}

function sync() {
  history.replaceState(null, '', location.pathname + encodeState(state));
  for (const b of document.querySelectorAll('#fields button')) b.setAttribute('aria-pressed', String(b.dataset.d === state.domain));
  if ($('q').value !== state.q) $('q').value = state.q;
}

async function main() {
  try { D = await (await fetch('data/years.json')).json(); }
  catch { $('status').textContent = 'Could not load the data. Try reloading.'; return; }
  MAX = Math.max(...D.years.flatMap((y) => [...y.top, ...Object.values(y.domains).flat()].map((w) => w.cites)));
  $('redated').textContent = Object.values(D.redated).join('; ');
  const ul = $('fields');
  for (const [d, name] of [['', 'Every field'], ...Object.entries(D.domains)]) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.d = d; b.textContent = name;
    b.addEventListener('click', () => { state.domain = d; sync(); draw(); });
    li.append(b); ul.append(li);
  }
  Object.assign(state, decodeState(location.search));
  sync(); draw();
  let t;
  $('q').addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = $('q').value.slice(0, 80); sync(); draw(); }, 150);
  });
  $('jump').addEventListener('change', (e) => {
    const d = e.target.value;
    if (!d) return;
    const first = [...document.querySelectorAll('#years > li[id]')].find((li) => decadeOf(+li.id.slice(1)) === +d);
    if (first) first.scrollIntoView({ block: 'start' });
    e.target.value = '';
  });
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ block: 'start' });
}

main();
