// Visual Starlog presentations. You build slides visually; Visual Starlog writes them as a
// Prolog file in Starlog syntax (Result is function(Args): "a":"b" joins text, [1]&[2] joins
// lists, X is reverse(L) >> length chains), and the runtime (prolog/vs_runtime.pl) runs it in
// SWI-Prolog with your Starlog library, giving the slides back as data, HTML or plain Prolog.
//
// Text in items can show a variable from the slide's goals with {Name}: "We have {Total}
// students" becomes  T1 is "We have " : Total : " students"  in the slide's rule.

export const KINDS = {
  text: { label: 'Text', field: 'text' },
  heading: { label: 'Heading', field: 'text' },
  bullets: { label: 'Bullet points', field: 'items' },
  quote: { label: 'Quote', field: 'text' },
  run: { label: 'Prolog goal (shows Starlog, Prolog and the answer)', field: 'goal' },
  character: { label: 'The character says', field: 'text' },
  open: { label: 'Open a LucianOS app', field: 'app' },
  doc: { label: 'Lucian Office document', field: 'path' },
  csv: { label: 'Table (CSV, e.g. from Counter)', field: 'path' },
  svg: { label: 'Drawing (SVG, e.g. from Etcher)', field: 'path' },
  image: { label: 'Picture', field: 'path' }
};

export function newPresentation(title = 'My presentation') {
  return {
    title,
    slides: [
      { title: 'Welcome', prolog: '', items: [{ kind: 'text', text: 'A presentation written in Prolog, with Starlog.' }, { kind: 'character', text: 'Hello! Press the right arrow to go on.' }] },
      { title: 'Starlog does the sums', prolog: 'Total is 12 * 4,\nNames is ["Ann"] & ["Ben", "Cal"],\nCount is Names >> length', items: [{ kind: 'text', text: '{Count} people, {Total} lessons.' }, { kind: 'run', goal: 'Greeting is "Hello" : " " : "World"' }] }
    ]
  };
}

// A Prolog double-quoted string.
export const pString = (s) => `"${String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
const VAR = /^[A-Z_][A-Za-z0-9_]*$/;

// "We have {Total} students" -> { expr: '"We have " : Total : " students"', vars: ['Total'] },
// or a plain string when there is no {Name} in it.
export function textExpr(text) {
  const parts = [];
  const vars = [];
  let rest = String(text ?? '');
  const re = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
  let m, last = 0;
  while ((m = re.exec(rest))) {
    if (!VAR.test(m[1])) continue;
    if (m.index > last) parts.push(pString(rest.slice(last, m.index)));
    parts.push(m[1]); vars.push(m[1]);
    last = m.index + m[0].length;
  }
  if (!vars.length) return { expr: pString(rest), vars };
  if (last < rest.length) parts.push(pString(rest.slice(last)));
  // a variable on its own still needs to become text
  if (parts.length === 1) parts.unshift('""');
  return { expr: parts.join(' : '), vars };
}

// The slide's own goals: lines with commas between them (a final full stop is dropped).
export function goalsOf(prolog) {
  const text = String(prolog ?? '').trim().replace(/\.\s*$/, '');
  if (!text) return [];
  return text.split(/,\s*\n|\n/).map((g) => g.trim().replace(/,$/, '')).filter((g) => g && !g.startsWith('%'));
}

// The whole presentation as a Prolog file in Starlog syntax.
export function toStarlog(p) {
  const out = ['% Made with Visual Starlog (Lucian Office). Starlog syntax: Result is function(Args);', '% "a":"b" joins text, [1]&[2] joins lists, L >> length chains. Runs with prolog/vs_runtime.pl.', '', `title(${pString(p.title)}).`, ''];
  p.slides.forEach((s, i) => {
    const goals = [...goalsOf(s.prolog)];
    let n = 0;
    const fresh = () => `T${++n}`;
    const text = (t) => { const e = textExpr(t); if (!e.vars.length) return e.expr; const v = fresh(); goals.push(`${v} is ${e.expr}`); return v; };
    const items = s.items.map((it) => {
      switch (it.kind) {
        case 'bullets': return `bullets([${(it.items ?? []).map(text).join(', ')}])`;
        case 'run': return `run(${pString(it.goal)})`;
        case 'open': return `open(${pString(it.app)})`;
        case 'doc': case 'csv': case 'svg': case 'image': return `${it.kind}(${pString(it.path)})`;
        default: return `${KINDS[it.kind] ? it.kind : 'text'}(${text(it.text)})`;
      }
    });
    const list = `[${items.join(',\n        ')}]`;
    if (!goals.length) out.push(`slide(${i + 1}, ${pString(s.title)}, ${list}).`, '');
    else out.push(`slide(${i + 1}, ${pString(s.title)}, Items) :-`, ...goals.map((g) => `    ${g},`), `    Items = ${list}.`, '');
  });
  return out.join('\n');
}

// The runtime's JSON (the last line that is a JSON object).
export function parseRuntime(text) {
  const line = String(text ?? '').split('\n').reverse().find((l) => l.trim().startsWith('{'));
  if (!line) return null;
  try { return JSON.parse(line); } catch { return null; }
}

// Slides as data without running Prolog: what the app shows before (or without) the runtime.
// {Name} stays as written, and goals show "run to see the answer".
export function draftSlides(p) {
  return p.slides.map((s, i) => ({
    n: i + 1, title: s.title, draft: true,
    items: s.items.map((it) => {
      if (it.kind === 'bullets') return { kind: 'bullets', items: it.items ?? [] };
      if (it.kind === 'run') return { kind: 'run', starlog: it.goal, prolog: '', answers: ['(run the presentation to see the answer)'], ok: true };
      if (it.kind === 'open') return { kind: 'open', app: it.app };
      if (['doc', 'csv', 'svg', 'image'].includes(it.kind)) return { kind: it.kind === 'csv' ? 'table-draft' : `${it.kind}-draft`, path: it.path };
      return { kind: it.kind, text: it.text };
    })
  }));
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// An SVG drawing, kept to its drawing (no scripts, no event handlers, no outside links).
export const safeSVG = (svg) => String(svg ?? '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');

// One slide as HTML for the app. url(path) gives a picture's address.
export function slideHTML(slide, { url = (p) => p } = {}) {
  const items = slide.items.map((it) => {
    switch (it.kind) {
      case 'text': return `<p>${esc(it.text)}</p>`;
      case 'heading': return `<h2>${esc(it.text)}</h2>`;
      case 'quote': return `<blockquote>${esc(it.text)}</blockquote>`;
      case 'error': return `<p class="err">${esc(it.text)}</p>`;
      case 'bullets': return `<ul>${it.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
      case 'character': return `<div class="say" data-say="${esc(it.text)}"><span class="face" aria-hidden="true">🙂</span><span class="bubble">${esc(it.text)}</span></div>`;
      case 'open': return `<p><button type="button" class="open" data-app="${esc(it.app)}">Open ${esc(it.app)}</button></p>`;
      case 'image': return `<p><img src="${esc(url(it.path))}" alt=""></p>`;
      case 'svg': return `<div class="svg">${safeSVG(it.svg)}</div>`;
      case 'run': return `<div class="run"><pre class="starlog">${esc(it.starlog)}</pre>${it.prolog ? `<pre class="prolog"><span>in Prolog</span>\n${esc(it.prolog)}</pre>` : ''}${it.answers.map((a) => `<p class="${it.ok ? 'ans' : 'bad'}">${esc(a)}</p>`).join('')}</div>`;
      case 'doc': return `<div class="doc"><h3>${esc(it.title || it.path)}</h3>${it.blocks.map((b) => (b.type === 'heading' ? `<h4>${esc(b.text)}</h4>` : b.type === 'inspiration' ? `<blockquote>${esc(b.text)}</blockquote>` : `<p>${esc(b.text)}</p>`)).join('')}</div>`;
      case 'table': return `<table>${it.rows.map((r, i) => `<tr>${r.map((c) => (i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`)).join('')}</tr>`).join('')}</table>`;
      default: return `<p class="draft">${esc(it.kind.replace('-draft', ''))}: ${esc(it.path ?? it.text ?? '')} <em>(run to show it)</em></p>`;
    }
  });
  return `<h1>${esc(slide.title)}</h1>${items.join('')}`;
}

// ---------------------------------------------------------------- changes (pure)
const copy = (x) => JSON.parse(JSON.stringify(x));
export function update(p, f) { const q = copy(p); f(q); return q; }
export const addSlide = (p, title, at = p.slides.length) => update(p, (q) => q.slides.splice(at, 0, { title, prolog: '', items: [] }));
export const removeSlide = (p, i) => update(p, (q) => q.slides.splice(i, 1));
export const moveSlide = (p, i, to) => update(p, (q) => { const [s] = q.slides.splice(i, 1); q.slides.splice(Math.max(0, Math.min(q.slides.length, to)), 0, s); });
export const addItem = (p, i, item) => update(p, (q) => q.slides[i]?.items.push(item));
export const setItem = (p, i, k, fields) => update(p, (q) => Object.assign(q.slides[i].items[k], fields));
export const removeItem = (p, i, k) => update(p, (q) => q.slides[i].items.splice(k, 1));
export const moveItem = (p, i, k, to) => update(p, (q) => { const its = q.slides[i].items; const [x] = its.splice(k, 1); its.splice(Math.max(0, Math.min(its.length, to)), 0, x); });
export const setSlide = (p, i, fields) => update(p, (q) => Object.assign(q.slides[i], fields));
