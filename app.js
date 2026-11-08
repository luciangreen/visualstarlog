// Visual Starlog (Lucian Office, Phase 9): presentations written in Prolog with Starlog syntax.
// Build slides here; Visual Starlog writes them as a Starlog file and runs it in SWI-Prolog
// with your Starlog library (as a LucianOS job). Slides can show Lucian Office documents,
// Counter tables and Etcher drawings, Prolog goals with their answers, open LucianOS apps,
// and have the RetroMR character speak.
import { api } from '/shared/api.js';
import { apply, characterHandler, deserialise, redo, serialise, undo } from './lib/core.js';
import { KINDS, addItem, addSlide, draftSlides, moveItem, moveSlide, newPresentation, parseRuntime, removeItem, removeSlide, setItem, setSlide, slideHTML, toStarlog, update } from './lib/present.js';
import { newVSDoc, presOf, presOps, vsCommands } from './lib/commands.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const { dataset, style, ...rest } = props;
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(rest)) if (k.startsWith('aria-')) n.setAttribute(k, v); else n[k] = v;
  Object.assign(n.dataset, dataset ?? {});
  if (style) n.style.cssText = style;
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
};
const say = (t) => { $('reply').textContent = t; };
const inFrame = parent !== window;

let doc = newVSDoc(newPresentation());
let current = 0;
let tab = 'slide';
let ran = null;        // the runtime's slides, for the presentation as it was run
let ranFor = '';       // the Starlog source they came from
let sourceProlog = ''; // the plain Prolog of the last run
let settings = { savePath: '', starlog: 'Dropbox/GitHub-private2/Starlog', vs: 'lucianos/apps/visualstarlog' };
const P = () => presOf(doc);
const persist = () => { api.state.set('visualstarlog', settings).catch(() => {}); api.state.set('visualstarlog-doc', doc).catch(() => {}); };
function change(p, label) { doc = apply(doc, presOps(p), { by: 'user', label }); persist(); render(); }

// The folder the presentation (and its documents, tables and drawings) lives in.
const folder = () => (settings.savePath ? settings.savePath.replace(/\/[^/]*$/, '') : `Documents/Visual Starlog/${(P().title || 'presentation').replace(/[^\w -]/g, '').trim() || 'presentation'}`);
const fromDir = (dir, p) => (p.startsWith('/') ? p : `${'../'.repeat(dir.split('/').filter(Boolean).length)}${p}`);
const slidesNow = () => (ran && ranFor === toStarlog(P()) ? ran.slides : draftSlides(P()));

// ------------------------------------------------------------------ running in SWI-Prolog
async function runtime(mode, ...more) {
  const dir = folder();
  await api.files.write(`${dir}/presentation.pl`, toStarlog(P()), { mkdirs: true, force: true });
  const job = await api.jobs.start({ cmd: 'swipl', cwd: dir, label: `Visual Starlog: ${mode}`, args: ['-q', '-g', 'vs_main', '-s', fromDir(dir, `${settings.vs}/prolog/vs_runtime.pl`), '--', mode, fromDir(dir, settings.starlog), 'presentation.pl', ...more] });
  return new Promise((resolve) => {
    let out = '', err = '';
    api.jobs.stream(job.id, { output: (c) => { if (c.stream === 'stderr') err += c.text; else out += c.text; }, end: (s) => resolve({ out, err, ok: s?.exitCode === 0 }) });
  });
}
async function run() {
  say('Running the presentation in SWI-Prolog with Starlog…');
  try {
    const r = await runtime('json');
    const deck = parseRuntime(r.out);
    if (!deck) { say(`It didn't run: ${(r.err || r.out).trim().slice(0, 400) || 'no output'}. Check the Starlog folder in Settings.`); return false; }
    ran = deck; ranFor = toStarlog(P());
    const errors = deck.slides.flatMap((s) => s.items.filter((i) => i.kind === 'error' || (i.kind === 'run' && !i.ok)).map((i) => `slide ${s.n}`));
    say(`Ran ${deck.slides.length} slide${deck.slides.length === 1 ? '' : 's'}${errors.length ? `; look at ${[...new Set(errors)].join(', ')}` : ''}.`);
    const pl = await runtime('prolog');
    sourceProlog = pl.ok ? pl.out : '';
    render();
    return true;
  } catch (err) { say(`Couldn't run it: ${err.message}`); return false; }
}

// ------------------------------------------------------------------ the slide list and editor
function render() {
  const p = P();
  $('title').value = p.title;
  current = Math.max(0, Math.min(p.slides.length - 1, current));
  $('list').replaceChildren(...p.slides.map((s, i) => el('li', {}, el('button', { type: 'button', className: i === current ? 'on' : '', onclick: () => { current = i; render(); } }, el('span', { className: 'n', textContent: String(i + 1) }), s.title || '(no title)'))));
  renderEditor();
  renderView();
}
const field = (label, control) => el('label', {}, label, control);
const btn = (text, onclick, props = {}) => el('button', { type: 'button', textContent: text, onclick, ...props });
function renderEditor() {
  const p = P(), s = p.slides[current];
  if (!s) { $('editor').replaceChildren(el('p', { className: 'note' }, 'No slides yet.'), btn('Add slide', () => $('addSlide').click())); return; }
  const i = current;
  const items = s.items.map((it, k) => {
    const set = (fields, label) => change(setItem(P(), i, k, fields), label);
    const kind = KINDS[it.kind] ?? KINDS.text;
    let body;
    if (it.kind === 'bullets') body = field('One point a line ({Name} shows a variable)', el('textarea', { value: (it.items ?? []).join('\n'), onchange: (e) => set({ items: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) }, 'edited points') }));
    else if (it.kind === 'run') body = field('A goal in Starlog or Prolog', el('textarea', { className: 'code', value: it.goal ?? '', placeholder: 'e.g. L is [1, 2] & [3]', onchange: (e) => set({ goal: e.target.value.trim() }, 'edited a goal') }));
    else if (it.kind === 'open') body = field('App', el('select', { onchange: (e) => set({ app: e.target.value }, 'chose an app') }, ['writer', 'counter', 'presenter', 'etcher', 'tabler', 'studio', 'moviemr', 'lucianoffice', 'iedit'].map((a) => el('option', { value: a, textContent: a, selected: a === it.app }))));
    else if (['doc', 'csv', 'svg', 'image'].includes(it.kind)) body = field(`File, from the presentation's folder (${folder()})`, el('input', { type: 'text', value: it.path ?? '', placeholder: { doc: 'plan.writer.json', csv: 'prices.csv', svg: 'flow.svg', image: 'photo.jpg' }[it.kind], onchange: (e) => set({ path: e.target.value.trim() }, 'chose a file') }));
    else body = field(it.kind === 'character' ? 'The character says' : 'Text ({Name} shows a variable from the slide\'s goals)', el('textarea', { value: it.text ?? '', onchange: (e) => set({ text: e.target.value }, 'edited text') }));
    return el('div', { className: 'item' },
      el('div', { className: 'row' }, el('b', {}, kind.label), el('span', { className: 'spacer', style: 'flex:1' }),
        btn('↑', () => change(moveItem(P(), i, k, k - 1), 'moved an item'), { disabled: !k, title: 'Up' }),
        btn('↓', () => change(moveItem(P(), i, k, k + 1), 'moved an item'), { disabled: k === s.items.length - 1, title: 'Down' }),
        btn('✕', () => change(removeItem(P(), i, k), 'removed an item'), { title: 'Remove' })),
      body);
  });
  const kindSel = el('select', { 'aria-label': 'Kind of item' }, Object.entries(KINDS).map(([k, v]) => el('option', { value: k, textContent: v.label })));
  $('editor').replaceChildren(
    field('Slide title', el('input', { type: 'text', value: s.title, onchange: (e) => change(setSlide(P(), i, { title: e.target.value }), 'renamed a slide') })),
    field('Goals that run first (Starlog or Prolog, one a line), e.g. Total is 12 * 4', el('textarea', { className: 'code', value: s.prolog ?? '', placeholder: 'Total is 12 * 4\nNames is ["Ann"] & ["Ben"]\nCount is Names >> length', onchange: (e) => change(setSlide(P(), i, { prolog: e.target.value }), 'edited the goals') })),
    ...items,
    el('div', { className: 'row' }, kindSel, btn('Add', () => { const k = kindSel.value; change(addItem(P(), i, { kind: k, ...(k === 'bullets' ? { items: [] } : k === 'run' ? { goal: '' } : k === 'open' ? { app: 'writer' } : ['doc', 'csv', 'svg', 'image'].includes(k) ? { path: '' } : { text: '' }) }), 'added an item'); })),
    el('div', { className: 'row' },
      btn('Move up', () => { change(moveSlide(P(), i, i - 1), 'moved a slide'); current = Math.max(0, i - 1); render(); }, { disabled: !i }),
      btn('Move down', () => { change(moveSlide(P(), i, i + 1), 'moved a slide'); current = Math.min(P().slides.length - 1, i + 1); render(); }, { disabled: i === p.slides.length - 1 }),
      btn('Delete slide', () => { if (confirm(`Delete slide ${i + 1}?`)) change(removeSlide(P(), i), 'deleted a slide'); })));
}

// ------------------------------------------------------------------ the preview, source and settings
const TABS = [['slide', 'Slide'], ['starlog', 'Starlog'], ['prolog', 'Prolog'], ['settings', 'Settings']];
const url = (path) => api.files.rawUrl(path.startsWith('/') ? path : `${folder()}/${path}`);
function renderView() {
  for (const b of $('tabs').children) b.classList.toggle('on', b.dataset.tab === tab);
  const v = $('view');
  if (tab === 'slide') {
    const slide = slidesNow()[current];
    const box = el('div', { className: 'slide' });
    box.innerHTML = slide ? slideHTML(slide, { url }) : '';
    wire(box);
    const stale = !(ran && ranFor === toStarlog(P()));
    v.replaceChildren(box, el('p', { className: 'note' }, stale ? 'Not run yet: {Name} values, goals, documents, tables and drawings appear when you press Run.' : 'As run in SWI-Prolog with Starlog.'));
  } else if (tab === 'starlog') {
    v.replaceChildren(el('p', { className: 'note' }, 'The presentation as Prolog with Starlog syntax (saved as presentation.pl in its folder).'), el('pre', { className: 'source', textContent: toStarlog(P()) }));
  } else if (tab === 'prolog') {
    v.replaceChildren(el('p', { className: 'note' }, "The same in plain Prolog, from Starlog's converter (after Run)."), el('pre', { className: 'source', textContent: sourceProlog || '(Press Run to see it.)' }));
  } else {
    v.replaceChildren(
      el('label', {}, 'Starlog folder (from your home folder)', el('input', { type: 'text', value: settings.starlog, onchange: (e) => { settings.starlog = e.target.value.trim(); persist(); } })),
      el('label', {}, 'Visual Starlog folder', el('input', { type: 'text', value: settings.vs, onchange: (e) => { settings.vs = e.target.value.trim(); persist(); } })),
      el('p', { className: 'note' }, `This presentation and its files are in ${folder()}. Put Writer documents (.writer.json), Counter tables (.csv) and Etcher drawings (.svg) there to show them.`));
  }
}
// Buttons that open apps; the character speaks when a slide is shown in the presentation.
function wire(box) {
  for (const b of box.querySelectorAll('button.open')) b.onclick = () => { if (inFrame) parent.postMessage({ type: 'lucianos.do', text: `open ${b.dataset.app}` }, location.origin); else window.open(`/apps/${b.dataset.app}/`, '_blank'); };
}

// ------------------------------------------------------------------ presenting
let showing = false;
function showSlide() {
  const slides = slidesNow();
  current = Math.max(0, Math.min(slides.length - 1, current));
  const slide = slides[current];
  const box = el('div', { className: 'slide' });
  box.innerHTML = slide ? slideHTML(slide, { url }) : '';
  wire(box);
  $('stage').replaceChildren(box);
  $('at').textContent = `${current + 1} / ${slides.length}`;
  const lines = slide ? slide.items.filter((i) => i.kind === 'character').map((i) => i.text) : [];
  if (lines.length && inFrame) parent.postMessage({ type: 'lucianos.say', text: lines.join(' ') }, location.origin);
}
async function present() {
  if (!(ran && ranFor === toStarlog(P()))) await run();
  showing = true;
  $('show').hidden = false;
  $('show').requestFullscreen?.().catch(() => {});
  showSlide();
}
function stopShow() { showing = false; $('show').hidden = true; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); render(); }

// ------------------------------------------------------------------ the character
const commands = vsCommands();
const ctx = { current: () => current, go: (i) => { current = i; if (showing) showSlide(); else render(); }, present: () => present() };
const handle = characterHandler(commands, () => doc, (d) => { doc = d; persist(); render(); }, ctx);
async function sayDo(text) {
  const reply = await handle({ intent: 'unknown', text }, text);
  say(reply ?? `I don't know how to do that in Visual Starlog. ${commands.help()}`);
}
$('say').addEventListener('submit', async (e) => { e.preventDefault(); await sayDo($('sayText').value); $('sayText').value = ''; });
addEventListener('message', async (e) => {
  if (e.origin !== location.origin || e.data?.type !== 'lucianos.command') return;
  const reply = await handle({ intent: 'unknown', text: e.data.text }, e.data.text);
  e.source.postMessage({ type: 'lucianos.reply', id: e.data.id, text: reply }, location.origin);
});
if (inFrame) parent.postMessage({ type: 'lucianos.commands', names: commands.list().map((c) => c.name) }, location.origin);

// ------------------------------------------------------------------ files
async function save() {
  const path = prompt('Save as (relative to your home folder)', settings.savePath || `${folder()}/presentation.vs.json`);
  if (!path) return;
  settings.savePath = path;
  await api.files.write(path, serialise(doc), { mkdirs: true, force: true });
  await api.files.write(`${folder()}/presentation.pl`, toStarlog(P()), { mkdirs: true, force: true });
  persist(); say(`Saved ${path}, with presentation.pl (Starlog) beside it.`);
}
async function open() {
  const path = prompt('Open which .vs.json file?', settings.savePath || '');
  if (!path) return;
  try { const d = deserialise((await api.files.read(path)).content); if (d.app !== 'visualstarlog') throw new Error('that is not a Visual Starlog file'); doc = d; settings.savePath = path; ran = null; current = 0; persist(); render(); } catch (err) { say(`Couldn't open it: ${err.message}`); }
}
async function exportAs(kind) {
  try {
    if (kind === 'pl') { const path = `${folder()}/presentation.pl`; await api.files.write(path, toStarlog(P()), { mkdirs: true, force: true }); say(`Wrote ${path} (Starlog).`); }
    else if (kind === 'html') { const r = await runtime('html', 'presentation.html'); say(r.ok ? `Wrote ${folder()}/presentation.html: open it in any browser (arrow keys move between slides).` : `It didn't run: ${(r.err || r.out).trim().slice(0, 300)}`); }
    else { const r = await runtime('prolog'); if (!r.ok) { say(`It didn't run: ${r.err.trim().slice(0, 300)}`); return; } const path = `${folder()}/presentation.prolog.pl`; await api.files.write(path, r.out, { mkdirs: true, force: true }); sourceProlog = r.out; say(`Wrote ${path} (plain Prolog).`); }
  } catch (err) { say(`Couldn't export: ${err.message}`); }
}

// ------------------------------------------------------------------ start
async function init() {
  settings = { ...settings, ...((await api.state.get('visualstarlog').catch(() => null)) ?? {}) };
  const d = await api.state.get('visualstarlog-doc').catch(() => null);
  if (d?.format === 'lucianoffice/1' && d.app === 'visualstarlog') doc = d;
  $('tabs').replaceChildren(...TABS.map(([id, name]) => el('button', { type: 'button', textContent: name, dataset: { tab: id }, onclick: () => { tab = id; renderView(); } })));
  $('addSlide').onclick = () => { const t = prompt('Slide title', 'New slide'); if (t !== null) { change(addSlide(P(), t.trim() || 'New slide', current + 1), 'added a slide'); current += 1; render(); } };
  $('title').onchange = () => { const v = $('title').value.trim() || 'My presentation'; doc = apply(doc, [...presOps(update(P(), (q) => { q.title = v; })), { op: 'title', value: v }], { by: 'user', label: 'renamed' }); persist(); render(); };
  $('undo').onclick = () => { doc = undo(doc).doc; persist(); render(); };
  $('redo').onclick = () => { doc = redo(doc).doc; persist(); render(); };
  $('new').onclick = () => { if (confirm('Start a new presentation? The current one stays saved if you saved it.')) { doc = newVSDoc(newPresentation()); ran = null; current = 0; settings.savePath = ''; persist(); render(); } };
  $('save').onclick = save;
  $('open').onclick = open;
  $('run').onclick = run;
  $('present').onclick = present;
  $('export').onchange = async (e) => { const k = e.target.value; e.target.value = ''; if (k) await exportAs(k); };
  $('prev').onclick = () => { current -= 1; showSlide(); };
  $('next').onclick = () => { current += 1; showSlide(); };
  $('stop').onclick = stopShow;
  addEventListener('keydown', (e) => {
    if (showing) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); current += 1; showSlide(); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); current -= 1; showSlide(); }
      if (e.key === 'Escape') stopShow();
      return;
    }
    if (e.target.closest?.('input, textarea, select')) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doc = (e.shiftKey ? redo(doc) : undo(doc)).doc; persist(); render(); }
  });
  render();
  const params = new URLSearchParams(location.search);
  if (params.get('do')) await sayDo(params.get('do'));
}
init();
