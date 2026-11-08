// Visual Starlog as a Lucian Office document (data.presentation), so each change is one
// undoable step, and the character's commands.
import { createCommands, createDocument } from './core.js';
import { addItem, addSlide, removeSlide, update } from './present.js';

export const newVSDoc = (presentation) => createDocument({ app: 'visualstarlog', title: presentation.title, data: { presentation } });
export const presOf = (doc) => doc.data.presentation;
export const presOps = (p) => [{ op: 'data', key: 'presentation', value: p }];

const clean = (s) => String(s ?? '').trim().replace(/^["“']|["”']$/g, '').replace(/[.!]$/, '').trim();
// "slide 2", "the second slide", "this slide", "the last slide"
const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
export function slideIndex(p, phrase, current = 0) {
  const s = clean(phrase).toLowerCase().replace(/^the\s+/, '').replace(/\s+slide$/, '').replace(/^slide\s+/, '');
  if (/^(this|it|current)$/.test(s)) return current;
  if (s === 'last') return p.slides.length - 1;
  const n = ORD[s] ?? Number(s);
  return n >= 1 && n <= p.slides.length ? n - 1 : -1;
}

export function vsCommands() {
  const reg = createCommands({ app: 'Visual Starlog' });
  const at = (doc, phrase, ctx) => slideIndex(presOf(doc), phrase, ctx.current?.() ?? 0);
  const noSlide = (phrase) => ({ ops: [], say: `There's no ${clean(phrase)}.` });
  const split = (rest) => /^(.+?)\s*:\s*(.+)$/.exec(rest);
  reg
    .register({ name: 'add slide', patterns: ['add a slide called {title}', 'add a slide {title}', 'new slide {title}'], help: 'add a slide called Prices',
      run: ({ args, doc }) => { const p = addSlide(presOf(doc), clean(args.title)); return { ops: presOps(p), say: `Added slide ${p.slides.length}, ${clean(args.title)}.` }; } })
    .register({ name: 'delete slide', patterns: ['delete {slide}', 'remove {slide}'], help: 'delete slide 3',
      run: ({ args, doc, ctx }) => { if (!/slide/i.test(args.slide)) return { ops: [], say: 'Say which slide, e.g. "delete slide 3".' }; const i = at(doc, args.slide, ctx); if (i < 0) return noSlide(args.slide); return { ops: presOps(removeSlide(presOf(doc), i)), say: `Deleted slide ${i + 1}.` }; } })
    .register({ name: 'add point', patterns: ['add a point to {rest}', 'add a bullet to {rest}'], help: 'add a point to slide 2: ten minutes a day',
      run: ({ args, doc, ctx }) => {
        const m = split(args.rest); if (!m) return { ops: [], say: 'Say it like "add a point to slide 2: ten minutes a day".' };
        const i = at(doc, m[1], ctx); if (i < 0) return noSlide(m[1]);
        const p = presOf(doc); const items = p.slides[i].items;
        const last = items.at(-1);
        const next = last?.kind === 'bullets' ? update(p, (q) => q.slides[i].items.at(-1).items.push(clean(m[2]))) : addItem(p, i, { kind: 'bullets', items: [clean(m[2])] });
        return { ops: presOps(next), say: `Added a point to slide ${i + 1}.` };
      } })
    .register({ name: 'add text', patterns: ['add text to {rest}', 'write on {rest}'], help: 'add text to slide 1: welcome',
      run: ({ args, doc, ctx }) => { const m = split(args.rest); if (!m) return { ops: [], say: 'Say it like "add text to slide 1: welcome".' }; const i = at(doc, m[1], ctx); if (i < 0) return noSlide(m[1]); return { ops: presOps(addItem(presOf(doc), i, { kind: 'text', text: clean(m[2]) })), say: `Added text to slide ${i + 1}.` }; } })
    .register({ name: 'character says', patterns: ['say on {rest}', 'have the character say on {rest}'], help: 'say on slide 2: here are the prices',
      run: ({ args, doc, ctx }) => { const m = split(args.rest); if (!m) return { ops: [], say: 'Say it like "say on slide 2: here are the prices".' }; const i = at(doc, m[1], ctx); if (i < 0) return noSlide(m[1]); return { ops: presOps(addItem(presOf(doc), i, { kind: 'character', text: clean(m[2]) })), say: `On slide ${i + 1} I'll say: ${clean(m[2])}` }; } })
    .register({ name: 'add goal', patterns: ['add a goal to {rest}', 'add a calculation to {rest}', 'show the goal on {rest}'], help: 'add a goal to slide 2: X is [1] & [2]',
      run: ({ args, doc, ctx }) => { const m = split(args.rest); if (!m) return { ops: [], say: 'Say it like "add a goal to slide 2: X is [1] & [2]".' }; const i = at(doc, m[1], ctx); if (i < 0) return noSlide(m[1]); return { ops: presOps(addItem(presOf(doc), i, { kind: 'run', goal: clean(m[2]) })), say: `Slide ${i + 1} will show ${clean(m[2])}, in Prolog, and its answer.` }; } })
    .register({ name: 'title', patterns: ['set the title to {title}', 'call it {title}'], help: 'set the title to Our course',
      run: ({ args, doc }) => ({ ops: [...presOps(update(presOf(doc), (q) => { q.title = clean(args.title); })), { op: 'title', value: clean(args.title) }], say: `The presentation is called ${clean(args.title)}.` }) })
    .register({ name: 'go to slide', patterns: ['go to {slide}', 'show {slide}'], help: 'go to slide 3',
      run: ({ args, doc, ctx }) => { const i = at(doc, args.slide, ctx); if (i < 0) return noSlide(args.slide); ctx.go?.(i); return { ops: [], say: `Slide ${i + 1}: ${presOf(doc).slides[i].title}.` }; } })
    .register({ name: 'next slide', patterns: ['next slide', 'next', 'go on'], help: 'next slide',
      run: ({ doc, ctx }) => { const i = Math.min(presOf(doc).slides.length - 1, (ctx.current?.() ?? 0) + 1); ctx.go?.(i); return { ops: [], say: `Slide ${i + 1}: ${presOf(doc).slides[i].title}.` }; } })
    .register({ name: 'previous slide', patterns: ['previous slide', 'back', 'go back'], help: 'previous slide',
      run: ({ doc, ctx }) => { const i = Math.max(0, (ctx.current?.() ?? 0) - 1); ctx.go?.(i); return { ops: [], say: `Slide ${i + 1}: ${presOf(doc).slides[i].title}.` }; } })
    .register({ name: 'present', patterns: ['present', 'present it', 'start the presentation'], help: 'present',
      run: ({ ctx }) => { ctx.present?.(); return { ops: [], say: 'Presenting. Use the arrow keys; Escape to stop.' }; } });
  return reg;
}
